import { describe, expect, test } from "vite-plus/test";
import { redactDecision, redactText } from "../redact";
import type { Decision } from "@/types/automation.types";

/**
 * Values that must never survive into a durable trace or an MCP response.
 * Shaped like real credentials rather than the word "secret", because the
 * masking is pattern-based and a placeholder would prove nothing.
 */
const SECRETS = {
  jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk",
  bearer: `Bearer ${["sk", "or", "v1", "4c1f".repeat(16)].join("-")}`,
  apiKey: "api_key=9f8e7d6c5b4a39281706f5e4d3c2b1a0",
  hex40: "3f5a9c2e7b1d4f6a8c0e2b4d6f8a0c2e4b6d8f0a",
  email: "field.tester@example.com",
  card: "4539148803436467",
};

function decisionTyping(text: string): Decision {
  return { operation: "type", text, confidence: 1, reason: "flow step s1" };
}

describe("secrets cannot reach a durable trace or an MCP response", () => {
  for (const [kind, secret] of Object.entries(SECRETS)) {
    test(`a ${kind} typed by a step is masked in the decision`, () => {
      const masked = redactDecision(decisionTyping(secret));
      expect(JSON.stringify(masked)).not.toContain(secret);
    });
  }

  test("a secret embedded in a sentence is masked without dropping the sentence", () => {
    const masked = redactDecision(decisionTyping(`login with ${SECRETS.jwt} now`));
    expect(masked.text).not.toContain(SECRETS.jwt);
    expect(masked.text).toContain("login with");
  });

  test("ordinary text survives, so the trace stays useful for debugging", () => {
    const masked = redactDecision(decisionTyping("Awane"));
    expect(masked.text).toBe("Awane");
  });

  test("a raw policy answer is masked at every depth", () => {
    const masked = redactDecision({
      operation: "type",
      text: "ok",
      confidence: 1,
      reason: "jev",
      detail: {
        answers: { token: SECRETS.bearer },
        candidates: [{ label: SECRETS.email }, { nested: [SECRETS.apiKey] }],
      },
    } as Decision);
    const serialized = JSON.stringify(masked);
    for (const secret of [SECRETS.bearer, SECRETS.email, SECRETS.apiKey]) {
      expect(serialized).not.toContain(secret);
    }
  });

  test("masking is idempotent, so a re-read of a trace does not double-mask", () => {
    const once = redactDecision(decisionTyping(SECRETS.hex40));
    const twice = redactDecision(once);
    expect(twice.text).toBe(once.text);
  });

  test("a decision with no text or detail is returned unchanged", () => {
    const decision: Decision = { operation: "back", confidence: 1, reason: "flow step s2" };
    expect(redactDecision(decision)).toEqual(decision);
  });

  test("the sweep: no secret fixture survives serialization of a masked decision", () => {
    for (const secret of Object.values(SECRETS)) {
      const masked = redactDecision({
        operation: "type",
        text: secret,
        confidence: 1,
        reason: secret,
        detail: { echo: secret },
      } as Decision);
      const serialized = JSON.stringify({ ...masked, reason: redactText(masked.reason) });
      expect(serialized, `leaked ${secret}`).not.toContain(secret);
    }
  });
});
