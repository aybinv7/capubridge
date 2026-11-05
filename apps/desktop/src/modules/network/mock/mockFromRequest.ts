import type {
  HttpMethodFilter,
  MockResponseHeader,
  MockRule,
  UrlMatchType,
} from "@/types/mock.types";
import { MOCKABLE_RESOURCE_TYPES } from "@/types/mock.types";
import type { NetworkEntry } from "@/types/network.types";
import { HTTP_METHODS } from "./mockView";

/** A response body as CDP hands it over: text, or Base64 for bytes. */
export interface MockSourceBody {
  body: string;
  base64Encoded: boolean;
}

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

const CAPACITOR_HTTP_PATH = "_capacitor_http_interceptor_";
const MAX_NAME = 60;

function queryCarriesAddress(parsed: URL): boolean {
  if (parsed.pathname.includes(CAPACITOR_HTTP_PATH)) return true;
  for (const value of parsed.searchParams.values()) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return true;
  }
  return false;
}

/**
 * A URL pattern that matches this request. Without a query: the exact URL. With a query that
 * carries the real address (CapacitorHttp's `?u=`, proxies): the exact URL, query included, since
 * the path alone would catch every call. Otherwise the origin and path followed by "?", so other
 * query values match too. Globs are avoided because their "?" matches any character.
 */
export function patternForUrl(url: string): { urlPattern: string; urlMatchType: UrlMatchType } {
  try {
    const parsed = new URL(url);
    const base = `${parsed.origin}${parsed.pathname}`;
    if (!parsed.search) return { urlPattern: base, urlMatchType: "exact" };
    if (queryCarriesAddress(parsed)) return { urlPattern: url, urlMatchType: "exact" };
    return { urlPattern: `${base}?`, urlMatchType: "contains" };
  } catch {
    return { urlPattern: url, urlMatchType: "contains" };
  }
}

export type MockAvailability = { ok: true } | { ok: false; reason: string };

/** Whether "Mock this response" can make a rule that will ever answer this request. */
export function mockAvailability(entry: NetworkEntry): MockAvailability {
  if (entry.isWebSocket) {
    return { ok: false, reason: "A WebSocket has no response to replay." };
  }
  if (entry.state !== "finished") {
    return { ok: false, reason: "Available once the request has finished." };
  }
  if (!MOCKABLE_RESOURCE_TYPES.includes(entry.resourceType)) {
    return {
      ok: false,
      reason:
        "Interception answers calls from code and page loads; images, scripts, styles, fonts and media load untouched.",
    };
  }
  return { ok: true };
}

function methodFilter(method: string): HttpMethodFilter {
  const upper = method.toUpperCase();
  return (HTTP_METHODS as readonly string[]).includes(upper) ? (upper as HttpMethodFilter) : "ANY";
}

function ruleName(entry: NetworkEntry): string {
  let name = entry.url;
  try {
    const parsed = new URL(entry.url);
    const target = parsed.pathname.includes(CAPACITOR_HTTP_PATH)
      ? parsed.searchParams.get("u")
      : null;
    name = target ? new URL(target).pathname : parsed.pathname;
  } catch {
    name = entry.url;
  }
  const label = name || entry.url;
  return label.length > MAX_NAME ? `${label.slice(0, MAX_NAME - 1)}…` : label;
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

/** A redirect or "not modified" replayed as is has no body to show, so it answers 200. */
function replayStatus(status: number | null): number {
  if (!status || status < 200 || (status >= 300 && status < 400)) return 200;
  return status;
}

/**
 * A mock rule that answers like this request was answered: same method, a URL pattern for it,
 * its status (redirects and 304 become 200), content type, the headers that still make sense for a
 * replayed body, and the body exactly as it arrived: text byte for byte, bytes as Base64.
 */
export function mockRuleFromRequest(
  entry: NetworkEntry,
  body: MockSourceBody | null,
): Partial<MockRule> {
  return {
    name: ruleName(entry),
    enabled: true,
    method: methodFilter(entry.method),
    ...patternForUrl(entry.url),
    statusCode: replayStatus(entry.httpStatus),
    contentType: contentTypeOf(entry),
    responseHeaders: keptHeaders(entry.responseHeaders),
    responseBody: body?.body ?? "",
    ...(body?.base64Encoded ? { bodyEncoding: "base64" as const } : {}),
    delayMs: 0,
    passThrough: false,
  };
}

/** What a person should know about the rule just made, in sentences. */
export function mockRuleNotes(entry: NetworkEntry, rule: Partial<MockRule>): string[] {
  const notes: string[] = [];
  if (entry.hasPostData) {
    notes.push(
      `It answers every ${entry.method.toUpperCase()} to this address, whatever the request sends.`,
    );
  }
  if (entry.httpStatus !== null && entry.httpStatus !== rule.statusCode) {
    notes.push(`The original ${entry.httpStatus} is answered as ${rule.statusCode}.`);
  }
  return notes;
}

/** Pretty-prints a JSON body when asked; other bodies, and JSON that does not parse, stay as they are. */
export function prettyBody(body: string, contentType: string): string {
  if (!contentType.includes("json") || !body.trim()) return body;
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
