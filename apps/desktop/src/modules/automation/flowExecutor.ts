import { createObservationCarry } from "./observationCarry";
import type {
  Assertion,
  Decision,
  Flow,
  FlowStep,
  Observation,
  ResolvedTarget,
  RunStatus,
  SessionSignalState,
  StepRecord,
  TargetRef,
} from "@/types/automation.types";
import type { AssertionResult, EvidenceReaders } from "./assertions";
import type { DeviceActions } from "./deviceActions";
import type { Candidate, Resolution } from "./elementIndex";
import type { LocalPolicy, PolicyId, RemotePolicy } from "./policies/types";
import { createJevPolicy } from "./policies/jev";
import { createEmbeddedReasoningPolicy } from "./policies/embedded";
import { createRulesPolicy } from "./policies/rules";
import {
  assertionBudget,
  DEFAULT_SETTLE_POLL_MS,
  DEFAULT_SETTLE_TIMEOUT_MS,
  performAction,
} from "./flowActions";
import { advanceGoal, disposeGoal, startGoal } from "./flowGoal";
import type { GoalRuntime } from "./flowGoal";
import { defaultSleep, messageOf } from "./flowShared";
import { observationFingerprint } from "./observation";

/** Bounds for one agent-goal run. Every bound is enforced; a run never loops unbounded. */
export interface RunLimits {
  maxSteps: number;
  maxDurationMs: number;
  maxConsecutiveFailures: number;
}

/** Outcome of a finished run. Cancelled runs keep every completed step. */
export interface RunResult {
  status: RunStatus;
  records: StepRecord[];
  failureReason: string | null;
  startedAt: number;
  endedAt: number;
}

/** Options for an agent-goal run. */
export interface RunGoalOptions {
  assertions?: Assertion[];
  onStep?: (record: StepRecord) => void;
}

/** One goal step with its op narrowed for policy handling. */
export type GoalStep = Extract<FlowStep, { op: "goal" }>;

/**
 * Resolves the policy for a goal step. Injected so tests never touch a
 * device or a model; the default covers all three ids with zero-dependency
 * instances (rules drives an empty intent list and answers done at once).
 */
export interface PolicyProvider {
  get(policyId: PolicyId, step: GoalStep): LocalPolicy | RemotePolicy;
}

/** Device evidence reads other than observe, injected for tests. */
export type DeviceEvidence = Omit<EvidenceReaders, "observe">;

/** Everything the executor touches, injected so no test needs a device. */
export interface ExecutorDeps {
  deviceSerial: string;
  installedPackages?: string[];
  appPackage?: string;
  observe(): Promise<Observation>;
  actions: DeviceActions;
  resolveTarget(target: TargetRef, observation: Observation): Resolution;
  buildCandidates(observation: Observation): Candidate[];
  evaluateAssertion(
    assertion: Assertion,
    evidence: EvidenceReaders,
    options: { timeoutMs: number; pollMs: number },
  ): Promise<AssertionResult>;
  evidence: DeviceEvidence;
  readbackText(target: TargetRef, observation?: Observation): Promise<string | null>;
  writeText?: (target: TargetRef, text: string) => Promise<boolean>;
  clickWebview?: (target: TargetRef) => Promise<boolean>;
  authorizeAction?: (decision: Decision, stepId: string) => Promise<void>;
  readSignals?: () => SessionSignalState;
  /** Captures the device screen as a base64 PNG for a policy that asks for it, "" on failure. */
  captureScreen?: () => Promise<string>;
  policies?: PolicyProvider;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  settleTimeoutMs?: number;
  settlePollMs?: number;
  assertionTimeoutMs?: number;
  assertionPollMs?: number;
}

/** Default provider used when the caller injects none. */
const defaultPolicyProvider: PolicyProvider = {
  get: (policyId) => {
    switch (policyId) {
      case "rules":
        return createRulesPolicy([]);
      case "jev":
        return createJevPolicy();
      case "embedded":
        return createEmbeddedReasoningPolicy();
    }
  },
};

/**
 * Runs a manual flow to completion, cancellation or halt. A failing step
 * halts by default; continuing past a failure is opt-in per step. The
 * optional step hook observes each completed record without affecting the run.
 */
export function runFlow(
  flow: Flow,
  deps: ExecutorDeps,
  signal: AbortSignal,
  onStep?: (record: StepRecord) => void,
): Promise<RunResult> {
  return runLoop({ kind: "flow", flow, cursor: 0, goal: null }, deps, signal, onStep);
}

/**
 * Runs an agent goal under a policy to completion, cancellation or halt.
 * A thin wrapper that runs a single-goal-step flow: the mixed loop below
 * owns limits, redaction, staleness and disposal, and the trailing
 * assertions still decide the outcome — the policy's done answer never does.
 */
export async function runGoal(
  goal: string,
  policy: LocalPolicy | RemotePolicy,
  deps: ExecutorDeps,
  limits: RunLimits,
  signal: AbortSignal,
  options: RunGoalOptions = {},
): Promise<RunResult> {
  const step: GoalStep = {
    id: "goal",
    op: "goal",
    goal,
    policyId: policy.id,
    limits,
    acknowledgedNotice: true,
  };
  const flow: Flow = { version: 1, id: "goal-run", name: goal, appPackage: "", steps: [step] };
  const forced: ExecutorDeps = { ...deps, policies: { get: () => policy } };
  const result = await runFlow(flow, forced, signal, options.onStep);
  if (result.status !== "passed") {
    return result;
  }
  const assertions = options.assertions ?? [];
  for (const assertion of assertions) {
    const evaluated = await deps.evaluateAssertion(
      assertion,
      { observe: () => deps.observe(), ...deps.evidence },
      assertionBudget(deps),
    );
    if (!evaluated.passed) {
      return { ...result, status: "failed", failureReason: evaluated.observed };
    }
  }
  const goalSummary = [...result.records].reverse().find((record) => record.goalStepId === null);
  if (
    assertions.length > 0 &&
    goalSummary !== undefined &&
    goalSummary.decision.operation === "done"
  ) {
    goalSummary.verificationStatus = "verified";
  }
  return result;
}

/** A flow run with an optional active goal step. */
export type StepSource = { kind: "flow"; flow: Flow; cursor: number; goal: GoalRuntime | null };

/** What the shared loop should do next. */
export type LoopInstruction =
  | {
      kind: "step";
      decision: Decision;
      step?: FlowStep;
      observation: Observation;
      stepId: string;
      goalStepId: string | null;
      goal: GoalRuntime | null;
      observationMs: number;
      policyMs: number;
    }
  | { kind: "skip" }
  | { kind: "continue" }
  | { kind: "stop"; status: RunStatus; failureReason: string | null };

/**
 * One step loop serves every run: deterministic steps synthesize their
 * decision from the flow, goal steps ask their policy. Discovered steps
 * execute through the same path with their goal's identity attached.
 */
async function runLoop(
  source: StepSource,
  deps: ExecutorDeps,
  signal: AbortSignal,
  onStep?: (record: StepRecord) => void,
): Promise<RunResult> {
  const clock = deps.now ?? Date.now;
  const startedAt = clock();
  const records: StepRecord[] = [];
  const carry = createObservationCarry(() => deps.observe(), clock);
  const decisionDeps: ExecutorDeps = { ...deps, observe: () => carry.observe() };
  for (;;) {
    if (signal.aborted) {
      await disposeGoal(source.goal);
      return finished("cancelled", records, null, startedAt, clock());
    }
    const instruction = await nextInstruction(source, decisionDeps, signal, records, (record) =>
      onStep?.(record),
    );
    if (instruction.kind === "stop") {
      return finished(instruction.status, records, instruction.failureReason, startedAt, clock());
    }
    if (instruction.kind === "skip" || instruction.kind === "continue") {
      continue;
    }
    const outcome = await executePlannedStep(
      instruction.decision,
      instruction.step,
      instruction.observation,
      deps,
      signal,
      records,
      { stepId: instruction.stepId, goalStepId: instruction.goalStepId },
      instruction.observationMs,
      instruction.policyMs,
    );
    if (outcome.carry === undefined) {
      carry.clear();
    } else {
      carry.offer(outcome.carry);
    }
    onStep?.(outcome.record);
    if (outcome.cancelled) {
      await disposeGoal(source.goal);
      return finished("cancelled", records, null, startedAt, clock());
    }
    if (outcome.fatalError !== null) {
      await disposeGoal(source.goal);
      return finished("failed", records, outcome.fatalError, startedAt, clock());
    }
    const stop = afterStep(instruction, outcome.record);
    if (stop !== null) {
      await disposeGoal(source.goal);
      return finished(stop.status, records, stop.failureReason, startedAt, clock());
    }
  }
}

/**
 * Decides the next loop action. Deterministic steps synthesize their
 * decision from the flow; an active goal keeps being served until it ends;
 * a goal step starts its policy exactly once.
 */
async function nextInstruction(
  source: StepSource,
  deps: ExecutorDeps,
  signal: AbortSignal,
  records: StepRecord[],
  emit: (record: StepRecord) => void,
): Promise<LoopInstruction> {
  if (source.goal !== null) {
    return advanceGoal(source, deps, signal, records, emit);
  }
  const step = source.flow.steps[source.cursor];
  if (step === undefined) {
    const failed = records.find((record) => record.outcome === "failed");
    return failed === undefined
      ? { kind: "stop", status: "passed", failureReason: null }
      : {
          kind: "stop",
          status: "failed",
          failureReason: `step ${failed.stepId} failed: ${failed.error ?? "unknown error"}`,
        };
  }
  if (step.op !== "goal") {
    source.cursor += 1;
    const observedAt = (deps.now ?? Date.now)();
    const observation = await deps.observe();
    const observationFingerprintValue = observationFingerprint(observation);
    return {
      kind: "step",
      decision: { ...decisionForStep(step), frameId: observationFingerprintValue },
      step,
      observation,
      observationMs: Math.max(0, (deps.now ?? Date.now)() - observedAt),
      stepId: step.id,
      goalStepId: null,
      goal: null,
      policyMs: 0,
    };
  }
  const provider = deps.policies ?? defaultPolicyProvider;
  return startGoal(source, step, deps, signal, provider, records, emit);
}

/**
 * Decides whether the loop stops after a completed step record.
 * Discovered steps feed their goal's consecutive-failure accounting and
 * never halt the run directly; goal terminals decide that themselves.
 */
function afterStep(
  instruction: Extract<LoopInstruction, { kind: "step" }>,
  record: StepRecord,
): { status: RunStatus; failureReason: string | null } | null {
  if (instruction.goal !== null) {
    instruction.goal.lastActionFingerprint =
      record.afterFingerprint ?? record.beforeFingerprint ?? null;
    instruction.goal.lastActionScreenChanged = record.screenChanged ?? false;
    if (record.outcome === "failed") {
      if (record.decision.operation === "type") {
        instruction.goal.consecutiveFailures = instruction.goal.step.limits.maxConsecutiveFailures;
        instruction.goal.lastPolicyError = record.error ?? "typed text could not be verified";
        return null;
      }
      instruction.goal.consecutiveFailures += 1;
    } else {
      instruction.goal.consecutiveFailures = 0;
    }
    return null;
  }
  if (record.outcome === "failed" && !(instruction.step?.continueOnFailure ?? false)) {
    return {
      status: "failed",
      failureReason: `step ${record.stepId} failed: ${record.error ?? "unknown error"}`,
    };
  }
  return null;
}

/** Outcome of executing one planned step. */
interface StepOutcome {
  record: StepRecord;
  cancelled: boolean;
  fatalError: string | null;
  carry?: Observation;
}

/** Identity attached to a record: its step id and its goal, if discovered. */
export interface StepIdentity {
  stepId: string;
  goalStepId: string | null;
}

/**
 * Executes one planned step with per-step retry, then records the action
 * before the post-action observation: if the settle read fails, the step
 * still exists in the trace. The record is pushed before settling so a
 * failed settle read cannot lose it.
 */
async function executePlannedStep(
  decision: Decision,
  step: FlowStep | undefined,
  preObservation: Observation,
  deps: ExecutorDeps,
  signal: AbortSignal,
  records: StepRecord[],
  identity?: StepIdentity,
  initialObservationMs = 0,
  initialPolicyMs = 0,
): Promise<StepOutcome> {
  const clock = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;
  const startedAt = clock();
  const maxAttempts = step?.retry?.maxAttempts ?? 1;
  const retryDelayMs = step?.retry?.delayMs ?? 0;
  const stepId = identity?.stepId ?? step?.id ?? `goal-${records.length}`;
  const goalStepId = identity?.goalStepId ?? null;
  let attempts = 0;
  let lastError: string | null = null;
  let resolved: ResolvedTarget | null = null;
  let screenshotRef = preObservation.visual.screenshotRef;
  let observation = preObservation;
  let beforeFingerprint = observationFingerprint(observation);
  let observationMs = initialObservationMs;
  let actionMs = 0;
  let dispatchStatus: StepRecord["dispatchStatus"] = "not_attempted";
  for (;;) {
    attempts += 1;
    if (signal.aborted) {
      return {
        record: {
          stepId,
          startedAt,
          endedAt: clock(),
          decision,
          resolvedTarget: resolved,
          outcome: "skipped",
          error: "cancelled",
          screenshotRef,
          attempts,
          goalStepId,
          signals: observation.signals,
          timings: { policyMs: initialPolicyMs, observationMs, actionMs, settleMs: 0 },
          beforeFingerprint,
          dispatchStatus,
          verificationStatus: "not_run",
        },
        cancelled: true,
        fatalError: null,
      };
    }
    try {
      if (attempts > 1) {
        const observedAt = clock();
        observation = await deps.observe();
        observationMs += Math.max(0, clock() - observedAt);
        beforeFingerprint = observationFingerprint(observation);
      }
      screenshotRef = observation.visual.screenshotRef;
      const actionStartedAt = clock();
      try {
        await deps.authorizeAction?.(decision, stepId);
        resolved = await performAction(decision, step, observation, deps);
        if (resolved !== null) {
          resolved = { ...resolved, frameId: beforeFingerprint };
        }
        dispatchStatus = "dispatched";
      } finally {
        actionMs += Math.max(0, clock() - actionStartedAt);
      }
      lastError = null;
      break;
    } catch (error) {
      lastError = messageOf(error);
      dispatchStatus = "failed";
      if (attempts >= maxAttempts) {
        break;
      }
      if (retryDelayMs > 0) {
        await sleep(retryDelayMs);
      }
    }
  }
  const record: StepRecord = {
    stepId,
    startedAt,
    endedAt: clock(),
    decision,
    resolvedTarget: resolved,
    outcome: lastError === null ? "ok" : "failed",
    error: lastError,
    screenshotRef,
    attempts,
    goalStepId,
    signals: observation.signals,
    timings: { policyMs: initialPolicyMs, observationMs, actionMs, settleMs: 0 },
    beforeFingerprint,
    dispatchStatus,
    verificationStatus:
      lastError !== null ? "unverified" : decision.operation === "assert" ? "verified" : "not_run",
  };
  records.push(record);
  if (lastError !== null || decision.operation === "assert" || decision.operation === "wait") {
    record.afterFingerprint = beforeFingerprint;
    record.screenChanged = false;
    return { record, cancelled: false, fatalError: null };
  }
  const settleStartedAt = clock();
  const settle = await settleDevice(deps, signal, beforeFingerprint);
  const timings = record.timings;
  if (timings !== undefined) {
    timings.settleMs = Math.max(0, clock() - settleStartedAt);
  }
  if (settle.kind === "cancelled") {
    record.verificationStatus = "unverified";
    return { record, cancelled: true, fatalError: null };
  }
  if (settle.kind === "error") {
    record.outcome = "failed";
    record.error = settle.message;
    record.verificationStatus = "unverified";
    return { record, cancelled: false, fatalError: settle.message };
  }
  record.afterFingerprint = observationFingerprint(settle.observation);
  record.screenChanged = settle.screenChanged;
  const typeReadbackError = await verifyTypeReadback(decision, step, settle.observation, deps);
  if (typeReadbackError !== null) {
    record.outcome = "failed";
    record.error = typeReadbackError;
    record.verificationStatus = "unverified";
    return { record, cancelled: false, fatalError: null };
  }
  record.verificationStatus = settle.screenChanged ? "verified" : "unverified";
  return {
    record,
    cancelled: false,
    fatalError: null,
    carry: settle.quiescent ? settle.observation : undefined,
  };
}

async function verifyTypeReadback(
  decision: Decision,
  step: FlowStep | undefined,
  observation: Observation,
  deps: ExecutorDeps,
): Promise<string | null> {
  if (decision.operation !== "type" || (step?.op === "type" && step.verifyReadback === false)) {
    return null;
  }
  const target = decision.target;
  const expected = step?.op === "type" ? step.text : decision.text;
  if (target === undefined || expected === undefined) {
    return "readback unavailable: type decision carries no target or text";
  }
  const actual = await deps.readbackText(target, observation);
  return actual === expected
    ? null
    : `readback mismatch: typed "${expected}", field reads "${actual ?? "<unreadable>"}"`;
}

/** Settle outcome: an error message, cancellation, or settled. */
type SettleOutcome =
  | { kind: "error"; message: string }
  | { kind: "cancelled" }
  | { kind: "settled"; observation: Observation; screenChanged: boolean; quiescent: boolean };

/**
 * Polls the device until pending requests drain, a deadline passes, or the
 * run is cancelled. Bounded polling with a deadline, never a fixed sleep.
 */
async function settleDevice(
  deps: ExecutorDeps,
  signal: AbortSignal,
  beforeFingerprint: string,
): Promise<SettleOutcome> {
  const clock = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;
  const timeoutMs = deps.settleTimeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS;
  const pollMs = Math.max(1, deps.settlePollMs ?? DEFAULT_SETTLE_POLL_MS);
  const maxPolls = Math.max(1, Math.ceil(Math.max(0, timeoutMs) / pollMs) + 1);
  const startedAt = clock();
  let latest: Observation | undefined;
  for (let poll = 0; poll < maxPolls; poll += 1) {
    if (signal.aborted) {
      return { kind: "cancelled" };
    }
    try {
      latest = await deps.observe();
    } catch (error) {
      return { kind: "error", message: `post-action observation failed: ${messageOf(error)}` };
    }
    const changed = observationFingerprint(latest) !== beforeFingerprint;
    if (changed) {
      return {
        kind: "settled",
        observation: latest,
        screenChanged: changed,
        quiescent: latest.signals.pendingRequests <= 0,
      };
    }
    if (latest.signals.pendingRequests <= 0) {
      if (deps.readSignals === undefined) {
        return { kind: "settled", observation: latest, screenChanged: false, quiescent: true };
      }
      await sleep(Math.min(pollMs, 50));
      try {
        if (deps.readSignals().pendingRequests <= 0) {
          return { kind: "settled", observation: latest, screenChanged: false, quiescent: true };
        }
      } catch {
        return { kind: "settled", observation: latest, screenChanged: false, quiescent: false };
      }
    }
    if (clock() - startedAt >= timeoutMs) {
      return { kind: "settled", observation: latest, screenChanged: false, quiescent: false };
    }
    await sleep(pollMs);
  }
  if (latest === undefined) {
    return { kind: "error", message: "post-action observation produced no state" };
  }
  return { kind: "settled", observation: latest, screenChanged: false, quiescent: false };
}

/**
 * Synthesizes the decision a manual step executes from.
 */
function decisionForStep(step: FlowStep): Decision {
  const reason = `flow step ${step.id}`;
  switch (step.op) {
    case "tap":
    case "longPress":
      return { operation: step.op, target: step.target, confidence: 1, reason };
    case "type":
      return { operation: step.op, target: step.target, text: step.text, confidence: 1, reason };
    case "swipe":
      return {
        operation: step.op,
        target: { kind: "point", x: step.to.x, y: step.to.y },
        confidence: 1,
        reason,
      };
    case "scroll":
      return { operation: step.op, target: step.target, confidence: 1, reason };
    case "pressKey":
      return { operation: step.op, text: step.keycode, confidence: 1, reason };
    case "back":
      return { operation: step.op, confidence: 1, reason };
    case "openApp":
      return { operation: step.op, text: step.packageName, confidence: 1, reason };
    case "wait":
      return { operation: step.op, confidence: 1, reason };
    case "assert":
      return { operation: step.op, confidence: 1, reason };
    case "goal": {
      throw new Error("goal steps decide through their policy in the mixed loop (CB-53)");
    }
  }
}

/**
 * Finishes a run with its records intact.
 */
function finished(
  status: RunStatus,
  records: StepRecord[],
  failureReason: string | null,
  startedAt: number,
  endedAt: number,
): RunResult {
  return { status, records, failureReason, startedAt, endedAt };
}
