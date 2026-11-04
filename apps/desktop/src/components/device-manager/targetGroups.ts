import type { CDPTarget } from "@/types/cdp.types";

export interface TargetGroup {
  /** Package name, or null when DevTools did not report one. */
  packageName: string | null;
  targets: CDPTarget[];
  /** True when the selected target belongs to this app. */
  hasActive: boolean;
}

const TYPE_LABEL: Record<CDPTarget["type"], string> = {
  page: "Page",
  iframe: "Frame",
  worker: "Worker",
  background_page: "Background page",
};

export function targetTypeLabel(target: Pick<CDPTarget, "type">): string {
  return TYPE_LABEL[target.type] ?? target.type;
}

/** The word shown at the end of a row: nothing for a page, the kind for anything else. */
export function targetKindHint(target: Pick<CDPTarget, "type">): string | null {
  return target.type === "page" ? null : targetTypeLabel(target);
}

const CHROME_SOCKET = "chrome_devtools_remote";

/**
 * A DevTools socket Capubridge found but whose page list did not answer: discovery reports it as
 * a page titled with the raw socket name, no URL, and the id `adb:<serial>:<socket>`.
 */
export function isUnansweredSocket(target: Pick<CDPTarget, "id" | "title" | "url">): boolean {
  const socket = target.title?.trim();
  return Boolean(socket) && !target.url?.trim() && target.id.endsWith(`:${socket}`);
}

/** Plain words for a raw DevTools socket name. */
export function socketDisplayName(socket: string): string {
  if (socket === CHROME_SOCKET) return "Chrome browser";
  const pid = /^webview_devtools_remote_(\d+)$/.exec(socket)?.[1];
  if (pid) return `WebView in process ${pid}`;
  return socket;
}

/** What to tell the user about a socket whose pages could not be listed. */
export function unansweredSocketHint(socket: string): string {
  return socket === CHROME_SOCKET
    ? "No tabs to show. Open a page in Chrome on the device, then scan again."
    : "Its pages could not be listed. Bring the app to the front, then scan again.";
}

/** A target's visible name: its title, else its URL without the scheme, else "Untitled". */
export function targetDisplayTitle(target: Pick<CDPTarget, "id" | "title" | "url">): string {
  if (isUnansweredSocket(target)) return socketDisplayName(target.title.trim());
  const title = target.title?.trim();
  if (title) return title;
  const url = target.url?.trim();
  if (url) return url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  return "Untitled";
}

/** The app a target belongs to, or null when discovery could not tell ("unknown" or blank). */
export function appPackageOf(target: Pick<CDPTarget, "packageName">): string | null {
  const name = target.packageName?.trim();
  return name && name !== "unknown" ? name : null;
}

function rank(target: CDPTarget): number {
  return target.type === "page" ? 0 : target.type === "iframe" ? 1 : 2;
}

/**
 * Groups one device's targets by app. Apps keep the order DevTools reported them, except that the
 * app holding the selected target comes first and targets no app could be matched to come last;
 * inside an app, pages come before frames and workers.
 */
export function groupTargetsByApp(
  targets: readonly CDPTarget[],
  selectedTargetId: string | null,
): TargetGroup[] {
  const groups = new Map<string | null, CDPTarget[]>();
  for (const target of targets) {
    const key = appPackageOf(target);
    const bucket = groups.get(key);
    if (bucket) bucket.push(target);
    else groups.set(key, [target]);
  }
  const result = Array.from(groups, ([packageName, members]) => ({
    packageName,
    targets: members
      .map((target, index) => ({ target, index }))
      .sort((a, b) => rank(a.target) - rank(b.target) || a.index - b.index)
      .map(({ target }) => target),
    hasActive:
      selectedTargetId !== null && members.some((target) => target.id === selectedTargetId),
  }));
  const unlinked = result.findIndex((group) => group.packageName === null);
  if (unlinked >= 0 && !result[unlinked].hasActive) result.push(...result.splice(unlinked, 1));
  const active = result.findIndex((group) => group.hasActive);
  if (active > 0) result.unshift(...result.splice(active, 1));
  return result;
}
