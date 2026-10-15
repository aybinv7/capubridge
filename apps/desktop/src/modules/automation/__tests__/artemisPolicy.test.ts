import { describe, expect, test, vi } from "vite-plus/test";
import type { Observation } from "@/types/automation.types";
import { buildCandidates } from "../elementIndex";
import { ARTEMIS_SUPERVISION_CONFIDENCE, createArtemisPolicy } from "../policies/artemis";
import type { ArtemisTaskStatus, ArtemisTransport } from "../policies/artemis";
import { policyRegistry } from "../policies/types";
import type { PolicyInput } from "../policies/types";
import { PolicyDecisionError } from "../policies/types";
import "../policies/artemis";
import "../policies/rules";
import "../policies/jev";

function observation(): Observation {
  return {
    native: {
      controls: [],
      packageName: "com.example.app",
      activity: "MainActivity",
      systemUi: { keyboardVisible: false, dialogPresent: false },
    },
    webview: null,
    signals: { pendingRequests: 0, recentErrors: [], lastDbWrite: null },
    visual: { screenshotRef: "" },
  };
}

function input(): PolicyInput {
  const seen = observation();
  return {
    goal: "sign in",
    observation: seen,
    candidates: buildCandidates(seen),
    history: [],
    stepIndex: 0,
  };
}

function runningStatus(): ArtemisTaskStatus {
  return {
    state: "running",
    elapsedSeconds: 12,
    summary: "tapping through onboarding",
    error: null,
  };
}

function fakeTransport(overrides: Partial<ArtemisTransport> = {}): ArtemisTransport & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    startTask: (goal) => {
      calls.push(`start:${goal}`);
      return Promise.resolve("trace-1");
    },
    taskStatus: () => {
      calls.push("status");
      return Promise.resolve(runningStatus());
    },
    stopTask: (traceId) => {
      calls.push(`stop:${traceId}`);
      return Promise.resolve();
    },
    ...overrides,
  };
}

describe("artemis policy", () => {
  test("a running task becomes a wait decision", async () => {
    const transport = fakeTransport();
    const policy = createArtemisPolicy({ transport });
    await policy.decide(input());
    const decision = await policy.decide(input());
    expect(decision.operation).toBe("wait");
    expect(decision.confidence).toBe(ARTEMIS_SUPERVISION_CONFIDENCE);
    expect(decision.reason).toContain("trace-1");
  });

  test("forwards each observed ARTEMIS action to the durable trace mapper", async () => {
    const actions = [{ id: "trace-tap", name: "tap", status: "success", error: null }];
    const onActions = vi.fn();
    const transport = fakeTransport({ listActions: () => Promise.resolve(actions) });
    const policy = createArtemisPolicy({ transport, onActions });
    await policy.decide(input());
    await policy.decide(input());
    expect(onActions).toHaveBeenCalledWith("trace-1", actions);
  });

  test("an ARTEMIS failure becomes blocked naming the failure", async () => {
    const transport = fakeTransport({
      taskStatus: () =>
        Promise.resolve({
          state: "failed",
          elapsedSeconds: 30,
          summary: null,
          error: "device offline",
        }),
    });
    const policy = createArtemisPolicy({ transport });
    await policy.decide(input());
    const decision = await policy.decide(input());
    expect(decision.operation).toBe("blocked");
    expect(decision.reason).toContain("device offline");
  });

  test("the session starts once across several decide calls", async () => {
    const transport = fakeTransport();
    const policy = createArtemisPolicy({ transport });
    await policy.decide(input());
    await policy.decide(input());
    await policy.decide(input());
    expect(transport.calls.filter((call) => call.startsWith("start:"))).toHaveLength(1);
  });

  test("teardown runs on normal end", async () => {
    const transport = fakeTransport({
      taskStatus: () =>
        Promise.resolve({ state: "completed", elapsedSeconds: 60, summary: null, error: null }),
    });
    const policy = createArtemisPolicy({ transport });
    await policy.decide(input());
    const decision = await policy.decide(input());
    expect(decision.operation).toBe("done");
    expect(transport.calls).toContain("stop:trace-1");
  });

  test("teardown runs on error", async () => {
    const transport = fakeTransport({
      taskStatus: () => Promise.reject(new Error("status lost")),
    });
    const policy = createArtemisPolicy({ transport });
    await policy.decide(input());
    const failure = await policy.decide(input()).catch((error) => error);
    expect(failure).toBeInstanceOf(PolicyDecisionError);
    expect(transport.calls).toContain("stop:trace-1");
  });

  test("teardown runs on cancellation through dispose", async () => {
    const transport = fakeTransport();
    const policy = createArtemisPolicy({ transport });
    await policy.decide(input());
    await policy.dispose();
    expect(transport.calls).toContain("stop:trace-1");
  });

  test("a transport failure yields a policy decision error, not a fabricated decision", async () => {
    const transport = fakeTransport({
      startTask: () => Promise.reject(new Error("daemon down")),
    });
    const policy = createArtemisPolicy({ transport });
    const failure = await policy.decide(input()).catch((error) => error);
    expect(failure).toBeInstanceOf(PolicyDecisionError);
    expect((failure as PolicyDecisionError).failure).toBe("transport");
  });

  test("artemis is local with a null data notice and registers additively", () => {
    const policy = createArtemisPolicy({ transport: fakeTransport() });
    expect(policy.id).toBe("artemis");
    expect(policy.isRemote).toBe(false);
    expect(policy.dataNotice).toBeNull();
    expect(policyRegistry.has("artemis")).toBe(true);
    expect(policyRegistry.has("rules")).toBe(true);
    expect(policyRegistry.has("jev")).toBe(true);
  });
});
