import { describe, expect, test } from "vite-plus/test";
import type { Flow, StepRecord } from "@/types/automation.types";
import {
  MAX_TRACKED_RUNS,
  activeRunOf,
  applyRunEvent,
  foreignActiveRun,
  runViewOf,
  startReason,
  workbenchStartReason,
} from "../runObserver";
import type { ActiveRun, RunEvent } from "../runObserver";

function flow(id = "flow-1"): Flow {
  return {
    id,
    schemaVersion: 1,
    name: "Order flow",
    appPackage: "com.presalio.app",
    steps: [],
  } as unknown as Flow;
}

function started(runId: string, overrides: Partial<Extract<RunEvent, { kind: "started" }>> = {}) {
  return {
    kind: "started" as const,
    runId,
    taskId: `task-${runId}`,
    origin: "flow" as const,
    label: "Order flow",
    policyId: "rules" as const,
    deviceSerial: "device-1",
    flow: flow(),
    goal: null,
    startedAt: 1_000,
    ...overrides,
  };
}

function record(stepId: string, startedAt: number): StepRecord {
  return {
    stepId,
    decision: { operation: "tap", confidence: 1, reason: "test" },
    resolvedTarget: null,
    outcome: "ok",
    error: null,
    screenshotRef: "",
    startedAt,
    endedAt: startedAt + 10,
  } as unknown as StepRecord;
}

function fold(events: RunEvent[]): Map<string, ActiveRun> {
  let runs = new Map<string, ActiveRun>();
  for (const event of events) {
    runs = applyRunEvent(runs, event);
  }
  return runs;
}

describe("applyRunEvent", () => {
  test("a started event registers a running run carrying its origin", () => {
    const runs = fold([started("run-1", { origin: "mcp" })]);
    const run = activeRunOf(runs, "run-1");
    expect(run?.status).toBe("running");
    expect(run?.origin).toBe("mcp");
    expect(run?.records).toHaveLength(0);
  });

  test("step events append in start order regardless of arrival order", () => {
    const runs = fold([
      started("run-1"),
      { kind: "step", runId: "run-1", record: record("s2", 2_000) },
      { kind: "step", runId: "run-1", record: record("s1", 1_500) },
    ]);
    expect(activeRunOf(runs, "run-1")?.records.map((entry) => entry.stepId)).toEqual(["s1", "s2"]);
  });

  test("a step for an unknown run is ignored rather than inventing one", () => {
    const runs = fold([{ kind: "step", runId: "ghost", record: record("s1", 1_000) }]);
    expect(runs.size).toBe(0);
  });

  test("a finished event carries the terminal status and reason", () => {
    const runs = fold([
      started("run-1"),
      { kind: "step", runId: "run-1", record: record("s1", 1_100) },
      {
        kind: "finished",
        runId: "run-1",
        status: "failed",
        failureReason: "step s1 missed",
        endedAt: 2_000,
      },
    ]);
    const run = activeRunOf(runs, "run-1");
    expect(run?.status).toBe("failed");
    expect(run?.failureReason).toBe("step s1 missed");
    expect(run?.endedAt).toBe(2_000);
  });

  test("a late step cannot resurrect a finished run", () => {
    const runs = fold([
      started("run-1"),
      { kind: "finished", runId: "run-1", status: "passed", failureReason: null, endedAt: 2_000 },
      { kind: "step", runId: "run-1", record: record("late", 3_000) },
    ]);
    const run = activeRunOf(runs, "run-1");
    expect(run?.status).toBe("passed");
    expect(run?.records).toHaveLength(0);
  });

  test("re-announcing a run keeps the records already folded", () => {
    const runs = fold([
      started("run-1"),
      { kind: "step", runId: "run-1", record: record("s1", 1_100) },
      started("run-1"),
    ]);
    expect(activeRunOf(runs, "run-1")?.records).toHaveLength(1);
  });

  test("finished runs evict oldest first while a running run is never evicted", () => {
    const events: RunEvent[] = [started("run-live", { startedAt: 0 })];
    for (let index = 0; index < MAX_TRACKED_RUNS + 5; index += 1) {
      const runId = `run-${index}`;
      events.push(started(runId, { startedAt: index + 1 }), {
        kind: "finished",
        runId,
        status: "passed",
        failureReason: null,
        endedAt: index + 2,
      });
    }
    const runs = fold(events);
    expect(runs.size).toBeLessThanOrEqual(MAX_TRACKED_RUNS);
    expect(activeRunOf(runs, "run-live")).not.toBeNull();
    expect(activeRunOf(runs, "run-0")).toBeNull();
  });
});

describe("runViewOf", () => {
  test("a goal run with no flow still yields a view of its steps", () => {
    const runs = fold([
      started("run-1", { flow: null, goal: "buy something", policyId: "jev" }),
      { kind: "step", runId: "run-1", record: record("s1", 1_100) },
    ]);
    const run = activeRunOf(runs, "run-1");
    if (run === null) {
      throw new Error("run must exist");
    }
    const view = runViewOf(run);
    expect(view.steps).toHaveLength(1);
    expect(view.flowSnapshot).toBeNull();
  });
});

describe("foreignActiveRun", () => {
  test("a running run the UI did not start is reported as foreign", () => {
    const runs = fold([started("run-mcp", { origin: "mcp" })]);
    expect(foreignActiveRun(runs, null)?.runId).toBe("run-mcp");
  });

  test("the run the UI itself started is not foreign", () => {
    const runs = fold([started("run-local")]);
    expect(foreignActiveRun(runs, "run-local")).toBeNull();
  });

  test("a finished foreign run no longer blocks", () => {
    const runs = fold([
      started("run-mcp", { origin: "mcp" }),
      { kind: "finished", runId: "run-mcp", status: "passed", failureReason: null, endedAt: 2_000 },
    ]);
    expect(foreignActiveRun(runs, null)).toBeNull();
  });
});

describe("startReason", () => {
  test("a foreign active run refuses a start and names the run", () => {
    const runs = fold([started("run-mcp", { origin: "mcp", label: "Order flow" })]);
    const reason = startReason(runs, null);
    expect(reason).not.toBeNull();
    expect(reason).toContain("run-mcp");
  });

  test("no active run leaves the start unblocked", () => {
    expect(startReason(new Map(), null)).toBeNull();
  });
});

describe("workbenchStartReason", () => {
  const ready = {
    flow: flow(),
    deviceSerial: "device-1",
    runnable: true,
    invalidReason: null,
    runs: new Map<string, ActiveRun>(),
    localRunId: null,
  };

  test("a ready workbench is not blocked", () => {
    expect(workbenchStartReason(ready)).toBeNull();
  });

  test("authoring gates keep their specific reasons", () => {
    expect(workbenchStartReason({ ...ready, flow: null })).toBe("no flow selected");
    expect(workbenchStartReason({ ...ready, deviceSerial: null })).toBe("no device connected");
    expect(
      workbenchStartReason({ ...ready, runnable: false, invalidReason: "step 2 invalid" }),
    ).toBe("step 2 invalid");
  });

  test("a busy device outranks an authoring gate the user could not act on anyway", () => {
    const runs = fold([started("run-mcp", { origin: "mcp" })]);
    const reason = workbenchStartReason({ ...ready, flow: null, runs });
    expect(reason).toContain("run-mcp");
    expect(reason).not.toBe("no flow selected");
  });
});
