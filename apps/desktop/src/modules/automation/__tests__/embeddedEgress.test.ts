import { describe, expect, test } from "vite-plus/test";
import {
  createEmbeddedReasoningPolicy,
  EMBEDDED_AUTO_ROUTED_NOTICE,
  EMBEDDED_DATA_NOTICE,
  embeddedDataNotice,
} from "../policies/embedded";
import { createJevPolicy } from "../policies/jev";
import { defaultReasoningSelection, resolveReasoningModel } from "../reasoning/providerRegistry";
import { gateGoalStep } from "../policyGate";
import type { Decision, FlowStep } from "@/types/automation.types";
import type { AgentPolicy, PolicyInput } from "../policies/types";

const AUTO = { provider: "openrouter" as const, modelId: "openrouter/auto" };

function goalStep(policyId: "jev" | "embedded", acknowledged: boolean): FlowStep {
  return {
    id: "g1",
    op: "goal",
    goal: "open stock and search",
    policyId,
    limits: { maxSteps: 40, maxDurationMs: 300_000, maxConsecutiveFailures: 5 },
    acknowledgedNotice: acknowledged,
  };
}

describe("embedded reasoning egress", () => {
  test("the default selection is a named model, never an auto-router", () => {
    const selection = defaultReasoningSelection();
    expect(resolveReasoningModel(selection).autoRouted).toBe(false);
  });

  test("the default is not openrouter/auto", () => {
    expect(defaultReasoningSelection().modelId).not.toBe("openrouter/auto");
  });

  test("an auto-routed selection warns that the recipient is unknown in advance", () => {
    const notice = embeddedDataNotice(AUTO);
    expect(notice).toContain(EMBEDDED_AUTO_ROUTED_NOTICE);
  });

  test("a named selection names its recipient and carries no auto-routing warning", () => {
    const notice = embeddedDataNotice(defaultReasoningSelection());
    expect(notice).not.toContain(EMBEDDED_AUTO_ROUTED_NOTICE);
    expect(notice).toContain(resolveReasoningModel(defaultReasoningSelection()).label);
  });

  test("an unknown model degrades to the base notice rather than silencing consent text", () => {
    const notice = embeddedDataNotice({ provider: "openrouter", modelId: "does-not-exist" });
    expect(notice).toBe(EMBEDDED_DATA_NOTICE);
  });

  test("the policy publishes the notice for the selection it was built with", () => {
    const auto = createEmbeddedReasoningPolicy({ selection: AUTO });
    expect(auto.dataNotice).toContain(EMBEDDED_AUTO_ROUTED_NOTICE);
    const named = createEmbeddedReasoningPolicy();
    expect(named.dataNotice).not.toContain(EMBEDDED_AUTO_ROUTED_NOTICE);
  });

  test("embedded is remote and always carries a notice", () => {
    const policy = createEmbeddedReasoningPolicy();
    expect(policy.isRemote).toBe(true);
    expect(policy.dataNotice).not.toBeNull();
  });
});

/**
 * The gate reads only policy metadata and never calls `decide`, so the real
 * policies' identity, remoteness and notice are carried over with a stub
 * decider. Using the real policies is the point: this proves the shipped
 * `embedded` is gated like the shipped `jev`, not that two fixtures agree.
 */
function gatePolicies(): AgentPolicy<PolicyInput>[] {
  return [
    createJevPolicy({ transport: { send: () => Promise.resolve({}) } }),
    createEmbeddedReasoningPolicy(),
  ].map((policy) => ({
    id: policy.id,
    label: policy.label,
    isRemote: policy.isRemote,
    dataNotice: policy.dataNotice,
    decide: (): Promise<Decision> => Promise.reject(new Error("the gate must not call decide")),
  }));
}

describe("embedded is gated exactly like jev", () => {
  const policies = gatePolicies();

  for (const id of ["jev", "embedded"] as const) {
    test(`${id} cannot run unacknowledged`, () => {
      const gate = gateGoalStep(goalStep(id, false), policies);
      expect(gate.runnable).toBe(false);
      expect(gate.needsAcknowledgement).toBe(true);
    });

    test(`${id} runs once acknowledged`, () => {
      expect(gateGoalStep(goalStep(id, true), policies).runnable).toBe(true);
    });
  }

  test("both policies reach the same gate decision for the same acknowledgement", () => {
    const jev = gateGoalStep(goalStep("jev", false), policies);
    const embedded = gateGoalStep(goalStep("embedded", false), policies);
    expect(embedded.runnable).toBe(jev.runnable);
    expect(embedded.needsAcknowledgement).toBe(jev.needsAcknowledgement);
  });
});
