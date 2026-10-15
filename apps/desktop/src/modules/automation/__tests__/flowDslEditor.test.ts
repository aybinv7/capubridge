import { describe, expect, test } from "vite-plus/test";
import type { AutomationCandidate } from "@/types/automation.types";
import { applyFlowDslCompletion, getFlowDslCompletions } from "../flowDslEditor";

const candidates: AutomationCandidate[] = [
  {
    id: "webview-1",
    label: "Start order",
    source: "webview",
    target: { kind: "selector", cssSelector: "#start-order" },
    enabled: true,
  },
];

describe("flow DSL editor", () => {
  test("offers command completions from a partial line", () => {
    const suggestions = getFlowDslCompletions("ta", 2, candidates);
    expect(suggestions[0]).toMatchObject({ label: "tap", insertText: 'tap selector ""' });
  });

  test("offers live target completions after a target command", () => {
    const source = "tap ";
    const suggestions = getFlowDslCompletions(source, source.length, candidates);
    expect(suggestions[0]).toMatchObject({
      label: "Start order",
      insertText: 'tap selector "#start-order"',
      detail: "webview target",
    });
  });

  test("replaces only the active line prefix", () => {
    const source = "wait 100\nta\n";
    const suggestions = getFlowDslCompletions(source, 11, candidates);
    const completion = suggestions[0];
    expect(completion).toBeDefined();
    if (completion === undefined) return;
    const applied = applyFlowDslCompletion(source, completion);
    expect(applied.source).toBe('wait 100\ntap selector ""\n');
    expect(applied.cursor).toBe(24);
  });
});
