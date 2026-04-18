import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import type { CDPTarget, CDPConnection } from "@/types/cdp.types";
import { CDPClient } from "utils";

export const useConnectionStore = defineStore("connection", () => {
  const connections = ref<Map<string, CDPConnection>>(new Map());
  const clientMap = new Map<string, CDPClient>();
  const selectedTargetId = ref<string | null>(null);
  const externalDevtoolsTargetId = ref<string | null>(null);
  const pendingConnections = new Map<string, Promise<CDPClient>>();

  const targetToWsUrl = new Map<string, string>();

  function logConnection(event: string, payload: Record<string, unknown>) {
    console.log("[connection]", event, payload);
  }

  const activeConnection = computed(() => {
    if (!selectedTargetId.value) return null;
    const conn = connections.value.get(selectedTargetId.value);
    if (conn && conn.status === "connected") return conn;
    return null;
  });

  function setConnection(targetId: string, connection: CDPConnection) {
    connections.value.set(targetId, connection);
  }

  function updateConnectionStatus(targetId: string, status: CDPConnection["status"]) {
    const existing = connections.value.get(targetId);
    if (!existing) return;
    setConnection(targetId, { ...existing, status });
  }

  async function connect(target: CDPTarget): Promise<CDPClient> {
    if (externalDevtoolsTargetId.value === target.id) {
      logConnection("connect:blocked-external-devtools", { targetId: target.id });
      throw new Error("Target currently owned by external DevTools");
    }
    selectedTargetId.value = target.id;
    logConnection("connect:start", {
      targetId: target.id,
      source: target.source,
      url: target.url,
    });

    const existing = clientMap.get(target.id);
    if (existing && existing.readyState === WebSocket.OPEN) {
      logConnection("connect:reuse-open", { targetId: target.id });
      return existing;
    }

    const pending = pendingConnections.get(target.id);
    if (pending) {
      logConnection("connect:reuse-pending", { targetId: target.id });
      return pending;
    }

    const connectionPromise = (async () => {
      try {
        targetToWsUrl.set(target.id, target.webSocketDebuggerUrl);

        let wsUrl = target.webSocketDebuggerUrl;
        if (target.source === "adb") {
          const proxy = await invoke<{ wsUrl: string; localPort: number }>("cdp_start_proxy", {
            wsUrl: target.webSocketDebuggerUrl,
          });
          wsUrl = proxy.wsUrl;
          logConnection("connect:proxy-started", {
            targetId: target.id,
            proxyWsUrl: proxy.wsUrl,
            proxyPort: proxy.localPort,
          });
        }

        const client = new CDPClient(wsUrl);

        const conn: CDPConnection = {
          targetId: target.id,
          ws: client.ws,
          status: "connecting",
        };
        setConnection(target.id, conn);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Connection timeout"));
          }, 10000);

          conn.ws.addEventListener("open", () => {
            clearTimeout(timeout);
            updateConnectionStatus(target.id, "connected");
            logConnection("connect:open", { targetId: target.id, wsUrl });
            resolve();
          });

          conn.ws.addEventListener("close", () => {
            clearTimeout(timeout);
            updateConnectionStatus(target.id, "disconnected");
            clientMap.delete(target.id);
            logConnection("connect:close", { targetId: target.id, wsUrl });
          });

          conn.ws.addEventListener("error", () => {
            clearTimeout(timeout);
            updateConnectionStatus(target.id, "error");
            logConnection("connect:error", { targetId: target.id, wsUrl });
            reject(new Error(`WebSocket error connecting to ${target.url}`));
          });
        });

        clientMap.set(target.id, client);
        logConnection("connect:ready", { targetId: target.id });
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
    logConnection("disconnect:start", { targetId });
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
        logConnection("disconnect:proxy-stopped", { targetId, wsUrl });
      } catch (e) {
        console.warn("[connection] Failed to stop proxy:", e);
      }
      targetToWsUrl.delete(targetId);
    }

    if (selectedTargetId.value === targetId) {
      selectedTargetId.value = null;
    }
    logConnection("disconnect:done", { targetId });
  }

  function setStatus(targetId: string, status: CDPConnection["status"]) {
    updateConnectionStatus(targetId, status);
  }

  function setExternalDevtoolsTarget(targetId: string | null) {
    externalDevtoolsTargetId.value = targetId;
    logConnection("external-devtools:set", { targetId });
  }

  function clearExternalDevtoolsTarget(targetId?: string) {
    if (targetId && externalDevtoolsTargetId.value && externalDevtoolsTargetId.value !== targetId) {
      return;
    }
    logConnection("external-devtools:clear", {
      previousTargetId: externalDevtoolsTargetId.value,
    });
    externalDevtoolsTargetId.value = null;
  }

  return {
    connections,
    activeConnection,
    selectedTargetId,
    externalDevtoolsTargetId,
    connect,
    getClient,
    disconnectTarget,
    setStatus,
    setExternalDevtoolsTarget,
    clearExternalDevtoolsTarget,
  };
});
