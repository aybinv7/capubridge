import { ref, computed } from "vue";
import { defineStore } from "pinia";
import type { CDPTarget, CDPConnection } from "@/types/cdp.types";
import { CDPClient } from "@capubridge/cdp-protocol";
import { invokeCommand } from "@/runtime/ipc/client";

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

  async function stopProxy(targetId: string, failureMessage: string) {
    const wsUrl = targetToWsUrl.get(targetId);
    if (!wsUrl) return;
    try {
      await invokeCommand("cdp_stop_proxy", { wsUrl });
      logConnection("proxy:stopped", { targetId, wsUrl });
    } catch (error) {
      console.warn(`[connection] ${failureMessage}:`, error);
    } finally {
      targetToWsUrl.delete(targetId);
    }
  }

  async function connect(target: CDPTarget): Promise<CDPClient> {
    if (target.source === "local" && !target.webSocketDebuggerUrl) {
      throw new Error(
        "Local target has no CDP endpoint yet. Wait for WebView2 debug discovery to complete.",
      );
    }
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
        if (!target.webSocketDebuggerUrl) {
          throw new Error("Target does not expose a CDP WebSocket URL.");
        }

        let wsUrl = target.webSocketDebuggerUrl;
        if (target.source === "adb") {
          const proxy = await invokeCommand("cdp_start_proxy", {
            wsUrl: target.webSocketDebuggerUrl,
          });
          targetToWsUrl.set(target.id, target.webSocketDebuggerUrl);
          wsUrl = proxy.wsUrl;
          logConnection("connect:proxy-started", {
            targetId: target.id,
            proxyPort: proxy.localPort,
          });
        }

        let client: CDPClient;
        try {
          client = new CDPClient(wsUrl);
        } catch (error) {
          await stopProxy(target.id, "Failed to stop proxy after client creation failure");
          throw error;
        }

        const conn: CDPConnection = {
          targetId: target.id,
          ws: client.ws,
          status: "connecting",
        };
        setConnection(target.id, conn);
        clientMap.set(target.id, client);
        conn.ws.addEventListener("close", () => {
          updateConnectionStatus(target.id, "disconnected");
          if (clientMap.get(target.id) === client) clientMap.delete(target.id);
          logConnection("connect:close", { targetId: target.id, wsUrl });
        });
        conn.ws.addEventListener("error", () => {
          updateConnectionStatus(target.id, "error");
          logConnection("connect:error", { targetId: target.id, wsUrl });
        });

        try {
          let openTimeoutId: ReturnType<typeof setTimeout> | undefined;
          const openTimeout = new Promise<never>((_, reject) => {
            openTimeoutId = setTimeout(() => reject(new Error("Connection timeout")), 10_000);
          });
          try {
            await Promise.race([client.waitForOpen(), openTimeout]);
          } finally {
            if (openTimeoutId !== undefined) clearTimeout(openTimeoutId);
          }
        } catch (error) {
          client.close();
          if (clientMap.get(target.id) === client) clientMap.delete(target.id);
          updateConnectionStatus(target.id, "error");
          await stopProxy(target.id, "Failed to stop proxy after connection failure");
          throw error;
        }

        updateConnectionStatus(target.id, "connected");
        logConnection("connect:open", { targetId: target.id, wsUrl });
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
    const client = clientMap.get(targetId);
    client?.close();
    clientMap.delete(targetId);
    const conn = connections.value.get(targetId);
    if (conn) {
      if (!client) conn.ws.close();
      connections.value.delete(targetId);
    }

    await stopProxy(targetId, "Failed to stop proxy");

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
