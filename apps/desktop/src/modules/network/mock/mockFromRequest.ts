import type {
  HttpMethodFilter,
  MockResponseHeader,
  MockRule,
  UrlMatchType,
} from "@/types/mock.types";
import type { NetworkEntry } from "@/types/network.types";
import { HTTP_METHODS } from "./mockView";

const DROPPED_HEADERS = new Set([
  "content-type",
  "content-length",
  "content-encoding",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "date",
  "alt-svc",
]);

const MAX_NAME = 60;

/**
 * A URL pattern that matches this request and its siblings with other query values: the exact
 * URL when it has no query, otherwise the origin and path followed by "?". Globs are avoided
 * because their "?" matches any character, which would also catch deeper paths.
 */
export function patternForUrl(url: string): { urlPattern: string; urlMatchType: UrlMatchType } {
  try {
    const parsed = new URL(url);
    const base = `${parsed.origin}${parsed.pathname}`;
    if (!parsed.search) return { urlPattern: base, urlMatchType: "exact" };
    return { urlPattern: `${base}?`, urlMatchType: "contains" };
  } catch {
    return { urlPattern: url, urlMatchType: "contains" };
  }
}

function methodFilter(method: string): HttpMethodFilter {
  const upper = method.toUpperCase();
  return (HTTP_METHODS as readonly string[]).includes(upper) ? (upper as HttpMethodFilter) : "ANY";
}

function ruleName(entry: NetworkEntry): string {
  let path = entry.url;
  try {
    path = new URL(entry.url).pathname;
  } catch {
    path = entry.url;
  }
  const name = path || entry.url;
  return name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name;
}

function keptHeaders(headers: Record<string, string>): MockResponseHeader[] {
  return Object.entries(headers)
    .filter(([name]) => !name.startsWith(":") && !DROPPED_HEADERS.has(name.toLowerCase()))
    .flatMap(([name, value]) =>
      value.split("\n").map((line) => ({ id: crypto.randomUUID(), name, value: line })),
    );
}

function contentTypeOf(entry: NetworkEntry): string {
  const header = Object.entries(entry.responseHeaders).find(
    ([name]) => name.toLowerCase() === "content-type",
  )?.[1];
  return header?.trim() || entry.mimeType || "application/json";
}

/**
 * A mock rule that answers like this request was answered: same method, a URL pattern for it,
 * its status, content type, headers that still make sense for a replayed body, and the body text
 * when it was text. A JSON body is pretty-printed so it is pleasant to edit.
 */
export function mockRuleFromRequest(entry: NetworkEntry, body: string | null): Partial<MockRule> {
  const contentType = contentTypeOf(entry);
  return {
    name: ruleName(entry),
    enabled: true,
    method: methodFilter(entry.method),
    ...patternForUrl(entry.url),
    statusCode: entry.httpStatus && entry.httpStatus >= 200 ? entry.httpStatus : 200,
    contentType,
    responseHeaders: keptHeaders(entry.responseHeaders),
    responseBody: prettyBody(body ?? "", contentType),
    delayMs: 0,
    passThrough: false,
  };
}

/** Pretty-prints a JSON body; other bodies are returned as they are. */
export function prettyBody(body: string, contentType: string): string {
  if (!contentType.includes("json") || !body.trim()) return body;
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
