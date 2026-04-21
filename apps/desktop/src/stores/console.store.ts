import { computed, ref, watch, type WatchStopHandle } from "vue";
import { defineStore } from "pinia";
import { useConnectionStore } from "@/stores/connection.store";
import { useDockStore } from "@/stores/dock.store";
import { useTargetsStore } from "@/stores/targets.store";
import type {
  ConsoleEntry,
  ConsoleEntryLevel,
  ConsoleExceptionEntry,
  ReplHistoryEntry,
} from "@/types/console.types";

const maxConsoleEntries = 500;
const maxExceptionEntries = 160;
const maxReplEntries = 80;

type ClientCleanup = () => void;

function normalizeTimestamp(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return Date.now();
  }

  if (value > 100_000_000_000) {
    return value;
  }

  if (value > 100_000_000) {
    return value * 1000;
  }

  return Date.now();
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(timestamp);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function trimList<T>(items: T[], maxItems: number): T[] {
  return items.length > maxItems ? items.slice(items.length - maxItems) : items;
}

function buildId(parts: Array<string | number | null | undefined>) {
  return parts.map((part) => (part == null ? "null" : String(part))).join(":");
}

function formatJsonValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return `${value}`;
  }

  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  try {
    const json = JSON.stringify(value, null, 2);
    if (json !== undefined) {
      return json;
    }
  } catch {
    return Object.prototype.toString.call(value);
  }

  return Object.prototype.toString.call(value);
}

function formatRemoteValue(value: unknown): string {
  if (!isRecord(value)) {
    return formatJsonValue(value);
  }

  if (typeof value.unserializableValue === "string") {
    return value.unserializableValue;
  }

  if ("value" in value) {
    return formatJsonValue(value.value);
  }

  if (value.subtype === "null") {
    return "null";
  }

  if (typeof value.description === "string" && value.description) {
    return value.description;
  }

  if (typeof value.type === "string") {
    return value.type;
  }

  return "[unknown]";
}

function buildSourceLabel(
  url: string | null,
  lineNumber: number | null,
  columnNumber: number | null,
) {
  if (!url) {
    return "runtime";
  }

  let label = url;
  try {
    const parsed = new URL(url);
    label = parsed.pathname.split("/").filter(Boolean).at(-1) ?? parsed.host ?? url;
  } catch {}

  if (lineNumber == null) {
    return label;
  }

  if (columnNumber == null) {
    return `${label}:${lineNumber}`;
  }

  return `${label}:${lineNumber}:${columnNumber}`;
}

function readFrameSource(frame: Record<string, unknown> | null | undefined) {
  const url = typeof frame?.url === "string" && frame.url ? frame.url : null;
  const lineNumber =
    typeof frame?.lineNumber === "number" && Number.isFinite(frame.lineNumber)
      ? frame.lineNumber + 1
      : null;
  const columnNumber =
    typeof frame?.columnNumber === "number" && Number.isFinite(frame.columnNumber)
      ? frame.columnNumber + 1
      : null;
  const source = buildSourceLabel(url, lineNumber, columnNumber);

  return {
    source,
    url,
    lineNumber,
    columnNumber,
  };
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

  const entries = ref<ConsoleEntry[]>([]);
  const exceptions = ref<ConsoleExceptionEntry[]>([]);
  const replHistory = ref<ReplHistoryEntry[]>([]);
  const boundTargetId = ref<string | null>(null);
  const isReady = ref(false);
  const error = ref<string | null>(null);

  const activeTarget = computed(() => targetsStore.selectedTarget);
  const activeTargetLabel = computed(
    () => activeTarget.value?.packageName ?? activeTarget.value?.title ?? "No active target",
  );

  let initializePromise: Promise<void> | null = null;
  let stopWatchHandle: WatchStopHandle | null = null;
  let clientCleanups: ClientCleanup[] = [];

  function clearClientBindings() {
    clientCleanups.forEach((cleanup) => cleanup());
    clientCleanups = [];
  }

  function resetTargetState(targetId: string | null) {
    boundTargetId.value = targetId;
    entries.value = [];
    exceptions.value = [];
    replHistory.value = [];
    error.value = null;
  }

  function clearConsole() {
    entries.value = [];
  }

  function clearExceptions() {
    exceptions.value = [];
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
    const lastEntry = entries.value.at(-1);
    if (
      lastEntry &&
      lastEntry.origin === entry.origin &&
      lastEntry.level === entry.level &&
      lastEntry.source === entry.source &&
      lastEntry.message === entry.message &&
      Math.abs(lastEntry.timestamp - entry.timestamp) < 250
    ) {
      return;
    }

    entries.value = trimList([...entries.value, entry], maxConsoleEntries);
    maybeMarkConsoleUnread();
  }

  function pushException(entry: ConsoleExceptionEntry) {
    exceptions.value = trimList([...exceptions.value, entry], maxExceptionEntries);
    maybeMarkExceptionsUnread();
  }

  function pushReplEntry(entry: ReplHistoryEntry) {
    replHistory.value = trimList([...replHistory.value, entry], maxReplEntries);
  }

  function handleRuntimeConsole(targetId: string, payload: unknown) {
    const params = isRecord(payload) ? payload : {};
    const runtimeType = typeof params.type === "string" ? params.type : "log";
    const timestamp = normalizeTimestamp(params.timestamp);
    const args = Array.isArray(params.args) ? params.args : [];
    const stackTrace = isRecord(params.stackTrace) ? params.stackTrace : null;
    const callFrames = Array.isArray(stackTrace?.callFrames) ? stackTrace.callFrames : [];
    const frame = isRecord(callFrames[0]) ? callFrames[0] : null;
    const sourceDetails = readFrameSource(frame);
    const message =
      args
        .map((arg) => formatRemoteValue(arg))
        .join(" ")
        .trim() || runtimeType;

    pushConsoleEntry({
      id: buildId([targetId, "runtime", timestamp, runtimeType, sourceDetails.source, message]),
      targetId,
      timestamp,
      timestampLabel: formatTimestamp(timestamp),
      level: runtimeLevelFromType(runtimeType),
      source: sourceDetails.source,
      message,
      origin: "runtime",
      type: runtimeType,
      url: sourceDetails.url,
      lineNumber: sourceDetails.lineNumber,
      columnNumber: sourceDetails.columnNumber,
    });
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

    pushConsoleEntry({
      id: buildId([targetId, "log", timestamp, levelType, source, message]),
      targetId,
      timestamp,
      timestampLabel: formatTimestamp(timestamp),
      level: logLevelFromType(levelType),
      source,
      message,
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

  async function bindActiveClient() {
    const targetId = connectionStore.activeConnection?.targetId ?? null;
    if (targetId !== boundTargetId.value) {
      resetTargetState(targetId);
    }

    clearClientBindings();

    if (!targetId) {
      return;
    }

    const client = connectionStore.getClient(targetId);
    if (!client) {
      return;
    }

    const enableResults = await Promise.allSettled([
      client.send("Runtime.enable", {}),
      client.send("Log.enable", {}),
    ]);

    const rejected = enableResults.find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") {
      error.value =
        rejected.reason instanceof Error ? rejected.reason.message : String(rejected.reason);
    }

    clientCleanups = [
      client.on("Runtime.consoleAPICalled", (payload) => handleRuntimeConsole(targetId, payload)),
      client.on("Runtime.exceptionThrown", (payload) => handleRuntimeException(targetId, payload)),
      client.on("Log.entryAdded", (payload) => handleLogEntry(targetId, payload)),
    ];
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
            connectionStore.activeConnection?.targetId ?? null,
            connectionStore.activeConnection?.status ?? "disconnected",
          ] as const,
        () => {
          void bindActiveClient();
        },
        { immediate: true },
      );

      isReady.value = true;
    });

    return initializePromise;
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

      const resultText = formatRemoteValue(response.result);
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

  return {
    entries,
    exceptions,
    replHistory,
    boundTargetId,
    isReady,
    error,
    activeTarget,
    activeTargetLabel,
    initialize,
    evaluate,
    clearConsole,
    clearExceptions,
    clearReplHistory,
    stopWatchHandle,
  };
});
