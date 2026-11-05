import type {
  HttpMethodFilter,
  MockInterceptMode,
  MockLogEntry,
  UrlMatchType,
} from "@/types/mock.types";
import type { CDPTarget } from "@/types/cdp.types";

export const HTTP_METHODS = [
  "ANY",
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
] as const satisfies readonly HttpMethodFilter[];

export const CONTENT_TYPES = [
  "application/json",
  "text/plain",
  "text/html",
  "application/xml",
  "application/octet-stream",
] as const;

export const MATCH_TYPES: ReadonlyArray<{ value: UrlMatchType; label: string; hint: string }> = [
  { value: "contains", label: "Contains", hint: "The URL contains this text" },
  { value: "glob", label: "Wildcard", hint: "* matches any run of characters, ? one character" },
  { value: "regex", label: "Regex", hint: "A regular expression, case-insensitive" },
  { value: "exact", label: "Exact", hint: "The whole URL, character for character" },
];

export const PATTERN_PLACEHOLDERS: Record<UrlMatchType, string> = {
  contains: "/api/users",
  glob: "/api/users/*",
  regex: "/api/users/\\d+",
  exact: "https://api.example.com/users",
};

export const MODES: ReadonlyArray<{ value: MockInterceptMode; label: string; hint: string }> = [
  { value: "off", label: "Off", hint: "Requests reach the real servers" },
  {
    value: "cdp",
    label: "In the WebView",
    hint: "Capubridge answers matching requests inside the selected WebView (CDP)",
  },
  {
    value: "http",
    label: "Local server",
    hint: "A mock HTTP server on this computer answers requests sent to it",
  },
];

/** HTTP port bounds the local mock server accepts. */
export const PORT_MIN = 1024;
export const PORT_MAX = 65535;

export const STATUS_MIN = 100;
export const STATUS_MAX = 599;
export const DELAY_MAX_MS = 60_000;

/** Clamps a number field's value into range, falling back when it is not a number. */
export function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

export type LogOutcome = "mocked" | "passed" | "unmatched";

/** What happened to an intercepted request. */
export function logOutcome(entry: MockLogEntry): LogOutcome {
  if (entry.noMatch) return "unmatched";
  return entry.passedThrough ? "passed" : "mocked";
}

export const OUTCOME_WORDS: Record<LogOutcome, string> = {
  mocked: "Mocked",
  passed: "Passed through",
  unmatched: "No rule",
};

/** A clock time for a log row, which stays true without ticking. */
export function clockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Whose rules these are, in words, with the identifiers kept for the tooltip. */
export function scopeWords(
  target: CDPTarget | null,
  appName: string | null,
): { label: string; detail: string } {
  if (!target) {
    return { label: "Shared rules", detail: "No app is selected, so these rules belong to no app" };
  }
  const name = appName ?? (target.title || target.url || target.id);
  if (target.source === "adb" && target.packageName) {
    return {
      label: `Rules for ${name}`,
      detail: `Kept for ${target.packageName} on ${target.deviceSerial ?? "this phone"}, across restarts`,
    };
  }
  return {
    label: `Rules for ${name}`,
    detail: `Kept for pages of ${target.url || target.id}`,
  };
}

/** Rule counts as a sentence, honest about interception being off: "2 rules ready, interception off". */
export function rulesSummary(enabled: number, total: number, mode: MockInterceptMode): string {
  if (total === 0) return "No rules";
  if (mode === "off") {
    return enabled === 0
      ? `${total} ${total === 1 ? "rule" : "rules"}, all off`
      : `${enabled} ${enabled === 1 ? "rule" : "rules"} ready, interception off`;
  }
  return `${enabled} of ${total} ${total === 1 ? "rule" : "rules"} on`;
}

/** Filters rules by name or pattern. */
export function matchesRuleSearch(
  rule: { name: string; urlPattern: string },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return rule.name.toLowerCase().includes(needle) || rule.urlPattern.toLowerCase().includes(needle);
}
