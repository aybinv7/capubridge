/** Longest accessible name kept for one element. */
const MAX_NAME_CHARS = 80;

/**
 * A route segment counts as a name only when it is word-like: letters and
 * spaces, 2 to 40 characters. Ids, SKUs and UUIDs carry digits, so they are
 * rejected and a record identifier never becomes a label sent to a policy.
 */
const WORD_LIKE = /^\p{L}[\p{L} ]{1,39}$/u;

/**
 * Raw naming signals read from one DOM element. Kept separate from the
 * element's visible text, which also serves text targets and type readback.
 */
export interface NameSources {
  ariaLabel: string | null;
  labelledBy: string | null;
  title: string | null;
  svgTitle: string | null;
  placeholder: string | null;
  href: string | null;
}

/**
 * Resolves the name an element would be announced by, in accessibility
 * order. This is what makes an icon-only control choosable: Presalio's search
 * icon has no text, no aria-label and no title, and is identified only by
 * `href="/stock/search/"`. Without it, every icon button reached the policy
 * as the bare role `a`, and the policy could not tell search from scan.
 */
export function accessibleName(sources: NameSources): string {
  const candidates = [
    sources.ariaLabel,
    sources.labelledBy,
    sources.title,
    sources.svgTitle,
    sources.placeholder,
    hrefName(sources.href),
  ];
  for (const candidate of candidates) {
    const normalized = normalize(candidate);
    if (normalized !== "") {
      return normalized.slice(0, MAX_NAME_CHARS);
    }
  }
  return "";
}

/** Names a link by the last word-like segment of its route, or null. */
export function hrefName(href: string | null): string | null {
  if (href === null) {
    return null;
  }
  const trimmed = href.trim();
  if (trimmed === "" || trimmed === "#" || /^javascript:/i.test(trimmed)) {
    return null;
  }
  const path = trimmed.startsWith("#/") ? trimmed.slice(1) : pathOf(trimmed);
  if (path === null) {
    return null;
  }
  const segment = path
    .split("/")
    .filter((part) => part !== "")
    .at(-1);
  if (segment === undefined) {
    return null;
  }
  const words = decodeSegment(segment).replace(/[-_]+/g, " ").trim();
  return WORD_LIKE.test(words) ? words : null;
}

function pathOf(href: string): string | null {
  try {
    return new URL(href, "https://base.invalid").pathname;
  } catch {
    return null;
  }
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function normalize(value: string | null): string {
  return value === null ? "" : value.replace(/\s+/g, " ").trim();
}
