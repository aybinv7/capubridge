import type { CDPTarget } from "@/types/cdp.types";

/**
 * The name a person knows the inspected app by, in the order the title bar uses: the installed
 * app's label, then the page title, then its address. `null` without a target.
 */
export function targetAppName(
  target: Pick<CDPTarget, "title" | "url"> | null | undefined,
  installedLabel: string | null | undefined,
): string | null {
  if (!target) return null;
  const label = installedLabel?.trim();
  if (label) return label;
  const title = target.title?.trim();
  return title ? title : target.url;
}
