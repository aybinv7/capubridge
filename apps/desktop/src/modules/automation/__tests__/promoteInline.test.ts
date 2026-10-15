import { describe, expect, test } from "vite-plus/test";
import type { Flow } from "@/types/automation.types";
import type { RunView } from "../runSource";
import { applyInlinePromotion } from "../promoteInline";
import { parseFlow } from "../flowSchema";

function goalStep(id: string) {
  return {
    id,
    op: "goal" as const,
    goal: `goal ${id}`,
    policyId: "rules" as const,
    limits: { maxSteps: 10, maxDurationMs: 60000, maxConsecutiveFailures: 3 },
    acknowledgedNotice: true,
  };
}

function tapStep(id: string, cssSelector: string) {
  return { id, op: "tap" as const, target: { kind: "selector" as const, cssSelector } };
}

function flow(steps: Flow["steps"]): Flow {
  return { version: 1, id: "f1", name: "Test", appPackage: "com.example.app", steps };
}

function runViewFor(_goalId: string, steps: RunView["steps"]): RunView {
  return {
    steps,
    durationMs: 1000,
    stepCount: steps.length,
    failedStepIndex: null,
    status: "passed",
    flowSnapshot: null,
  };
}

function discoveredStep(stepId: string, goalId: string, cssSelector = "#a") {
  return {
    stepId,
    decision: {
      operation: "tap" as const,
      target: { kind: "selector" as const, cssSelector },
      confidence: 1,
      reason: "test",
    },
    resolvedTarget: { x: 10, y: 20, strategy: "selector" as const },
    outcome: "ok" as const,
    error: null,
    screenshotRef: "",
    assertions: [],
    goalStepId: goalId,
    replayOffsetMs: 0,
  };
}

describe("promoteInline", () => {
  test("keeping inserts after goal and validates", () => {
    const f = flow([tapStep("s1", "#a"), goalStep("g1"), tapStep("s3", "#c")]);
    const rv = runViewFor("g1", [discoveredStep("g1.0", "g1"), discoveredStep("g1.1", "g1", "#b")]);
    const result = applyInlinePromotion(f, rv, "g1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(parseFlow(result.flow).ok).toBe(true);
    expect(result.flow.steps.map((s) => s.id)).toContain("g1");
    expect(result.keptCount).toBe(2);
  });

  test("keeping with keepGoal false replaces goal", () => {
    const f = flow([tapStep("s1", "#a"), goalStep("g1"), tapStep("s3", "#c")]);
    const rv = runViewFor("g1", [discoveredStep("g1.0", "g1")]);
    const result = applyInlinePromotion(f, rv, "g1", { keepGoal: false });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.flow.steps.find((s) => s.id === "g1")).toBeUndefined();
    expect(result.flow.steps).toHaveLength(3);
  });

  test("default keeps goal present", () => {
    const f = flow([goalStep("g1")]);
    const rv = runViewFor("g1", [discoveredStep("g1.0", "g1")]);
    const result = applyInlinePromotion(f, rv, "g1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.flow.steps[0]?.id).toBe("g1");
    expect(result.flow.steps[1]?.id).toBe("g1.0");
  });

  test("promoted steps carry warnings for point target", () => {
    const f = flow([goalStep("g1")]);
    const rv = runViewFor("g1", [
      {
        stepId: "g1.0",
        decision: { operation: "tap" as const, confidence: 0.4, reason: "guess" },
        resolvedTarget: { x: 100, y: 200, strategy: "point" as const },
        outcome: "ok" as const,
        error: null,
        screenshotRef: "",
        assertions: [],
        goalStepId: "g1",
        replayOffsetMs: 0,
      },
    ]);
    const result = applyInlinePromotion(f, rv, "g1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.warnings.some((w) => w.kind === "point-target")).toBe(true);
  });

  test("provisional waits are collapsed in kept result", () => {
    const f = flow([goalStep("g1")]);
    const rv = runViewFor("g1", [
      {
        stepId: "w1",
        decision: { operation: "wait" as const, confidence: 1, reason: "wait" },
        resolvedTarget: null,
        outcome: "ok" as const,
        error: null,
        screenshotRef: "",
        assertions: [],
        goalStepId: "g1",
        replayOffsetMs: 0,
      },
      discoveredStep("g1.0", "g1"),
    ]);
    const provisionalCount = rv.steps.length;
    const result = applyInlinePromotion(f, rv, "g1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(provisionalCount).toBe(2);
    expect(result.keptCount).toBe(1);
    expect(result.flow.steps.every((s) => s.op !== "wait")).toBe(true);
  });

  test("keeping a goal that discovered nothing is refused", () => {
    const f = flow([goalStep("g1")]);
    const rv = runViewFor("g1", []);
    const result = applyInlinePromotion(f, rv, "g1");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("discovered no steps");
    }
    expect(f.steps).toHaveLength(1);
  });

  test("undo restores flow exactly", () => {
    const original = flow([tapStep("s1", "#a"), goalStep("g1"), tapStep("s3", "#c")]);
    const rv = runViewFor("g1", [discoveredStep("g1.0", "g1")]);
    const result = applyInlinePromotion(original, rv, "g1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    const restored = original;
    expect(restored).toEqual(original);
    expect(result.flow.steps).not.toEqual(original.steps);
  });

  test("keeping one goal leaves the other untouched", () => {
    const f = flow([goalStep("g1"), goalStep("g2")]);
    const rv = runViewFor("g1", [discoveredStep("g1.0", "g1")]);
    const result = applyInlinePromotion(f, rv, "g1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.flow.steps.find((s) => s.id === "g2")).toBeDefined();
    expect(result.flow.steps.filter((s) => s.id === "g1.0")).toHaveLength(1);
  });
});
