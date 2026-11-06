import { invokeCommand, listenEvent } from "@/runtime/ipc/client";
import { useTargetsStore } from "@/stores/targets.store";
import { useRecordingStore } from "@/stores/recording.store";
import { useCDP } from "./useCDP";
import { useRecordingSession } from "./useRecordingSession";
import { useMockStore } from "@/modules/network/stores/useMockStore";
import type { MockRule, MockInterceptMode } from "@/types/mock.types";
import type { McpBridgeRequestEvent } from "@/runtime/ipc/events";
import type { RecordingConfig } from "@/types/replay.types";
import { getRunRegistry } from "@/modules/automation/runRegistry";
import { waitForRun } from "@/modules/automation/runWait";
import type { PolicyId } from "@/modules/automation/policies/types";
import { POLICY_IDS } from "@/modules/automation/flowShared";
import { isRemovedArtemis, REMOVED_ARTEMIS_MESSAGE } from "@/modules/automation/removedPolicies";
import type { Assertion, ReasoningOwner } from "@/types/automation.types";

const REASONING_OWNERS: readonly ReasoningOwner[] = ["embedded", "mcp-host", "deterministic"];

/**
 * Frontend half of the MCP → frontend bridge (see `mcp/bridge.rs`). The MCP
 * server emits `mcp://bridge/request` for actions only the frontend can do
 * (selecting + connecting a CDP target, later: recording), and this listener
 * performs the work and answers via the `mcp_bridge_respond` command with the
 * same `requestId`. Mounted once in the main window (see `McpBridgeBootstrap`).
 */
export function useMcpBridge() {
  const targetsStore = useTargetsStore();
  const recordingStore = useRecordingStore();
  const mockStore = useMockStore();
  const recording = useRecordingSession();
  const { connectToTarget } = useCDP();

  async function selectTarget(payload: unknown): Promise<unknown> {
    const { serial, targetId } = (payload ?? {}) as { serial?: string; targetId?: string };
    if (!serial || !targetId) {
      throw new Error("select_target requires serial and targetId");
    }

    // Populate the frontend's target list for this device, then find the one asked for.
    await targetsStore.hydrateAdbTargets(serial);
    const target = targetsStore.targets.find((candidate) => candidate.id === targetId);
    if (!target) {
      const available = targetsStore.targets.map((candidate) => candidate.id).join(", ");
      throw new Error(
        `Target ${targetId} not found on ${serial}. Available: ${available || "(none)"}`,
      );
    }

    targetsStore.selectTarget(target);
    await connectToTarget(target);

    return {
      selected: { id: target.id, title: target.title, url: target.url },
    };
  }

  async function startRecording(payload: unknown): Promise<unknown> {
    if (recordingStore.isRecording) {
      throw new Error(`Already recording (session ${recordingStore.sessionId ?? "?"})`);
    }
    if (!targetsStore.selectedTarget) {
      throw new Error("No target selected — call select_target first");
    }

    const config = payload as RecordingConfig;
    await recording.start(config);

    if (recordingStore.errorMessage) {
      throw new Error(recordingStore.errorMessage);
    }
    if (!recordingStore.isRecording) {
      throw new Error("Recording did not start");
    }
    return { started: true, sessionId: recordingStore.sessionId };
  }

  async function stopRecording(): Promise<unknown> {
    if (!recordingStore.isRecording) {
      return { stopped: false, reason: "No recording in progress" };
    }
    const filePath = await recording.stop();
    return { stopped: true, filePath };
  }

  function recordingStatus(): Promise<unknown> {
    return Promise.resolve({
      recording: recordingStore.isRecording,
      phase: recordingStore.phase,
      sessionId: recordingStore.sessionId,
      startedAt: recordingStore.startedAt,
    });
  }

  function upsertMockRule(payload: unknown): Promise<unknown> {
    const rule = payload as Omit<MockRule, "id" | "createdAt"> & { id?: string };
    if (!rule?.name || !rule.urlPattern) {
      return Promise.reject(new Error("upsert_mock_rule requires name and urlPattern"));
    }
    const existing = rule.id
      ? mockStore.rules.find((candidate) => candidate.id === rule.id)
      : undefined;
    const next: MockRule = {
      ...rule,
      id: existing?.id ?? crypto.randomUUID(),
      createdAt: existing?.createdAt ?? Date.now(),
    };
    if (existing) mockStore.updateRule(next);
    else mockStore.addRule(next);
    return Promise.resolve({ rule: next });
  }

  function setMockMode(payload: unknown): Promise<unknown> {
    const { mode } = (payload ?? {}) as { mode?: MockInterceptMode };
    if (!mode || !["off", "cdp", "http"].includes(mode)) {
      return Promise.reject(new Error("set_mock_mode requires off, cdp, or http"));
    }
    mockStore.interceptMode = mode;
    return Promise.resolve({ mode, enabledRules: mockStore.enabledCount });
  }

  function automationRunFlow(payload: unknown): Promise<unknown> {
    const { flowId, deviceSerial, principalId, connectionId, clientName } = (payload ?? {}) as {
      flowId?: string;
      deviceSerial?: string;
      principalId?: string;
      connectionId?: string | null;
      clientName?: string;
    };
    if (!flowId || !deviceSerial) {
      throw new Error("automation_run_flow requires flowId and deviceSerial");
    }
    return Promise.resolve({
      runId: getRunRegistry().startFlow(flowId, deviceSerial, {
        principal: principalId
          ? {
              id: principalId,
              label: clientName ?? principalId,
              kind: "mcp",
              connectionId: connectionId ?? null,
              clientName: clientName ?? null,
            }
          : undefined,
      }),
    });
  }

  function automationRunAgentGoal(payload: unknown): Promise<unknown> {
    const params = (payload ?? {}) as {
      goal?: string;
      policyId?: string;
      deviceSerial?: string;
      flowId?: string | null;
      limits?: {
        maxSteps?: number;
        maxDurationMs?: number;
        maxConsecutiveFailures?: number;
      } | null;
      acknowledgeDataNotice?: boolean;
      appPackage?: string | null;
      principalId?: string;
      connectionId?: string | null;
      clientName?: string;
    };
    if (!params.goal || !params.policyId || !params.deviceSerial) {
      throw new Error("automation_run_agent_goal requires goal, policyId and deviceSerial");
    }
    if (isRemovedArtemis(params.policyId)) {
      throw new Error(REMOVED_ARTEMIS_MESSAGE);
    }
    if (!POLICY_IDS.includes(params.policyId as PolicyId)) {
      throw new Error(`unknown policy '${params.policyId}'`);
    }
    const runId = getRunRegistry().startGoal(
      params.goal,
      params.policyId as PolicyId,
      params.deviceSerial,
      {
        flowId: params.flowId ?? null,
        limits: params.limits ?? null,
        acknowledgeDataNotice: params.acknowledgeDataNotice,
        appPackage: params.appPackage ?? null,
        principal: params.principalId
          ? {
              id: params.principalId,
              label: params.clientName ?? params.principalId,
              kind: "mcp",
              connectionId: params.connectionId ?? null,
              clientName: params.clientName ?? null,
            }
          : undefined,
      },
    );
    return Promise.resolve({ runId, taskId: getRunRegistry().getStatus(runId).taskId });
  }

  function automationGetRunStatus(payload: unknown): Promise<unknown> {
    const { runId } = (payload ?? {}) as { runId?: string };
    if (!runId) {
      throw new Error("automation_get_run_status requires runId");
    }
    return Promise.resolve(getRunRegistry().getStatus(runId));
  }

  /**
   * Blocks until the run finishes or the bound passes. Bounded well under the
   * Rust bridge's own deadline for this action, so the frontend always
   * answers first and a slow run returns a not-done summary, never an error.
   */
  function automationWaitForRun(payload: unknown): Promise<unknown> {
    const { runId, timeoutMs } = (payload ?? {}) as { runId?: string; timeoutMs?: number };
    if (!runId) {
      throw new Error("automation_wait_for_run requires runId");
    }
    const requested =
      typeof timeoutMs === "number" && Number.isFinite(timeoutMs) ? timeoutMs : 50_000;
    return waitForRun(getRunRegistry(), runId, Math.min(Math.max(requested, 1_000), 110_000));
  }

  function automationGetTask(payload: unknown): Promise<unknown> {
    const { taskId } = (payload ?? {}) as { taskId?: string };
    if (!taskId) {
      throw new Error("automation_get_task requires taskId");
    }
    return Promise.resolve(getRunRegistry().getTask(taskId));
  }

  function automationReadTaskEvents(payload: unknown): Promise<unknown> {
    const { taskId, cursor, limit } = (payload ?? {}) as {
      taskId?: string;
      cursor?: string | null;
      limit?: number;
    };
    if (!taskId) {
      throw new Error("automation_read_task_events requires taskId");
    }
    return Promise.resolve(getRunRegistry().readTaskEvents(taskId, cursor ?? null, limit ?? 100));
  }

  function automationReadRunTrace(payload: unknown): Promise<unknown> {
    const { runId, offset, limit } = (payload ?? {}) as {
      runId?: string;
      offset?: number;
      limit?: number;
    };
    if (!runId) {
      throw new Error("automation_read_run_trace requires runId");
    }
    return getRunRegistry().readTrace(runId, offset ?? 0, limit ?? 100);
  }

  function automationPromoteRun(payload: unknown): Promise<unknown> {
    const { runId, name } = (payload ?? {}) as { runId?: string; name?: string };
    if (!runId || !name) {
      throw new Error("automation_promote_run requires runId and name");
    }
    return getRunRegistry().promoteRun(runId, name);
  }

  function automationListFlows(): Promise<unknown> {
    return Promise.resolve({ flows: getRunRegistry().listFlows() });
  }

  function automationSaveFlow(payload: unknown): Promise<unknown> {
    const { name, appPackage, description, steps } = (payload ?? {}) as {
      name?: string;
      appPackage?: string;
      description?: string | null;
      steps?: unknown[] | null;
    };
    if (!name || !appPackage) {
      throw new Error("automation_save_flow requires name and appPackage");
    }
    return Promise.resolve({
      flowId: getRunRegistry().createFlow({ name, appPackage, description, steps }),
    });
  }

  function automationUpdateFlow(payload: unknown): Promise<unknown> {
    const { flowId, name, appPackage, description, steps } = (payload ?? {}) as {
      flowId?: string;
      name?: string | null;
      appPackage?: string | null;
      description?: string | null;
      steps?: unknown[] | null;
    };
    if (!flowId) {
      throw new Error("automation_update_flow requires flowId");
    }
    return Promise.resolve({
      flowId: getRunRegistry().updateFlow(flowId, { name, appPackage, description, steps }),
    });
  }

  function automationDeleteFlow(payload: unknown): Promise<unknown> {
    const { flowId } = (payload ?? {}) as { flowId?: string };
    if (!flowId) {
      throw new Error("automation_delete_flow requires flowId");
    }
    return Promise.resolve({ deleted: getRunRegistry().deleteFlow(flowId) });
  }

  function automationCancelRun(payload: unknown): Promise<unknown> {
    const { runId } = (payload ?? {}) as { runId?: string };
    if (!runId) {
      throw new Error("automation_cancel_run requires runId");
    }
    return getRunRegistry().cancelRun(runId);
  }

  function automationCancelTask(payload: unknown): Promise<unknown> {
    const { taskId } = (payload ?? {}) as { taskId?: string };
    if (!taskId) {
      throw new Error("automation_cancel_task requires taskId");
    }
    return getRunRegistry().cancelTask(taskId);
  }

  function automationHandoffTask(payload: unknown): Promise<unknown> {
    const { taskId, owner, reason } = (payload ?? {}) as {
      taskId?: string;
      owner?: string;
      reason?: string | null;
    };
    if (!taskId || !owner) {
      throw new Error("automation_handoff_task requires taskId and owner");
    }
    if (isRemovedArtemis(owner)) {
      throw new Error(REMOVED_ARTEMIS_MESSAGE);
    }
    if (!REASONING_OWNERS.includes(owner as ReasoningOwner)) {
      throw new Error("owner must be embedded, mcp-host or deterministic");
    }
    return Promise.resolve(
      getRunRegistry().handoffTask(taskId, owner as ReasoningOwner, reason ?? null),
    );
  }

  function automationUpdateTaskPlan(payload: unknown): Promise<unknown> {
    const { taskId, summary } = (payload ?? {}) as { taskId?: string; summary?: string };
    if (!taskId || !summary) {
      throw new Error("automation_update_task_plan requires taskId and summary");
    }
    return Promise.resolve(getRunRegistry().updateTaskPlan(taskId, summary));
  }

  function automationPauseTask(payload: unknown): Promise<unknown> {
    const { taskId } = (payload ?? {}) as { taskId?: string };
    if (!taskId) throw new Error("automation_pause_task requires taskId");
    return getRunRegistry().pauseTask(taskId);
  }

  function automationResumeTask(payload: unknown): Promise<unknown> {
    const { taskId } = (payload ?? {}) as { taskId?: string };
    if (!taskId) throw new Error("automation_resume_task requires taskId");
    return Promise.resolve(getRunRegistry().resumeTask(taskId));
  }

  function automationObserveTask(payload: unknown): Promise<unknown> {
    const { taskId } = (payload ?? {}) as { taskId?: string };
    if (!taskId) throw new Error("automation_observe_task requires taskId");
    return getRunRegistry().observeTask(taskId);
  }

  function automationExecuteTaskBatch(payload: unknown): Promise<unknown> {
    const { taskId, steps, principalId } = (payload ?? {}) as {
      taskId?: string;
      steps?: unknown[];
      principalId?: string;
    };
    if (!taskId || !Array.isArray(steps))
      throw new Error("automation_execute_task_batch requires taskId and steps");
    return Promise.resolve(getRunRegistry().executeTaskBatch(taskId, steps, principalId));
  }

  function automationVerifyTask(payload: unknown): Promise<unknown> {
    const { taskId, assertion } = (payload ?? {}) as { taskId?: string; assertion?: Assertion };
    if (!taskId || !assertion)
      throw new Error("automation_verify_task requires taskId and assertion");
    return getRunRegistry().verifyTask(taskId, assertion);
  }

  function automationHeartbeatTask(payload: unknown): Promise<unknown> {
    const { taskId } = (payload ?? {}) as { taskId?: string };
    if (!taskId) throw new Error("automation_heartbeat_task requires taskId");
    return Promise.resolve(getRunRegistry().heartbeatTask(taskId));
  }

  const handlers: Record<string, (payload: unknown) => Promise<unknown>> = {
    select_target: selectTarget,
    start_recording: startRecording,
    stop_recording: stopRecording,
    recording_status: recordingStatus,
    upsert_mock_rule: upsertMockRule,
    set_mock_mode: setMockMode,
    automation_run_flow: automationRunFlow,
    automation_run_agent_goal: automationRunAgentGoal,
    automation_get_run_status: automationGetRunStatus,
    automation_wait_for_run: automationWaitForRun,
    automation_get_task: automationGetTask,
    automation_read_task_events: automationReadTaskEvents,
    automation_read_run_trace: automationReadRunTrace,
    automation_promote_run: automationPromoteRun,
    automation_list_flows: automationListFlows,
    automation_save_flow: automationSaveFlow,
    automation_update_flow: automationUpdateFlow,
    automation_delete_flow: automationDeleteFlow,
    automation_cancel_run: automationCancelRun,
    automation_cancel_task: automationCancelTask,
    automation_handoff_task: automationHandoffTask,
    automation_update_task_plan: automationUpdateTaskPlan,
    automation_pause_task: automationPauseTask,
    automation_resume_task: automationResumeTask,
    automation_observe_task: automationObserveTask,
    automation_execute_task_batch: automationExecuteTaskBatch,
    automation_verify_task: automationVerifyTask,
    automation_heartbeat_task: automationHeartbeatTask,
  };

  async function handleRequest(event: McpBridgeRequestEvent): Promise<void> {
    const handler = handlers[event.action];
    if (!handler) {
      await invokeCommand("mcp_bridge_respond", {
        requestId: event.requestId,
        ok: false,
        error: `Unknown bridge action: ${event.action}`,
      });
      return;
    }

    try {
      const result = await handler(event.payload);
      await invokeCommand("mcp_bridge_respond", {
        requestId: event.requestId,
        ok: true,
        result,
      });
    } catch (err) {
      await invokeCommand("mcp_bridge_respond", {
        requestId: event.requestId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Start listening. Returns an unlisten function. */
  async function start(): Promise<() => void> {
    return listenEvent("mcp://bridge/request", (payload) => {
      void handleRequest(payload);
    });
  }

  return { start };
}
