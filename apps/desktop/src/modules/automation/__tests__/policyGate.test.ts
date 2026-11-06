import { describe, expect, test } from "vite-plus/test";
import type { Flow } from "@/types/automation.types";
import type { AgentPolicy, PolicyId, PolicyInput } from "../policies/types";
import { gateFlow, gateGoalStep } from "../policyGate";

function localPolicy(
  id: PolicyId = "rules",
  notice: string | null = null,
): AgentPolicy<PolicyInput> {
  return {
    id,
    label: `${id} policy`,
    isRemote: false,
    dataNotice: notice,
    decide: () => Promise.resolve({ operation: "done", confidence: 1, reason: "test" }),
  };
}

function remotePolicy(
  id: PolicyId = "jev",
  notice: string | null = "Data leaves the machine.",
): AgentPolicy<PolicyInput> {
  return {
    id,
    label: `${id} policy`,
    isRemote: true,
    dataNotice: notice,
    decide: () => Promise.resolve({ operation: "done", confidence: 1, reason: "test" }),
  };
}

function goalStep(policyId: PolicyId, acknowledged = false) {
  return {
    id: `g-${policyId}`,
    op: "goal" as const,
    goal: `test goal`,
    policyId,
    limits: { maxSteps: 10, maxDurationMs: 60000, maxConsecutiveFailures: 3 },
    acknowledgedNotice: acknowledged,
  };
}

describe("policyGate", () => {
  test("a local policy goal step is runnable with no acknowledgement", () => {
    const gate = gateGoalStep(goalStep("rules"), [localPolicy()]);
    expect(gate.runnable).toBe(true);
    expect(gate.needsAcknowledgement).toBe(false);
    expect(gate.blocker).toBeNull();
  });

  test("a remote policy goal step is not runnable until acknowledged", () => {
    const gate = gateGoalStep(goalStep("jev", false), [remotePolicy()]);
    expect(gate.runnable).toBe(false);
    expect(gate.needsAcknowledgement).toBe(true);
    expect(gate.blocker).not.toBeNull();
    expect(gate.blocker?.reason).toContain("acknowledgement");
  });

  test("changing the goal text after acknowledging resets it", () => {
    const step = goalStep("jev", true);
    const gate1 = gateGoalStep(step, [remotePolicy()]);
    expect(gate1.runnable).toBe(true);

    const resetStep = { ...step, acknowledgedNotice: false };
    const gate2 = gateGoalStep(resetStep, [remotePolicy()]);
    expect(gate2.runnable).toBe(false);
    expect(gate2.needsAcknowledgement).toBe(true);
  });

  test("changing the policy resets acknowledgement", () => {
    const step = goalStep("jev", true);
    const gate1 = gateGoalStep(step, [remotePolicy()]);
    expect(gate1.runnable).toBe(true);

    const switched = { ...step, policyId: "embedded" as PolicyId, acknowledgedNotice: false };
    const gate2 = gateGoalStep(switched, [remotePolicy("embedded")]);
    expect(gate2.runnable).toBe(false);
  });

  test("a remote policy with null dataNotice is never runnable", () => {
    const gate = gateGoalStep(goalStep("jev", true), [remotePolicy("jev", null)]);
    expect(gate.runnable).toBe(false);
    expect(gate.needsAcknowledgement).toBe(false);
    expect(gate.blocker?.reason).toContain("no data notice");
  });

  test("notice text comes from the policy object, not a literal", () => {
    const custom = remotePolicy("jev", "Custom notice from policy object");
    const gate = gateGoalStep(goalStep("jev", true), [custom]);
    expect(gate.noticeText).toBe("Custom notice from policy object");
  });

  test("default limits differ by policy", () => {
    const rulesGate = gateGoalStep(goalStep("rules"), [localPolicy()]);
    const jevGate = gateGoalStep(goalStep("jev", true), [remotePolicy("jev", "notice")]);
    expect(jevGate.limits.maxConsecutiveFailures).toBeGreaterThan(
      rulesGate.limits.maxConsecutiveFailures,
    );
  });

  test("a flow with one remote goal step among local ones is flagged as transferring", () => {
    const flow: Flow = {
      version: 1,
      id: "f1",
      name: "Mixed",
      appPackage: "com.example.app",
      steps: [goalStep("rules"), goalStep("jev", true), goalStep("rules")],
    };
    const gate = gateFlow(flow, [localPolicy(), remotePolicy()]);
    expect(gate.isTransferring).toBe(true);
    expect(gate.runnable).toBe(true);
  });

  test("a flow with no goal steps needs no acknowledgement", () => {
    const flow: Flow = {
      version: 1,
      id: "f1",
      name: "No goals",
      appPackage: "com.example.app",
      steps: [{ id: "s1", op: "tap", target: { kind: "selector", cssSelector: "#a" } }],
    };
    const gate = gateFlow(flow, []);
    expect(gate.runnable).toBe(true);
    expect(gate.isTransferring).toBe(false);
    expect(gate.blockers).toHaveLength(0);
  });

  test("a missing policy is a blocker", () => {
    const gate = gateGoalStep(goalStep("jev"), []);
    expect(gate.runnable).toBe(false);
    expect(gate.blocker?.reason).toContain("not available");
  });

  test("a non-goal step is always runnable", () => {
    const step = {
      id: "s1",
      op: "tap" as const,
      target: { kind: "selector" as const, cssSelector: "#a" },
    };
    const gate = gateGoalStep(step, []);
    expect(gate.runnable).toBe(true);
  });
});
