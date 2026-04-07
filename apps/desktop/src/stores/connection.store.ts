import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import type { CDPTarget, CDPConnection } from "@/types/cdp.types";
import { CDPClient } from "utils";

export const useConnectionStore = defineStore("connection", () => {
  const connections = ref<Map<string, CDPConnection>>(new Map());
  const clientMap = new Map<string, CDPClient>();
  const selectedTargetId = ref<string | null>(null);

  const activeConnection = computed(() => {
    if (!selectedTargetId.value) return null;
    const conn = connections.value.get(selectedTargetId.value);
    if (conn && conn.status === "connected") return conn;
    return null;
  });

  async function connect(target: CDPTarget): Promise<CDPClient> {
    selectedTargetId.value = target.id;
    const existing = clientMap.get(target.id);
    if (existing && existing.readyState === WebSocket.OPEN) return existing;

    // Use Rust WebSocket proxy to avoid Origin header 403 from Android CDP
    let wsUrl = target.webSocketDebuggerUrl;
    if (target.source === "adb") {
      try {
        const proxy = await invoke<{ wsUrl: string; localPort: number }>("cdp_start_proxy", {
          wsUrl: target.webSocketDebuggerUrl,
        });
        wsUrl = proxy.wsUrl;
        console.log("[connection] Using CDP proxy:", wsUrl);
      } catch (e) {
        console.error("[connection] Failed to start CDP proxy:", e);
        throw e;
      }
    }

    // Create the CDPClient first — opens exactly one WebSocket to the proxy.
    // Do NOT open a separate raw WebSocket for status tracking; reuse the client's socket.
    const client = new CDPClient(wsUrl);

    const conn: CDPConnection = {
      targetId: target.id,
      ws: client.ws,
      status: "connecting",
    };
    connections.value.set(target.id, conn);

    await new Promise<void>((resolve, reject) => {
      conn.ws.addEventListener("open", () => {
        conn.status = "connected";
        resolve();
      });

      conn.ws.addEventListener("close", () => {
        conn.status = "disconnected";
        clientMap.delete(target.id);
      });

      conn.ws.addEventListener("error", () => {
        conn.status = "error";
        reject(new Error(`WebSocket error connecting to ${target.url}`));
      });
    });

    clientMap.set(target.id, client);
    return client;
  }

  function getClient(targetId: string): CDPClient | undefined {
    return clientMap.get(targetId);
  }

  function disconnectTarget(targetId: string) {
    clientMap.get(targetId)?.close();
    clientMap.delete(targetId);
    const conn = connections.value.get(targetId);
    if (conn) {
      conn.ws.close();
      connections.value.delete(targetId);
    }
  }

  function setStatus(targetId: string, status: CDPConnection["status"]) {
    const conn = connections.value.get(targetId);
    if (conn) conn.status = status;
  }

  return {
    connections,
    activeConnection,
    selectedTargetId,
    connect,
    getClient,
    disconnectTarget,
    setStatus,
  };
});
