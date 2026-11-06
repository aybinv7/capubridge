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
import {
  buildSourceLabel,
  formatTimestamp,
  isRecord,
  normalizeTimestamp,
  readFrameSource,
} from "@/lib/console/consoleFormat";
import { STREAM_CAPS } from "@/lib/stream-caps";
import type { CDPTarget } from "@/types/cdp.types";
import type {
  ConsoleArg,
  ConsoleEntry,
  ConsoleEntryLevel,
  ConsoleExceptionEntry,
  ReplHistoryEntry,
} from "@/types/console.types";
import { parseRemoteValue, flattenArgsForMessage } from "@/lib/console-parse";

const maxReplEntries = 80;
const initialRetryDelay = 500;
const maximumRetryDelay = 8_000;

type ClientCleanup = () => void;
type ConsoleCaptureStatus = "idle" | "connecting" | "live" | "error";

function trimList<T>(items: T[], maxItems: number): T[] {
  return items.length > maxItems ? items.slice(items.length - maxItems) : items;
}

function buildId(parts: Array<string | number | null | undefined>) {
  return parts.map((part) => (part == null ? "null" : String(part))).join(":");
}

function runtimeLevelFromType(type: string): ConsoleEntryLevel {
  if (type === "warning") {
    return "warn";
  }

  if (type === "error" || type === "assert") {
    return "error";
  }

  if (type === "info") {
    return "info";
  }

  if (type === "debug" || type === "trace" || type === "dir" || type === "dirxml") {
    return "debug";
  }

  return "log";
}

function logLevelFromType(type: string): ConsoleEntryLevel {
  if (type === "verbose" || type === "info") {
    return "info";
  }

  if (type === "warning") {
    return "warn";
  }

  if (type === "error") {
    return "error";
  }

  return "log";
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
  let groupStack: string[] = [];
  let idCounter = 0;
  let bindingPromise: Promise<void> | null = null;
  let bindingTargetId: string | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = initialRetryDelay;
  const pendingGroups = new Map<string, ConsoleEntry>();

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
    groupStack = [];
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
    const params = isRecord(payload) ? payload : {};
    const runtimeType = typeof params.type === "string" ? params.type : "log";

    if (runtimeType === "endGroup") {
      groupStack.pop();
      return;
    }
    if (runtimeType === "clear") return;

    const isGroup = runtimeType === "startGroup" || runtimeType === "startGroupCollapsed";
    const groupCollapsed = runtimeType === "startGroupCollapsed";
    const rawParentId = groupStack[groupStack.length - 1] ?? null;

    const timestamp = normalizeTimestamp(params.timestamp);
    const rawArgs = Array.isArray(params.args) ? params.args : [];
    const args = rawArgs.map((a) => parseRemoteValue(a));
    const stackTrace = isRecord(params.stackTrace) ? params.stackTrace : null;
    const callFrames = Array.isArray(stackTrace?.callFrames) ? stackTrace.callFrames : [];
    const frame = isRecord(callFrames[0]) ? callFrames[0] : null;
    const sourceDetails = readFrameSource(frame);
    const message = flattenArgsForMessage(args) || runtimeType;

    if (isGroup && rawParentId) {
      const parent = pendingGroups.get(rawParentId) ?? buffer.findGroup(rawParentId);
      if (
        parent &&
        parent.isGroup &&
        parent.message === message &&
        parent.source === sourceDetails.source
      ) {
        groupStack.push(rawParentId);
        return;
      }
    }

    const seq = ++idCounter;
    const id = buildId([targetId, "runtime", timestamp, runtimeType, seq]);
    const parentId = rawParentId === id ? null : rawParentId;

    pushConsoleEntry({
      seq,
      id,
      targetId,
      timestamp,
      timestampLabel: formatTimestamp(timestamp),
      level: runtimeLevelFromType(runtimeType),
      source: sourceDetails.source,
      message,
      args,
      parentId,
      isGroup,
      groupCollapsed,
      origin: "runtime",
      type: runtimeType,
      url: sourceDetails.url,
      lineNumber: sourceDetails.lineNumber,
      columnNumber: sourceDetails.columnNumber,
    });

    if (isGroup) {
      groupStack.push(id);
    }
  }

  function handleLogEntry(targetId: string, payload: unknown) {
    const params = isRecord(payload) ? payload : {};
    const entry = isRecord(params.entry) ? params.entry : {};
    const sourceType = typeof entry.source === "string" ? entry.source : "log";
    const levelType = typeof entry.level === "string" ? entry.level : "info";
    const timestamp = normalizeTimestamp(entry.timestamp);
    const url = typeof entry.url === "string" && entry.url ? entry.url : null;
    const lineNumber =
      typeof entry.lineNumber === "number" && Number.isFinite(entry.lineNumber)
        ? entry.lineNumber + 1
        : null;
    const source = buildSourceLabel(url, lineNumber, null) || sourceType;
    const message = typeof entry.text === "string" && entry.text ? entry.text : sourceType;
    const args: ConsoleArg[] = [{ kind: "primitive", text: message }];
    const seq = ++idCounter;
    const id = buildId([targetId, "log", timestamp, levelType, seq]);
    const rawParentId = groupStack[groupStack.length - 1] ?? null;
    const parentId = rawParentId === id ? null : rawParentId;

    pushConsoleEntry({
      seq,
      id,
      targetId,
      timestamp,
      timestampLabel: formatTimestamp(timestamp),
      level: logLevelFromType(levelType),
      source,
      message,
      args,
      parentId,
      isGroup: false,
      groupCollapsed: false,
      origin: "log",
      type: levelType,
      url,
      lineNumber,
      columnNumber: null,
    });
  }

  function handleRuntimeException(targetId: string, payload: unknown) {
    const params = isRecord(payload) ? payload : {};
    const details = isRecord(params.exceptionDetails) ? params.exceptionDetails : {};
    const timestamp = normalizeTimestamp(params.timestamp);
    const stackTrace = isRecord(details.stackTrace) ? details.stackTrace : null;
    const callFrames = Array.isArray(stackTrace?.callFrames) ? stackTrace.callFrames : [];
    const frame = isRecord(callFrames[0]) ? callFrames[0] : null;
    const sourceDetails = readFrameSource(frame);
    const exception = isRecord(details.exception) ? details.exception : null;
    const stack = callFrames
      .filter((frameItem): frameItem is Record<string, unknown> => isRecord(frameItem))
      .map((frameItem) => {
        const fn =
          typeof frameItem.functionName === "string" && frameItem.functionName
            ? frameItem.functionName
            : "(anonymous)";
        const url =
          typeof frameItem.url === "string" && frameItem.url
            ? buildSourceLabel(
                frameItem.url,
                typeof frameItem.lineNumber === "number" ? frameItem.lineNumber + 1 : null,
                typeof frameItem.columnNumber === "number" ? frameItem.columnNumber + 1 : null,
              )
            : "runtime";
        return `${fn} @ ${url}`;
      });
    const message =
      (typeof exception?.description === "string" && exception.description) ||
      (typeof details.text === "string" && details.text) ||
      "Unhandled exception";

    pushException({
      seq: ++idCounter,
      id: buildId([targetId, "exception", timestamp, sourceDetails.source, message]),
      targetId,
      timestamp,
      timestampLabel: formatTimestamp(timestamp),
      message,
      source: sourceDetails.source,
      url: sourceDetails.url,
      lineNumber: sourceDetails.lineNumber,
      columnNumber: sourceDetails.columnNumber,
      stack,
    });
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
    } catch (error) {
      console.warn("Failed to detach console session lease", error);
    }
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
      await runSessionEffect(attachConsoleTargetEffect(nextSerial, nextTargetId), {
        operation: "session.attachConsoleTarget",
      });
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
      const result = await client.send<{ result?: unknown; exceptionDetails?: unknown }>(
        "Runtime.evaluate",
        {
          expression: normalizedExpression,
          awaitPromise: true,
          returnByValue: true,
          replMode: true,
          userGesture: true,
          generatePreview: true,
        },
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
    stopWatchHandle,
  };
});
