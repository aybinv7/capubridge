import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import type { CDPTarget, CDPConnection } from "@/types/cdp.types";
import { CDPClient } from "utils";

export const useConnectionStore = defineStore("connection", () => {
  const connections = ref<Map<string, CDPConnection>>(new Map());
  const clientMap = new Map<string, CDPClient>();
  const selectedTargetId = ref<string | null>(null);
  const pendingConnections = new Map<string, Promise<CDPClient>>();

  const targetToWsUrl = new Map<string, string>();

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

    const pending = pendingConnections.get(target.id);
    if (pending) return pending;

    const connectionPromise = (async () => {
      try {
        targetToWsUrl.set(target.id, target.webSocketDebuggerUrl);

        let wsUrl = target.webSocketDebuggerUrl;
        if (target.source === "adb") {
          const proxy = await invoke<{ wsUrl: string; localPort: number }>("cdp_start_proxy", {
            wsUrl: target.webSocketDebuggerUrl,
          });
          wsUrl = proxy.wsUrl;
        }

        const client = new CDPClient(wsUrl);

        const conn: CDPConnection = {
          targetId: target.id,
          ws: client.ws,
          status: "connecting",
        };
        connections.value.set(target.id, conn);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Connection timeout"));
          }, 10000);

          conn.ws.addEventListener("open", () => {
            clearTimeout(timeout);
            conn.status = "connected";
            resolve();
          });

          conn.ws.addEventListener("close", () => {
            clearTimeout(timeout);
            conn.status = "disconnected";
            clientMap.delete(target.id);
          });

          conn.ws.addEventListener("error", () => {
            clearTimeout(timeout);
            conn.status = "error";
            reject(new Error(`WebSocket error connecting to ${target.url}`));
          });
        });

        clientMap.set(target.id, client);
        return client;
      } finally {
        pendingConnections.delete(target.id);
      }
    })();

    pendingConnections.set(target.id, connectionPromise);
    return connectionPromise;
  }

  function getClient(targetId: string): CDPClient | undefined {
    return clientMap.get(targetId);
  }

  async function disconnectTarget(targetId: string) {
    clientMap.get(targetId)?.close();
    clientMap.delete(targetId);
    const conn = connections.value.get(targetId);
    if (conn) {
      conn.ws.close();
      connections.value.delete(targetId);
    }

    const wsUrl = targetToWsUrl.get(targetId);
    if (wsUrl) {
      try {
        await invoke("cdp_stop_proxy", { wsUrl });
      } catch (e) {
        console.warn("[connection] Failed to stop proxy:", e);
      }
      targetToWsUrl.delete(targetId);
    }

    if (selectedTargetId.value === targetId) {
      selectedTargetId.value = null;
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
