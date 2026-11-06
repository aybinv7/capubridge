import { computed, markRaw, ref, shallowRef, watch, type WatchStopHandle } from "vue";
import { defineStore } from "pinia";
import {
  attachConsoleTargetEffect,
  detachConsoleTargetEffect,
  runSessionEffect,
} from "@/runtime/session";
import { useConnectionStore } from "@/stores/connection.store";
import { useDockStore } from "@/stores/dock.store";
import { useTargetsStore } from "@/stores/targets.store";
import { createFrameBatcher } from "@/lib/frame-batcher";
import { createConsoleBuffer } from "@/lib/console/consoleBuffer";
import { formatTimestamp, isRecord } from "@/lib/console/consoleFormat";
import { STREAM_CAPS } from "@/lib/stream-caps";
import { withTimeout } from "@/lib/with-timeout";
import type { CDPTarget } from "@/types/cdp.types";
import type {
  ConsoleArg,
  ConsoleEntry,
  ConsoleExceptionEntry,
  ReplHistoryEntry,
} from "@/types/console.types";
import { parseRemoteValue } from "@/lib/console-parse";
import {
  buildId,
  exceptionEntry,
  logEventEntry,
  runtimeConsoleEntry,
  type ConsoleEventContext,
} from "@/lib/console/consoleEvents";

const maxReplEntries = 80;
const replTimeoutMs = 30_000;
const initialRetryDelay = 500;
const maximumRetryDelay = 8_000;

type ClientCleanup = () => void;
type ConsoleCaptureStatus = "idle" | "connecting" | "live" | "error";

function trimList<T>(items: T[], maxItems: number): T[] {
  return items.length > maxItems ? items.slice(items.length - maxItems) : items;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useConsoleStore = defineStore("console", () => {
  const connectionStore = useConnectionStore();
  const targetsStore = useTargetsStore();
  const dockStore = useDockStore();

  const buffer = markRaw(createConsoleBuffer());
  const entryVersion = shallowRef(0);
  const exceptionVersion = shallowRef(0);
  const levelCounts = shallowRef(buffer.counts());
  const entries = computed<ConsoleEntry[]>(() => {
    void entryVersion.value;
    return buffer.entries.toArray();
  });
  const exceptions = computed<ConsoleExceptionEntry[]>(() => {
    void exceptionVersion.value;
    return buffer.exceptions.toArray();
  });
  const exceptionCount = computed(() => {
    void exceptionVersion.value;
    return buffer.exceptions.size;
  });
  const replHistory = ref<ReplHistoryEntry[]>([]);
  const boundTargetId = ref<string | null>(null);
  const leasedTargetId = ref<string | null>(null);
  const leasedSerial = ref<string | null>(null);
  const leaseConsumers = ref(0);
  const isReady = ref(false);
  const error = ref<string | null>(null);
  const captureStatus = ref<ConsoleCaptureStatus>("idle");

  const activeTarget = computed(() => targetsStore.selectedTarget);
  const activeTargetLabel = computed(
    () => activeTarget.value?.packageName ?? activeTarget.value?.title ?? "No active target",
  );

  let initializePromise: Promise<void> | null = null;
  let stopWatchHandle: WatchStopHandle | null = null;
  let clientCleanups: ClientCleanup[] = [];

  let idCounter = 0;
  let bindingPromise: Promise<void> | null = null;
  let bindingTargetId: string | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = initialRetryDelay;
  const pendingGroups = new Map<string, ConsoleEntry>();
  const eventContext: ConsoleEventContext = {
    nextSeq: () => ++idCounter,
    groupStack: [],
    findGroup: (id) => pendingGroups.get(id) ?? buffer.findGroup(id),
  };

  /** Appends a batch to the console ring and tells subscribers. Exposed for measurement. */
  function flushEntries(batch: readonly ConsoleEntry[]) {
    buffer.appendEntries(batch);
    pendingGroups.clear();
    entryVersion.value += 1;
    levelCounts.value = buffer.counts();
    maybeMarkConsoleUnread();
  }

  const entryBatcher = createFrameBatcher<ConsoleEntry>(flushEntries, STREAM_CAPS.console);

  const exceptionBatcher = createFrameBatcher<ConsoleExceptionEntry>((batch) => {
    buffer.appendExceptions(batch);
    exceptionVersion.value += 1;
    maybeMarkExceptionsUnread();
  }, STREAM_CAPS.exceptions);

  function clearRetry() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function clearClientBindings() {
    clientCleanups.forEach((cleanup) => cleanup());
    clientCleanups = [];
  }

  function clearConsole() {
    entryBatcher.clear();
    pendingGroups.clear();
    buffer.clearEntries();
    entryVersion.value += 1;
    levelCounts.value = buffer.counts();
    eventContext.groupStack.length = 0;
  }

  function clearExceptions() {
    exceptionBatcher.clear();
    buffer.clearExceptions();
    exceptionVersion.value += 1;
  }

  function resetTargetState(targetId: string | null) {
    clearRetry();
    retryDelay = initialRetryDelay;
    boundTargetId.value = targetId;
    clearConsole();
    clearExceptions();
    replHistory.value = [];
    error.value = null;
    captureStatus.value = targetId ? "connecting" : "idle";
  }

  function clearReplHistory() {
    replHistory.value = [];
  }

  function maybeMarkConsoleUnread() {
    dockStore.markUnread("console");
  }

  function maybeMarkExceptionsUnread() {
    dockStore.markUnread("exceptions");
  }

  function pushConsoleEntry(entry: ConsoleEntry) {
    if (!entry.isGroup) {
      const lastEntry = entryBatcher.last() ?? buffer.entries.last();
      if (
        lastEntry &&
        lastEntry.origin === entry.origin &&
        lastEntry.level === entry.level &&
        lastEntry.source === entry.source &&
        lastEntry.message === entry.message &&
        lastEntry.parentId === entry.parentId &&
        Math.abs(lastEntry.timestamp - entry.timestamp) < 250
      ) {
        return;
      }
    } else {
      pendingGroups.set(entry.id, entry);
    }

    entryBatcher.push(entry);
  }

  function pushException(entry: ConsoleExceptionEntry) {
    exceptionBatcher.push(entry);
  }

  function pushReplEntry(entry: ReplHistoryEntry) {
    replHistory.value = trimList([...replHistory.value, entry], maxReplEntries);
  }

  function handleRuntimeConsole(targetId: string, payload: unknown) {
    const entry = runtimeConsoleEntry(targetId, payload, eventContext);
    if (entry) {
      pushConsoleEntry(entry);
    }
  }

  function handleLogEntry(targetId: string, payload: unknown) {
    pushConsoleEntry(logEventEntry(targetId, payload, eventContext));
  }

  function handleRuntimeException(targetId: string, payload: unknown) {
    pushException(exceptionEntry(targetId, payload, () => ++idCounter));
  }

  function findTarget(targetId: string): CDPTarget | null {
    const selectedTarget = targetsStore.selectedTarget;
    return (
      targetsStore.targets.find((target) => target.id === targetId) ??
      (selectedTarget?.id === targetId ? selectedTarget : null)
    );
  }

  function scheduleRetry(targetId: string) {
    clearRetry();
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (leasedTargetId.value === targetId && leaseConsumers.value > 0) {
        void bindLeasedClient();
      }
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, maximumRetryDelay);
  }

  async function bindLeasedClientInternal() {
    const targetId = leasedTargetId.value;
    if (targetId !== boundTargetId.value) {
      resetTargetState(targetId);
    }

    clearClientBindings();

    if (!targetId) {
      captureStatus.value = "idle";
      return;
    }

    const target = findTarget(targetId);
    if (!target) {
      error.value = "No active target metadata";
      captureStatus.value = "error";
      return;
    }

    captureStatus.value = "connecting";
    let client = connectionStore.getClient(targetId);
    if (!client) {
      try {
        client = await connectionStore.connect(target);
      } catch (err) {
        if (leasedTargetId.value !== targetId) return;
        error.value = err instanceof Error ? err.message : String(err);
        captureStatus.value = "error";
        scheduleRetry(targetId);
        return;
      }
    }

    if (!client || leasedTargetId.value !== targetId) {
      return;
    }

    const nextCleanups = [
      client.on("Runtime.consoleAPICalled", (payload) => {
        if (leasedTargetId.value === targetId) handleRuntimeConsole(targetId, payload);
      }),
      client.on("Runtime.exceptionThrown", (payload) => {
        if (leasedTargetId.value === targetId) handleRuntimeException(targetId, payload);
      }),
      client.on("Log.entryAdded", (payload) => {
        if (leasedTargetId.value === targetId) handleLogEntry(targetId, payload);
      }),
    ];

    const enableResults = await Promise.allSettled([
      client.send("Runtime.enable", {}),
      client.send("Log.enable", {}),
    ]);

    if (leasedTargetId.value !== targetId) {
      nextCleanups.forEach((cleanup) => cleanup());
      return;
    }

    clearClientBindings();
    clientCleanups = nextCleanups;
    const rejected = enableResults.find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") {
      error.value =
        rejected.reason instanceof Error ? rejected.reason.message : String(rejected.reason);
      captureStatus.value = "error";
      scheduleRetry(targetId);
      return;
    }

    clearRetry();
    retryDelay = initialRetryDelay;
    error.value = null;
    captureStatus.value = "live";
  }

  async function bindLeasedClient() {
    const targetId = leasedTargetId.value;
    if (bindingPromise && bindingTargetId === targetId) {
      return bindingPromise;
    }

    bindingTargetId = targetId;
    const currentPromise = bindLeasedClientInternal();
    bindingPromise = currentPromise;
    try {
      await currentPromise;
    } finally {
      if (bindingPromise === currentPromise) {
        bindingPromise = null;
        bindingTargetId = null;
      }
    }
  }

  async function initialize() {
    if (initializePromise) {
      return initializePromise;
    }

    initializePromise = Promise.resolve().then(() => {
      if (isReady.value) {
        return;
      }

      stopWatchHandle = watch(
        () =>
          [
            leasedTargetId.value,
            connectionStore.activeConnection?.targetId ?? null,
            connectionStore.activeConnection?.status ?? "disconnected",
          ] as const,
        () => {
          if (leaseConsumers.value <= 0 || !leasedTargetId.value) {
            clearClientBindings();
            if (boundTargetId.value) {
              resetTargetState(null);
            }
            return;
          }

          void bindLeasedClient();
        },
        { immediate: true },
      );

      isReady.value = true;
    });

    return initializePromise;
  }

  async function detachConsoleLease(serial: string | null) {
    if (!serial) {
      return;
    }

    try {
      await runSessionEffect(detachConsoleTargetEffect(serial), {
        operation: "session.detachConsoleTarget",
      });
    } catch (err) {
      error.value = `Could not release the previous device's console: ${describeError(err)}`;
    }
  }

  async function attachLease(serial: string, targetId: string): Promise<boolean> {
    try {
      await runSessionEffect(attachConsoleTargetEffect(serial, targetId), {
        operation: "session.attachConsoleTarget",
      });
      return true;
    } catch (err) {
      if (leasedTargetId.value !== targetId) {
        return false;
      }
      error.value = `Could not attach the console: ${describeError(err)}`;
      captureStatus.value = "error";
      clearRetry();
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (leasedTargetId.value === targetId && leaseConsumers.value > 0) {
          void attachAndBind(serial, targetId);
        }
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, maximumRetryDelay);
      return false;
    }
  }

  async function attachAndBind(serial: string, targetId: string) {
    if (await attachLease(serial, targetId)) {
      await bindLeasedClient();
    }
  }

  /** Tries to attach and connect again now, instead of waiting for the next automatic retry. */
  async function retry() {
    const targetId = leasedTargetId.value;
    if (!targetId || leaseConsumers.value <= 0) {
      return;
    }
    clearRetry();
    retryDelay = initialRetryDelay;
    error.value = null;
    captureStatus.value = "connecting";
    if (leasedSerial.value) {
      await attachAndBind(leasedSerial.value, targetId);
      return;
    }
    await bindLeasedClient();
  }

  async function syncLease(target: CDPTarget | null) {
    await initialize();

    if (leaseConsumers.value <= 0) {
      return;
    }

    const nextTargetId = target?.id ?? null;
    const nextSerial = target?.source === "adb" ? (target.deviceSerial ?? null) : null;

    if (nextTargetId === leasedTargetId.value && nextSerial === leasedSerial.value) {
      await bindLeasedClient();
      return;
    }

    const previousSerial = leasedSerial.value;
    leasedTargetId.value = nextTargetId;
    leasedSerial.value = nextSerial;
    resetTargetState(nextTargetId);
    clearClientBindings();

    if (previousSerial && previousSerial !== nextSerial) {
      await detachConsoleLease(previousSerial);
    }

    if (!target || !nextTargetId) {
      return;
    }

    if (nextSerial) {
      await attachAndBind(nextSerial, nextTargetId);
      return;
    }

    await bindLeasedClient();
  }

  async function acquireLease() {
    await initialize();
    leaseConsumers.value += 1;
    if (leaseConsumers.value > 1) {
      return;
    }

    await syncLease(targetsStore.selectedTarget);
  }

  async function releaseLease() {
    if (leaseConsumers.value <= 0) {
      return;
    }

    leaseConsumers.value -= 1;
    if (leaseConsumers.value > 0) {
      return;
    }

    const previousSerial = leasedSerial.value;
    leasedTargetId.value = null;
    leasedSerial.value = null;
    clearRetry();
    clearClientBindings();
    resetTargetState(null);
    await detachConsoleLease(previousSerial);
  }

  async function evaluate(expression: string) {
    const normalizedExpression = expression.trim();
    if (!normalizedExpression) {
      return "";
    }

    const client = boundTargetId.value ? connectionStore.getClient(boundTargetId.value) : null;
    const targetId = boundTargetId.value;
    if (!client || !targetId) {
      const message = "No active CDP target";
      const timestamp = Date.now();
      pushReplEntry({
        id: buildId(["repl", timestamp, message]),
        targetId: "none",
        timestamp,
        timestampLabel: formatTimestamp(timestamp),
        expression: normalizedExpression,
        result: message,
        status: "error",
      });
      throw new Error(message);
    }

    const timestamp = Date.now();

    try {
      const result = await withTimeout(
        client.send<{ result?: unknown; exceptionDetails?: unknown }>("Runtime.evaluate", {
          expression: normalizedExpression,
          awaitPromise: true,
          returnByValue: true,
          replMode: true,
          userGesture: true,
          generatePreview: true,
        }),
        replTimeoutMs,
        `No answer after ${replTimeoutMs / 1000} s. The expression may still be running in the app.`,
      );

      const response = isRecord(result) ? result : {};
      if (response.exceptionDetails) {
        const details = isRecord(response.exceptionDetails) ? response.exceptionDetails : {};
        const message =
          (typeof details.text === "string" && details.text) ||
          (isRecord(details.exception) && typeof details.exception.description === "string"
            ? details.exception.description
            : "Evaluation failed");
        pushReplEntry({
          id: buildId(["repl", timestamp, "error", normalizedExpression]),
          targetId,
          timestamp,
          timestampLabel: formatTimestamp(timestamp),
          expression: normalizedExpression,
          result: message,
          status: "error",
        });
        throw new Error(message);
      }

      const resultArg = parseRemoteValue(response.result);
      const resultText = resultArg.kind === "primitive" ? resultArg.text : resultArg.description;
      pushReplEntry({
        id: buildId(["repl", timestamp, "ok", normalizedExpression]),
        targetId,
        timestamp,
        timestampLabel: formatTimestamp(timestamp),
        expression: normalizedExpression,
        result: resultText,
        status: "ok",
      });
      return resultText;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      pushReplEntry({
        id: buildId(["repl", timestamp, "throw", normalizedExpression]),
        targetId,
        timestamp,
        timestampLabel: formatTimestamp(timestamp),
        expression: normalizedExpression,
        result: message,
        status: "error",
      });
      throw err;
    }
  }

  async function fetchObjectProperties(
    objectId: string,
  ): Promise<Array<{ name: string; value: ConsoleArg }>> {
    const client = boundTargetId.value ? connectionStore.getClient(boundTargetId.value) : null;
    if (!client) return [];

    const res = await client.send<{ result?: Array<Record<string, unknown>> }>(
      "Runtime.getProperties",
      {
        objectId,
        ownProperties: true,
        accessorPropertiesOnly: false,
        generatePreview: true,
      },
    );

    const items = Array.isArray(res.result) ? res.result : [];
    return items
      .filter((it) => it.enumerable !== false)
      .map((it) => ({
        name: typeof it.name === "string" ? it.name : "?",
        value: parseRemoteValue(it.value),
      }));
  }

  const consoleSource = markRaw({
    ring: markRaw(buffer.entries),
    feed: markRaw(buffer.entryFeed),
  });
  const exceptionSource = markRaw({
    ring: markRaw(buffer.exceptions),
    feed: markRaw(buffer.exceptionFeed),
  });

  return {
    entries,
    exceptions,
    exceptionCount,
    levelCounts,
    entryVersion,
    exceptionVersion,
    consoleSource,
    exceptionSource,
    flushEntries,
    replHistory,
    boundTargetId,
    leasedTargetId,
    isReady,
    error,
    captureStatus,
    activeTarget,
    activeTargetLabel,
    initialize,
    syncLease,
    acquireLease,
    releaseLease,
    evaluate,
    fetchObjectProperties,
    clearConsole,
    clearExceptions,
    clearReplHistory,
    retry,
    stopWatchHandle,
  };
});
