import type { AssertionResult } from "./assertions";
import type {
  Decision,
  Flow,
  ResolvedTarget,
  RunStatus,
  StepOutcome,
  StepRecord,
} from "@/types/automation.types";
import type { AutomationCapuEvent, SessionManifest } from "@/types/replay.types";

/** One step in the unified run view, sourced from live or archive. */
export interface RunViewStep {
  stepId: string;
  decision: Decision;
  resolvedTarget: ResolvedTarget | null;
  outcome: StepOutcome;
  error: string | null;
  screenshotRef: string;
  assertions: AssertionResult[];
  goalStepId: string | null;
  replayOffsetMs: number | null;
  signals?: StepRecord["signals"];
  timings?: StepRecord["timings"];
  beforeFingerprint?: string;
  afterFingerprint?: string;
  screenChanged?: boolean;
  dispatchStatus?: StepRecord["dispatchStatus"];
  verificationStatus?: StepRecord["verificationStatus"];
}

/** A run normalized to one shape regardless of live or recorded origin. */
export interface RunView {
  steps: RunViewStep[];
  durationMs: number;
  stepCount: number;
  failedStepIndex: number | null;
  status: RunStatus;
  flowSnapshot: Flow | null;
}

/** Derived from live StepRecord[] plus the flow that was run. */
export function fromLiveRecords(records: StepRecord[], flow: Flow | null): RunView {
  const steps: RunViewStep[] = records.map((record) => ({
    stepId: record.stepId,
    decision: record.decision,
    resolvedTarget: record.resolvedTarget,
    outcome: record.outcome,
    error: record.error,
    screenshotRef: record.screenshotRef,
    assertions: [],
    goalStepId: record.goalStepId ?? null,
    replayOffsetMs: record.startedAt,
    signals: record.signals,
    timings: record.timings,
    beforeFingerprint: record.beforeFingerprint,
    afterFingerprint: record.afterFingerprint,
    screenChanged: record.screenChanged,
    dispatchStatus: record.dispatchStatus,
    verificationStatus: record.verificationStatus,
  }));
  const failedIndex = steps.findIndex((step) => step.outcome === "failed");
  const durationMs =
    records.length > 0
      ? (records[records.length - 1]?.endedAt ?? 0) - (records[0]?.startedAt ?? 0)
      : 0;
  return {
    steps,
    durationMs,
    stepCount: steps.length,
    failedStepIndex: failedIndex >= 0 ? failedIndex : null,
    status: deriveStatus(records),
    flowSnapshot: flow,
  };
}

/** Derived from archived AutomationCapuEvent[] plus the session manifest. */
export function fromArchive(events: AutomationCapuEvent[], manifest: SessionManifest): RunView {
  const snapshot = manifest.automation?.flowSnapshot ?? null;
  const goalId = snapshot?.steps.find((step) => step.op === "goal")?.id ?? null;
  const steps: RunViewStep[] = events.map((event) => ({
    stepId: event.data.stepId,
    decision: event.data.decision,
    resolvedTarget: event.data.resolvedTarget,
    outcome: event.data.outcome,
    error: event.data.error,
    screenshotRef: event.data.screenshot ?? "",
    assertions: Array.isArray(event.data.assertions) ? event.data.assertions : [],
    goalStepId: goalId,
    replayOffsetMs: event.t,
    signals: event.data.signals,
    timings: event.data.timings,
    beforeFingerprint: event.data.beforeFingerprint,
    afterFingerprint: event.data.afterFingerprint,
    screenChanged: event.data.screenChanged,
    dispatchStatus: event.data.dispatchStatus,
    verificationStatus: event.data.verificationStatus,
  }));
  const failedIndex = steps.findIndex((step) => step.outcome === "failed");
  return {
    steps,
    durationMs: manifest.duration,
    stepCount: steps.length,
    failedStepIndex: failedIndex >= 0 ? failedIndex : null,
    status: manifest.automation?.runStatus ?? "pending",
    flowSnapshot: manifest.automation?.flowSnapshot ?? null,
  };
}

/**
 * Finds a run by id. Live runs come from the in-memory map; finished runs
 * are located by session file on disk. Returns null for an unknown id
 * rather than throwing.
 */
export function resolveRun(
  runId: string,
  liveRuns: Map<string, StepRecord[]>,
  locateFile: (id: string) => string | null,
): { kind: "live"; records: StepRecord[] } | { kind: "file"; filePath: string } | null {
  const live = liveRuns.get(runId);
  if (live !== undefined) {
    return { kind: "live", records: live };
  }
  const filePath = locateFile(runId);
  if (filePath !== null) {
    return { kind: "file", filePath };
  }
  return null;
}

function deriveStatus(records: StepRecord[]): RunStatus {
  if (records.length === 0) {
    return "pending";
  }
  const hasFailure = records.some((record) => record.outcome === "failed");
  if (hasFailure) {
    return "failed";
  }
  return "passed";
}
