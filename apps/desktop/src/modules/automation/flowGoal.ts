import type {
  ActionBatch,
  Decision,
  Observation,
  StepRecord,
  TargetRef,
} from "@/types/automation.types";
import type {
  ExecutorDeps,
  GoalStep,
  LoopInstruction,
  PolicyProvider,
  StepSource,
} from "./flowExecutor";
import type { LocalPolicy, PolicyInput, RemotePolicy } from "./policies/types";
import { messageOf } from "./flowShared";
import { observationFingerprint } from "./observation";
import { redactObservation } from "./redact";
import { executeActionBatch } from "./actionBatch";

const MAX_CONSECUTIVE_WAIT_DECISIONS = 3;

/** Live state of one goal step while the loop serves it. */
export interface GoalRuntime {
  step: GoalStep;
  policy: LocalPolicy | RemotePolicy;
  taken: number;
  discovered: number;
  consecutiveFailures: number;
  startedAt: number;
  lastDecision: Decision | null;
  lastPolicyError: string | null;
  consecutiveWaits: number;
  consecutiveRepeats: number;
  lastActionFingerprint: string | null;
  lastActionScreenChanged: boolean | null;
  disposed: boolean;
}

/**
 * Starts the policy for a goal step exactly once, then serves its first
 * decision. A provider failure fails the step with the policy's own error.
 */
export async function startGoal(
  source: StepSource,
  step: GoalStep,
  deps: ExecutorDeps,
  signal: AbortSignal,
  provider: PolicyProvider,
  records: StepRecord[],
  emit: (record: StepRecord) => void,
): Promise<LoopInstruction> {
  const clock = deps.now ?? Date.now;
  let policy: LocalPolicy | RemotePolicy;
  try {
    policy = provider.get(step.policyId, step);
  } catch (error) {
    return failGoalStep(source, step, messageOf(error), clock(), records, emit);
  }
  source.goal = {
    step,
    policy,
    taken: 0,
    discovered: 0,
    consecutiveFailures: 0,
    startedAt: clock(),
    lastDecision: null,
    lastPolicyError: null,
    consecutiveWaits: 0,
    consecutiveRepeats: 0,
    lastActionFingerprint: null,
    lastActionScreenChanged: null,
    disposed: false,
  };
  return advanceGoal(source, deps, signal, records, emit);
}

/**
 * Fails a goal step before its policy ever ran, honouring continueOnFailure.
 */
function failGoalStep(
  source: StepSource,
  step: GoalStep,
  message: string,
  now: number,
  records: StepRecord[],
  emit: (record: StepRecord) => void,
): LoopInstruction {
  const summary: StepRecord = {
    stepId: step.id,
    startedAt: now,
    endedAt: now,
    decision: { operation: "blocked", confidence: 1, reason: message },
    resolvedTarget: null,
    outcome: "failed",
    error: message,
    screenshotRef: "",
    attempts: 0,
    goalStepId: null,
    dispatchStatus: "not_attempted",
    verificationStatus: "unverified",
  };
  records.push(summary);
  emit(summary);
  source.cursor += 1;
  if (step.continueOnFailure === true) {
    return { kind: "continue" };
  }
  return { kind: "stop", status: "failed", failureReason: message };
}

/**
 * Serves one decision of the active goal: limit checks, then observe,
 * decide, validate. Terminal states dispose the policy, emit the goal
 * summary record, and either continue the flow or stop the run.
 */
export async function advanceGoal(
  source: StepSource,
  deps: ExecutorDeps,
  signal: AbortSignal,
  records: StepRecord[],
  emit: (record: StepRecord) => void,
): Promise<LoopInstruction> {
  const clock = deps.now ?? Date.now;
  const runtime = source.goal;
  if (runtime === null) {
    return { kind: "continue" };
  }
  if (signal.aborted) {
    await disposeGoal(source.goal);
    source.goal = null;
    return { kind: "stop", status: "cancelled", failureReason: null };
  }
  const limitHit = goalLimitHit(runtime, clock());
  if (limitHit !== null) {
    return endGoalHalted(source, records, emit, limitHit, clock());
  }
  let observation: Observation;
  let observationMs = 0;
  const observedAt = clock();
  try {
    observation = await deps.observe();
    observationMs = Math.max(0, clock() - observedAt);
  } catch (error) {
    return endGoalHalted(
      source,
      records,
      emit,
      `goal ${runtime.step.id} observation failed: ${messageOf(error)}`,
      clock(),
    );
  }
  const stateFingerprint = observationFingerprint(observation);
  const policyInput: PolicyInput = {
    goal: runtime.step.goal,
    observation,
    candidates: deps.buildCandidates(observation),
    history: records,
    stepIndex: records.length,
    stateFingerprint,
  };
  if (runtime.policy.decideBatch !== undefined) {
    try {
      const batch = await decideBatchWithPolicy(runtime.policy, policyInput);
      const batchResult = await executeActionBatch(batch, deps, signal);
      records.push(...batchResult.records);
      batchResult.records.forEach(emit);
      runtime.taken += batchResult.records.length;
      const lastRecord = batchResult.records.at(-1);
      if (lastRecord !== undefined) {
        runtime.lastDecision = lastRecord.decision;
        runtime.lastActionFingerprint = lastRecord.afterFingerprint ?? stateFingerprint;
        runtime.lastActionScreenChanged = batchResult.screenChanged;
      }
      if (batchResult.status === "cancelled") {
        return endGoalHalted(source, records, emit, "action batch cancelled", clock());
      }
      if (batchResult.status !== "completed") {
        return endGoalHalted(source, records, emit, `action batch ${batchResult.reason}`, clock());
      }
      if (!batchResult.screenChanged) {
        return endGoalHalted(
          source,
          records,
          emit,
          "action batch completed without an authoritative state change",
          clock(),
        );
      }
      return { kind: "continue" };
    } catch (error) {
      runtime.consecutiveFailures += 1;
      runtime.lastPolicyError = messageOf(error);
      return { kind: "skip" };
    }
  }
  let decision: Decision;
  let policyMs = 0;
  const policyStartedAt = clock();
  try {
    decision = await decideWithPolicy(runtime.policy, policyInput);
    policyMs = Math.max(0, clock() - policyStartedAt);
    decision = { ...decision, frameId: stateFingerprint };
  } catch (error) {
    runtime.consecutiveFailures += 1;
    runtime.lastPolicyError = messageOf(error);
    return { kind: "skip" };
  }
  const isRepeat =
    runtime.lastDecision !== null &&
    runtime.lastDecision.operation === decision.operation &&
    isSameTarget(runtime.lastDecision.target, decision.target);
  const noProgress =
    runtime.lastActionFingerprint === stateFingerprint && runtime.lastActionScreenChanged !== true;
  if (isRepeat && noProgress && decision.operation !== "wait") {
    const previous = records.at(-1);
    return endGoalHalted(
      source,
      records,
      emit,
      previous?.dispatchStatus === "failed" && previous.error !== null
        ? `goal ${runtime.step.id} stopped: its ${decision.operation} never dispatched: ${previous.error}`
        : `goal ${runtime.step.id} made no progress after one unchanged action (${decision.operation})`,
      clock(),
    );
  }
  if (isRepeat && decision.operation !== "wait") {
    runtime.consecutiveRepeats += 1;
  } else {
    runtime.consecutiveRepeats = 0;
  }
  if (!(runtime.policy.id === "artemis" && decision.operation === "wait")) {
    runtime.taken += 1;
  }
  runtime.lastDecision = decision;
  if (decision.operation === "wait") {
    runtime.consecutiveWaits += 1;
    if (
      runtime.policy.id !== "artemis" &&
      runtime.step.limits.maxSteps > MAX_CONSECUTIVE_WAIT_DECISIONS &&
      runtime.consecutiveWaits > MAX_CONSECUTIVE_WAIT_DECISIONS
    ) {
      return endGoalHalted(
        source,
        records,
        emit,
        `goal ${runtime.step.id} made no progress after ${MAX_CONSECUTIVE_WAIT_DECISIONS} waits`,
        clock(),
      );
    }
  } else {
    runtime.consecutiveWaits = 0;
  }
  if (decision.operation === "done") {
    return endGoalDone(source, records, emit, decision, clock());
  }
  if (decision.operation === "blocked") {
    return endGoalHalted(
      source,
      records,
      emit,
      `goal ${runtime.step.id} blocked: ${decision.reason}`,
      clock(),
    );
  }
  const targetResolution =
    decision.target === undefined ? null : deps.resolveTarget(decision.target, observation);
  if (targetResolution !== null && !targetResolution.ok) {
    runtime.consecutiveFailures += 1;
    runtime.lastPolicyError = `target rejected before dispatch: ${targetResolution.reason}`;
    return { kind: "skip" };
  }
  const stepId = `${runtime.step.id}.${runtime.discovered}`;
  runtime.discovered += 1;
  return {
    kind: "step",
    decision,
    step: undefined,
    observation,
    stepId,
    goalStepId: runtime.step.id,
    goal: runtime,
    observationMs,
    policyMs,
  };
}

/**
 * Names the exhausted bound, if any, for one goal step.
 */
function goalLimitHit(runtime: GoalRuntime, now: number): string | null {
  const limits = runtime.step.limits;
  if (runtime.taken >= limits.maxSteps) {
    return `goal ${runtime.step.id} halted: maxSteps (${limits.maxSteps}) reached`;
  }
  if (now - runtime.startedAt >= limits.maxDurationMs) {
    return `goal ${runtime.step.id} halted: maxDurationMs (${limits.maxDurationMs}) reached`;
  }
  if (runtime.consecutiveFailures >= limits.maxConsecutiveFailures) {
    return `goal ${runtime.step.id} halted: maxConsecutiveFailures (${limits.maxConsecutiveFailures}) reached`;
  }
  return null;
}

/**
 * Appends the policy error when one explains the halt, so a run never
 * reports only a limit when the underlying cause was a policy failure.
 */
function withPolicyCause(message: string, runtime: GoalRuntime): string {
  if (runtime.lastPolicyError === null) {
    return message;
  }
  return `${message}; last policy error: ${runtime.lastPolicyError}`;
}

/**
 * Ends a goal step that answered done. The answer only stops the goal;
 * discovered failures fail it like any other failed step.
 */
async function endGoalDone(
  source: StepSource,
  records: StepRecord[],
  emit: (record: StepRecord) => void,
  decision: Decision,
  now: number,
): Promise<LoopInstruction> {
  const runtime = source.goal;
  if (runtime === null) {
    return { kind: "continue" };
  }
  await disposeGoal(source.goal);
  source.goal = null;
  source.cursor += 1;
  const failed = records.find(
    (record) => record.goalStepId === runtime.step.id && record.outcome === "failed",
  );
  const summary: StepRecord = {
    stepId: runtime.step.id,
    startedAt: runtime.startedAt,
    endedAt: now,
    decision,
    resolvedTarget: null,
    outcome: failed === undefined ? "ok" : "failed",
    error: failed === undefined ? null : (failed.error ?? "a discovered step failed"),
    screenshotRef: "",
    attempts: runtime.taken,
    goalStepId: null,
    dispatchStatus: "not_attempted",
    verificationStatus: "unverified",
  };
  records.push(summary);
  emit(summary);
  if (summary.outcome === "failed" && runtime.step.continueOnFailure !== true) {
    return {
      kind: "stop",
      status: "failed",
      failureReason: `step ${summary.stepId} failed: ${summary.error ?? "unknown error"}`,
    };
  }
  return { kind: "continue" };
}

/**
 * Ends a goal step on a halt: blocked, limited, or interrupted. The halt
 * continues the flow only when the step says to; halting defaults to
 * halting the run.
 */
async function endGoalHalted(
  source: StepSource,
  records: StepRecord[],
  emit: (record: StepRecord) => void,
  message: string,
  now: number,
): Promise<LoopInstruction> {
  const runtime = source.goal;
  if (runtime === null) {
    return { kind: "continue" };
  }
  const failureReason = withPolicyCause(message, runtime);
  const lastDecision = runtime.lastDecision ?? {
    operation: "blocked" as const,
    confidence: 1,
    reason: message,
  };
  await disposeGoal(source.goal);
  source.goal = null;
  source.cursor += 1;
  const summary: StepRecord = {
    stepId: runtime.step.id,
    startedAt: runtime.startedAt,
    endedAt: now,
    decision: lastDecision,
    resolvedTarget: null,
    outcome: "failed",
    error: failureReason,
    screenshotRef: "",
    attempts: runtime.taken,
    goalStepId: null,
    dispatchStatus: "not_attempted",
    verificationStatus: "unverified",
  };
  records.push(summary);
  emit(summary);
  if (runtime.step.continueOnFailure === true) {
    return { kind: "continue" };
  }
  return { kind: "stop", status: "halted", failureReason };
}

/**
 * Disposes one goal policy exactly once. Best-effort: a failing teardown
 * must not hide the run outcome it accompanies.
 */
export async function disposeGoal(runtime: GoalRuntime | null): Promise<void> {
  if (runtime === null || runtime.disposed) {
    return;
  }
  runtime.disposed = true;
  const candidate = runtime.policy as Partial<{ dispose(): Promise<void> }>;
  if (typeof candidate.dispose === "function") {
    try {
      await candidate.dispose();
    } catch {
      return;
    }
  }
}

/**
 * Asks one policy for its decision. Local policies see the raw
 * observation; remote policies see only the redacted one, rebuilt every
 * iteration so no caller can smuggle raw state past the gate.
 */
function decideWithPolicy(
  policy: LocalPolicy | RemotePolicy,
  base: PolicyInput,
): Promise<Decision> {
  if (!policy.isRemote) {
    return policy.decide(base);
  }
  return policy.decide({
    ...base,
    observation: redactObservation(base.observation),
  });
}

function decideBatchWithPolicy(
  policy: LocalPolicy | RemotePolicy,
  base: PolicyInput,
): Promise<ActionBatch> {
  if (policy.decideBatch === undefined) {
    throw new Error("policy does not provide action batches");
  }
  if (!policy.isRemote) {
    return policy.decideBatch(base);
  }
  return policy.decideBatch({
    ...base,
    observation: redactObservation(base.observation),
  });
}

/** Compares two target references for equality across types. */
function isSameTarget(first: TargetRef | undefined, second: TargetRef | undefined): boolean {
  if (first === undefined && second === undefined) {
    return true;
  }
  if (first === undefined || second === undefined) {
    return false;
  }
  if (first.kind !== second.kind) {
    return false;
  }
  switch (first.kind) {
    case "selector":
      return first.cssSelector === (second as typeof first).cssSelector;
    case "text":
      return first.text === (second as typeof first).text;
    case "nativeIndex":
      return first.index === (second as typeof first).index;
    case "point":
      return first.x === (second as typeof first).x && first.y === (second as typeof first).y;
  }
}
