/** How a request is named in a row: the part that tells it apart, then where it went, quietly. */
export interface RequestNameParts {
  main: string;
  detail: string;
}

/** What a request is called: the path and query, the media type for `data:` URLs. */
export function requestName(url: string): string {
  if (url.startsWith("data:")) {
    const end = url.search(/[;,]/);
    return end > 0 ? url.slice(0, end) : "data:";
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "blob:") return url;
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return url;
  }
}

/** The host a request went to, or an empty string when the URL has none. */
export function requestHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGITS = /^\d+$/;
const LONG_HEX = /^[0-9a-f]{16,}$/i;

/** Whether a path segment is an identifier (a UUID, a number, a long hex hash), not a name. */
export function isIdSegment(segment: string): boolean {
  return UUID.test(segment) || DIGITS.test(segment) || LONG_HEX.test(segment);
}

/** An identifier short enough to tell rows apart: small numbers whole, the rest by their end. */
export function shortId(segment: string): string {
  if (DIGITS.test(segment) && segment.length <= 6) return segment;
  return `…${segment.slice(-4)}`;
}

/**
 * The last path segment and query as the main text ("orders?page=2"), and the host and the path
 * before it as the quiet detail ("api.shop.test/v1/"). A site root reads as its host; a
 * CapacitorHttp call is named by the address it carries. A path that ends in an identifier is
 * named by the segment before it and a short id ("snapshot/…0001"), so rows say what they fetch.
 */
export function requestNameParts(url: string): RequestNameParts {
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return { main: requestName(url), detail: "" };
  }
  try {
    const parsed = new URL(url);
    const proxied = parsed.pathname.includes("_capacitor_http_interceptor_")
      ? parsed.searchParams.get("u")
      : null;
    if (proxied && proxied !== url) return requestNameParts(proxied);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const trailing = parsed.pathname.endsWith("/") && segments.length > 0 ? "/" : "";
    const last = segments.pop();
    const folder = segments.length ? `/${segments.join("/")}/` : "/";
    if (last === undefined) {
      return parsed.search
        ? { main: `/${parsed.search}`, detail: parsed.host }
        : { main: parsed.host || url, detail: "" };
    }
    const parent = segments.at(-1);
    if (parent !== undefined && isIdSegment(last)) {
      const before = segments.slice(0, -1);
      return {
        main: `${parent}/${shortId(last)}${trailing}${parsed.search}`,
        detail: `${parsed.host}${before.length ? `/${before.join("/")}/` : "/"}`,
      };
    }
    return { main: `${last}${trailing}${parsed.search}`, detail: `${parsed.host}${folder}` };
  } catch {
    return { main: url, detail: "" };
  }
}
