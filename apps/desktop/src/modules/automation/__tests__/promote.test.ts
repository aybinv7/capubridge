import { describe, expect, test } from "vite-plus/test";
import type { Decision, StepRecord } from "@/types/automation.types";
import { parseFlow, serializeFlow } from "../flowSchema";
import { promoteRun, promoteSteps, runTraceFromEvents } from "../promote";
import type { PromotableStep, RunTrace } from "../promote";

function record(
  stepId: string,
  decision: Decision,
  overrides: Partial<StepRecord> = {},
): StepRecord {
  return {
    stepId,
    startedAt: 1000,
    endedAt: 1100,
    decision,
    resolvedTarget: null,
    outcome: "ok",
    error: null,
    screenshotRef: "",
    ...overrides,
  };
}

function tapDecision(cssSelector: string): Decision {
  return {
    operation: "tap",
    target: { kind: "selector", cssSelector },
    confidence: 1,
    reason: "test",
  };
}

function trace(steps: PromotableStep[], status: RunTrace["status"] = "passed"): RunTrace {
  return { runId: "run-1", status, policyId: "rules", steps };
}

describe("promoteRun", () => {
  test("a successful run promotes to a flow that validates", () => {
    const result = promoteRun(
      trace([
        {
          record: record("s1", tapDecision("#a"), {
            resolvedTarget: { x: 10, y: 20, strategy: "selector" },
          }),
          assertions: [],
        },
        {
          record: record("s2", { operation: "back", confidence: 1, reason: "test" }),
          assertions: [],
        },
        {
          record: record("s3", {
            operation: "type",
            target: { kind: "selector", cssSelector: "#name" },
            text: "hi",
            confidence: 1,
            reason: "test",
          }),
          assertions: [],
        },
      ]),
      { name: "Promoted", appPackage: "com.example.app" },
    );
    expect(parseFlow(result.flow).ok).toBe(true);
    expect(result.flow.steps.map((step) => step.op)).toEqual(["tap", "back", "type"]);
  });

  test("a selector-resolved step promotes to a selector even with a recorded point", () => {
    const result = promoteRun(
      trace([
        {
          record: record("s1", tapDecision("#login"), {
            resolvedTarget: { x: 55, y: 45, strategy: "selector" },
          }),
          assertions: [],
        },
      ]),
      { name: "P", appPackage: "com.example.app" },
    );
    const step = result.flow.steps[0];
    expect(step?.op).toBe("tap");
    if (step?.op === "tap") {
      expect(step.target).toEqual({ kind: "selector", cssSelector: "#login" });
    }
  });

  test("a point-only step promotes to a point with a warning", () => {
    const result = promoteRun(
      trace([
        {
          record: record(
            "s1",
            { operation: "tap", confidence: 0.4, reason: "guess" },
            {
              resolvedTarget: { x: 111, y: 222, strategy: "point" },
            },
          ),
          assertions: [],
        },
      ]),
      { name: "P", appPackage: "com.example.app" },
    );
    expect(parseFlow(result.flow).ok).toBe(true);
    const step = result.flow.steps[0];
    expect(step?.op).toBe("tap");
    if (step?.op === "tap") {
      expect(step.target).toEqual({ kind: "point", x: 111, y: 222 });
    }
    expect(result.warnings.some((warning) => warning.kind === "point-target")).toBe(true);
  });

  test("consecutive waits collapse into the following timeout with no wait steps", () => {
    const result = promoteRun(
      trace([
        {
          record: record("w1", { operation: "wait", confidence: 1, reason: "settle" }),
          assertions: [],
        },
        {
          record: record("w2", { operation: "wait", confidence: 1, reason: "settle" }),
          assertions: [],
        },
        {
          record: record("s1", tapDecision("#a"), {
            resolvedTarget: { x: 1, y: 2, strategy: "selector" },
          }),
          assertions: [],
        },
      ]),
      { name: "P", appPackage: "com.example.app" },
    );
    expect(result.flow.steps.every((step) => step.op !== "wait")).toBe(true);
    expect(result.flow.steps).toHaveLength(1);
    expect(result.flow.steps[0]?.timeoutMs).toBeGreaterThanOrEqual(2000);
    expect(parseFlow(result.flow).ok).toBe(true);
  });

  test("a retried step keeps only the successful attempt", () => {
    const result = promoteRun(
      trace([
        {
          record: record("s1", tapDecision("#a"), { outcome: "failed", error: "missed" }),
          assertions: [],
        },
        {
          record: record("s1", tapDecision("#a"), {
            resolvedTarget: { x: 1, y: 2, strategy: "selector" },
          }),
          assertions: [],
        },
      ]),
      { name: "P", appPackage: "com.example.app" },
    );
    expect(result.flow.steps).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.kind === "dropped")).toBe(true);
    expect(parseFlow(result.flow).ok).toBe(true);
  });

  test("a run with an assertion produces a matching assert step", () => {
    const result = promoteRun(
      trace([
        {
          record: record("s1", tapDecision("#a"), {
            resolvedTarget: { x: 1, y: 2, strategy: "selector" },
          }),
          assertions: [
            {
              passed: true,
              assertion: { kind: "urlMatches", pattern: "^https://" },
              elapsedMs: 5,
              attempts: 1,
              observed: "matched",
            },
          ],
        },
      ]),
      { name: "P", appPackage: "com.example.app" },
    );
    expect(parseFlow(result.flow).ok).toBe(true);
    const assertStep = result.flow.steps.find((step) => step.op === "assert");
    expect(assertStep).toBeDefined();
    if (assertStep?.op === "assert") {
      expect(assertStep.assertion).toEqual({ kind: "urlMatches", pattern: "^https://" });
    }
  });

  test("a cancelled run promotes its prefix with an incomplete warning", () => {
    const result = promoteRun(
      trace(
        [
          {
            record: record("s1", tapDecision("#a"), {
              resolvedTarget: { x: 1, y: 2, strategy: "selector" },
            }),
            assertions: [],
          },
        ],
        "cancelled",
      ),
      { name: "P", appPackage: "com.example.app" },
    );
    expect(result.flow.steps).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.kind === "incomplete")).toBe(true);
    expect(parseFlow(result.flow).ok).toBe(true);
  });

  test("a promoted flow round-trips through serialize and parse unchanged", () => {
    const result = promoteRun(
      trace([
        {
          record: record("s1", tapDecision("#a"), {
            resolvedTarget: { x: 1, y: 2, strategy: "selector" },
          }),
          assertions: [],
        },
      ]),
      { name: "P", appPackage: "com.example.app" },
    );
    const reparsed = parseFlow(JSON.parse(serializeFlow(result.flow)) as unknown);
    expect(reparsed).toEqual({ ok: true, flow: result.flow });
  });

  test("stored automation events rebuild a promotable trace", () => {
    const rebuilt = runTraceFromEvents("run-9", "passed", "rules", [
      {
        t: 120,
        data: {
          stepId: "s1",
          decision: tapDecision("#a"),
          resolvedTarget: { x: 1, y: 2, strategy: "selector" },
          outcome: "ok",
          error: null,
          screenshot: null,
          policyId: "rules",
          confidence: 1,
          assertions: [],
        },
      },
    ]);
    expect(rebuilt.steps).toHaveLength(1);
    const result = promoteRun(rebuilt, { name: "P", appPackage: "com.example.app" });
    expect(parseFlow(result.flow).ok).toBe(true);
  });
});

describe("promoteSteps", () => {
  function goalRecord(
    stepId: string,
    goalStepId: string,
    decision: Decision,
    overrides: Partial<StepRecord> = {},
  ): StepRecord {
    return record(stepId, decision, { goalStepId, ...overrides });
  }

  test("promoting a subset yields only those steps in order and validates", () => {
    const result = promoteSteps(
      trace([
        {
          record: goalRecord("g1.0", "g1", tapDecision("#a"), {
            resolvedTarget: { x: 1, y: 2, strategy: "selector" },
          }),
          assertions: [],
        },
        {
          record: goalRecord("g1.1", "g1", {
            operation: "back",
            confidence: 1,
            reason: "test",
          }),
          assertions: [],
        },
        {
          record: goalRecord("g1.2", "g1", tapDecision("#b"), {
            resolvedTarget: { x: 3, y: 4, strategy: "selector" },
          }),
          assertions: [],
        },
      ]),
      { name: "Subset", appPackage: "com.example.app", stepIds: ["g1.0", "g1.2"] },
    );
    expect(parseFlow(result.flow).ok).toBe(true);
    expect(result.flow.steps.map((step) => step.op)).toEqual(["tap", "tap"]);
    expect(result.flow.steps).toHaveLength(2);
  });

  test("a point-only step in the subset raises a point-target warning", () => {
    const result = promoteSteps(
      trace([
        {
          record: goalRecord(
            "g1.0",
            "g1",
            { operation: "tap", confidence: 0.4, reason: "guess" },
            {
              resolvedTarget: { x: 100, y: 200, strategy: "point" },
            },
          ),
          assertions: [],
        },
      ]),
      { name: "S", appPackage: "com.example.app", stepIds: ["g1.0"] },
    );
    expect(result.flow.steps).toHaveLength(1);
    expect(result.warnings.some((w) => w.kind === "point-target")).toBe(true);
  });

  test("waits before the first kept step raise that step's timeout", () => {
    const result = promoteSteps(
      trace([
        {
          record: record("w1", { operation: "wait", confidence: 1, reason: "settle" }),
          assertions: [],
        },
        {
          record: record("w2", { operation: "wait", confidence: 1, reason: "settle" }),
          assertions: [],
        },
        {
          record: goalRecord("g1.0", "g1", tapDecision("#a"), {
            resolvedTarget: { x: 1, y: 2, strategy: "selector" },
          }),
          assertions: [],
        },
      ]),
      { name: "S", appPackage: "com.example.app", stepIds: ["g1.0"] },
    );
    expect(result.flow.steps).toHaveLength(1);
    expect(result.flow.steps[0]?.timeoutMs).toBeGreaterThanOrEqual(2000);
    expect(result.flow.steps.every((step) => step.op !== "wait")).toBe(true);
  });

  test("a retried step in the subset keeps only the successful attempt", () => {
    const result = promoteSteps(
      trace([
        {
          record: goalRecord("g1.0", "g1", tapDecision("#a"), {
            outcome: "failed",
            error: "missed",
          }),
          assertions: [],
        },
        {
          record: goalRecord("g1.0", "g1", tapDecision("#a"), {
            resolvedTarget: { x: 1, y: 2, strategy: "selector" },
          }),
          assertions: [],
        },
      ]),
      { name: "S", appPackage: "com.example.app", stepIds: ["g1.0"] },
    );
    expect(result.flow.steps).toHaveLength(1);
    expect(result.warnings.some((w) => w.kind === "dropped")).toBe(true);
  });

  test("an assertion inside the subset becomes an assert step", () => {
    const result = promoteSteps(
      trace([
        {
          record: goalRecord("g1.0", "g1", tapDecision("#a"), {
            resolvedTarget: { x: 1, y: 2, strategy: "selector" },
          }),
          assertions: [
            {
              passed: true,
              assertion: { kind: "urlMatches", pattern: "^https://" },
              elapsedMs: 5,
              attempts: 1,
              observed: "matched",
            },
          ],
        },
      ]),
      { name: "S", appPackage: "com.example.app", stepIds: ["g1.0"] },
    );
    expect(result.flow.steps).toHaveLength(2);
    expect(result.flow.steps[1]?.op).toBe("assert");
  });

  test("promoting a subset of a cancelled run warns it is incomplete", () => {
    const result = promoteSteps(
      trace(
        [
          {
            record: goalRecord("g1.0", "g1", tapDecision("#a"), {
              resolvedTarget: { x: 1, y: 2, strategy: "selector" },
            }),
            assertions: [],
          },
        ],
        "cancelled",
      ),
      { name: "S", appPackage: "com.example.app", stepIds: ["g1.0"] },
    );
    expect(result.flow.steps).toHaveLength(1);
    expect(result.warnings.some((w) => w.kind === "incomplete")).toBe(true);
  });

  test("steps not in the subset are excluded", () => {
    const result = promoteSteps(
      trace([
        {
          record: goalRecord("g1.0", "g1", tapDecision("#a"), {
            resolvedTarget: { x: 1, y: 2, strategy: "selector" },
          }),
          assertions: [],
        },
        {
          record: goalRecord("g1.1", "g1", tapDecision("#b"), {
            resolvedTarget: { x: 3, y: 4, strategy: "selector" },
          }),
          assertions: [],
        },
      ]),
      { name: "S", appPackage: "com.example.app", stepIds: ["g1.1"] },
    );
    expect(result.flow.steps).toHaveLength(1);
    const step = result.flow.steps[0];
    expect(step?.op).toBe("tap");
    if (step?.op === "tap" && step.target.kind === "selector") {
      expect(step.target.cssSelector).toBe("#b");
    }
  });
});
