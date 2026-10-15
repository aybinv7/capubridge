/** Automation workbench domain types (CB-33). Manual flows, fused observations and run traces share this contract. */

import type { PolicyId } from "@/modules/automation/policies/types";

/** Screen rectangle as [x, y, width, height]. Native bounds are device pixels; WebView bounds are CSS pixels. */
export type Bounds = [number, number, number, number];

/** Point on the device screen in device pixels. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** A native UIAutomator control from the accessibility projection. */
export interface IndexedControl {
  index: number;
  bounds: Bounds;
  className: string;
  text: string;
  contentDesc: string;
  clickable: boolean;
  enabled: boolean;
}

/**
 * A WebView element observed through CDP.
 * Carries no field value: `isInput` plus `inputType` let redaction and read-back
 * identify fields without ever transporting their contents.
 */
export interface IndexedElement {
  index: number;
  cssSelector: string;
  role: string;
  text: string;
  enabled: boolean;
  visible: boolean;
  bounds: Bounds;
  isInput: boolean;
  inputType: string | null;
  clickable?: boolean;
  /**
   * Accessible name, kept apart from `text`: `text` is the visible text and,
   * for inputs, what type readback compares against. The name is what labels
   * an icon-only control for targets and policies.
   */
  name?: string;
}

/** A live target suggestion used by the source editor. */
export interface AutomationCandidate {
  id: string;
  label: string;
  source: "webview" | "native";
  target: TargetRef;
  enabled: boolean;
}

/** Soft keyboard and native dialog presence derived from the native hierarchy. */
export interface SystemUiState {
  keyboardVisible: boolean;
  dialogPresent: boolean;
}

/** Native observation layer: where the app actually renders. */
export interface NativeObservation {
  controls: IndexedControl[];
  packageName: string;
  activity: string;
  systemUi: SystemUiState;
  webViewBounds?: Bounds;
}

/** WebView observation layer: semantics through CDP. Null when no CDP target is attached. */
export interface WebviewObservation {
  elements: IndexedElement[];
}

/** Live session signals no accessibility tree can see. */
export interface SessionSignalState {
  pendingRequests: number;
  recentErrors: string[];
  lastDbWrite: string | null;
}

/** Visual evidence handle. The screenshot bytes live in the trace, never in a policy payload. */
export interface VisualObservation {
  screenshotRef: string;
}

/** Fused observation from the native, WebView and session-signal layers. */
export interface Observation {
  native: NativeObservation;
  webview: WebviewObservation | null;
  signals: SessionSignalState;
  visual: VisualObservation;
  frameId?: string;
}

/**
 * How a step names its target. Fallback ordering is a product requirement:
 * selector first, text second, native index third, raw point last.
 */
export type TargetRef =
  | { kind: "selector"; cssSelector: string }
  | { kind: "text"; text: string; exact: boolean }
  | { kind: "nativeIndex"; index: number }
  | { kind: "point"; x: number; y: number };

/** Retry behaviour for one step. */
export interface RetryPolicy {
  maxAttempts: number;
  delayMs?: number;
}

/** Step operations. Matches the device action vocabulary that has an executor, plus the goal step. */
export type FlowStepOp =
  | "tap"
  | "longPress"
  | "type"
  | "swipe"
  | "scroll"
  | "pressKey"
  | "back"
  | "openApp"
  | "wait"
  | "assert"
  | "goal";

/** Bounds for one goal step. Each goal may want different bounds. */
export interface RunLimits {
  maxSteps: number;
  maxDurationMs: number;
  maxConsecutiveFailures: number;
}

/** Fields every step carries. */
export const PRESALIO_ORDER_MILESTONES = [
  "app-opened",
  "location-obstacle-cleared",
  "next-stop-opened",
  "three-products-selected",
  "quantities-set-to-two",
  "order-reviewed",
  "order-confirmed",
  "report-returned",
] as const;

export type PresalioMilestone = (typeof PRESALIO_ORDER_MILESTONES)[number];
export type PresalioAcceptanceAvailability = "completed" | "failed" | "unavailable";

export interface PresalioAcceptanceReport {
  version: 1;
  scenario: "presalio-order-v1";
  mode: "embedded" | "claude-mcp" | "chatgpt-mcp" | "artemis-pro" | "deterministic";
  availability: PresalioAcceptanceAvailability;
  runId: string | null;
  completedMilestones: PresalioMilestone[];
  missingMilestones: PresalioMilestone[];
  durationMs: number;
  physicalActions: number;
  noOpActions: number;
  staleTargetFailures: number;
  recoveryEvents: number;
  evidenceComplete: boolean;
  reason: string | null;
}

/** Fields every step carries. */
export interface FlowStepBase {
  id: string;
  label?: string;
  acceptanceMilestone?: PresalioMilestone;
  timeoutMs?: number;
  retry?: RetryPolicy;
  continueOnFailure?: boolean;
}

/** An explicit, ordered automation step. Discriminated on `op`. */
export type FlowStep =
  | (FlowStepBase & { op: "tap"; target: TargetRef })
  | (FlowStepBase & { op: "longPress"; target: TargetRef; durationMs?: number })
  | (FlowStepBase & { op: "type"; target: TargetRef; text: string; verifyReadback?: boolean })
  | (FlowStepBase & { op: "swipe"; from: ScreenPoint; to: ScreenPoint; durationMs?: number })
  | (FlowStepBase & {
      op: "scroll";
      direction: "up" | "down" | "left" | "right";
      distance?: number;
      target?: TargetRef;
    })
  | (FlowStepBase & { op: "pressKey"; keycode: string })
  | (FlowStepBase & { op: "back" })
  | (FlowStepBase & { op: "openApp"; packageName: string })
  | (FlowStepBase & { op: "wait"; durationMs: number })
  | (FlowStepBase & { op: "assert"; assertion: Assertion })
  | (FlowStepBase & {
      op: "goal";
      goal: string;
      policyId: PolicyId;
      limits: RunLimits;
      acknowledgedNotice: boolean;
    });

/**
 * Deterministic pass/fail checks against observed evidence.
 * Each variant names its evidence source so evaluation dispatches without a policy.
 */
export type Assertion =
  | { kind: "visible"; target: TargetRef; source: "dom" | "native" }
  | { kind: "notVisible"; target: TargetRef; source: "dom" | "native" }
  | { kind: "textEquals"; target: TargetRef; expected: string }
  | { kind: "textContains"; target: TargetRef; substring: string }
  | { kind: "urlMatches"; pattern: string }
  | { kind: "dbRowExists"; database: string; store: string; key: string }
  | { kind: "networkStatus"; urlPattern: string; status: number; method?: string }
  | { kind: "consoleClean"; level: "warn" | "error"; ignorePatterns?: string[] };

/** Schema version of the flow document. */
export type FlowVersion = 1;

/** A manual flow: an explicit, ordered, deterministic step list. */
export interface Flow {
  version: FlowVersion;
  id: string;
  name: string;
  appPackage: string;
  acceptanceScenario?: "presalio-order-v1";
  steps: FlowStep[];
  description?: string;
}

/** Operations a policy may answer, extending the step vocabulary with loop control. */
export type DecisionOperation = FlowStepOp | "done" | "blocked";

/** What a policy returns for one step. Confidence is 0..1. */
export interface Decision {
  operation: DecisionOperation;
  target?: TargetRef;
  text?: string;
  confidence: number;
  reason: string;
  frameId?: string;
  /**
   * Raw policy answer for display only, never executed. Jev attaches the
   * full answers object (probabilities included) so the inspector can show
   * what the model actually said. Absent on deterministic steps.
   */
  detail?: unknown;
}

/** A bounded group of device actions requested against one opening observation. */
export interface ActionBatch {
  id: string;
  actions: Array<{ id: string; decision: Decision; step?: FlowStep }>;
  precondition: {
    fingerprint: string;
    packageName?: string;
    activity?: string;
  };
  maxActions: number;
  timeoutMs: number;
  postconditions: Assertion[];
}

/** Which resolution strategy produced the screen point. */
export type TargetStrategy = "selector" | "text" | "nativeIndex" | "point";

/** Executor that performed a resolved action. */
export type ActionExecutor = "webview" | "device" | "point";

/** A target resolved to a tappable screen point. */
export interface ResolvedTarget {
  x: number;
  y: number;
  strategy: TargetStrategy;
  frameId?: string;
  executor?: ActionExecutor;
}

/** Outcome of one executed step. */
export type StepOutcome = "ok" | "failed" | "skipped";

export interface StepTimings {
  policyMs?: number;
  observationMs: number;
  actionMs: number;
  settleMs: number;
}

/** One executed step for the run trace. A retried step is one record with attempts, not several records. */
export interface StepRecord {
  stepId: string;
  startedAt: number;
  endedAt: number;
  decision: Decision;
  resolvedTarget: ResolvedTarget | null;
  outcome: StepOutcome;
  error: string | null;
  screenshotRef: string;
  attempts?: number;
  goalStepId?: string | null;
  signals?: SessionSignalState;
  timings?: StepTimings;
  beforeFingerprint?: string;
  afterFingerprint?: string;
  screenChanged?: boolean;
  dispatchStatus?: "not_attempted" | "dispatched" | "failed";
  verificationStatus?: "not_run" | "verified" | "unverified";
}

/** Lifecycle status of a run. */
export type RunStatus = "pending" | "running" | "passed" | "failed" | "halted" | "cancelled";

/** Schema version for durable automation task and event contracts. */
export type AutomationTaskSchemaVersion = 1;

/** Stable schema marker included in every task, run and event payload. */
export const AUTOMATION_TASK_SCHEMA_VERSION: AutomationTaskSchemaVersion = 1;

/** Identifier of one user-facing automation task. */
export type AutomationTaskId = string;

/** Identifier of one execution attempt for an automation task. */
export type AutomationTaskRunId = string;

/** Identifier of one append-only task event. */
export type AutomationTaskEventId = string;

/** The one component permitted to make the next automation decision. */
export type ReasoningOwner = "embedded" | "mcp-host" | "artemis" | "deterministic";

/** How a task first entered Capubridge. */
export type AutomationTaskOrigin = "local-chat" | "mcp" | "artemis" | "flow";

/** Authenticated principal that created or currently controls a task. */
export interface AutomationPrincipal {
  id: string;
  label: string;
  kind: "local" | "mcp" | "system";
  connectionId: string | null;
  clientName: string | null;
}

/** Reusable permission granted by the original task request. */
export interface AutomationAuthorizationScope {
  id: string;
  grantedAt: number;
  expiresAt: number | null;
  appPackages: string[];
  deviceSerials: string[];
  actionClasses: AutomationActionClass[];
  finalCommitments: string[];
  remoteData: "none" | "redacted-observation";
}

/** Device actions that can be covered by a task authorization scope. */
export type AutomationActionClass =
  | "observe"
  | "navigate"
  | "input"
  | "confirm"
  | "launch-app"
  | "external-data";

/** Exclusive device ownership for one active task run. */
export interface AutomationDeviceLease {
  id: string;
  taskId: AutomationTaskId;
  runId: AutomationTaskRunId;
  deviceSerial: string;
  acquiredAt: number;
  expiresAt: number | null;
}

/** Durable lifecycle of a task. Terminal states admit no later task events. */
export type AutomationTaskStatus =
  | "created"
  | "queued"
  | "running"
  | "awaiting-reasoner"
  | "awaiting-device"
  | "awaiting-authorization"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";

/** Terminal task states. */
export type AutomationTerminalStatus = Extract<
  AutomationTaskStatus,
  "completed" | "failed" | "blocked" | "cancelled"
>;

/** Durable lifecycle of one execution attempt. */
export type AutomationTaskRunStatus = "pending" | "running" | AutomationTerminalStatus;

/** Why a task stopped without successful completion. */
export type AutomationTaskBlockReason =
  | "authorization-required"
  | "device-unavailable"
  | "reasoner-unavailable"
  | "precondition-mismatch"
  | "no-progress"
  | "verification-failed"
  | "execution-failed"
  | "cancelled-by-user";

/** Redacted reference to model, MCP or recording evidence. */
export type AutomationEvidenceRef =
  | { kind: "redacted"; digest: string; byteLength: number; label: string }
  | { kind: "recording"; sessionId: string; path: string | null }
  | { kind: "trace"; runId: AutomationTaskRunId; stepId: string; field: string };

/** User intent that can outlive an open chat, provider response or MCP connection. */
export interface AutomationTask {
  schemaVersion: AutomationTaskSchemaVersion;
  id: AutomationTaskId;
  conversationId: string | null;
  origin: AutomationTaskOrigin;
  principal: AutomationPrincipal;
  originalGoal: string;
  appPackage: string | null;
  deviceSerial: string | null;
  reasoningOwner: ReasoningOwner | null;
  authorizationScope: AutomationAuthorizationScope | null;
  status: AutomationTaskStatus;
  activeRunId: AutomationTaskRunId | null;
  terminalReason: AutomationTaskBlockReason | null;
  createdAt: number;
  updatedAt: number;
}

/** One attempt to carry a task from its last verified checkpoint to completion. */
export interface AutomationTaskRun {
  schemaVersion: AutomationTaskSchemaVersion;
  id: AutomationTaskRunId;
  taskId: AutomationTaskId;
  attempt: number;
  status: AutomationTaskRunStatus;
  reasoningOwner: ReasoningOwner;
  principalId: string;
  deviceLease: AutomationDeviceLease | null;
  startedAt: number | null;
  endedAt: number | null;
}

/** Event names emitted by every task entry point. */
export type AutomationTaskEventKind =
  | "task.created"
  | "run.started"
  | "owner.changed"
  | "plan.updated"
  | "reasoning.decision"
  | "reasoning.streamed"
  | "authorization.consumed"
  | "authorization.denied"
  | "action.dispatched"
  | "observation.captured"
  | "verification.completed"
  | "recording.linked"
  | "acceptance.milestone"
  | "acceptance.reported"
  | "task.awaiting"
  | "task.terminal";

/** Stable context shared by every append-only task event. */
export interface AutomationTaskEventBase {
  schemaVersion: AutomationTaskSchemaVersion;
  id: AutomationTaskEventId;
  taskId: AutomationTaskId;
  runId: AutomationTaskRunId;
  sequence: number;
  occurredAt: number;
  origin: AutomationTaskOrigin;
  principalId: string;
  connectionId: string | null;
}

/** Typed append-only evidence of one task lifecycle transition. */
export type AutomationTaskEvent =
  | (AutomationTaskEventBase & {
      kind: "task.created";
      data: { goal: string; appPackage: string | null; deviceSerial: string | null };
    })
  | (AutomationTaskEventBase & {
      kind: "run.started";
      data: { attempt: number; owner: ReasoningOwner; lease: AutomationDeviceLease | null };
    })
  | (AutomationTaskEventBase & {
      kind: "owner.changed";
      data: { previous: ReasoningOwner | null; current: ReasoningOwner; reason: string | null };
    })
  | (AutomationTaskEventBase & {
      kind: "plan.updated";
      data: { plan: AutomationEvidenceRef; summary: string };
    })
  | (AutomationTaskEventBase & {
      kind: "reasoning.decision";
      data: {
        stepId: string;
        owner: ReasoningOwner;
        operation: DecisionOperation;
        target: TargetRef | null;
        confidence: number | null;
        reason: string;
        payload: AutomationEvidenceRef | null;
      };
    })
  | (AutomationTaskEventBase & {
      kind: "reasoning.streamed";
      data: {
        provider: "openrouter" | "openai" | "anthropic" | "test";
        modelId: string;
        phase:
          | "started"
          | "text"
          | "tool-call"
          | "tool-result"
          | "usage"
          | "retry"
          | "failed"
          | "cancelled";
        detail: string | null;
      };
    })
  | (AutomationTaskEventBase & {
      kind: "authorization.consumed";
      data: { scopeId: string; actionClass: AutomationActionClass; stepId: string };
    })
  | (AutomationTaskEventBase & {
      kind: "authorization.denied";
      data: {
        scopeId: string | null;
        actionClass: AutomationActionClass;
        stepId: string;
        reason: string;
      };
    })
  | (AutomationTaskEventBase & {
      kind: "action.dispatched";
      data: {
        stepId: string;
        operation: FlowStepOp;
        status: NonNullable<StepRecord["dispatchStatus"]>;
        target: ResolvedTarget | null;
        error: string | null;
      };
    })
  | (AutomationTaskEventBase & {
      kind: "observation.captured";
      data: {
        stepId: string;
        beforeFingerprint: string | null;
        afterFingerprint: string | null;
        screenChanged: boolean | null;
        evidence: AutomationEvidenceRef | null;
      };
    })
  | (AutomationTaskEventBase & {
      kind: "verification.completed";
      data: {
        stepId: string;
        status: NonNullable<StepRecord["verificationStatus"]>;
        outcome: StepOutcome;
        error: string | null;
      };
    })
  | (AutomationTaskEventBase & {
      kind: "recording.linked";
      data: { recording: Extract<AutomationEvidenceRef, { kind: "recording" }> };
    })
  | (AutomationTaskEventBase & {
      kind: "acceptance.milestone";
      data: { scenario: "presalio-order-v1"; milestone: PresalioMilestone; stepId: string };
    })
  | (AutomationTaskEventBase & {
      kind: "acceptance.reported";
      data: { report: PresalioAcceptanceReport };
    })
  | (AutomationTaskEventBase & {
      kind: "task.awaiting";
      data: { status: Extract<AutomationTaskStatus, `awaiting-${string}`>; reason: string };
    })
  | (AutomationTaskEventBase & {
      kind: "task.terminal";
      data: { status: AutomationTerminalStatus; reason: AutomationTaskBlockReason | null };
    });

/** Cursor page for task events. Cursors are opaque to callers. */
export interface AutomationTaskEventPage {
  events: AutomationTaskEvent[];
  nextCursor: string | null;
}
