import type { CDPTarget } from "@/types/cdp.types";

export const GLOBAL_SCOPE = "global";

const EARLIER_PREFIX = "earlier:";
const CURRENT_PREFIXES = ["app:", "page:", EARLIER_PREFIX];

type ScopeTarget = Pick<CDPTarget, "source" | "deviceSerial" | "packageName" | "url">;

function deviceOf(target: Pick<CDPTarget, "source" | "deviceSerial">): string {
  return `${target.source}:${target.deviceSerial ?? "local"}`;
}

function originOf(url: string): string {
  try {
    const origin = new URL(url).origin;
    return origin === "null" ? url : origin;
  } catch {
    return url;
  }
}

/**
 * Whose rules apply to a target. An app on a phone keeps its rules by device and package, so they
 * survive the app restarting (which gives its page a new DevTools id); other pages by origin.
 */
export function mockScopeKey(target: ScopeTarget | null): string {
  if (!target) return GLOBAL_SCOPE;
  if (target.source === "adb" && target.packageName) {
    return `app:${target.deviceSerial ?? "local"}:${target.packageName}`;
  }
  return `page:${deviceOf(target)}:${originOf(target.url)}`;
}

/** Where rules saved under a page's DevTools id wait until an app of that device claims them. */
export function earlierScopeFor(target: Pick<CDPTarget, "source" | "deviceSerial">): string {
  return `${EARLIER_PREFIX}${deviceOf(target)}`;
}

/** Whether a stored key is the old page-id scope (`source:serial:pageId`), not a current one. */
export function isPageIdScope(key: string): boolean {
  if (key === GLOBAL_SCOPE) return false;
  if (CURRENT_PREFIXES.some((prefix) => key.startsWith(prefix))) return false;
  return /^(adb|chrome|local):[^:]*:.+$/.test(key);
}

/** The earlier-rules bucket an old page-id scope belongs to. */
export function earlierScopeOfPageId(key: string): string {
  const first = key.indexOf(":");
  const last = key.lastIndexOf(":");
  return `${EARLIER_PREFIX}${key.slice(0, first)}:${key.slice(first + 1, last) || "local"}`;
}
