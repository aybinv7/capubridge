import { describe, expect, test } from "vite-plus/test";
import type { Flow } from "@/types/automation.types";
import type { RunViewStep } from "../runSource";
import {
  buildStepRows,
  canEditStructure,
  failingRowIndex,
  flattenRows,
  flowFromRunSteps,
  moveTargetFor,
} from "../stepRowModel";

function tapStep(id: string, cssSelector: string) {
  return { id, op: "tap" as const, target: { kind: "selector" as const, cssSelector } };
}

function goalStep(id: string, goal: string) {
  return {
    id,
    op: "goal" as const,
    goal,
    policyId: "rules" as const,
    limits: { maxSteps: 10, maxDurationMs: 60000, maxConsecutiveFailures: 3 },
    acknowledgedNotice: true,
  };
}

function flow(steps: Flow["steps"]): Flow {
  return {
    version: 1,
    id: "f1",
    name: "Test",
    appPackage: "com.example.app",
    steps,
  };
}

function runStep(
  stepId: string,
  outcome: "ok" | "failed" | "skipped" = "ok",
  overrides: Partial<RunViewStep> = {},
): RunViewStep {
  return {
    stepId,
    decision: { operation: "tap", confidence: 1, reason: "test" },
    resolvedTarget: null,
    outcome,
    error: null,
    screenshotRef: "",
    assertions: [],
    goalStepId: null,
    replayOffsetMs: null,
    ...overrides,
  };
}

describe("stepRowModel", () => {
  test("a flow with no run yields one row per step in order", () => {
    const rows = buildStepRows(flow([tapStep("s1", "#a"), tapStep("s2", "#b")]), null);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.stepId)).toEqual(["s1", "s2"]);
    expect(rows.every((r) => r.outcome === null)).toBe(true);
  });

  test("a flow plus a run decorates each row with its outcome", () => {
    const rows = buildStepRows(flow([tapStep("s1", "#a"), tapStep("s2", "#b")]), [
      runStep("s1", "ok"),
      runStep("s2", "failed", { error: "missed" }),
    ]);
    expect(rows[0]?.outcome).toBe("ok");
    expect(rows[1]?.outcome).toBe("failed");
    expect(rows[1]?.error).toBe("missed");
    expect(failingRowIndex(rows)).toBe(1);
  });

  test("goal-produced steps nest under their goal", () => {
    const rows = buildStepRows(
      flow([tapStep("s1", "#a"), goalStep("g1", "find button"), tapStep("s3", "#c")]),
      [
        runStep("s1"),
        runStep("g1.0", "ok", { goalStepId: "g1" }),
        runStep("g1.1", "ok", { goalStepId: "g1" }),
        runStep("s3"),
      ],
    );
    expect(rows).toHaveLength(3);
    const goal = rows[1];
    expect(goal?.isGoal).toBe(true);
    expect(goal?.nestedRows).toHaveLength(2);
    expect(goal?.nestedRows.map((r) => r.stepId)).toEqual(["g1.0", "g1.1"]);
  });

  test("flattened list puts nested rows after their goal", () => {
    const rows = buildStepRows(
      flow([tapStep("s1", "#a"), goalStep("g1", "find button"), tapStep("s3", "#c")]),
      [runStep("s1"), runStep("g1.0", "ok", { goalStepId: "g1" }), runStep("s3")],
    );
    const flat = flattenRows(rows);
    expect(flat.map((f) => f.row.stepId)).toEqual(["s1", "g1", "g1.0", "s3"]);
    expect(flat[2]?.depth).toBe(1);
  });

  test("target strength classifies selector as strongest and point as weakest", () => {
    const rows = buildStepRows(
      flow([
        { id: "sel", op: "tap", target: { kind: "selector", cssSelector: "#x" } },
        { id: "pt", op: "tap", target: { kind: "point", x: 10, y: 20 } },
        { id: "idx", op: "tap", target: { kind: "nativeIndex", index: 0 } },
      ]),
      null,
    );
    expect(rows[0]?.targetStrength).toBe("strong");
    expect(rows[1]?.targetStrength).toBe("weak");
    expect(rows[2]?.targetStrength).toBe("fair");
  });

  test("a run with more steps than the flow flattens without losing any", () => {
    const rows = buildStepRows(flow([tapStep("s1", "#a"), goalStep("g1", "goal")]), [
      runStep("s1"),
      runStep("g1.0", "ok", { goalStepId: "g1" }),
      runStep("g1.1", "ok", { goalStepId: "g1" }),
    ]);
    const flat = flattenRows(rows);
    expect(flat.length).toBeGreaterThanOrEqual(4);
  });

  test("a run with fewer steps leaves remaining rows undecorated", () => {
    const rows = buildStepRows(
      flow([tapStep("s1", "#a"), tapStep("s2", "#b"), tapStep("s3", "#c")]),
      [runStep("s1")],
    );
    expect(rows[0]?.outcome).toBe("ok");
    expect(rows[1]?.outcome).toBeNull();
    expect(rows[2]?.outcome).toBeNull();
  });

  test("the flattened list is stable across two builds", () => {
    const input = flow([tapStep("s1", "#a"), goalStep("g1", "goal"), tapStep("s3", "#c")]);
    const runSteps = [runStep("s1"), runStep("g1.0", "ok", { goalStepId: "g1" }), runStep("s3")];
    const flat1 = flattenRows(buildStepRows(input, runSteps));
    const flat2 = flattenRows(buildStepRows(input, runSteps));
    expect(flat1.map((f) => f.row.stepId)).toEqual(flat2.map((f) => f.row.stepId));
  });

  test("flowFromRunSteps parents discovered steps under a synthetic goal", () => {
    const runSteps = [
      runStep("goal", "ok", { goalStepId: null }),
      runStep("goal.0", "ok", { goalStepId: "goal" }),
      runStep("goal.1", "ok", { goalStepId: "goal" }),
    ];
    const synthesized = flowFromRunSteps(runSteps, {
      name: "Agent run",
      goal: "open the app",
      goalStepId: "goal",
      policyId: "jev",
      limits: { maxSteps: 10, maxDurationMs: 60000, maxConsecutiveFailures: 3 },
    });
    expect(synthesized.steps[0]?.id).toBe("goal");
    const rows = buildStepRows(synthesized, runSteps);
    const goal = rows.find((r) => r.stepId === "goal");
    expect(goal?.nestedRows.map((r) => r.stepId)).toEqual(["goal.0", "goal.1"]);
  });
});

describe("structure editing", () => {
  const three = flow([tapStep("a", "#a"), tapStep("b", "#b"), tapStep("c", "#c")]);

  test("moving a step down returns the adjacent index pair", () => {
    expect(moveTargetFor(three, "a", "down")).toEqual({ from: 0, to: 1 });
  });

  test("moving a step up returns the adjacent index pair", () => {
    expect(moveTargetFor(three, "c", "up")).toEqual({ from: 2, to: 1 });
  });

  test("moving the first step up is a no-op, not an error", () => {
    expect(moveTargetFor(three, "a", "up")).toBeNull();
  });

  test("moving the last step down is a no-op, not an error", () => {
    expect(moveTargetFor(three, "c", "down")).toBeNull();
  });

  test("an unknown step id is a no-op", () => {
    expect(moveTargetFor(three, "nope", "up")).toBeNull();
  });

  test("a goal step moves as one unit, since produced steps live only in the run view", () => {
    const withGoal = flow([tapStep("a", "#a"), goalStep("g", "search"), tapStep("c", "#c")]);
    expect(moveTargetFor(withGoal, "g", "up")).toEqual({ from: 1, to: 0 });
    const rows = buildStepRows(withGoal, [runStep("g"), runStep("g-1")]);
    const goalRow = rows.find((row) => row.stepId === "g");
    expect(goalRow?.isGoal).toBe(true);
  });

  test("a produced step is not independently reorderable", () => {
    const withGoal = flow([goalStep("g", "search")]);
    const rows = buildStepRows(withGoal, [runStep("g"), runStep("g-1")]);
    const produced = rows.flatMap((row) => row.nestedRows);
    for (const row of produced) {
      expect(moveTargetFor(withGoal, row.stepId, "up")).toBeNull();
    }
  });

  test("structure editing is refused while a run is executing", () => {
    expect(canEditStructure({ isRunning: true, hasRun: false })).toBe(false);
  });

  test("structure editing is refused when viewing a recorded run", () => {
    expect(canEditStructure({ isRunning: false, hasRun: true })).toBe(false);
  });

  test("structure editing is allowed on an idle draft", () => {
    expect(canEditStructure({ isRunning: false, hasRun: false })).toBe(true);
  });
});
