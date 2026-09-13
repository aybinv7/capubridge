import { invokeCommand, listenEvent } from "@/runtime/ipc/client";
import { useTargetsStore } from "@/stores/targets.store";
import { useRecordingStore } from "@/stores/recording.store";
import { useCDP } from "./useCDP";
import { useRecordingSession } from "./useRecordingSession";
import { useMockStore } from "@/modules/network/stores/useMockStore";
import type { MockRule, MockInterceptMode } from "@/types/mock.types";
import type { McpBridgeRequestEvent } from "@/runtime/ipc/events";
import type { RecordingConfig } from "@/types/replay.types";

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
    const rule = payload as Omit<MockRule, "id" | "hitCount" | "createdAt"> & { id?: string };
    if (!rule?.name || !rule.urlPattern) {
      return Promise.reject(new Error("upsert_mock_rule requires name and urlPattern"));
    }
    const existing = rule.id
      ? mockStore.rules.find((candidate) => candidate.id === rule.id)
      : undefined;
    const next: MockRule = {
      ...rule,
      id: existing?.id ?? crypto.randomUUID(),
      hitCount: existing?.hitCount ?? 0,
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

  const handlers: Record<string, (payload: unknown) => Promise<unknown>> = {
    select_target: selectTarget,
    start_recording: startRecording,
    stop_recording: stopRecording,
    recording_status: recordingStatus,
    upsert_mock_rule: upsertMockRule,
    set_mock_mode: setMockMode,
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
