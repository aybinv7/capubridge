import type { Flow, FlowStep } from "@/types/automation.types";
import type { AgentPolicy, PolicyInput } from "./policies/types";
import { defaultLimitsFor } from "./agentPanelState";
import type { RunLimitValues } from "./agentPanelState";

/** Why a goal step cannot run. */
export interface GateBlocker {
  stepId: string;
  reason: string;
}

/** The gate result for a single goal step. */
export interface GoalStepGate {
  runnable: boolean;
  needsAcknowledgement: boolean;
  blocker: GateBlocker | null;
  noticeText: string | null;
  limits: RunLimitValues;
}

/** The gate result for an entire flow. */
export interface FlowGate {
  runnable: boolean;
  blockers: GateBlocker[];
  isTransferring: boolean;
}

/**
 * Evaluates whether a goal step is runnable. Local policies are always
 * runnable. Remote policies require an acknowledged dataNotice. A remote
 * policy with a null dataNotice is never runnable.
 */
export function gateGoalStep(step: FlowStep, policies: AgentPolicy<PolicyInput>[]): GoalStepGate {
  if (step.op !== "goal") {
    return {
      runnable: true,
      needsAcknowledgement: false,
      blocker: null,
      noticeText: null,
      limits: defaultLimitsFor("rules"),
    };
  }

  const policy = policies.find((p) => p.id === step.policyId);
  const limits = defaultLimitsFor(step.policyId);

  if (policy === undefined) {
    return {
      runnable: false,
      needsAcknowledgement: false,
      blocker: { stepId: step.id, reason: `policy "${step.policyId}" is not available` },
      noticeText: null,
      limits,
    };
  }

  if (!policy.isRemote) {
    return {
      runnable: true,
      needsAcknowledgement: false,
      blocker: null,
      noticeText: policy.dataNotice,
      limits,
    };
  }

  if (policy.dataNotice === null) {
    return {
      runnable: false,
      needsAcknowledgement: false,
      blocker: {
        stepId: step.id,
        reason: `remote policy "${policy.id}" has no data notice and cannot be presented as runnable`,
      },
      noticeText: null,
      limits,
    };
  }

  const needsAck = policy.isRemote && step.acknowledgedNotice !== true;
  if (needsAck) {
    return {
      runnable: false,
      needsAcknowledgement: true,
      blocker: {
        stepId: step.id,
        reason: `step ${step.id} requires acknowledgement that data leaves the machine`,
      },
      noticeText: policy.dataNotice,
      limits,
    };
  }

  return {
    runnable: true,
    needsAcknowledgement: false,
    blocker: null,
    noticeText: policy.dataNotice,
    limits,
  };
}

/**
 * Evaluates whether an entire flow is runnable. Collects all goal step
 * blockers. Reports whether any step transfers data.
 */
export function gateFlow(flow: Flow, policies: AgentPolicy<PolicyInput>[]): FlowGate {
  const blockers: GateBlocker[] = [];
  let isTransferring = false;

  for (const step of flow.steps) {
    if (step.op !== "goal") {
      continue;
    }
    const gate = gateGoalStep(step, policies);
    if (gate.blocker !== null) {
      blockers.push(gate.blocker);
    }
    if (gate.noticeText !== null) {
      isTransferring = true;
    }
  }

  return {
    runnable: blockers.length === 0,
    blockers,
    isTransferring,
  };
}
