import { describe, expect, test } from "vite-plus/test";
import type { FlowStep, TargetRef } from "@/types/automation.types";
import type { RunViewStep } from "../runSource";
import { inspectorState, replayHref, runDetailFor, withTarget } from "../stepInspectorState";
import { validateStepAt } from "../flowValidate";

function tapStep(target: TargetRef): FlowStep {
  return { id: "s1", op: "tap", target };
}

function runStep(overrides: Partial<RunViewStep> = {}): RunViewStep {
  return {
    stepId: "s1",
    decision: { operation: "tap", confidence: 0.9, reason: "test" },
    resolvedTarget: { x: 10, y: 20, strategy: "selector" },
    outcome: "ok",
    error: null,
    screenshotRef: "shot.png",
    assertions: [],
    goalStepId: null,
    replayOffsetMs: 1234,
    ...overrides,
  };
}

describe("stepInspectorState", () => {
  test("editing a step's target produces a valid step for each target kind", () => {
    const base = tapStep({ kind: "selector", cssSelector: "#a" });
    const kinds: TargetRef[] = [
      { kind: "selector", cssSelector: "#login" },
      { kind: "text", text: "Sign in", exact: false },
      { kind: "nativeIndex", index: 2 },
      { kind: "point", x: 100, y: 200 },
    ];
    for (const target of kinds) {
      const next = withTarget(base, target);
      const errors = validateStepAt(next, "step");
      expect(errors).toEqual([]);
    }
  });

  test("an invalid edit surfaces the precise message from validateStep", () => {
    const bad: FlowStep = { id: "s1", op: "tap", target: { kind: "selector", cssSelector: "" } };
    const errors = validateStepAt(bad, "step");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain("cssSelector");
    const state = inspectorState(bad, null, null);
    expect(state.errors[0]?.message).toBe(errors[0]?.message);
  });

  test("run mode exposes expected against observed for a failed assertion", () => {
    const step = runStep({
      assertions: [
        {
          passed: false,
          assertion: {
            kind: "textEquals",
            target: { kind: "selector", cssSelector: "#a" },
            expected: "hello",
          },
          elapsedMs: 10,
          attempts: 1,
          observed: "world",
        },
      ],
    });
    const detail = runDetailFor(step, null);
    expect(detail.assertions).toHaveLength(1);
    expect(detail.assertions[0]?.expected).toBe("hello");
    expect(detail.assertions[0]?.observed).toBe("world");
    expect(detail.assertions[0]?.passed).toBe(false);
  });

  test("a step with no screenshot yields an absent state", () => {
    const detail = runDetailFor(runStep({ screenshotRef: "" }), null);
    expect(detail.screenshot.present).toBe(false);
    expect(detail.screenshot.ref).toBeNull();
  });

  test("the replay link carries the file path and the step's millisecond offset", () => {
    const link = replayHref("/capu/run-1.capu", 1234);
    expect(link).toBe("/replay?file=%2Fcapu%2Frun-1.capu&t=1234");
    const detail = runDetailFor(runStep({ replayOffsetMs: 500 }), "/capu/run-1.capu");
    expect(detail.replayHref).toBe("/replay?file=%2Fcapu%2Frun-1.capu&t=500");
  });

  test("a step resolved by text fallback reports that it fell back", () => {
    const selector = runDetailFor(
      runStep({ resolvedTarget: { x: 1, y: 2, strategy: "selector" } }),
      null,
    );
    const text = runDetailFor(runStep({ resolvedTarget: { x: 1, y: 2, strategy: "text" } }), null);
    expect(selector.fallbackLabel).toBe("selector match");
    expect(text.fallbackLabel).toBe("text fallback");
    expect(selector.fallbackLabel).not.toBe(text.fallbackLabel);
  });

  test("a step with a raw policy answer exposes it as formatted JSON", () => {
    const detail = runDetailFor(
      runStep({
        decision: {
          operation: "tap",
          confidence: 0.93,
          reason: "jev",
          detail: { answers: { operation: { choice: "tap" } } },
        },
      }),
      null,
    );
    expect(detail.rawAnswer).toContain("tap");
    expect(detail.rawAnswer).toContain("answers");
  });

  test("a step without a raw answer yields no raw block", () => {
    const detail = runDetailFor(runStep(), null);
    expect(detail.rawAnswer).toBeNull();
  });

  test("switching selection between draft and run yields correct mode without leaking", () => {
    const draft = inspectorState(tapStep({ kind: "selector", cssSelector: "#a" }), null, null);
    expect(draft.mode).toBe("draft");
    expect(draft.runDetail).toBeNull();
    const run = inspectorState(null, runStep(), "/capu/run.capu");
    expect(run.mode).toBe("run");
    expect(run.runDetail).not.toBeNull();
    expect(run.errors).toEqual([]);
    const back = inspectorState(tapStep({ kind: "point", x: 1, y: 2 }), null, null);
    expect(back.mode).toBe("draft");
    expect(back.runDetail).toBeNull();
  });
});
