import type { AssertionResult } from "./assertions";
import type {
  FlowSummary,
  ManagedRun,
  RecordingHandle,
  RunRegistryDeps,
  RunStatusSnapshot,
  TracePage,
} from "./runRegistryTypes";
export type {
  FlowSummary,
  ManagedRun,
  RecordingHandle,
  RunRegistryDeps,
  RunStatusSnapshot,
  TracePage,
  TraceRecord,
} from "./runRegistryTypes";
import {
  acceptanceMilestonesForFlow,
  acceptanceModeForPolicy,
  acceptanceUnavailableReason,
  asDisposable,
  backfillAssertions,
  buildRegistryPolicy,
  launchSelectedApp,
  requireGoalApp,
  terminalReason,
} from "./runRegistryHelpers";
import { createRuntimeState } from "./runRegistryRuntimeState";
import { createRunObservers, flowOrNull } from "./runRegistryObservers";
import type { RunLimitValues } from "./agentPanelState";
import { defaultLimitsFor } from "./agentPanelState";
import type {
  AutomationTask,
  AutomationPrincipal,
  AutomationTaskEventPage,
  AutomationTaskRun,
  ReasoningOwner,
  RunStatus,
  StepRecord,
  Assertion,
  PresalioMilestone,
  PresalioAcceptanceReport,
} from "@/types/automation.types";
import type { ExecutorDeps } from "./flowExecutor";
import { runFlow, runGoal } from "./flowExecutor";
import type { RunLimits, RunResult } from "./flowExecutor";
import { createDesktopExecutorDeps } from "./runDeps";
import type { PolicyId } from "./policies/types";
import { promoteRun } from "./promote";
import { createEmptyFlow, parseFlow } from "./flowSchema";
import { startRunRecording, RECORDING_ENABLED } from "./runTrace";
import { parseReplayManifest } from "@/composables/useReplaySession";
import { invokeCommand } from "@/runtime/ipc/client";
import { useFlowStore } from "./flowStore";
import { redactDecision, redactObservation } from "./redact";
import { observationFingerprint } from "./observation";
import type { PersistedAutomationTaskSnapshot } from "./taskEvents";
import {
  appendAutomationTaskEvent,
  createAutomationTaskEvent,
  eventsForStepRecord,
  pageAutomationTaskEvents,
  terminalStatusFromRunStatus,
} from "./taskRuntime";
import { createReasoningStreamEvent } from "./reasoning/streamEvents";
import type { ReasoningStreamRecord } from "./reasoning/streamEvents";
import { createReasoningOwnerCoordinator } from "./reasoning/ownerCoordinator";
import { actionClassForDecision, authorizeFlow, authorizeRequest } from "./taskAuthorization";
import { buildPresalioAcceptanceReport } from "./acceptance";

/** Maximum finished runs retained. Oldest finished runs evict first; running runs never evict. */
const MAX_RETAINED_RUNS = 20;

/** Maximum trace records returned in one read. */
const MAX_TRACE_LIMIT = 500;

/**
 * Creates an isolated run registry. Production uses the singleton from
 * getRunRegistry; tests create their own with fakes and no device.
 */
export function createRunRegistry(deps: RunRegistryDeps) {
  const runs = new Map<string, ManagedRun>();
  const ownerCoordinator = createReasoningOwnerCoordinator();
  const { subscribe, notify, notifyStarted, notifyFinished } = createRunObservers();
  let sequence = 0;

  function retain(run: ManagedRun): void {
    runs.set(run.runId, run);
    const finished = [...runs.values()].filter((entry) => entry.status !== "running");
    while (runs.size > MAX_RETAINED_RUNS && finished.length > 0) {
      const oldest = finished.shift();
      if (oldest !== undefined) {
        runs.delete(oldest.runId);
      }
    }
  }

  function requireRun(runId: string): ManagedRun {
    const run = runs.get(runId);
    if (run === undefined) {
      throw new Error(`unknown run ${runId}`);
    }
    return run;
  }

  function requireTask(taskId: string): ManagedRun {
    const taskRuns = [...runs.values()]
      .filter((run) => run.taskId === taskId)
      .sort((left, right) => right.startedAt - left.startedAt);
    const run = taskRuns[0];
    if (run === undefined) {
      throw new Error(`unknown task ${taskId}`);
    }
    return run;
  }

  function spawn(managed: ManagedRun, execute: () => Promise<RunResult>): void {
    void (async () => {
      try {
        const result = await execute();
        managed.status = result.status;
        managed.failureReason = result.failureReason;
        managed.endedAt = result.endedAt;
        if (managed.pauseRequested && result.status === "cancelled") {
          managed.status = "halted";
          if (managed.taskRuntime.task.status !== "awaiting-reasoner") {
            appendAwaitingReasonerEvent(managed, "paused by task controller");
          }
          notifyFinished(managed);
          queueRuntimePersistence(managed);
          await managed.persistenceTail;
          return;
        }
        appendTerminalEvent(managed, result);
        notifyFinished(managed);
        queueRuntimePersistence(managed);
        await managed.persistenceTail;
      } catch (error) {
        managed.status = "failed";
        managed.failureReason = error instanceof Error ? error.message : String(error);
        managed.endedAt = Date.now();
        appendTerminalEvent(managed, {
          status: "failed",
          records: managed.records,
          failureReason: managed.failureReason,
          startedAt: managed.startedAt,
          endedAt: managed.endedAt,
        });
        notifyFinished(managed);
        queueRuntimePersistence(managed);
        await managed.persistenceTail;
      }
    })();
  }

  function appendAwaitingReasonerEvent(managed: ManagedRun, reason: string): void {
    const sequence = managed.taskRuntime.events.length + 1;
    const event = createAutomationTaskEvent({
      id: `event-${managed.runId}-${sequence}`,
      taskId: managed.taskId,
      runId: managed.runId,
      sequence,
      occurredAt: Math.max(Date.now(), managed.taskRuntime.events.at(-1)?.occurredAt ?? 0),
      origin: managed.taskRuntime.task.origin,
      principalId: managed.taskRuntime.task.principal.id,
      connectionId: managed.taskRuntime.task.principal.connectionId,
      kind: "task.awaiting",
      data: { status: "awaiting-reasoner", reason },
    });
    managed.taskRuntime = appendAutomationTaskEvent(managed.taskRuntime, event);
    enqueuePersistence(managed, () => invokeCommand("automation_event_append", { event }));
  }

  function appendAuthorizationEvent(
    managed: ManagedRun,
    decision: ReturnType<typeof authorizeFlow>,
  ): void {
    const sequence = managed.taskRuntime.events.length + 1;
    const event = createAutomationTaskEvent({
      id: `event-${managed.runId}-${sequence}`,
      taskId: managed.taskId,
      runId: managed.runId,
      sequence,
      occurredAt: Math.max(Date.now(), managed.taskRuntime.events.at(-1)?.occurredAt ?? 0),
      origin: managed.taskRuntime.task.origin,
      principalId: managed.taskRuntime.task.principal.id,
      connectionId: managed.taskRuntime.task.principal.connectionId,
      kind: decision.allowed ? "authorization.consumed" : "authorization.denied",
      data: decision.allowed
        ? { scopeId: decision.scopeId, actionClass: decision.actionClass, stepId: decision.stepId }
        : {
            scopeId: decision.scopeId,
            actionClass: decision.actionClass,
            stepId: decision.stepId,
            reason: decision.reason,
          },
    });
    managed.taskRuntime = appendAutomationTaskEvent(managed.taskRuntime, event);
    enqueuePersistence(managed, () => invokeCommand("automation_event_append", { event }));
  }

  function authorizationExecutorDeps(managed: ManagedRun): ExecutorDeps {
    const executor = deps.createExecutorDeps(
      managed.deviceSerial,
      managed.taskRuntime.task.appPackage ?? "",
    );
    return {
      ...executor,
      authorizeAction: async (decision, stepId) => {
        const authorization = authorizeRequest(
          managed.taskRuntime.task.authorizationScope,
          {
            principalId: managed.taskRuntime.task.principal.id,
            deviceSerial: managed.deviceSerial,
            appPackage: managed.taskRuntime.task.appPackage ?? "",
            actionClass: actionClassForDecision(decision),
            stepId,
            occurredAt: Date.now(),
          },
          managed.taskRuntime.task.principal,
        );
        appendAuthorizationEvent(managed, authorization);
        if (!authorization.allowed) {
          appendAwaitingReasonerEvent(managed, authorization.reason);
          throw new Error(authorization.reason);
        }
      },
    };
  }

  function captureInto(
    managed: ManagedRun,
    recording: RecordingHandle | null,
  ): (record: StepRecord) => void {
    return (record: StepRecord) => {
      managed.records.push(record);
      notify({ kind: "step", runId: managed.runId, record });
      recording?.recordStep(record);
      const minimumOccurredAt = managed.taskRuntime.events.at(-1)?.occurredAt ?? record.startedAt;
      const eventRecord: StepRecord = {
        ...record,
        startedAt: Math.max(record.startedAt, minimumOccurredAt),
        endedAt: Math.max(record.endedAt, minimumOccurredAt),
      };
      const events = eventsForStepRecord({
        taskId: managed.taskId,
        runId: managed.runId,
        origin: managed.taskRuntime.task.origin,
        principalId: managed.taskRuntime.task.principal.id,
        connectionId: managed.taskRuntime.task.principal.connectionId,
        owner: managed.taskRuntime.run.reasoningOwner,
        firstSequence: managed.taskRuntime.events.length + 1,
        idForSequence: (sequence) => `event-${managed.runId}-${sequence}`,
        record: eventRecord,
      });
      for (const event of events) {
        managed.taskRuntime = appendAutomationTaskEvent(managed.taskRuntime, event);
        enqueuePersistence(managed, () => invokeCommand("automation_event_append", { event }));
      }
      const milestone = managed.acceptanceMilestones.get(record.stepId);
      if (
        milestone !== undefined &&
        record.decision.operation === "assert" &&
        record.verificationStatus === "verified"
      ) {
        appendAcceptanceMilestone(managed, milestone, record.stepId, record.endedAt);
      }
    };
  }

  function appendReasoningStream(managed: ManagedRun, record: ReasoningStreamRecord): void {
    const sequence = managed.taskRuntime.events.length + 1;
    const event = createReasoningStreamEvent(
      {
        id: `event-${managed.runId}-${sequence}`,
        taskId: managed.taskId,
        runId: managed.runId,
        sequence,
        occurredAt: Math.max(Date.now(), managed.taskRuntime.events.at(-1)?.occurredAt ?? 0),
        origin: managed.taskRuntime.task.origin,
        principalId: managed.taskRuntime.task.principal.id,
        connectionId: managed.taskRuntime.task.principal.connectionId,
      },
      record,
    );
    managed.taskRuntime = appendAutomationTaskEvent(managed.taskRuntime, event);
    enqueuePersistence(managed, () => invokeCommand("automation_event_append", { event }));
  }

  async function finishRecording(
    managed: ManagedRun,
    recording: RecordingHandle | null,
    result: RunResult,
  ): Promise<void> {
    if (recording === null) {
      return;
    }
    try {
      const finished = await recording.finish(result);
      managed.filePath = finished.filePath;
      if (finished.filePath !== null && managed.recordingSessionId !== null) {
        const sequence = managed.taskRuntime.events.length + 1;
        managed.taskRuntime = appendAutomationTaskEvent(
          managed.taskRuntime,
          createAutomationTaskEvent({
            id: `event-${managed.runId}-${sequence}`,
            taskId: managed.taskId,
            runId: managed.runId,
            sequence,
            occurredAt: result.endedAt,
            origin: managed.taskRuntime.task.origin,
            principalId: managed.taskRuntime.task.principal.id,
            connectionId: managed.taskRuntime.task.principal.connectionId,
            kind: "recording.linked",
            data: {
              recording: {
                kind: "recording",
                sessionId: managed.recordingSessionId,
                path: finished.filePath,
              },
            },
          }),
        );
      }
    } catch {
      managed.filePath = null;
    }
  }

  function appendAcceptanceMilestone(
    managed: ManagedRun,
    milestone: PresalioMilestone,
    stepId: string,
    occurredAt: number,
  ): void {
    const sequence = managed.taskRuntime.events.length + 1;
    const event = createAutomationTaskEvent({
      id: `event-${managed.runId}-${sequence}`,
      taskId: managed.taskId,
      runId: managed.runId,
      sequence,
      occurredAt: Math.max(occurredAt, managed.taskRuntime.events.at(-1)?.occurredAt ?? occurredAt),
      origin: managed.taskRuntime.task.origin,
      principalId: managed.taskRuntime.task.principal.id,
      connectionId: managed.taskRuntime.task.principal.connectionId,
      kind: "acceptance.milestone",
      data: { scenario: "presalio-order-v1", milestone, stepId },
    });
    managed.taskRuntime = appendAutomationTaskEvent(managed.taskRuntime, event);
    enqueuePersistence(managed, () => invokeCommand("automation_event_append", { event }));
  }

  function appendAcceptanceReport(managed: ManagedRun, result: RunResult): void {
    if (managed.acceptanceScenario === null) {
      return;
    }
    const unavailableReason = acceptanceUnavailableReason(result.failureReason);
    const report = buildPresalioAcceptanceReport({
      mode: acceptanceModeForPolicy(managed.policyId, managed.taskRuntime.task.principal),
      status: unavailableReason === null ? result.status : "unavailable",
      startedAt: result.startedAt,
      endedAt: result.endedAt,
      events: managed.taskRuntime.events,
      runId: managed.runId,
      ...(unavailableReason === null ? {} : { unavailableReason }),
    });
    const sequence = managed.taskRuntime.events.length + 1;
    const event = createAutomationTaskEvent({
      id: `event-${managed.runId}-${sequence}`,
      taskId: managed.taskId,
      runId: managed.runId,
      sequence,
      occurredAt: Math.max(
        result.endedAt,
        managed.taskRuntime.events.at(-1)?.occurredAt ?? result.endedAt,
      ),
      origin: managed.taskRuntime.task.origin,
      principalId: managed.taskRuntime.task.principal.id,
      connectionId: managed.taskRuntime.task.principal.connectionId,
      kind: "acceptance.reported",
      data: { report },
    });
    managed.taskRuntime = appendAutomationTaskEvent(managed.taskRuntime, event);
    enqueuePersistence(managed, () => invokeCommand("automation_event_append", { event }));
  }

  function appendTerminalEvent(managed: ManagedRun, result: RunResult): void {
    appendAcceptanceReport(managed, result);
    const status = terminalStatusFromRunStatus(result.status);
    if (status === null) {
      return;
    }
    const sequence = managed.taskRuntime.events.length + 1;
    const occurredAt = Math.max(
      result.endedAt,
      managed.taskRuntime.events.at(-1)?.occurredAt ?? result.endedAt,
    );
    managed.taskRuntime = appendAutomationTaskEvent(
      managed.taskRuntime,
      createAutomationTaskEvent({
        id: `event-${managed.runId}-${sequence}`,
        taskId: managed.taskId,
        runId: managed.runId,
        sequence,
        occurredAt,
        origin: managed.taskRuntime.task.origin,
        principalId: managed.taskRuntime.task.principal.id,
        connectionId: managed.taskRuntime.task.principal.connectionId,
        kind: "task.terminal",
        data: { status, reason: terminalReason(status) },
      }),
    );
    const event = managed.taskRuntime.events.at(-1);
    if (event !== undefined) {
      enqueuePersistence(managed, () => invokeCommand("automation_event_append", { event }));
    }
  }

  function enqueuePersistence(managed: ManagedRun, operation: () => Promise<unknown>): void {
    managed.persistenceTail = managed.persistenceTail
      .then(async () => {
        await operation();
      })
      .catch((error) => {
        console.warn("automation runtime persistence unavailable", error);
      });
  }

  function queueRuntimePersistence(managed: ManagedRun): void {
    enqueuePersistence(managed, () =>
      invokeCommand("automation_task_upsert", {
        task: managed.taskRuntime.task,
        run: managed.taskRuntime.run,
      }),
    );
  }

  return {
    startFlow(
      flowId: string,
      deviceSerial: string,
      options?: string | { taskId?: string; principal?: AutomationPrincipal },
    ): string {
      const flow = deps.loadFlow(flowId);
      if (flow === null) {
        throw new Error(`unknown flow ${flowId}`);
      }
      sequence += 1;
      const runId = `run-${Date.now().toString(36)}-${sequence}`;
      const startedAt = Date.now();
      const normalizedOptions = typeof options === "string" ? { taskId: options } : (options ?? {});
      const taskRuntime = createRuntimeState({
        runId,
        kind: "flow",
        label: flow.name,
        policyId: "rules",
        goal: null,
        deviceSerial,
        startedAt,
        taskId: normalizedOptions.taskId,
        principal: normalizedOptions.principal,
        appPackage: flow.appPackage,
      });
      ownerCoordinator.claim(
        taskRuntime.task.id,
        taskRuntime.run.reasoningOwner,
        taskRuntime.task.principal.connectionId,
      );
      const managed: ManagedRun = {
        runId,
        taskId: taskRuntime.task.id,
        kind: "flow",
        label: flow.name,
        status: "running",
        policyId: "rules",
        flowId: flow.id,
        goal: null,
        deviceSerial,
        records: [],
        failureReason: null,
        filePath: null,
        recorded: false,
        startedAt,
        endedAt: null,
        controller: new AbortController(),
        pauseRequested: false,
        disposePolicy: null,
        assertionsByStep: new Map(),
        assertionsLoaded: false,
        taskRuntime,
        recordingSessionId: null,
        persistenceTail: Promise.resolve(),
        acceptanceScenario: flow.acceptanceScenario ?? null,
        acceptanceMilestones: acceptanceMilestonesForFlow(flow),
      };
      queueRuntimePersistence(managed);
      retain(managed);
      notifyStarted(managed, flow);
      spawn(managed, async () => {
        const recording = await deps.beginRecording({
          taskId: managed.taskId,
          taskRunId: managed.runId,
          taskOrigin: managed.taskRuntime.task.origin,
          label: flow.name,
          policyId: "rules",
          flow,
          goal: null,
          deviceSerial,
          appPackage: flow.appPackage,
        });
        if (recording !== null) {
          managed.recorded = true;
          managed.recordingSessionId = recording.sessionId;
        }
        const result = await runFlow(
          flow,
          deps.createExecutorDeps(deviceSerial, flow.appPackage),
          managed.controller.signal,
          captureInto(managed, recording),
        );
        await finishRecording(managed, recording, result);
        return result;
      });
      return managed.runId;
    },

    startGoal(
      goal: string,
      policyId: PolicyId,
      deviceSerial: string,
      options: {
        flowId?: string | null;
        limits?: Partial<RunLimitValues> | null;
        acknowledgeDataNotice?: boolean;
        taskId?: string;
        attempt?: number;
        principal?: AutomationPrincipal;
        appPackage?: string | null;
      } = {},
    ): string {
      if (goal.trim() === "") {
        throw new Error("goal must not be empty");
      }
      if (policyId !== "rules" && options.acknowledgeDataNotice !== true) {
        throw new Error(
          `policy '${policyId}' sends data off this machine; re-call with acknowledgeDataNotice: true`,
        );
      }
      const limits: RunLimits = { ...defaultLimitsFor(policyId), ...options.limits };
      sequence += 1;
      const runId = `run-${Date.now().toString(36)}-${sequence}`;
      const startedAt = Date.now();
      const taskRuntime = createRuntimeState({
        runId,
        kind: "goal",
        label: goal,
        policyId,
        goal,
        deviceSerial,
        startedAt,
        taskId: options.taskId,
        attempt: options.attempt,
        principal: options.principal,
        appPackage: requireGoalApp(options.appPackage, options.flowId, deps),
      });
      ownerCoordinator.claim(
        taskRuntime.task.id,
        taskRuntime.run.reasoningOwner,
        taskRuntime.task.principal.connectionId,
      );
      const managed: ManagedRun = {
        runId,
        taskId: taskRuntime.task.id,
        kind: "goal",
        label: goal,
        status: "running",
        policyId,
        flowId: options.flowId ?? null,
        goal,
        deviceSerial,
        records: [],
        failureReason: null,
        filePath: null,
        recorded: false,
        startedAt,
        endedAt: null,
        controller: new AbortController(),
        pauseRequested: false,
        disposePolicy: null,
        assertionsByStep: new Map(),
        assertionsLoaded: false,
        taskRuntime,
        recordingSessionId: null,
        persistenceTail: Promise.resolve(),
        acceptanceScenario:
          options.flowId === null || options.flowId === undefined
            ? null
            : (deps.loadFlow(options.flowId)?.acceptanceScenario ?? null),
        acceptanceMilestones:
          options.flowId === null || options.flowId === undefined
            ? new Map()
            : acceptanceMilestonesForFlow(deps.loadFlow(options.flowId)),
      };
      const policy = buildRegistryPolicy(policyId, options.flowId ?? null, deps, (record) =>
        appendReasoningStream(managed, record),
      );
      managed.disposePolicy = asDisposable(policy);
      queueRuntimePersistence(managed);
      retain(managed);
      notifyStarted(managed, flowOrNull(deps, options.flowId));
      spawn(managed, async () => {
        const recording = await deps.beginRecording({
          taskId: managed.taskId,
          taskRunId: managed.runId,
          taskOrigin: managed.taskRuntime.task.origin,
          label: goal,
          policyId,
          flow: null,
          goal,
          deviceSerial,
          appPackage: managed.taskRuntime.task.appPackage,
        });
        if (recording !== null) {
          managed.recorded = true;
          managed.recordingSessionId = recording.sessionId;
        }
        try {
          const executor = authorizationExecutorDeps(managed);
          const launched = await launchSelectedApp(managed, executor);
          if (launched !== null) {
            captureInto(managed, recording)(launched);
            if (launched.outcome === "failed") {
              return {
                status: "failed",
                records: [launched],
                failureReason: launched.error,
                startedAt: managed.startedAt,
                endedAt: launched.endedAt,
              };
            }
          }
          const result = await runGoal(goal, policy, executor, limits, managed.controller.signal, {
            assertions: [],
            onStep: captureInto(managed, recording),
          });
          await finishRecording(managed, recording, result);
          await managed.disposePolicy?.();
          return result;
        } catch (error) {
          await managed.disposePolicy?.();
          throw error;
        }
      });
      return managed.runId;
    },

    getStatus(runId: string): RunStatusSnapshot {
      const run = requireRun(runId);
      return {
        runId: run.runId,
        taskId: run.taskId,
        status: run.status,
        currentStep: run.records.length,
        stepCount: run.records.length,
        policyId: run.policyId,
        label: run.label,
        failureReason: run.failureReason,
        filePath: run.filePath,
      };
    },

    getTask(taskId: string): { task: AutomationTask; run: AutomationTaskRun; status: RunStatus } {
      const run = requireTask(taskId);
      return { task: run.taskRuntime.task, run: run.taskRuntime.run, status: run.status };
    },

    handoffTask(
      taskId: string,
      owner: ReasoningOwner,
      reason: string | null,
    ): { task: AutomationTask; run: AutomationTaskRun; status: RunStatus } {
      const managed = requireTask(taskId);
      ownerCoordinator.handoff(taskId, owner, managed.taskRuntime.task.principal.connectionId);
      const sequence = managed.taskRuntime.events.length + 1;
      const event = createAutomationTaskEvent({
        id: `event-${managed.runId}-${sequence}`,
        taskId: managed.taskId,
        runId: managed.runId,
        sequence,
        occurredAt: Math.max(Date.now(), managed.taskRuntime.events.at(-1)?.occurredAt ?? 0),
        origin: managed.taskRuntime.task.origin,
        principalId: managed.taskRuntime.task.principal.id,
        connectionId: managed.taskRuntime.task.principal.connectionId,
        kind: "owner.changed",
        data: { previous: managed.taskRuntime.task.reasoningOwner, current: owner, reason },
      });
      managed.taskRuntime = appendAutomationTaskEvent(managed.taskRuntime, event);
      enqueuePersistence(managed, () => invokeCommand("automation_event_append", { event }));
      queueRuntimePersistence(managed);
      return {
        task: managed.taskRuntime.task,
        run: managed.taskRuntime.run,
        status: managed.status,
      };
    },

    heartbeatTask(taskId: string): { expiresAt: number } {
      const managed = requireTask(taskId);
      try {
        const lease = ownerCoordinator.heartbeat(
          taskId,
          managed.taskRuntime.run.reasoningOwner,
          managed.taskRuntime.task.principal.connectionId,
        );
        return { expiresAt: lease.expiresAt };
      } catch (error) {
        if (managed.taskRuntime.task.status === "running") {
          managed.pauseRequested = true;
          managed.controller.abort();
          appendAwaitingReasonerEvent(managed, "reasoner ownership lease expired");
          queueRuntimePersistence(managed);
        }
        throw error;
      }
    },

    updateTaskPlan(
      taskId: string,
      summary: string,
    ): { task: AutomationTask; run: AutomationTaskRun } {
      const managed = requireTask(taskId);
      const normalized = summary.trim();
      if (normalized === "") {
        throw new Error("task plan cannot be empty");
      }
      const sequence = managed.taskRuntime.events.length + 1;
      const event = createAutomationTaskEvent({
        id: `event-${managed.runId}-${sequence}`,
        taskId: managed.taskId,
        runId: managed.runId,
        sequence,
        occurredAt: Math.max(Date.now(), managed.taskRuntime.events.at(-1)?.occurredAt ?? 0),
        origin: managed.taskRuntime.task.origin,
        principalId: managed.taskRuntime.task.principal.id,
        connectionId: managed.taskRuntime.task.principal.connectionId,
        kind: "plan.updated",
        data: {
          plan: { kind: "trace", runId: managed.runId, stepId: "task-plan", field: "summary" },
          summary: normalized,
        },
      });
      managed.taskRuntime = appendAutomationTaskEvent(managed.taskRuntime, event);
      enqueuePersistence(managed, () => invokeCommand("automation_event_append", { event }));
      return { task: managed.taskRuntime.task, run: managed.taskRuntime.run };
    },

    async observeTask(
      taskId: string,
    ): Promise<{ taskId: string; observation: ReturnType<typeof redactObservation> }> {
      const managed = requireTask(taskId);
      const observation = await deps
        .createExecutorDeps(managed.deviceSerial, managed.taskRuntime.task.appPackage ?? "")
        .observe();
      const sequence = managed.taskRuntime.events.length + 1;
      const fingerprint = observationFingerprint(observation);
      const event = createAutomationTaskEvent({
        id: `event-${managed.runId}-${sequence}`,
        taskId: managed.taskId,
        runId: managed.runId,
        sequence,
        occurredAt: Math.max(Date.now(), managed.taskRuntime.events.at(-1)?.occurredAt ?? 0),
        origin: managed.taskRuntime.task.origin,
        principalId: managed.taskRuntime.task.principal.id,
        connectionId: managed.taskRuntime.task.principal.connectionId,
        kind: "observation.captured",
        data: {
          stepId: `mcp-observation-${sequence}`,
          beforeFingerprint: fingerprint,
          afterFingerprint: fingerprint,
          screenChanged: null,
          evidence: null,
        },
      });
      managed.taskRuntime = appendAutomationTaskEvent(managed.taskRuntime, event);
      enqueuePersistence(managed, () => invokeCommand("automation_event_append", { event }));
      return { taskId: managed.taskId, observation: redactObservation(observation) };
    },

    executeTaskBatch(
      taskId: string,
      steps: unknown[],
      principalId?: string,
    ): { taskId: string; runId: string } {
      const managed = requireTask(taskId);
      if (managed.status !== "halted" || managed.taskRuntime.task.status !== "awaiting-reasoner") {
        throw new Error("task must be awaiting a reasoner before executing a batch");
      }
      const draft = createEmptyFlow(
        "MCP task batch",
        managed.taskRuntime.task.appPackage ?? "com.example.app",
      );
      const parsed = parseFlow({ ...draft, steps });
      if (!parsed.ok) {
        throw new Error(
          `invalid task batch: ${parsed.errors.map((error) => `${error.path}: ${error.message}`).join("; ")}`,
        );
      }
      const authorization = authorizeFlow(
        managed.taskRuntime.task.authorizationScope,
        managed.taskRuntime.task.principal,
        managed.deviceSerial,
        parsed.flow,
        Date.now(),
      );
      if (principalId !== undefined && principalId !== managed.taskRuntime.task.principal.id) {
        appendAuthorizationEvent(managed, {
          allowed: false,
          scopeId: managed.taskRuntime.task.authorizationScope?.id ?? null,
          actionClass: authorization.actionClass,
          stepId: authorization.stepId,
          reason: "principal does not own this task",
        });
        appendAwaitingReasonerEvent(managed, "principal does not own this task");
        throw new Error("principal does not own this task");
      }
      appendAuthorizationEvent(managed, authorization);
      if (!authorization.allowed) {
        appendAwaitingReasonerEvent(managed, authorization.reason);
        throw new Error(authorization.reason);
      }
      managed.controller = new AbortController();
      managed.pauseRequested = false;
      managed.status = "running";
      spawn(managed, () =>
        runFlow(
          parsed.flow,
          deps.createExecutorDeps(managed.deviceSerial, parsed.flow.appPackage),
          managed.controller.signal,
          captureInto(managed, null),
        ),
      );
      return { taskId: managed.taskId, runId: managed.runId };
    },

    async verifyTask(taskId: string, assertion: Assertion): Promise<AssertionResult> {
      const managed = requireTask(taskId);
      const executor = deps.createExecutorDeps(
        managed.deviceSerial,
        managed.taskRuntime.task.appPackage ?? "",
      );
      const result = await executor.evaluateAssertion(
        assertion,
        { observe: () => executor.observe(), ...executor.evidence },
        { timeoutMs: executor.assertionTimeoutMs ?? 5000, pollMs: executor.assertionPollMs ?? 250 },
      );
      const sequence = managed.taskRuntime.events.length + 1;
      const event = createAutomationTaskEvent({
        id: `event-${managed.runId}-${sequence}`,
        taskId: managed.taskId,
        runId: managed.runId,
        sequence,
        occurredAt: Math.max(Date.now(), managed.taskRuntime.events.at(-1)?.occurredAt ?? 0),
        origin: managed.taskRuntime.task.origin,
        principalId: managed.taskRuntime.task.principal.id,
        connectionId: managed.taskRuntime.task.principal.connectionId,
        kind: "verification.completed",
        data: {
          stepId: `mcp-verification-${sequence}`,
          status: result.passed ? "verified" : "unverified",
          outcome: result.passed ? "ok" : "failed",
          error: result.passed ? null : result.observed,
        },
      });
      managed.taskRuntime = appendAutomationTaskEvent(managed.taskRuntime, event);
      enqueuePersistence(managed, () => invokeCommand("automation_event_append", { event }));
      return result;
    },

    async readTrace(runId: string, offset = 0, limit = 100): Promise<TracePage> {
      const run = requireRun(runId);
      await backfillAssertions(run, deps);
      const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_TRACE_LIMIT);
      const safeOffset = Math.max(0, Math.floor(offset));
      const total = run.records.length;
      const page = run.records.slice(safeOffset, safeOffset + safeLimit);
      return {
        total,
        offset: safeOffset,
        limit: safeLimit,
        records: page.map((record) => {
          // An external reasoner reads this page, so the decision crosses the
          // same boundary as a remote policy payload and is masked identically.
          const decision = redactDecision(record.decision);
          return {
            stepId: record.stepId,
            startedAt: record.startedAt,
            endedAt: record.endedAt,
            operation: decision.operation,
            target: (decision.target ?? null) as unknown,
            text: (decision.text ?? null) as unknown,
            confidence: decision.confidence,
            reason: decision.reason,
            resolvedTarget: (record.resolvedTarget ?? null) as unknown,
            outcome: record.outcome,
            error: record.error,
            screenshot: record.screenshotRef === "" ? null : record.screenshotRef,
            assertions: run.assertionsByStep.get(record.stepId) ?? [],
            beforeFingerprint: record.beforeFingerprint,
            afterFingerprint: record.afterFingerprint,
            screenChanged: record.screenChanged,
            dispatchStatus: record.dispatchStatus,
            verificationStatus: record.verificationStatus,
          };
        }),
      };
    },

    readTaskEvents(
      taskId: string,
      cursor: string | null = null,
      limit = 100,
    ): AutomationTaskEventPage {
      const run = requireTask(taskId);
      return pageAutomationTaskEvents(run.taskRuntime.events, cursor, limit);
    },

    readAcceptanceReport(runId: string): PresalioAcceptanceReport | null {
      const event = requireRun(runId).taskRuntime.events.findLast(
        (candidate) => candidate.kind === "acceptance.reported",
      );
      return event?.kind === "acceptance.reported" ? event.data.report : null;
    },

    readEvents(runId: string, cursor: string | null = null, limit = 100): AutomationTaskEventPage {
      return pageAutomationTaskEvents(requireRun(runId).taskRuntime.events, cursor, limit);
    },

    async promoteRun(
      runId: string,
      name: string,
    ): Promise<{ flowId: string; warnings: unknown[]; stepCount: number }> {
      const run = requireRun(runId);
      await backfillAssertions(run, deps);
      let appPackage = "unknown";
      if (run.flowId !== null) {
        const flow = deps.loadFlow(run.flowId);
        if (flow !== null) {
          appPackage = flow.appPackage;
        }
      }
      const promoted = promoteRun(
        {
          runId: run.runId,
          status: run.status,
          policyId: run.policyId,
          steps: run.records.map((record) => ({
            record,
            assertions: run.assertionsByStep.get(record.stepId) ?? [],
          })),
        },
        { name, appPackage },
      );
      deps.saveFlow(promoted.flow);
      return {
        flowId: promoted.flow.id,
        warnings: promoted.warnings,
        stepCount: promoted.flow.steps.length,
      };
    },

    listFlows(): FlowSummary[] {
      return deps.listFlows();
    },

    createFlow(input: {
      name: string;
      appPackage: string;
      description?: string | null;
      steps?: unknown[] | null;
    }): string {
      if (input.name.trim() === "" || input.appPackage.trim() === "") {
        throw new Error("save_flow needs a name and an appPackage");
      }
      const base = createEmptyFlow(input.name.trim(), input.appPackage.trim());
      const parsed = parseFlow({
        ...base,
        description: input.description ?? undefined,
        steps: input.steps ?? [],
      });
      if (!parsed.ok) {
        throw new Error(
          `invalid flow: ${parsed.errors.map((error) => `${error.path}: ${error.message}`).join("; ")}`,
        );
      }
      deps.saveFlow(parsed.flow);
      return parsed.flow.id;
    },

    updateFlow(
      flowId: string,
      patch: {
        name?: string | null;
        appPackage?: string | null;
        description?: string | null;
        steps?: unknown[] | null;
      },
    ): string {
      const existing = deps.loadFlow(flowId);
      if (existing === null) {
        throw new Error(`unknown flow ${flowId}`);
      }
      const parsed = parseFlow({
        ...existing,
        name: patch.name ?? existing.name,
        appPackage: patch.appPackage ?? existing.appPackage,
        description:
          patch.description === null ? undefined : (patch.description ?? existing.description),
        steps: patch.steps ?? existing.steps,
      });
      if (!parsed.ok) {
        throw new Error(
          `invalid flow: ${parsed.errors.map((error) => `${error.path}: ${error.message}`).join("; ")}`,
        );
      }
      deps.saveFlow(parsed.flow);
      return parsed.flow.id;
    },

    deleteFlow(flowId: string): boolean {
      return deps.deleteFlow(flowId);
    },

    /** Watches every run managed here, whatever started it. Visibility only, never control. */
    subscribe,

    async cancelRun(runId: string): Promise<{ cancelled: boolean; status: RunStatus }> {
      const run = requireRun(runId);
      if (run.status !== "running") {
        return { cancelled: false, status: run.status };
      }
      run.controller.abort();
      try {
        await run.disposePolicy?.();
      } catch {
        return { cancelled: true, status: run.status };
      }
      return { cancelled: true, status: run.status };
    },

    cancelTask(taskId: string): Promise<{ cancelled: boolean; status: RunStatus }> {
      return this.cancelRun(requireTask(taskId).runId);
    },

    async pauseTask(taskId: string): Promise<{ paused: boolean; status: RunStatus }> {
      const run = requireTask(taskId);
      if (run.status !== "running") {
        return { paused: false, status: run.status };
      }
      run.pauseRequested = true;
      ownerCoordinator.release(
        taskId,
        run.taskRuntime.run.reasoningOwner,
        run.taskRuntime.task.principal.connectionId,
      );
      run.controller.abort();
      await run.disposePolicy?.();
      return { paused: true, status: run.status };
    },

    resumeTask(taskId: string): { taskId: string; runId: string } {
      const run = requireTask(taskId);
      if (run.status !== "halted" || run.taskRuntime.task.status !== "awaiting-reasoner") {
        throw new Error("task is not awaiting a reasoner");
      }
      if (run.goal === null) {
        throw new Error("only agent-goal tasks can resume");
      }
      const runId = this.startGoal(run.goal, run.policyId, run.deviceSerial, {
        flowId: run.flowId,
        taskId: run.taskId,
        attempt: run.taskRuntime.run.attempt + 1,
        acknowledgeDataNotice: run.policyId !== "rules",
        principal: run.taskRuntime.task.principal,
        appPackage: run.taskRuntime.task.appPackage,
      });
      return { taskId: run.taskId, runId };
    },
  };
}

export type RunRegistry = ReturnType<typeof createRunRegistry>;

let singleton: RunRegistry | null = null;

/**
 * Production singleton wiring the registry to the flow store, the desktop
 * executor deps and the run recording pipeline.
 */
export function getRunRegistry(): RunRegistry {
  if (singleton === null) {
    singleton = createRunRegistry({
      loadFlow: (flowId) => useFlowStore().flows.find((flow) => flow.id === flowId) ?? null,
      listFlows: () =>
        useFlowStore().flows.map((flow) => ({
          id: flow.id,
          name: flow.name,
          appPackage: flow.appPackage,
          stepCount: flow.steps.length,
        })),
      saveFlow: (flow) => {
        useFlowStore().importFlow(flow);
      },
      deleteFlow: (flowId) => {
        const store = useFlowStore();
        if (!store.loaded) {
          store.loadFlows();
        }
        const exists = store.flows.some((flow) => flow.id === flowId);
        if (exists) {
          store.deleteFlow(flowId);
        }
        return exists;
      },
      createExecutorDeps: (serial, appPackage) => createDesktopExecutorDeps(serial, [], appPackage),
      beginRecording: async (info) => {
        if (!RECORDING_ENABLED) {
          return null;
        }
        try {
          return await startRunRecording(info);
        } catch {
          return null;
        }
      },
      readSessionFile: async (filePath) => {
        const raw = await invokeCommand("recording_read_session", { filePath });
        return {
          manifest: parseReplayManifest(raw.manifest_json),
          automationNdjson: raw.tracks["automation"] ?? "",
        };
      },
    });
  }
  return singleton;
}

/** Starts a fresh attempt for a restored task while preserving its durable task identity. */
export function resumePersistedGoal(
  registry: ReturnType<typeof createRunRegistry>,
  snapshot: PersistedAutomationTaskSnapshot,
  policyId: PolicyId,
  deviceSerial: string,
  options: {
    flowId?: string | null;
    limits?: Partial<RunLimitValues> | null;
    acknowledgeDataNotice?: boolean;
  } = {},
): string {
  const attempt = snapshot.runs.reduce((highest, run) => Math.max(highest, run.attempt), 0) + 1;
  return registry.startGoal(snapshot.task.originalGoal, policyId, deviceSerial, {
    ...options,
    taskId: snapshot.task.id,
    attempt,
  });
}
