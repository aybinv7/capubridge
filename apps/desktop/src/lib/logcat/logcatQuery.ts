import { compileQuery } from "@/lib/stream-query/compileQuery";
import { parseQuery } from "@/lib/stream-query/parseQuery";
import type { QueryKeyHelp } from "@/lib/stream-query/querySuggest";
import type {
  CompiledQuery,
  ParsedQuery,
  StreamQuerySchema,
} from "@/lib/stream-query/streamQuery.types";
import type { LogcatEntry, LogcatLevel } from "@/types/logcat.types";

/** Logcat levels, lowest first. */
export const LOGCAT_LEVELS: readonly LogcatLevel[] = ["V", "D", "I", "W", "E", "F"];

export const LOGCAT_LEVEL_NAMES: Readonly<Record<LogcatLevel, string>> = {
  V: "Verbose",
  D: "Debug",
  I: "Info",
  W: "Warning",
  E: "Error",
  F: "Fatal",
};

export const LOGCAT_QUERY_KEYS = [
  "tag",
  "package",
  "process",
  "message",
  "line",
  "level",
  "age",
  "is",
  "pid",
  "tid",
] as const;

export const LOGCAT_KEY_HELP: readonly QueryKeyHelp[] = [
  { insert: "package:mine", detail: "Lines from the app you are inspecting" },
  { insert: "tag:", detail: "Tag contains" },
  { insert: "-tag:", detail: "Hide a tag" },
  { insert: "tag~:", detail: "Tag matches a pattern" },
  { insert: "level:", detail: "This level and above" },
  { insert: "message:", detail: "Message contains" },
  { insert: "age:", detail: "Only the last 30s, 5m, 2h, 1d" },
  { insert: "is:crash", detail: "Crash lines, Java or native" },
  { insert: "is:stacktrace", detail: "Lines that hold a stack trace" },
  { insert: "process:", detail: "Process name contains" },
  { insert: "pid:", detail: "One process id" },
  { insert: "package:", detail: "Package contains" },
];

const LEVEL_RANK: Readonly<Record<LogcatLevel, number>> = { V: 0, D: 1, I: 2, W: 3, E: 4, F: 5 };

const LEVEL_WORDS: Readonly<Record<string, LogcatLevel>> = {
  v: "V",
  verbose: "V",
  d: "D",
  debug: "D",
  i: "I",
  info: "I",
  w: "W",
  warn: "W",
  warning: "W",
  e: "E",
  error: "E",
  f: "F",
  a: "F",
  fatal: "F",
  assert: "F",
};

/** The level a typed word names (`W`, `warn`, `error`, ...), or null. */
export function parseLogcatLevel(value: string): LogcatLevel | null {
  return LEVEL_WORDS[value.trim().toLowerCase()] ?? null;
}

export function logcatLevelRank(level: LogcatLevel): number {
  return LEVEL_RANK[level];
}

/** The level whose rank is `rank`, for chips that mirror a parsed `level:`. */
export function logcatLevelAt(rank: number): LogcatLevel | null {
  return LOGCAT_LEVELS[rank] ?? null;
}

const searchTexts = new WeakMap<LogcatEntry, string>();

/** The lowercased text free text searches, built once per entry on first use. */
export function logcatSearchText(entry: LogcatEntry): string {
  let text = searchTexts.get(entry);
  if (text === undefined) {
    text = [entry.packageName, entry.processName, entry.tag, entry.message]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    searchTexts.set(entry, text);
  }
  return text;
}

const JAVA_FRAME = /^\s+at\s+\S/m;

/** Whether the entry holds a Java stack trace (`at ...` frames or `Caused by:`). */
export function isStacktrace(entry: LogcatEntry): boolean {
  return JAVA_FRAME.test(entry.message) || entry.message.includes("Caused by:");
}

/** Lines that are part of an app crash: Java (`AndroidRuntime`, fatal) or native (`DEBUG`, `libc`). */
export function isCrash(entry: LogcatEntry): boolean {
  if (entry.level === "F") return true;
  if (entry.level !== "E") return false;
  if (entry.tag === "AndroidRuntime") return true;
  if (entry.message.startsWith("FATAL EXCEPTION")) return true;
  return entry.tag === "libc" && entry.message.includes("Fatal signal");
}

const WEBVIEW_ECHO = /^\[[A-Z]*:?CONSOLE\(/;
const ECHO_TAGS = new Set(["Capacitor/Console", "Web Console"]);

/** A WebView `console.*` call that Android repeats into logcat; the Console view shows it. */
export function isWebViewEcho(entry: LogcatEntry): boolean {
  if (ECHO_TAGS.has(entry.tag)) return true;
  return entry.tag === "chromium" && WEBVIEW_ECHO.test(entry.message);
}

export interface LogcatQueryContext {
  /** The package of the app being inspected, for `package:mine`. */
  myPackage: string | null;
  /** Host time of a device time, for `age:`. */
  hostTime(entry: LogcatEntry): number;
}

function packageOf(entry: LogcatEntry): string | null {
  return entry.packageName ?? entry.processName;
}

function fieldOf(entry: LogcatEntry, key: string): string | null {
  switch (key) {
    case "tag":
      return entry.tag;
    case "package":
      return packageOf(entry);
    case "process":
      return entry.processName ?? entry.packageName;
    case "message":
      return entry.message;
    case "line":
      return logcatSearchText(entry);
    case "pid":
      return entry.pid === null ? null : String(entry.pid);
    case "tid":
      return entry.tid === null ? null : String(entry.tid);
    default:
      return null;
  }
}

export function logcatSchema(context: LogcatQueryContext): StreamQuerySchema<LogcatEntry> {
  return {
    keys: LOGCAT_QUERY_KEYS,
    text: logcatSearchText,
    field: fieldOf,
    levelRank: (entry) => LEVEL_RANK[entry.level],
    parseLevel: (value) => {
      const level = parseLogcatLevel(value);
      return level ? LEVEL_RANK[level] : null;
    },
    time: (entry) => context.hostTime(entry),
    is: { crash: isCrash, stacktrace: isStacktrace },
    resolve(key, value) {
      if (key !== "package" || value.toLowerCase() !== "mine") return undefined;
      return context.myPackage
        ? { value: context.myPackage }
        : { problem: "package:mine needs an app: choose a WebView or a debuggable app first" };
    },
  };
}

export interface LogcatQuery extends CompiledQuery<LogcatEntry> {
  parsed: ParsedQuery;
}

/** Parses and compiles a Logs query against `context`. */
export function compileLogcatQuery(source: string, context: LogcatQueryContext): LogcatQuery {
  const parsed = parseQuery(source, LOGCAT_QUERY_KEYS);
  return { parsed, ...compileQuery(parsed, logcatSchema(context)) };
}
