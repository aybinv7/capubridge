import type { LocalPageVisit } from "@/lib/local-page-history";

interface TabSource {
  url: string;
}

interface LiveSource {
  url: string;
  title: string;
  icon: string | null;
}

/**
 * What a tab shows: the page's live title, else the title it had when last open, else its host.
 * The icon follows the same order.
 */
export function tabLabel(
  target: TabSource,
  live: LiveSource | undefined,
  visits: readonly LocalPageVisit[],
): { title: string; icon: string | null; url: string } {
  const url = live?.url || target.url;
  const visit =
    visits.find((entry) => entry.url === url) ?? visits.find((entry) => entry.url === target.url);
  const title = live?.title.trim() || visit?.title.trim() || hostOf(url);
  return { title, icon: live?.icon ?? visit?.icon ?? null, url };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}
