import { flattenArgsForMessage, parseRemoteValue } from "@/lib/console-parse";
import {
  buildSourceLabel,
  formatTimestamp,
  isRecord,
  normalizeTimestamp,
  readFrameSource,
} from "@/lib/console/consoleFormat";
import type {
  ConsoleArg,
  ConsoleEntry,
  ConsoleEntryLevel,
  ConsoleExceptionEntry,
} from "@/types/console.types";

/** What turning CDP events into entries needs from the console store. */
export interface ConsoleEventContext {
  nextSeq(): number;
  /** Ids of the open `console.group` calls, innermost last. Mutated in place. */
  groupStack: string[];
  findGroup(id: string): ConsoleEntry | undefined;
}

export function buildId(parts: Array<string | number | null | undefined>): string {
  return parts.map((part) => (part == null ? "null" : String(part))).join(":");
}

function runtimeLevelFromType(type: string): ConsoleEntryLevel {
  if (type === "warning") return "warn";
  if (type === "error" || type === "assert") return "error";
  if (type === "info") return "info";
  if (type === "debug" || type === "trace" || type === "dir" || type === "dirxml") return "debug";
  return "log";
}

function logLevelFromType(type: string): ConsoleEntryLevel {
  if (type === "verbose" || type === "info") return "info";
  if (type === "warning") return "warn";
  if (type === "error") return "error";
  return "log";
}

/**
 * The entry for a `Runtime.consoleAPICalled` event, or null when it only changes group state
 * (`console.groupEnd`, `console.clear`, or a repeated group header).
 */
export function runtimeConsoleEntry(
  targetId: string,
  payload: unknown,
  context: ConsoleEventContext,
): ConsoleEntry | null {
  const params = isRecord(payload) ? payload : {};
  const runtimeType = typeof params.type === "string" ? params.type : "log";
  const stack = context.groupStack;

  if (runtimeType === "endGroup") {
    stack.pop();
    return null;
  }
  if (runtimeType === "clear") return null;

  const isGroup = runtimeType === "startGroup" || runtimeType === "startGroupCollapsed";
  const rawParentId = stack[stack.length - 1] ?? null;
  const timestamp = normalizeTimestamp(params.timestamp);
  const rawArgs = Array.isArray(params.args) ? params.args : [];
  const args = rawArgs.map((arg) => parseRemoteValue(arg));
  const stackTrace = isRecord(params.stackTrace) ? params.stackTrace : null;
  const callFrames = Array.isArray(stackTrace?.callFrames) ? stackTrace.callFrames : [];
  const frame = isRecord(callFrames[0]) ? callFrames[0] : null;
  const sourceDetails = readFrameSource(frame);
  const message = flattenArgsForMessage(args) || runtimeType;

  if (isGroup && rawParentId) {
    const parent = context.findGroup(rawParentId);
    if (parent?.isGroup && parent.message === message && parent.source === sourceDetails.source) {
      stack.push(rawParentId);
      return null;
    }
  }

  const seq = context.nextSeq();
  const id = buildId([targetId, "runtime", timestamp, runtimeType, seq]);
  if (isGroup) {
    stack.push(id);
  }

  return {
    seq,
    id,
    targetId,
    timestamp,
    timestampLabel: formatTimestamp(timestamp),
    level: runtimeLevelFromType(runtimeType),
    source: sourceDetails.source,
    message,
    args,
    parentId: rawParentId === id ? null : rawParentId,
    isGroup,
    groupCollapsed: runtimeType === "startGroupCollapsed",
    origin: "runtime",
    type: runtimeType,
    url: sourceDetails.url,
    lineNumber: sourceDetails.lineNumber,
    columnNumber: sourceDetails.columnNumber,
  };
}

/** The entry for a `Log.entryAdded` event (browser and network messages). */
export function logEventEntry(
  targetId: string,
  payload: unknown,
  context: ConsoleEventContext,
): ConsoleEntry {
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
  const message = typeof entry.text === "string" && entry.text ? entry.text : sourceType;
  const args: ConsoleArg[] = [{ kind: "primitive", text: message }];
  const seq = context.nextSeq();
  const id = buildId([targetId, "log", timestamp, levelType, seq]);
  const rawParentId = context.groupStack[context.groupStack.length - 1] ?? null;

  return {
    seq,
    id,
    targetId,
    timestamp,
    timestampLabel: formatTimestamp(timestamp),
    level: logLevelFromType(levelType),
    source: buildSourceLabel(url, lineNumber, null) || sourceType,
    message,
    args,
    parentId: rawParentId === id ? null : rawParentId,
    isGroup: false,
    groupCollapsed: false,
    origin: "log",
    type: levelType,
    url,
    lineNumber,
    columnNumber: null,
  };
}

function stackLine(frame: Record<string, unknown>): string {
  const fn =
    typeof frame.functionName === "string" && frame.functionName
      ? frame.functionName
      : "(anonymous)";
  const url =
    typeof frame.url === "string" && frame.url
      ? buildSourceLabel(
          frame.url,
          typeof frame.lineNumber === "number" ? frame.lineNumber + 1 : null,
          typeof frame.columnNumber === "number" ? frame.columnNumber + 1 : null,
        )
      : "runtime";
  return `${fn} @ ${url}`;
}

/** The entry for a `Runtime.exceptionThrown` event; its id is unique even within one ms. */
export function exceptionEntry(
  targetId: string,
  payload: unknown,
  nextSeq: () => number,
): ConsoleExceptionEntry {
  const params = isRecord(payload) ? payload : {};
  const details = isRecord(params.exceptionDetails) ? params.exceptionDetails : {};
  const timestamp = normalizeTimestamp(params.timestamp);
  const stackTrace = isRecord(details.stackTrace) ? details.stackTrace : null;
  const callFrames = Array.isArray(stackTrace?.callFrames) ? stackTrace.callFrames : [];
  const frame = isRecord(callFrames[0]) ? callFrames[0] : null;
  const sourceDetails = readFrameSource(frame);
  const exception = isRecord(details.exception) ? details.exception : null;
  const message =
    (typeof exception?.description === "string" && exception.description) ||
    (typeof details.text === "string" && details.text) ||
    "Unhandled exception";
  const seq = nextSeq();

  return {
    seq,
    id: buildId([targetId, "exception", timestamp, seq]),
    targetId,
    timestamp,
    timestampLabel: formatTimestamp(timestamp),
    message,
    source: sourceDetails.source,
    url: sourceDetails.url,
    lineNumber: sourceDetails.lineNumber,
    columnNumber: sourceDetails.columnNumber,
    stack: callFrames.filter(isRecord).map(stackLine),
  };
}
