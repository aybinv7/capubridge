import { describe, expect, test } from "vite-plus/test";
import {
  LIMITS,
  PASSING_ASSERTION,
  deps,
  flow,
  observation,
  policyWith,
  waitDecision,
} from "./flowExecutorFixtures";
import type { Decision, Flow } from "@/types/automation.types";
import type { AssertionResult } from "../assertions";
import { createFakeDeviceActions } from "../deviceActions";
import { runFlow, runGoal } from "../flowExecutor";
import type { GoalStep } from "../flowExecutor";
import type { LocalPolicy, RemotePolicy, RemotePolicyInput } from "../policies/types";

describe("runGoal", () => {
  test("halting on maxSteps names the limit", async () => {
    const policy = policyWith([waitDecision()]);
    const result = await runGoal(
      "settle",
      policy,
      deps(),
      { ...LIMITS, maxSteps: 3 },
      new AbortController().signal,
    );
    expect(result.status).toBe("halted");
    expect(result.failureReason).toContain("maxSteps");
  });

  test("halting on maxDurationMs names the limit", async () => {
    let now = 0;
    const result = await runGoal(
      "settle",
      policyWith([waitDecision()]),
      deps({
        now: () => now,
        observe: () => {
          now += 600;
          return Promise.resolve(observation());
        },
      }),
      { ...LIMITS, maxDurationMs: 1000 },
      new AbortController().signal,
    );
    expect(result.status).toBe("halted");
    expect(result.failureReason).toContain("maxDurationMs");
  });

  test("halting on maxConsecutiveFailures names the limit", async () => {
    const stale: Decision = {
      operation: "tap",
      target: { kind: "nativeIndex", index: 9999 },
      confidence: 1,
      reason: "stale",
    };
    const result = await runGoal(
      "tap",
      policyWith([stale]),
      deps(),
      { ...LIMITS, maxConsecutiveFailures: 3 },
      new AbortController().signal,
    );
    expect(result.status).toBe("halted");
    expect(result.failureReason).toContain("maxConsecutiveFailures");
  });

  test("a failed preflight stops before any policy decision", async () => {
    let decisions = 0;
    const policy = policyWith([{ operation: "tap", confidence: 1, reason: "tap" }]);
    const wrapped: LocalPolicy = {
      ...policy,
      decide: (input) => {
        decisions += 1;
        return policy.decide(input);
      },
    };
    const result = await runGoal(
      "open presalio",
      wrapped,
      deps({ observe: () => Promise.reject(new Error("uiautomator dump carries no XML payload")) }),
      LIMITS,
      new AbortController().signal,
    );
    expect(result.status).toBe("halted");
    expect(result.failureReason).toContain("observation failed");
    expect(result.failureReason).toContain("no XML payload");
    expect(decisions).toBe(0);
  });

  test("a stale decision is discarded and re-observed, never executed", async () => {
    const fake = createFakeDeviceActions();
    let observes = 0;
    const stale: Decision = {
      operation: "tap",
      target: { kind: "nativeIndex", index: 9999 },
      confidence: 1,
      reason: "stale",
    };
    const result = await runGoal(
      "tap",
      policyWith([stale]),
      deps({
        actions: fake,
        observe: () => {
          observes += 1;
          return Promise.resolve(observation());
        },
      }),
      { ...LIMITS, maxSteps: 3 },
      new AbortController().signal,
    );
    expect(observes).toBeGreaterThanOrEqual(3);
    expect(fake.calls).toEqual([]);
    expect(result.status).toBe("halted");
  });

  test("a done answer with a failing trailing assertion yields failed", async () => {
    const failing: AssertionResult = {
      passed: false,
      assertion: PASSING_ASSERTION,
      elapsedMs: 0,
      attempts: 1,
      observed: "cart is empty",
    };
    const result = await runGoal(
      "fill the cart",
      policyWith([{ operation: "done", confidence: 0.9, reason: "looks done" }]),
      deps({ evaluateAssertion: () => Promise.resolve(failing) }),
      LIMITS,
      new AbortController().signal,
      { assertions: [PASSING_ASSERTION] },
    );
    expect(result.status).toBe("failed");
    expect(result.failureReason).toContain("cart is empty");
  });

  test("repeated wait decisions halt instead of re-observing forever", async () => {
    let observes = 0;
    const result = await runGoal(
      "open presalio",
      policyWith([waitDecision()]),
      deps({
        observe: () => {
          observes += 1;
          return Promise.resolve(observation());
        },
      }),
      { maxSteps: 4000, maxDurationMs: 30_000_000, maxConsecutiveFailures: 5 },
      new AbortController().signal,
    );
    expect(result.status).toBe("halted");
    expect(result.failureReason).toContain("made no progress");
    expect(observes).toBeLessThanOrEqual(4);
  });

  test("ARTEMIS supervision waits remain bounded by duration instead of the generic no-progress cap", async () => {
    const policy = {
      ...policyWith([
        { operation: "wait" as const, confidence: 1, reason: "artemis task trace-1 running" },
        { operation: "wait" as const, confidence: 1, reason: "artemis task trace-1 running" },
        { operation: "wait" as const, confidence: 1, reason: "artemis task trace-1 running" },
        { operation: "wait" as const, confidence: 1, reason: "artemis task trace-1 running" },
        { operation: "done" as const, confidence: 1, reason: "artemis task trace-1 completed" },
      ]),
      id: "artemis" as const,
    };
    const sleeps: number[] = [];
    const result = await runGoal(
      "open presalio",
      policy,
      deps({
        sleep: (duration) => {
          sleeps.push(duration);
          return Promise.resolve();
        },
      }),
      LIMITS,
      new AbortController().signal,
    );
    expect(result.status).toBe("passed");
    expect(sleeps).toEqual([1000, 1000, 1000, 1000]);
  });

  test("a done answer with passing assertions yields passed", async () => {
    const result = await runGoal(
      "fill the cart",
      policyWith([{ operation: "done", confidence: 0.9, reason: "looks done" }]),
      deps(),
      LIMITS,
      new AbortController().signal,
      { assertions: [PASSING_ASSERTION] },
    );
    expect(result.status).toBe("passed");
  });

  test("a discovered openApp step carrying text attempts the device call", async () => {
    const fake = createFakeDeviceActions();
    const result = await runGoal(
      "open the app",
      policyWith([
        { operation: "openApp", text: "com.example.app", confidence: 0.9, reason: "open" },
        { operation: "done", confidence: 1, reason: "done" },
      ]),
      deps({ actions: fake }),
      LIMITS,
      new AbortController().signal,
    );
    expect(result.status).toBe("passed");
    expect(
      fake.calls.some((call) => call.method === "openApp" && call.args[1] === "com.example.app"),
    ).toBe(true);
  });

  test("a bare Jev app name opens the preselected app instead", async () => {
    const fake = createFakeDeviceActions();
    const result = await runGoal(
      "open presalio",
      policyWith([
        { operation: "openApp", text: "presalio", confidence: 0.93, reason: "open" },
        { operation: "done", confidence: 1, reason: "done" },
      ]),
      deps({ actions: fake, appPackage: "com.presalio.app" }),
      LIMITS,
      new AbortController().signal,
    );
    expect(result.status).toBe("passed");
    expect(
      fake.calls.some((call) => call.method === "openApp" && call.args[1] === "com.presalio.app"),
    ).toBe(true);
    expect(
      fake.calls.some((call) => call.method === "openApp" && call.args[1] === "presalio"),
    ).toBe(false);
  });

  test("an ungroundable openApp without a selected app never reaches the device", async () => {
    const fake = createFakeDeviceActions();
    const result = await runGoal(
      "open presalio",
      policyWith([{ operation: "openApp", text: "presalio", confidence: 0.93, reason: "open" }]),
      deps({ actions: fake }),
      { maxSteps: 2, maxDurationMs: 60000, maxConsecutiveFailures: 3 },
      new AbortController().signal,
    );
    expect(result.status).toBe("halted");
    expect(fake.calls.some((call) => call.method === "openApp")).toBe(false);
    expect(result.records.some((record) => record.error?.includes("selected app") ?? false)).toBe(
      true,
    );
  });

  test("a remote policy decides from redacted observations only", async () => {
    const seen: RemotePolicyInput[] = [];
    const remote: RemotePolicy = {
      id: "jev",
      label: "Test remote",
      isRemote: true,
      dataNotice: "leaves the machine",
      decide: (input) => {
        seen.push(input);
        return Promise.resolve({ operation: "done", confidence: 1, reason: "done" });
      },
    };
    const secret = observation();
    secret.native.controls.push({
      index: 0,
      bounds: [0, 0, 100, 40],
      className: "android.widget.TextView",
      text: "contact user@example.com",
      contentDesc: "",
      clickable: false,
      enabled: true,
    });
    secret.visual = { screenshotRef: "runs/abc/shot-1.png" };
    const result = await runGoal(
      "goal",
      remote,
      deps({ observe: () => Promise.resolve(secret) }),
      LIMITS,
      new AbortController().signal,
      {},
    );
    expect(result.status).toBe("passed");
    expect(seen.length).toBeGreaterThan(0);
    for (const input of seen) {
      expect("visual" in input.observation).toBe(false);
      expect(JSON.stringify(input.observation)).not.toContain("user@example.com");
      expect(JSON.stringify(input.observation)).not.toContain("shot-1.png");
    }
  });
});

describe("CB-53 mixed flows", () => {
  function goalStep(id: string, policyId: "rules" | "jev" | "artemis" = "rules"): GoalStep {
    return {
      id,
      op: "goal",
      goal: `goal ${id}`,
      policyId,
      limits: { maxSteps: 10, maxDurationMs: 60000, maxConsecutiveFailures: 3 },
      acknowledgedNotice: true,
    };
  }

  test("deterministic → goal → deterministic runs in order and tags goalStepId", async () => {
    const policy = policyWith([
      {
        operation: "tap",
        target: { kind: "selector", cssSelector: "#a" },
        confidence: 1,
        reason: "tap a",
      },
      { operation: "done", confidence: 1, reason: "done" },
    ]);
    const mixed: Flow = {
      version: 1,
      id: "mixed-1",
      name: "Mixed",
      appPackage: "com.example.app",
      steps: [
        { id: "s1", op: "tap", target: { kind: "selector", cssSelector: "#a" } },
        goalStep("g1", "rules"),
        { id: "s3", op: "back" },
      ],
    };
    const result = await runFlow(
      mixed,
      deps({ readbackText: () => Promise.resolve(null), policies: { get: () => policy } }),
      new AbortController().signal,
    );
    expect(result.status).toBe("passed");
    const ids = result.records.map((r) => r.stepId);
    expect(ids).toEqual(["s1", "g1.0", "g1", "s3"]);
    const discovered = result.records.find((r) => r.stepId === "g1.0");
    expect(discovered?.goalStepId).toBe("g1");
    const goalSummary = result.records.find((r) => r.stepId === "g1" && r.outcome === "ok");
    expect(goalSummary?.goalStepId).toBeNull();
  });

  test("each limit halts only its own goal, not the run", async () => {
    const policy = policyWith([waitDecision()]);
    const mixed: Flow = {
      version: 1,
      id: "mixed-2",
      name: "Two goals",
      appPackage: "com.example.app",
      steps: [goalStep("g1"), goalStep("g2")],
    };
    const result = await runFlow(
      mixed,
      deps({ policies: { get: () => policy } }),
      new AbortController().signal,
    );
    expect(result.status).toBe("halted");
    const g1 = result.records.find((r) => r.stepId === "g1");
    expect(g1?.outcome).toBe("failed");
    expect(g1?.error).toContain("made no progress");
  });

  test("policy error is always distinguishable from a bare limit", async () => {
    const failingPolicy: LocalPolicy = {
      id: "rules",
      label: "Broken",
      isRemote: false,
      dataNotice: null,
      decide: () => {
        throw new Error("model refused: content policy");
      },
    };
    const result = await runGoal(
      "offensive goal",
      failingPolicy,
      deps(),
      { ...LIMITS, maxConsecutiveFailures: 2 },
      new AbortController().signal,
    );
    expect(result.status).toBe("halted");
    expect(result.failureReason).toContain("maxConsecutiveFailures");
    expect(result.failureReason).toContain("model refused");
  });

  test("policy dispose runs on normal completion", async () => {
    let disposed = false;
    const disposable = {
      id: "rules" as const,
      label: "Disposable",
      isRemote: false as const,
      dataNotice: null,
      decide: () => Promise.resolve({ operation: "done" as const, confidence: 1, reason: "done" }),
      dispose: () => {
        disposed = true;
        return Promise.resolve();
      },
    } satisfies LocalPolicy & { dispose(): Promise<void> };
    await runGoal("goal", disposable, deps(), LIMITS, new AbortController().signal);
    expect(disposed).toBe(true);
  });

  test("policy dispose runs on cancellation", async () => {
    let disposed = false;
    const controller = new AbortController();
    const disposable = {
      id: "rules" as const,
      label: "Disposable",
      isRemote: false as const,
      dataNotice: null,
      decide: () => {
        controller.abort();
        return Promise.resolve(waitDecision());
      },
      dispose: () => {
        disposed = true;
        return Promise.resolve();
      },
    } satisfies LocalPolicy & { dispose(): Promise<void> };
    await runGoal("goal", disposable, deps(), LIMITS, controller.signal);
    expect(disposed).toBe(true);
  });

  test("policy dispose runs on policy error", async () => {
    let disposed = false;
    const broken = {
      id: "rules" as const,
      label: "Broken",
      isRemote: false as const,
      dataNotice: null,
      decide: () => {
        throw new Error("policy crashed");
      },
      dispose: () => {
        disposed = true;
        return Promise.resolve();
      },
    } satisfies LocalPolicy & { dispose(): Promise<void> };
    await runGoal("goal", broken, deps(), LIMITS, new AbortController().signal);
    expect(disposed).toBe(true);
  });

  test("no-goal flow behaves identically to pre-CB-53", async () => {
    const result = await runFlow(
      flow(),
      deps({ readbackText: () => Promise.resolve("hello") }),
      new AbortController().signal,
    );
    expect(result.status).toBe("passed");
    expect(result.records).toHaveLength(3);
    expect(result.records.every((r) => r.goalStepId === null)).toBe(true);
  });

  test("halts when policy issues repeated identical actions", async () => {
    const policy = policyWith([
      {
        operation: "tap",
        target: { kind: "selector", cssSelector: "#a" },
        confidence: 1,
        reason: "tap a",
      },
      {
        operation: "tap",
        target: { kind: "selector", cssSelector: "#a" },
        confidence: 1,
        reason: "tap a",
      },
      {
        operation: "tap",
        target: { kind: "selector", cssSelector: "#a" },
        confidence: 1,
        reason: "tap a",
      },
      {
        operation: "tap",
        target: { kind: "selector", cssSelector: "#a" },
        confidence: 1,
        reason: "tap a",
      },
    ]);
    const result = await runGoal("goal", policy, deps(), LIMITS, new AbortController().signal);
    expect(result.status).toBe("halted");
    expect(result.failureReason).toContain("one unchanged action");
  });

  test("a goal halts after one failed type verification", async () => {
    const actions = createFakeDeviceActions();
    const result = await runGoal(
      "search for awanee",
      policyWith([
        {
          operation: "type",
          target: { kind: "selector", cssSelector: "#name" },
          text: "awanee",
          confidence: 0.9,
          reason: "search",
        },
      ]),
      deps({ actions, readbackText: () => Promise.resolve(null) }),
      { ...LIMITS, maxConsecutiveFailures: 5 },
      new AbortController().signal,
    );
    expect(result.status).toBe("halted");
    expect(result.failureReason).toContain("readback mismatch");
    expect(actions.calls.filter((call) => call.method === "inputText")).toHaveLength(1);
  });
});

describe("a refused action is reported as refused", () => {
  const tapAlpha: Decision = {
    operation: "tap",
    target: { kind: "selector", cssSelector: "#a" },
    confidence: 1,
    reason: "tap alpha",
  };

  test("an authorization denial halts with the denial, not a no-progress claim", async () => {
    const result = await runGoal(
      "open stock",
      policyWith([tapAlpha]),
      deps({
        authorizeAction: () => Promise.reject(new Error("app is outside the authorized scope")),
      }),
      LIMITS,
      new AbortController().signal,
    );
    expect(result.status).toBe("halted");
    expect(result.failureReason).toContain("app is outside the authorized scope");
    expect(result.failureReason).not.toContain("made no progress");
  });

  test("an action that dispatched but changed nothing is still no progress", async () => {
    const result = await runGoal(
      "open stock",
      policyWith([tapAlpha]),
      deps(),
      LIMITS,
      new AbortController().signal,
    );
    expect(result.status).toBe("halted");
    expect(result.failureReason).toContain("made no progress");
  });
});
