import {
  AUTOMATION_TASK_SCHEMA_VERSION,
  type AutomationEvidenceRef,
  type AutomationTask,
  type AutomationTaskEvent,
  type AutomationTaskEventBase,
  type AutomationTaskEventKind,
  type AutomationTaskEventPage,
  type AutomationTaskId,
  type AutomationTaskRun,
  type AutomationTaskRunId,
  type AutomationTaskStatus,
  type AutomationTerminalStatus,
  type FlowStepOp,
  type ReasoningOwner,
  type RunStatus,
  type StepRecord,
} from "@/types/automation.types";

/** Canonical in-memory projection reconstructed from a task's event stream. */
export interface AutomationTaskRuntimeState {
  task: AutomationTask;
  run: AutomationTaskRun;
  events: AutomationTaskEvent[];
}

/** Input required to create one canonical event without leaking payload contents. */
export type CreateAutomationTaskEventInput<Kind extends AutomationTaskEventKind> = Omit<
  Extract<AutomationTaskEvent, { kind: Kind }>,
  "schemaVersion" | "id" | "kind"
> & {
  id: string;
  kind: Kind;
};

/** Returns whether a task lifecycle state is terminal. */
export function isTerminalTaskStatus(
  status: AutomationTaskStatus,
): status is AutomationTerminalStatus {
  return (
    status === "completed" || status === "failed" || status === "blocked" || status === "cancelled"
  );
}

/** Maps the legacy live-run status into the durable task terminal vocabulary. */
export function terminalStatusFromRunStatus(status: RunStatus): AutomationTerminalStatus | null {
  switch (status) {
    case "passed":
      return "completed";
    case "failed":
      return "failed";
    case "halted":
      return "blocked";
    case "cancelled":
      return "cancelled";
    case "pending":
    case "running":
      return null;
  }
}

/** Creates one schema-versioned task event. */
export function createAutomationTaskEvent<Kind extends AutomationTaskEventKind>(
  input: CreateAutomationTaskEventInput<Kind>,
): Extract<AutomationTaskEvent, { kind: Kind }> {
  return {
    ...input,
    schemaVersion: AUTOMATION_TASK_SCHEMA_VERSION,
  } as Extract<AutomationTaskEvent, { kind: Kind }>;
}

/** Appends an event only when ordering and task/run ownership remain valid. */
export function appendAutomationTaskEvent(
  state: AutomationTaskRuntimeState,
  event: AutomationTaskEvent,
): AutomationTaskRuntimeState {
  validateEvent(state, event);
  const task = applyTaskEvent(state.task, event);
  const run = applyRunEvent(state.run, event);
  return { task, run, events: [...state.events, event] };
}

/** Builds the bounded external-reader page from a numeric event cursor. */
export function pageAutomationTaskEvents(
  events: AutomationTaskEvent[],
  cursor: string | null,
  limit: number,
): AutomationTaskEventPage {
  const start = parseEventCursor(cursor);
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 500);
  const page = events.slice(start, start + safeLimit);
  const next = start + page.length;
  return {
    events: page,
    nextCursor: next < events.length ? String(next) : null,
  };
}

/** Converts one legacy step record into canonical decision-to-verification evidence. */
export function eventsForStepRecord(input: {
  taskId: AutomationTaskId;
  runId: AutomationTaskRunId;
  origin: AutomationTaskEvent["origin"];
  principalId: string;
  connectionId: string | null;
  owner: ReasoningOwner;
  firstSequence: number;
  idForSequence: (sequence: number) => string;
  record: StepRecord;
}): AutomationTaskEvent[] {
  const { record } = input;
  const evidence = evidenceForRecord(input.runId, record);
  const base = (
    sequence: number,
    occurredAt: number,
  ): Omit<AutomationTaskEventBase, "schemaVersion" | "id"> => ({
    taskId: input.taskId,
    runId: input.runId,
    sequence,
    occurredAt,
    origin: input.origin,
    principalId: input.principalId,
    connectionId: input.connectionId,
  });
  const decision = createAutomationTaskEvent({
    ...base(input.firstSequence, record.startedAt),
    id: input.idForSequence(input.firstSequence),
    kind: "reasoning.decision",
    data: {
      stepId: record.stepId,
      owner: input.owner,
      operation: record.decision.operation,
      target: record.decision.target ?? null,
      confidence: record.decision.confidence,
      reason: record.decision.reason,
      payload: null,
    },
  });
  const dispatched = createAutomationTaskEvent({
    ...base(input.firstSequence + 1, record.endedAt),
    id: input.idForSequence(input.firstSequence + 1),
    kind: "action.dispatched",
    data: {
      stepId: record.stepId,
      operation: operationForRecord(record),
      status: record.dispatchStatus ?? "not_attempted",
      target: record.resolvedTarget,
      error: record.error,
    },
  });
  const observed = createAutomationTaskEvent({
    ...base(input.firstSequence + 2, record.endedAt),
    id: input.idForSequence(input.firstSequence + 2),
    kind: "observation.captured",
    data: {
      stepId: record.stepId,
      beforeFingerprint: record.beforeFingerprint ?? null,
      afterFingerprint: record.afterFingerprint ?? null,
      screenChanged: record.screenChanged ?? null,
      evidence,
    },
  });
  const verified = createAutomationTaskEvent({
    ...base(input.firstSequence + 3, record.endedAt),
    id: input.idForSequence(input.firstSequence + 3),
    kind: "verification.completed",
    data: {
      stepId: record.stepId,
      status: record.verificationStatus ?? "not_run",
      outcome: record.outcome,
      error: record.error,
    },
  });
  return [decision, dispatched, observed, verified];
}

/** Maps the existing action vocabulary into the executable subset required by dispatch events. */
function operationForRecord(record: StepRecord): FlowStepOp {
  return record.decision.operation === "done" || record.decision.operation === "blocked"
    ? "wait"
    : record.decision.operation;
}

/** Returns a trace reference only when a step stored a screenshot or visual marker. */
function evidenceForRecord(
  runId: AutomationTaskRunId,
  record: StepRecord,
): AutomationEvidenceRef | null {
  if (record.screenshotRef === "") {
    return null;
  }
  return { kind: "trace", runId, stepId: record.stepId, field: "screenshotRef" };
}

/** Validates append-only event rules before any state transition occurs. */
function validateEvent(state: AutomationTaskRuntimeState, event: AutomationTaskEvent): void {
  if (event.schemaVersion !== AUTOMATION_TASK_SCHEMA_VERSION) {
    throw new Error("unsupported task event schema");
  }
  if (event.taskId !== state.task.id || event.runId !== state.run.id) {
    throw new Error("task event does not belong to this runtime state");
  }
  if (isTerminalTaskStatus(state.task.status)) {
    throw new Error("cannot append an event after a terminal task outcome");
  }
  const previous = state.events.at(-1);
  const expectedSequence = previous === undefined ? 1 : previous.sequence + 1;
  if (event.sequence !== expectedSequence) {
    throw new Error(`expected event sequence ${expectedSequence}, received ${event.sequence}`);
  }
  if (previous !== undefined && event.occurredAt < previous.occurredAt) {
    throw new Error("task events must be ordered by occurrence time");
  }
  if (state.events.length === 0 && event.kind !== "task.created") {
    throw new Error("the first task event must be task.created");
  }
  if (event.kind === "task.created" && state.events.length > 0) {
    throw new Error("task.created may only appear once");
  }
  if (event.kind === "run.started" && state.run.status !== "pending") {
    throw new Error("run.started may only appear once for a pending run");
  }
}

/** Applies the durable task lifecycle projection for one valid event. */
function applyTaskEvent(task: AutomationTask, event: AutomationTaskEvent): AutomationTask {
  const updatedAt = Math.max(task.updatedAt, event.occurredAt);
  switch (event.kind) {
    case "task.created":
      return { ...task, updatedAt };
    case "run.started":
      return { ...task, status: "running", activeRunId: event.runId, updatedAt };
    case "owner.changed":
      return { ...task, reasoningOwner: event.data.current, updatedAt };
    case "task.awaiting":
      return { ...task, status: event.data.status, updatedAt };
    case "task.terminal":
      return {
        ...task,
        status: event.data.status,
        terminalReason: event.data.reason,
        activeRunId: null,
        updatedAt,
      };
    case "plan.updated":
    case "reasoning.decision":
    case "reasoning.streamed":
    case "authorization.consumed":
    case "authorization.denied":
    case "action.dispatched":
    case "observation.captured":
    case "verification.completed":
    case "recording.linked":
    case "acceptance.milestone":
    case "acceptance.reported":
      return { ...task, updatedAt };
  }
}

/** Applies the durable run lifecycle projection for one valid event. */
function applyRunEvent(run: AutomationTaskRun, event: AutomationTaskEvent): AutomationTaskRun {
  switch (event.kind) {
    case "run.started":
      return {
        ...run,
        status: "running",
        startedAt: event.occurredAt,
        deviceLease: event.data.lease,
      };
    case "owner.changed":
      return { ...run, reasoningOwner: event.data.current };
    case "task.terminal":
      return { ...run, status: event.data.status, endedAt: event.occurredAt, deviceLease: null };
    case "task.created":
    case "plan.updated":
    case "reasoning.decision":
    case "reasoning.streamed":
    case "authorization.consumed":
    case "authorization.denied":
    case "action.dispatched":
    case "observation.captured":
    case "verification.completed":
    case "recording.linked":
    case "acceptance.milestone":
    case "acceptance.reported":
    case "task.awaiting":
      return run;
  }
}

/** Parses a bounded numeric cursor without exposing storage offsets as an API contract. */
function parseEventCursor(cursor: string | null): number {
  if (cursor === null) {
    return 0;
  }
  const value = Number(cursor);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
