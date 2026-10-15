import type { Flow, FlowStep } from "@/types/automation.types";
import { parseFlow, serializeFlow } from "./flowSchema";
import { promoteSteps } from "./promote";
import type { PromoteWarning, RunTrace } from "./promote";
import type { RunView } from "./runSource";

/** Options for inline keep, default keeps goal present. */
export interface InlinePromoteOptions {
  keepGoal?: boolean;
}

/** Success result of inline promotion. */
export interface InlinePromoteResult {
  flow: Flow;
  warnings: PromoteWarning[];
  keptCount: number;
}

/** Failure when nothing to keep or resulting flow invalid. */
export interface InlinePromoteError {
  error: string;
}

export type InlinePromoteOutcome = InlinePromoteResult | InlinePromoteError;

/**
 * Turns the steps discovered by one goal step into ordinary flow steps.
 * When keepGoal is true (default) the goal stays and promoted steps are
 * inserted after it; when false the goal is replaced.
 */
export function applyInlinePromotion(
  flow: Flow,
  runView: RunView,
  goalStepId: string,
  options: InlinePromoteOptions = {},
): InlinePromoteOutcome {
  const keepGoal = options.keepGoal ?? true;
  const goalIndex = flow.steps.findIndex((s) => s.id === goalStepId);
  if (goalIndex < 0) {
    return { error: `goal ${goalStepId} not found in flow` };
  }
  const goalStep = flow.steps[goalIndex];
  if (goalStep?.op !== "goal") {
    return { error: `step ${goalStepId} is not a goal step` };
  }

  const discovered = runView.steps.filter((s) => s.goalStepId === goalStepId);
  if (discovered.length === 0) {
    return { error: `goal ${goalStepId} discovered no steps to keep` };
  }

  const trace: RunTrace = {
    runId: goalStepId,
    status: "passed",
    policyId: goalStep.policyId,
    steps: discovered.map((step) => ({
      record: {
        stepId: step.stepId,
        startedAt: 0,
        endedAt: 0,
        decision: step.decision,
        resolvedTarget: step.resolvedTarget,
        outcome: step.outcome,
        error: step.error,
        screenshotRef: step.screenshotRef,
      },
      assertions: step.assertions,
    })),
  };

  const stepIds = discovered.map((s) => s.stepId);
  const promoted = promoteSteps(trace, {
    name: flow.name,
    appPackage: flow.appPackage,
    stepIds,
  });

  const keptSteps = promoted.flow.steps;
  const warnings = promoted.warnings;

  let nextSteps: FlowStep[];
  if (keepGoal) {
    nextSteps = [
      ...flow.steps.slice(0, goalIndex),
      goalStep,
      ...keptSteps,
      ...flow.steps.slice(goalIndex + 1),
    ];
  } else {
    nextSteps = [
      ...flow.steps.slice(0, goalIndex),
      ...keptSteps,
      ...flow.steps.slice(goalIndex + 1),
    ];
  }

  const candidate: Flow = { ...flow, steps: nextSteps };
  const parsed = parseFlow(JSON.parse(serializeFlow(candidate)) as unknown);
  if (!parsed.ok) {
    return { error: `promoted flow invalid: ${parsed.errors.map((e) => e.message).join("; ")}` };
  }

  return { flow: parsed.flow, warnings, keptCount: keptSteps.length };
}
