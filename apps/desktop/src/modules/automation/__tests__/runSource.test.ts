import { describe, expect, test } from "vite-plus/test";
import type { Decision, Flow, StepRecord } from "@/types/automation.types";
import type { SessionManifest } from "@/types/replay.types";
import { fromArchive, fromLiveRecords, resolveRun } from "../runSource";

function tapDecision(cssSelector: string): Decision {
  return {
    operation: "tap",
    target: { kind: "selector", cssSelector },
    confidence: 1,
    reason: "test",
  };
}

function liveRecord(
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

function flow(): Flow {
  return {
    version: 1,
    id: "flow-1",
    name: "Test flow",
    appPackage: "com.example.app",
    steps: [
      { id: "s1", op: "tap", target: { kind: "selector", cssSelector: "#a" } },
      { id: "s2", op: "back" },
    ],
  };
}

function manifest(overrides: Partial<SessionManifest> = {}): SessionManifest {
  return {
    version: 1,
    sessionId: "run-1",
    label: "Test",
    startedAt: 1000,
    duration: 500,
    deviceSerial: null,
    targetUrl: null,
    appPackage: "com.example.app",
    tracks: { rrweb: false, network: false, console: false },
    automation: {
      runStatus: "passed",
      policyId: "rules",
      flowId: "flow-1",
      flowName: "Test flow",
      goal: null,
      flowSnapshot: flow(),
    },
    ...overrides,
  };
}

describe("runSource", () => {
  test("live records and archive events produce the same step list", () => {
    const liveResult = fromLiveRecords(
      [
        liveRecord("s1", tapDecision("#a"), {
          resolvedTarget: { x: 1, y: 2, strategy: "selector" },
        }),
        liveRecord("s2", { operation: "back", confidence: 1, reason: "test" }),
      ],
      flow(),
    );
    const archiveResult = fromArchive(
      [
        {
          t: 0,
          data: {
            stepId: "s1",
            decision: tapDecision("#a"),
            resolvedTarget: { x: 1, y: 2, strategy: "selector" },
            outcome: "ok",
            error: null,
            screenshot: "s1.png",
            policyId: "rules",
            confidence: 1,
            assertions: [],
          },
        },
        {
          t: 100,
          data: {
            stepId: "s2",
            decision: { operation: "back", confidence: 1, reason: "test" },
            resolvedTarget: null,
            outcome: "ok",
            error: null,
            screenshot: null,
            policyId: "rules",
            confidence: 1,
            assertions: [],
          },
        },
      ],
      manifest(),
    );
    expect(liveResult.steps.map((s) => s.stepId)).toEqual(["s1", "s2"]);
    expect(archiveResult.steps.map((s) => s.stepId)).toEqual(["s1", "s2"]);
    expect(liveResult.stepCount).toBe(2);
    expect(archiveResult.stepCount).toBe(2);
    expect(liveResult.failedStepIndex).toBeNull();
    expect(archiveResult.failedStepIndex).toBeNull();
  });

  test("steps inside a goal carry the goal step id from live records", () => {
    const result = fromLiveRecords(
      [
        liveRecord("g1.0", tapDecision("#a"), { goalStepId: "g1" }),
        liveRecord(
          "g1.1",
          { operation: "back", confidence: 1, reason: "test" },
          { goalStepId: "g1" },
        ),
      ],
      flow(),
    );
    expect(result.steps[0]?.goalStepId).toBe("g1");
    expect(result.steps[1]?.goalStepId).toBe("g1");
  });

  test("a mid-run failure sets failedStepIndex", () => {
    const result = fromLiveRecords(
      [
        liveRecord("s1", tapDecision("#a")),
        liveRecord("s2", tapDecision("#b"), { outcome: "failed", error: "missed" }),
        liveRecord("s3", { operation: "back", confidence: 1, reason: "test" }),
      ],
      flow(),
    );
    expect(result.failedStepIndex).toBe(1);
    expect(result.status).toBe("failed");
  });

  test("an empty run has zero duration and pending status", () => {
    const result = fromLiveRecords([], flow());
    expect(result.steps).toHaveLength(0);
    expect(result.durationMs).toBe(0);
    expect(result.status).toBe("pending");
  });

  test("archived goal runs nest under the snapshot goal id", () => {
    const goalFlow: Flow = {
      version: 1,
      id: "goal-run",
      name: "Agent run",
      appPackage: "",
      steps: [
        {
          id: "goal",
          op: "goal",
          goal: "open presalio",
          policyId: "jev",
          limits: { maxSteps: 40, maxDurationMs: 300000, maxConsecutiveFailures: 5 },
          acknowledgedNotice: true,
        },
      ],
    };
    const result = fromArchive(
      [
        {
          t: 0,
          data: {
            stepId: "goal.0",
            decision: tapDecision("#a"),
            resolvedTarget: null,
            outcome: "ok",
            error: null,
            screenshot: null,
            policyId: "jev",
            confidence: 1,
            assertions: [],
          },
        },
      ],
      manifest({
        automation: {
          runStatus: "passed",
          policyId: "jev",
          flowId: null,
          flowName: "Agent run",
          goal: "open presalio",
          flowSnapshot: goalFlow,
        },
      }),
    );
    expect(result.steps[0]?.goalStepId).toBe("goal");
  });

  test("flowSnapshot is carried from the manifest", () => {
    const snap = flow();
    const result = fromArchive(
      [],
      manifest({
        automation: {
          runStatus: "passed",
          policyId: "rules",
          flowId: "flow-1",
          flowName: "Test",
          goal: null,
          flowSnapshot: snap,
        },
      }),
    );
    expect(result.flowSnapshot).toEqual(snap);
  });

  test("a missing flowSnapshot degrades to null", () => {
    const result = fromArchive(
      [],
      manifest({
        automation: {
          runStatus: "passed",
          policyId: "rules",
          flowId: null,
          flowName: null,
          goal: null,
        },
      }),
    );
    expect(result.flowSnapshot).toBeNull();
  });

  test("resolveRun finds a live run by id", () => {
    const live = new Map([["run-1", [liveRecord("s1", tapDecision("#a"))]]]);
    const result = resolveRun("run-1", live, () => null);
    expect(result).toEqual({ kind: "live", records: live.get("run-1") });
  });

  test("resolveRun finds a finished run by file", () => {
    const live = new Map<string, StepRecord[]>();
    const result = resolveRun("run-2", live, (id) => (id === "run-2" ? "/capu/run-2.capu" : null));
    expect(result).toEqual({ kind: "file", filePath: "/capu/run-2.capu" });
  });

  test("resolveRun returns null for an unknown id", () => {
    const live = new Map<string, StepRecord[]>();
    const result = resolveRun("run-999", live, () => null);
    expect(result).toBeNull();
  });

  test("duration is derived from first and last record", () => {
    const result = fromLiveRecords(
      [
        liveRecord("s1", tapDecision("#a"), { startedAt: 100, endedAt: 200 }),
        liveRecord(
          "s2",
          { operation: "back", confidence: 1, reason: "test" },
          { startedAt: 300, endedAt: 500 },
        ),
      ],
      flow(),
    );
    expect(result.durationMs).toBe(400);
  });
});
