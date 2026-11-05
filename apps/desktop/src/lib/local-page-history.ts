export interface LocalPageVisit {
  url: string;
  /** The page's own title when it was last open; empty until the page has loaded once. */
  title: string;
  /** The page's icon as a data URL, so it shows without loading anything from the page's site. */
  icon: string | null;
  openedAt: number;
}

export const MAX_LOCAL_PAGE_VISITS = 12;
/** Icons larger than this are not kept; history lives in local storage. */
export const MAX_ICON_DATA_URL_LENGTH = 48_000;

export function isLocalPageVisit(value: unknown): value is LocalPageVisit {
  if (!value || typeof value !== "object") return false;
  const visit = value as Record<string, unknown>;
  return (
    typeof visit.url === "string" &&
    typeof visit.title === "string" &&
    (visit.icon === null || typeof visit.icon === "string") &&
    typeof visit.openedAt === "number"
  );
}

export function isVisitList(value: unknown): value is LocalPageVisit[] {
  return Array.isArray(value) && value.every(isLocalPageVisit);
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Puts a visit first, keeping what is already known about the page and its site's icon. */
export function recordVisit(visits: LocalPageVisit[], url: string, now: number): LocalPageVisit[] {
  const known = visits.find((visit) => visit.url === url);
  const origin = originOf(url);
  const siteIcon = visits.find((visit) => visit.icon && originOf(visit.url) === origin)?.icon;
  const visit: LocalPageVisit = {
    url,
    title: known?.title ?? "",
    icon: known?.icon ?? siteIcon ?? null,
    openedAt: now,
  };
  return [visit, ...visits.filter((entry) => entry.url !== url)].slice(0, MAX_LOCAL_PAGE_VISITS);
}

export function describeVisit(
  visits: LocalPageVisit[],
  url: string,
  details: { title: string; icon: string | null },
): LocalPageVisit[] {
  const icon =
    details.icon && details.icon.length <= MAX_ICON_DATA_URL_LENGTH ? details.icon : null;
  return visits.map((visit) =>
    visit.url === url
      ? { ...visit, title: details.title.trim() || visit.title, icon: icon ?? visit.icon }
      : visit,
  );
}

/** The icon known for a page's site, for rows that show a page that is open right now. */
export function iconForUrl(visits: LocalPageVisit[], url: string): string | null {
  const exact = visits.find((visit) => visit.url === url && visit.icon);
  if (exact) return exact.icon;
  const origin = originOf(url);
  return visits.find((visit) => visit.icon && originOf(visit.url) === origin)?.icon ?? null;
}
