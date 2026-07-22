import { invokeCommand, listenEvent } from "@/runtime/ipc/client";
import { useTargetsStore } from "@/stores/targets.store";
import { useCDP } from "./useCDP";
import type { McpBridgeRequestEvent } from "@/runtime/ipc/events";

/**
 * Frontend half of the MCP → frontend bridge (see `mcp/bridge.rs`). The MCP
 * server emits `mcp://bridge/request` for actions only the frontend can do
 * (selecting + connecting a CDP target, later: recording), and this listener
 * performs the work and answers via the `mcp_bridge_respond` command with the
 * same `requestId`. Mounted once in the main window (see `McpBridgeBootstrap`).
 */
export function useMcpBridge() {
  const targetsStore = useTargetsStore();
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

  const handlers: Record<string, (payload: unknown) => Promise<unknown>> = {
    select_target: selectTarget,
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
