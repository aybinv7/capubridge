/** What the response's own headers say about its lifetime. */
export type FreshnessState = "fresh" | "expired" | "revalidate" | "no-store" | "unknown";

export interface CacheFreshness {
  /** When the server sent it (its `Date` header), in milliseconds. */
  servedAt: number | null;
  /** How old it is now: since `servedAt`, plus the `Age` it already had. */
  ageMs: number | null;
  /** The lifetime its headers give it. */
  lifetimeMs: number | null;
  /** Where the lifetime comes from, in words: "max-age 1 h", "Expires". */
  rule: string | null;
  state: FreshnessState;
  /** Time left while fresh, negative once expired. */
  remainingMs: number | null;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A length of time for people: "45 s", "12 min", "3 h", "2 days". */
export function formatDuration(ms: number): string {
  const value = Math.abs(ms);
  if (value < MINUTE) return `${Math.max(0, Math.round(value / SECOND))} s`;
  if (value < HOUR) return `${Math.round(value / MINUTE)} min`;
  if (value < DAY) return `${Math.round(value / HOUR)} h`;
  const days = Math.round(value / DAY);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function httpDate(value: string | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function directives(value: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (value ?? "").split(",")) {
    const [name = "", argument = ""] = part.trim().split("=");
    if (name) out.set(name.toLowerCase(), argument.replace(/^"|"$/g, ""));
  }
  return out;
}

function seconds(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value.trim())) return null;
  return Number(value) * SECOND;
}

/**
 * Reads a cached response's lifetime from its headers (`Date`, `Age`, `Cache-Control`,
 * `Expires`) the way an HTTP cache would. Cache storage itself ignores all of it: an entry
 * stays until the app deletes it, so this only tells how stale the app's copy is.
 */
export function freshnessOf(
  headers: Readonly<Record<string, string>>,
  now: number,
): CacheFreshness {
  const servedAt = httpDate(headers["date"]);
  const ageHeader = seconds(headers["age"]) ?? 0;
  const ageMs = servedAt === null ? null : Math.max(0, now - servedAt) + ageHeader;
  const control = directives(headers["cache-control"]);
  const base = { servedAt, ageMs, lifetimeMs: null, remainingMs: null };
  if (control.has("no-store")) return { ...base, rule: "no-store", state: "no-store" };
  if (control.has("no-cache")) return { ...base, rule: "no-cache", state: "revalidate" };
  const maxAge = seconds(control.get("max-age"));
  let lifetimeMs: number | null = null;
  let rule: string | null = null;
  if (maxAge !== null) {
    lifetimeMs = maxAge;
    rule = `max-age ${formatDuration(maxAge)}`;
  } else {
    const expires = httpDate(headers["expires"]);
    if (expires !== null && servedAt !== null) {
      lifetimeMs = Math.max(0, expires - servedAt);
      rule = "Expires";
    } else if (headers["expires"] !== undefined) {
      return { ...base, lifetimeMs: 0, rule: "Expires", state: "expired", remainingMs: 0 };
    }
  }
  if (lifetimeMs === null || ageMs === null) {
    return { ...base, lifetimeMs, rule, state: "unknown" };
  }
  const remainingMs = lifetimeMs - ageMs;
  return {
    ...base,
    lifetimeMs,
    rule,
    state: remainingMs > 0 ? "fresh" : "expired",
    remainingMs,
  };
}

/** The freshness in one sentence: "Fresh for 2 h more (max-age 1 day)". */
export function freshnessWords(freshness: CacheFreshness): string {
  const rule = freshness.rule ? ` (${freshness.rule})` : "";
  switch (freshness.state) {
    case "fresh":
      return `Fresh for ${formatDuration(freshness.remainingMs ?? 0)} more${rule}`;
    case "expired":
      return freshness.remainingMs
        ? `Expired ${formatDuration(freshness.remainingMs)} ago${rule}`
        : `Expired${rule}`;
    case "revalidate":
      return "To be checked with the server before each use (no-cache)";
    case "no-store":
      return "Marked no-store: an HTTP cache would not keep it";
    default:
      return freshness.rule ? `No server date to count from${rule}` : "Its headers set no lifetime";
  }
}
