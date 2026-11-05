import type { MockRule } from "@/types/mock.types";

/** The part of a rule the editor changes; the rest (id, on/off, creation) is the store's. */
export type MockRuleDraft = Pick<
  MockRule,
  | "name"
  | "method"
  | "urlPattern"
  | "urlMatchType"
  | "statusCode"
  | "contentType"
  | "responseHeaders"
  | "responseBody"
  | "bodyEncoding"
  | "delayMs"
  | "passThrough"
>;

/** A fresh, independent draft of a rule, its body kept exactly as stored. */
export function draftFromRule(rule: MockRule): MockRuleDraft {
  return {
    name: rule.name,
    method: rule.method,
    urlPattern: rule.urlPattern,
    urlMatchType: rule.urlMatchType,
    statusCode: rule.statusCode,
    contentType: rule.contentType,
    responseHeaders: rule.responseHeaders.map((header) => ({ ...header })),
    responseBody: rule.responseBody,
    bodyEncoding: rule.bodyEncoding,
    delayMs: rule.delayMs,
    passThrough: rule.passThrough,
  };
}

/** Whether two rules differ in anything the editor owns; field by field, never serialised. */
export function sameEditorFields(a: MockRule, b: MockRule): boolean {
  if (
    a.name !== b.name ||
    a.method !== b.method ||
    a.urlPattern !== b.urlPattern ||
    a.urlMatchType !== b.urlMatchType ||
    a.statusCode !== b.statusCode ||
    a.contentType !== b.contentType ||
    a.responseBody !== b.responseBody ||
    a.bodyEncoding !== b.bodyEncoding ||
    a.delayMs !== b.delayMs ||
    a.passThrough !== b.passThrough ||
    a.responseHeaders.length !== b.responseHeaders.length
  ) {
    return false;
  }
  return a.responseHeaders.every((header, index) => {
    const other = b.responseHeaders[index];
    return other?.name === header.name && other.value === header.value;
  });
}

/** The stored rule with the editor's fields applied, keeping its switch and identity. */
export function applyDraft(rule: MockRule, draft: MockRuleDraft): MockRule {
  const next: MockRule = {
    ...rule,
    ...draft,
    responseHeaders: draft.responseHeaders.map((header) => ({
      id: header.id,
      name: header.name,
      value: header.value,
    })),
  };
  if (!draft.bodyEncoding) delete next.bodyEncoding;
  return next;
}
