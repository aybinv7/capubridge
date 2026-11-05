import { utf8ToBase64 } from "@/lib/base64";
import type { MockRule } from "@/types/mock.types";

const encodedBodies = new WeakMap<MockRule, string>();

/**
 * The rule's body as `Fetch.fulfillRequest` wants it (Base64), encoded once per rule version:
 * rules are replaced, never mutated, so a new version is a new object and a new cache entry.
 */
export function encodedBody(rule: MockRule): string | undefined {
  if (!rule.responseBody) return undefined;
  if (rule.bodyEncoding === "base64") return rule.responseBody;
  let encoded = encodedBodies.get(rule);
  if (encoded === undefined) {
    encoded = utf8ToBase64(rule.responseBody);
    encodedBodies.set(rule, encoded);
  }
  return encoded;
}

function findHeader(headers: Record<string, string>, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

function hasHeader(headers: ReadonlyArray<{ name: string }>, name: string): boolean {
  const wanted = name.toLowerCase();
  return headers.some((header) => header.name.toLowerCase() === wanted);
}

/** Response headers for a mocked answer: the rule's, its content type, and CORS for the caller. */
export function answerHeaders(
  rule: MockRule,
  requestHeaders: Record<string, string>,
): Array<{ name: string; value: string }> {
  const headers = rule.responseHeaders.map((header) => ({
    name: header.name,
    value: header.value,
  }));
  if (rule.contentType && !hasHeader(headers, "content-type")) {
    headers.unshift({ name: "content-type", value: rule.contentType });
  }
  const origin = findHeader(requestHeaders, "origin");
  if (origin && !hasHeader(headers, "access-control-allow-origin")) {
    headers.push({ name: "access-control-allow-origin", value: origin });
  }
  if (origin && !hasHeader(headers, "access-control-allow-credentials")) {
    headers.push({ name: "access-control-allow-credentials", value: "true" });
  }
  return headers;
}
