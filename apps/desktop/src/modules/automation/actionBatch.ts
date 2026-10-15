import type { ActionBatch, Observation, StepRecord } from "@/types/automation.types";
import type { AssertionResult } from "./assertions";
import { performAction } from "./flowActions";
import type { ExecutorDeps } from "./flowExecutor";
import { messageOf } from "./flowShared";
import { observationFingerprint } from "./observation";

export type ActionBatchStopReason =
  | "completed"
  | "stale-precondition"
  | "budget-exhausted"
  | "timeout"
  | "cancelled"
  | "unchanged-action-identity"
  | "dispatch-failed"
  | "verification-failed";

export interface ActionBatchResult {
  status: "completed" | "failed" | "blocked" | "cancelled";
  reason: ActionBatchStopReason;
  records: StepRecord[];
  observation: Observation | null;
  screenChanged: boolean;
  assertions: AssertionResult[];
}

const MAX_BATCH_ACTIONS = 8;

export async function executeActionBatch(
  batch: ActionBatch,
  deps: ExecutorDeps,
  signal: AbortSignal,
): Promise<ActionBatchResult> {
  const clock = deps.now ?? Date.now;
  const startedAt = clock();
  const records: StepRecord[] = [];
  const opening = await deps.observe();
  const openingFingerprint = observationFingerprint(opening);
  if (
    openingFingerprint !== batch.precondition.fingerprint ||
    (batch.precondition.packageName !== undefined &&
      opening.native.packageName !== batch.precondition.packageName) ||
    (batch.precondition.activity !== undefined &&
      opening.native.activity !== batch.precondition.activity)
  ) {
    return result("blocked", "stale-precondition", records, opening, false, []);
  }
  const limit = Math.min(Math.max(1, Math.floor(batch.maxActions)), MAX_BATCH_ACTIONS);
  if (batch.actions.length === 0 || batch.actions.length > limit) {
    return result("blocked", "budget-exhausted", records, opening, false, []);
  }
  let previousIdentity: string | null = null;
  for (const action of batch.actions.slice(0, limit)) {
    if (signal.aborted) {
      return result("cancelled", "cancelled", records, opening, false, []);
    }
    if (clock() - startedAt >= Math.max(1, batch.timeoutMs)) {
      return result("blocked", "timeout", records, opening, false, []);
    }
    const identity = `${action.decision.operation}:${JSON.stringify(action.decision.target ?? null)}`;
    if (identity === previousIdentity) {
      return result("blocked", "unchanged-action-identity", records, opening, false, []);
    }
    previousIdentity = identity;
    const started = clock();
    const record: StepRecord = {
      stepId: action.id,
      startedAt: started,
      endedAt: started,
      decision: action.decision,
      resolvedTarget: null,
      outcome: "ok",
      error: null,
      screenshotRef: opening.visual.screenshotRef,
      attempts: 1,
      goalStepId: null,
      signals: opening.signals,
      timings: { observationMs: 0, actionMs: 0, settleMs: 0 },
      beforeFingerprint: openingFingerprint,
      dispatchStatus: "not_attempted",
      verificationStatus: "not_run",
    };
    try {
      record.resolvedTarget = await performAction(action.decision, action.step, opening, deps);
      record.dispatchStatus = "dispatched";
    } catch (error) {
      record.outcome = "failed";
      record.error = messageOf(error);
      record.dispatchStatus = "failed";
      record.verificationStatus = "unverified";
      record.endedAt = clock();
      records.push(record);
      return result("failed", "dispatch-failed", records, opening, false, []);
    }
    record.endedAt = clock();
    record.timings = {
      observationMs: 0,
      actionMs: Math.max(0, record.endedAt - started),
      settleMs: 0,
    };
    records.push(record);
  }
  const settled = await deps.observe();
  const settledFingerprint = observationFingerprint(settled);
  const screenChanged = settledFingerprint !== openingFingerprint;
  for (const record of records) {
    record.afterFingerprint = settledFingerprint;
    record.screenChanged = screenChanged;
  }
  for (const [index, action] of batch.actions.entries()) {
    if (
      action.decision.operation !== "type" ||
      (action.step?.op === "type" && action.step.verifyReadback === false)
    ) {
      continue;
    }
    const expected = action.step?.op === "type" ? action.step.text : action.decision.text;
    if (action.decision.target === undefined || expected === undefined) {
      records[index].outcome = "failed";
      records[index].error = "readback unavailable: type decision carries no target or text";
      records[index].verificationStatus = "unverified";
      return result("failed", "verification-failed", records, settled, screenChanged, []);
    }
    const actual = await deps.readbackText(action.decision.target, settled);
    if (actual !== expected) {
      records[index].outcome = "failed";
      records[index].error =
        `readback mismatch: typed "${expected}", field reads "${actual ?? "<unreadable>"}"`;
      records[index].verificationStatus = "unverified";
      return result("failed", "verification-failed", records, settled, screenChanged, []);
    }
  }
  if (batch.postconditions.length === 0) {
    for (const record of records) record.verificationStatus = "unverified";
    return result("failed", "verification-failed", records, settled, screenChanged, []);
  }
  const assertions: AssertionResult[] = [];
  for (const assertion of batch.postconditions) {
    const evaluated = await deps.evaluateAssertion(
      assertion,
      { observe: () => deps.observe(), ...deps.evidence },
      { timeoutMs: deps.assertionTimeoutMs ?? 5000, pollMs: deps.assertionPollMs ?? 250 },
    );
    assertions.push(evaluated);
    if (!evaluated.passed) {
      for (const record of records) record.verificationStatus = "unverified";
      return result("failed", "verification-failed", records, settled, screenChanged, assertions);
    }
  }
  for (const record of records) record.verificationStatus = "verified";
  return result("completed", "completed", records, settled, screenChanged, assertions);
}

function result(
  status: ActionBatchResult["status"],
  reason: ActionBatchStopReason,
  records: StepRecord[],
  observation: Observation | null,
  screenChanged: boolean,
  assertions: AssertionResult[],
): ActionBatchResult {
  return { status, reason, records, observation, screenChanged, assertions };
}
