/**
 * Shared shapes for the run registry.
 *
 * Extracted so `runRegistry.ts` and `runRegistryHelpers.ts` can both depend on
 * these without depending on each other. Types only: nothing here executes.
 */
import type { AssertionResult } from "./assertions";
import type { Flow, RunStatus, StepRecord } from "@/types/automation.types";
import type { ExecutorDeps, RunResult } from "./flowExecutor";
import type { AutomationRunInfo } from "./runTrace";
import type { SessionManifest } from "@/types/replay.types";
import type { AutomationTaskRuntimeState } from "./taskRuntime";
import type { PolicyId } from "./policies/types";
import type { PresalioMilestone } from "./acceptance";

/** One managed run, live in the app until evicted. */
export interface ManagedRun {
  runId: string;
  taskId: string;
  kind: "flow" | "goal";
  label: string;
  status: RunStatus;
  policyId: PolicyId;
  flowId: string | null;
  goal: string | null;
  deviceSerial: string;
  records: StepRecord[];
  failureReason: string | null;
  filePath: string | null;
  recorded: boolean;
  startedAt: number;
  endedAt: number | null;
  controller: AbortController;
  pauseRequested: boolean;
  disposePolicy: (() => Promise<void>) | null;
  assertionsByStep: Map<string, AssertionResult[]>;
  assertionsLoaded: boolean;
  taskRuntime: AutomationTaskRuntimeState;
  recordingSessionId: string | null;
  persistenceTail: Promise<void>;
  acceptanceScenario: "presalio-order-v1" | null;
  acceptanceMilestones: Map<string, PresalioMilestone>;
}

/** Status snapshot for one run. */
export interface RunStatusSnapshot {
  runId: string;
  taskId: string;
  status: RunStatus;
  currentStep: number;
  stepCount: number;
  policyId: string;
  label: string;
  failureReason: string | null;
  filePath: string | null;
}

/** One trace record for outer-loop readers. */
export interface TraceRecord {
  stepId: string;
  startedAt: number;
  endedAt: number;
  operation: string;
  target: unknown;
  text: unknown;
  confidence: number;
  reason: string;
  resolvedTarget: unknown;
  outcome: string;
  error: string | null;
  screenshot: string | null;
  assertions: AssertionResult[];
  beforeFingerprint?: string;
  afterFingerprint?: string;
  screenChanged?: boolean;
  dispatchStatus?: StepRecord["dispatchStatus"];
  verificationStatus?: StepRecord["verificationStatus"];
}

/** One bounded trace page. */
export interface TracePage {
  total: number;
  offset: number;
  limit: number;
  records: TraceRecord[];
}

/** Flow summary for listing. */
export interface FlowSummary {
  id: string;
  name: string;
  appPackage: string;
  stepCount: number;
}

/** Recording handle owned by one managed run. */
export interface RecordingHandle {
  sessionId: string;
  recordStep(record: StepRecord): void;
  finish(result: RunResult): Promise<{ filePath: string | null }>;
}

/** Seam for tests: loading, persistence, execution and recording. */
export interface RunRegistryDeps {
  loadFlow(flowId: string): Flow | null;
  listFlows(): FlowSummary[];
  saveFlow(flow: Flow): void;
  deleteFlow(flowId: string): boolean;
  createExecutorDeps(serial: string, appPackage?: string): ExecutorDeps;
  beginRecording(info: AutomationRunInfo): Promise<RecordingHandle | null>;
  readSessionFile(
    filePath: string,
  ): Promise<{ manifest: SessionManifest; automationNdjson: string }>;
}
