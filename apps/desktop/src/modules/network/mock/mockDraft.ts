import type { MockRule } from "@/types/mock.types";
import { prettyBody } from "./mockFromRequest";

/** The part of a rule the editor changes; the rest (id, on/off, hits, creation) is the store's. */
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
  | "delayMs"
  | "passThrough"
>;

/** The editor-owned fields of a rule as stored, copied so edits never reach the store. */
export function draftFields(rule: MockRule): MockRuleDraft {
  return {
    name: rule.name,
    method: rule.method,
    urlPattern: rule.urlPattern,
    urlMatchType: rule.urlMatchType,
    statusCode: rule.statusCode,
    contentType: rule.contentType,
    responseHeaders: rule.responseHeaders.map((header) => ({ ...header })),
    responseBody: rule.responseBody,
    delayMs: rule.delayMs,
    passThrough: rule.passThrough,
  };
}

/** A fresh, independent draft of a rule, with a JSON body pretty-printed for editing. */
export function draftFromRule(rule: MockRule): MockRuleDraft {
  const fields = draftFields(rule);
  return { ...fields, responseBody: prettyBody(fields.responseBody, fields.contentType) };
}

/** A comparable fingerprint of what the editor owns, to tell real changes from echoes. */
export function draftSignature(draft: MockRuleDraft): string {
  return JSON.stringify([
    draft.name,
    draft.method,
    draft.urlPattern,
    draft.urlMatchType,
    draft.statusCode,
    draft.contentType,
    draft.responseHeaders.map((header) => [header.id, header.name, header.value]),
    draft.responseBody,
    draft.delayMs,
    draft.passThrough,
  ]);
}

/** The stored rule with the editor's fields applied, keeping its switch, hits and identity. */
export function applyDraft(rule: MockRule, draft: MockRuleDraft): MockRule {
  return {
    ...rule,
    ...draft,
    responseHeaders: draft.responseHeaders.map((header) => ({ ...header })),
  };
}
