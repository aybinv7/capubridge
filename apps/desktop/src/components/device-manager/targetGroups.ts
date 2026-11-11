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
  app: "App",
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
 * The socket of a placeholder for a DevTools socket whose pages could not be listed, else null.
 * Its title is the socket name, followed by the app's package when Android said which app it is
 * (`webview_devtools_remote_19350 (com.presalio.retail)`), and it has no page address.
 */
export function unansweredSocketOf(target: Pick<CDPTarget, "id" | "title" | "url">): string | null {
  if (target.url?.trim()) return null;
  const socket = target.title?.trim().split(/\s+/)[0];
  return socket && target.id.endsWith(`:${socket}`) ? socket : null;
}

export function isUnansweredSocket(target: Pick<CDPTarget, "id" | "title" | "url">): boolean {
  return unansweredSocketOf(target) !== null;
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
    : "No page open. Open the app on the phone, then scan again.";
}

/** A target's visible name: its title, else its URL without the scheme, else "Untitled". */
export function targetDisplayTitle(target: Pick<CDPTarget, "id" | "title" | "url">): string {
  const socket = unansweredSocketOf(target);
  if (socket) return socketDisplayName(socket);
  const title = target.title?.trim();
  if (title) return title;
  const url = target.url?.trim();
  if (url) return url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  return "Untitled";
}

const APP_ORIGIN = /^(?:https?|capacitor|ionic):\/\/localhost(?::\d+)?$/i;

/**
 * The route of a page an installed app serves itself (`https://localhost/…`, `capacitor://…`), or
 * null for a page on the open web. Every such app reports the same origin, so only the route says
 * anything.
 */
export function appRouteOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (
      !APP_ORIGIN.test(
        parsed.origin === "null" ? `${parsed.protocol}//${parsed.host}` : parsed.origin,
      )
    ) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return null;
  }
}

/**
 * The two lines of a target row. A page an app serves itself drops the shared origin and shows
 * its route; a title that only repeats the app's name gives way to the route.
 */
export function describeTargetLines(
  target: Pick<CDPTarget, "id" | "title" | "url">,
  appLabel: string | null,
): { title: string; detail: string | null } {
  const title = targetDisplayTitle(target);
  const route = appRouteOf(target.url);
  if (route === null) {
    return { title, detail: target.title?.trim() && target.url ? target.url : null };
  }
  const repeatsApp =
    appLabel !== null && title.trim().toLowerCase() === appLabel.trim().toLowerCase();
  if (repeatsApp) return { title: route === "/" ? "Main screen" : route, detail: null };
  return { title, detail: route === "/" ? null : route };
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
