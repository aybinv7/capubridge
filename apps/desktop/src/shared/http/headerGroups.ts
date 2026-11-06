/** Header pairs sorted by name, for stable reading. */
export function sortedHeaders(headers: Record<string, string>): Array<[string, string]> {
  return Object.entries(headers).sort(([a], [b]) => a.localeCompare(b));
}

/** Response headers worth reading first: what the body is, how it is cached, where it points. */
export const RESPONSE_FIRST: readonly string[] = [
  "content-type",
  "content-length",
  "content-encoding",
  "cache-control",
  "etag",
  "last-modified",
  "expires",
  "age",
  "location",
  "retry-after",
  "www-authenticate",
  "access-control-allow-origin",
];

/** Request headers worth reading first: what was sent, what was asked for, who asked. */
export const REQUEST_FIRST: readonly string[] = [
  "content-type",
  "content-length",
  "accept",
  "authorization",
  "cache-control",
  "if-none-match",
  "if-modified-since",
  "range",
  "origin",
];

/** At most this many headers show unfolded without a "more" control. */
export const UNFOLDED_LIMIT = 6;

export interface HeaderGroups {
  /** Shown at once: the important headers in reading order, or every header of a short list. */
  surfaced: Array<[string, string]>;
  /** Folded by default, sorted by name. */
  folded: Array<[string, string]>;
  /** The cookie header's value, told in full by the Cookies tab, so not listed here. */
  cookie: string;
  total: number;
}

/**
 * Splits headers into the ones read first and the folded rest. The cookie header (`cookie` or
 * `set-cookie`) is taken out: the Cookies tab is its one home, and the section links there.
 */
export function groupHeaders(
  headers: Record<string, string>,
  first: readonly string[],
  cookieHeader: "cookie" | "set-cookie",
): HeaderGroups {
  let cookie = "";
  const rest: Array<[string, string]> = [];
  for (const pair of sortedHeaders(headers)) {
    if (pair[0].toLowerCase() === cookieHeader) cookie = pair[1];
    else rest.push(pair);
  }
  const total = rest.length + (cookie ? 1 : 0);
  const rank = (name: string) => first.indexOf(name.toLowerCase());
  const ranked = (pairs: Array<[string, string]>) =>
    [...pairs].sort(([a], [b]) => weight(rank(a)) - weight(rank(b)));
  if (rest.length <= UNFOLDED_LIMIT) return { surfaced: ranked(rest), folded: [], cookie, total };
  return {
    surfaced: ranked(rest.filter(([name]) => rank(name) >= 0)),
    folded: rest.filter(([name]) => rank(name) < 0),
    cookie,
    total,
  };
}

function weight(rank: number): number {
  return rank < 0 ? Number.MAX_SAFE_INTEGER : rank;
}
