import { entryItem, exceptionItem, type ConsoleStreamItem } from "@/lib/console/consoleStream";
import type { RingBuffer } from "@/lib/ring-buffer";
import type { ConsoleEntry, ConsoleExceptionEntry, StackFrame } from "@/types/console.types";

const LIBRARY_URL =
  /node_modules|\/vendor[s.\-/]|chunk-vendors|polyfill|webpack\/bootstrap|native-bridge|capacitor\.js|cordova\.js|^chrome-extension:|^extensions::/i;

/**
 * Whether a frame is the app's own code: it has a URL, is not a bundled library or the native
 * bridge, and (when the app's origin is known) comes from that origin.
 */
export function isAppFrame(frame: StackFrame, appOrigin: string | null): boolean {
  if (!frame.url || LIBRARY_URL.test(frame.url)) return false;
  return appOrigin === null || frame.url.startsWith(appOrigin);
}

/** The origin of a page URL, or null for URLs without one (`about:blank`, `data:`). */
export function originOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const origin = new URL(url).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

/** Errors with the same first message line and top app frame, counted. */
export interface ErrorGroup {
  key: string;
  message: string;
  frame: StackFrame | null;
  count: number;
  firstTime: number;
  lastTime: number;
  /** The newest occurrence, opened when the group is expanded. */
  latest: ConsoleStreamItem;
  exceptions: number;
}

function firstLine(text: string): string {
  const end = text.indexOf("\n");
  return (end < 0 ? text : text.slice(0, end)).trim();
}

function topFrame(frames: readonly StackFrame[] | null | undefined, appOrigin: string | null) {
  if (!frames || frames.length === 0) return null;
  return frames.find((frame) => isAppFrame(frame, appOrigin)) ?? frames[0] ?? null;
}

function frameKey(frame: StackFrame | null, fallback: string): string {
  return frame ? `${frame.functionName}@${frame.url ?? ""}:${frame.lineNumber ?? ""}` : fallback;
}

export interface ErrorGroupInput {
  entries: RingBuffer<ConsoleEntry>;
  exceptions: RingBuffer<ConsoleExceptionEntry>;
  appOrigin: string | null;
  /** Keeps an item; null keeps every error. */
  test: ((item: ConsoleStreamItem) => boolean) | null;
}

/**
 * The Errors view: `console.error` calls and uncaught exceptions grouped by their first message
 * line and top app frame, newest group first.
 */
export function groupConsoleErrors(input: ErrorGroupInput): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();

  function add(item: ConsoleStreamItem, message: string, frame: StackFrame | null, source: string) {
    if (input.test && !input.test(item)) return;
    const line = firstLine(message);
    const key = `${line}|${frameKey(frame, source)}`;
    const group = groups.get(key);
    const isException = item.kind === "exception" ? 1 : 0;
    if (!group) {
      groups.set(key, {
        key,
        message: line,
        frame,
        count: 1,
        firstTime: item.time,
        lastTime: item.time,
        latest: item,
        exceptions: isException,
      });
      return;
    }
    group.count += 1;
    group.exceptions += isException;
    if (item.time >= group.lastTime) {
      group.lastTime = item.time;
      group.latest = item;
    }
    if (item.time < group.firstTime) group.firstTime = item.time;
  }

  input.entries.forEach((entry) => {
    if (entry.level !== "error") return;
    add(entryItem(entry), entry.message, topFrame(entry.frames, input.appOrigin), entry.source);
  });
  input.exceptions.forEach((exception) => {
    add(
      exceptionItem(exception),
      exception.message,
      topFrame(exception.frames, input.appOrigin),
      exception.source,
    );
  });

  return [...groups.values()].sort((a, b) => b.lastTime - a.lastTime);
}
