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

/** A target's visible name: its title, else its URL without the scheme, else "Untitled". */
export function targetDisplayTitle(target: Pick<CDPTarget, "title" | "url">): string {
  const title = target.title?.trim();
  if (title) return title;
  const url = target.url?.trim();
  if (url) return url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  return "Untitled";
}

function rank(target: CDPTarget): number {
  return target.type === "page" ? 0 : target.type === "iframe" ? 1 : 2;
}

/**
 * Groups one device's targets by app. Apps keep the order DevTools reported them, except that the
 * app holding the selected target comes first; inside an app, pages come before frames and workers.
 */
export function groupTargetsByApp(
  targets: readonly CDPTarget[],
  selectedTargetId: string | null,
): TargetGroup[] {
  const groups = new Map<string | null, CDPTarget[]>();
  for (const target of targets) {
    const key = target.packageName?.trim() || null;
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
  const active = result.findIndex((group) => group.hasActive);
  if (active > 0) result.unshift(...result.splice(active, 1));
  return result;
}
