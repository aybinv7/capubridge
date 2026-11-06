import type { ConsoleStreamItem } from "@/lib/console/consoleStream";
import { compileQuery } from "@/lib/stream-query/compileQuery";
import { parseQuery } from "@/lib/stream-query/parseQuery";
import type { QueryKeyHelp } from "@/lib/stream-query/querySuggest";
import type {
  CompiledQuery,
  ParsedQuery,
  StreamQuerySchema,
} from "@/lib/stream-query/streamQuery.types";

/** Console levels as the query and the chips name them, lowest first. */
export const CONSOLE_LEVELS = ["verbose", "info", "warn", "error"] as const;
export type ConsoleQueryLevel = (typeof CONSOLE_LEVELS)[number];

export const CONSOLE_LEVEL_NAMES: Readonly<Record<ConsoleQueryLevel, string>> = {
  verbose: "Verbose",
  info: "Info",
  warn: "Warnings",
  error: "Errors",
};

export const CONSOLE_QUERY_KEYS = ["level", "url", "source", "message", "age", "is"] as const;

export const CONSOLE_KEY_HELP: readonly QueryKeyHelp[] = [
  { insert: "level:", detail: "This level and above" },
  { insert: "url:", detail: "Script URL contains" },
  { insert: "-url:", detail: "Hide a script" },
  { insert: "message:", detail: "Message contains" },
  { insert: "source:", detail: "File and line contain" },
  { insert: "age:", detail: "Only the last 30s, 5m, 2h, 1d" },
  { insert: "is:exception", detail: "Uncaught exceptions" },
  { insert: "is:network", detail: "Messages about a request" },
  { insert: "is:repl", detail: "What you ran in the prompt" },
];

const LEVEL_WORDS: Readonly<Record<string, number>> = {
  v: 0,
  verbose: 0,
  log: 0,
  debug: 0,
  d: 0,
  i: 1,
  info: 1,
  w: 2,
  warn: 2,
  warning: 2,
  warnings: 2,
  e: 3,
  error: 3,
  errors: 3,
};

/** The rank of a typed console level, or null. */
export function parseConsoleLevel(value: string): number | null {
  return LEVEL_WORDS[value.trim().toLowerCase()] ?? null;
}

/** Rank of an item: verbose (log, debug) 0, info 1, warn 2, error 3. */
export function consoleItemRank(item: ConsoleStreamItem): number {
  switch (item.kind) {
    case "entry": {
      const level = item.entry.level;
      if (level === "error") return 3;
      if (level === "warn") return 2;
      if (level === "info") return 1;
      return 0;
    }
    case "exception":
      return 3;
    case "input":
      return 1;
    case "result":
      return item.repl.status === "error" ? 3 : 1;
  }
}

const searchTexts = new WeakMap<ConsoleStreamItem, string>();

/** Lowercased text that free text searches, built once per item. */
export function consoleItemText(item: ConsoleStreamItem): string {
  let text = searchTexts.get(item);
  if (text !== undefined) return text;
  switch (item.kind) {
    case "entry":
      text = `${item.entry.source} ${item.entry.message}`;
      break;
    case "exception":
      text = `${item.exception.source} ${item.exception.message} ${item.exception.stack.join(" ")}`;
      break;
    case "input":
      text = item.repl.expression;
      break;
    case "result":
      text = item.repl.result;
      break;
  }
  text = text.toLowerCase();
  searchTexts.set(item, text);
  return text;
}

function fieldOf(item: ConsoleStreamItem, key: string): string | null {
  if (item.kind === "entry") {
    if (key === "url") return item.entry.url;
    if (key === "source") return item.entry.source;
    if (key === "message") return item.entry.message;
    return null;
  }
  if (item.kind === "exception") {
    if (key === "url") return item.exception.url;
    if (key === "source") return item.exception.source;
    if (key === "message") return item.exception.message;
    return null;
  }
  if (key === "message") return item.kind === "input" ? item.repl.expression : item.repl.result;
  return null;
}

export interface ConsoleQueryContext {
  hostTime(item: ConsoleStreamItem): number;
}

export function consoleSchema(context: ConsoleQueryContext): StreamQuerySchema<ConsoleStreamItem> {
  return {
    keys: CONSOLE_QUERY_KEYS,
    text: consoleItemText,
    field: fieldOf,
    levelRank: consoleItemRank,
    parseLevel: parseConsoleLevel,
    time: (item) => context.hostTime(item),
    is: {
      exception: (item) => item.kind === "exception",
      network: (item) =>
        item.kind === "entry" &&
        (Boolean(item.entry.networkRequestId) || item.entry.type === "network"),
      repl: (item) => item.kind === "input" || item.kind === "result",
    },
  };
}

export interface ConsoleQuery extends CompiledQuery<ConsoleStreamItem> {
  parsed: ParsedQuery;
}

/** Parses and compiles a Console query: `level:`, `url:`, `-url:`, `/regex/` and the rest. */
export function compileConsoleQuery(source: string, context: ConsoleQueryContext): ConsoleQuery {
  const parsed = parseQuery(source, CONSOLE_QUERY_KEYS);
  return { parsed, ...compileQuery(parsed, consoleSchema(context)) };
}
