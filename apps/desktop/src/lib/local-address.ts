import { normalizeInspectableUrl } from "@/lib/inspect-url";

/**
 * Where typed text in a page's address bar leads. A path, or a URL on the page's own origin,
 * stays on the same page; a URL on another origin is another page, so it opens as its own target.
 */
export type AddressResolution =
  | { kind: "same-page"; url: string }
  | { kind: "other-page"; url: string };

const PATH_LIKE = /^[\w\-.~%!$&'()*+,;=:@/?#[\]]+$/;

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function resolveAddress(raw: string, currentUrl: string): AddressResolution | null {
  const input = raw.trim();
  if (!input) return null;
  const currentOrigin = originOf(currentUrl);

  if (currentOrigin && /^[/?#]/.test(input)) {
    return { kind: "same-page", url: new URL(input, currentUrl).href };
  }

  const absolute = normalizeInspectableUrl(input);
  if (absolute) {
    const origin = originOf(absolute);
    if (!origin) return null;
    const url = new URL(absolute).href;
    return origin === currentOrigin ? { kind: "same-page", url } : { kind: "other-page", url };
  }

  if (currentOrigin && PATH_LIKE.test(input)) {
    return { kind: "same-page", url: new URL(`/${input}`, currentOrigin).href };
  }
  return null;
}

/** The address as the bar shows it at rest: no `http://`, and no slash after a bare origin. */
export function displayAddress(url: string): { origin: string; rest: string } {
  try {
    const parsed = new URL(url);
    const rest = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return { origin: parsed.host, rest: rest === "/" ? "" : rest };
  } catch {
    return { origin: url, rest: "" };
  }
}
