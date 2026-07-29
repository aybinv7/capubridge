import { computed, onUnmounted, watch } from "vue";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";
import { useNetworkStore } from "@/modules/network/stores/useNetworkStore";
import { NetworkDomain } from "@capubridge/cdp-protocol";
import type { CDPClient } from "@capubridge/cdp-protocol";
import type { CDPTarget } from "@/types/cdp.types";
import type { NetworkEntry, NetworkResourceType } from "@/types/network.types";

const initialRetryDelay = 500;
const maximumRetryDelay = 8_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function useNetwork() {
  const store = useNetworkStore();
  const { getClient, connectToTarget, connectionStore } = useCDP();
  const targetsStore = useTargetsStore();
  const target = computed(() => {
    const selected = targetsStore.selectedTarget;
    return selected && targetsStore.cdpTargetId ? selected : null;
  });

  let unsubscribers: Array<() => void> = [];
  let activeDomain: NetworkDomain | null = null;
  let activeTargetId: string | null = null;
  let bindingTargetId: string | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = initialRetryDelay;
  let revision = 0;

  function clearRetry() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  async function clearBindings() {
    for (const unsubscribe of unsubscribers) unsubscribe();
    unsubscribers = [];
    const domain = activeDomain;
    activeDomain = null;
    activeTargetId = null;
    if (domain) {
      await domain.disable().catch((error) => {
        console.warn("Failed to disable CDP network capture", error);
      });
    }
  }

  function scheduleRetry(nextTarget: CDPTarget) {
    clearRetry();
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (targetsStore.selectedTarget?.id === nextTarget.id) {
        void startCapture(nextTarget);
      }
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, maximumRetryDelay);
  }

  function attachListeners(client: CDPClient, domain: NetworkDomain, targetId: string) {
    unsubscribers = [
      client.on("Page.frameNavigated", (payload) => {
        if (activeTargetId !== targetId || store.preserveLog) return;
        const params = isRecord(payload) ? payload : {};
        const frame = isRecord(params.frame) ? params.frame : {};
        if (!frame.parentId) {
          store.clear();
        }
      }),
      domain.onRequestWillBeSent((event) => {
        if (activeTargetId !== targetId || !store.isRecording) return;

        if (event.redirectResponse) {
          store.patchEntry(event.requestId, {
            httpStatus: event.redirectResponse.status,
            statusText: event.redirectResponse.statusText,
            state: "finished",
            finishedTimestamp: event.timestamp,
          });
        }

        const entry: NetworkEntry = {
          requestId: event.requestId,
          url: event.request.url,
          method: event.request.method,
          requestHeaders: event.request.headers,
          hasPostData: !!event.request.hasPostData || !!event.request.postData,
          httpStatus: null,
          statusText: "",
          responseHeaders: {},
          mimeType: "",
          protocol: "",
          remoteAddress: "",
          startedAt: event.wallTime * 1000,
          startTimestamp: event.timestamp,
          responseTimestamp: null,
          finishedTimestamp: null,
          timing: null,
          transferSize: 0,
          state: "pending",
          resourceType: (event.type as NetworkResourceType) ?? "Other",
          fromDiskCache: false,
          fromServiceWorker: false,
          fromPrefetchCache: false,
          initiatorType: event.initiator.type,
          initiatorUrl: event.initiator.url,
          initiatorLine: event.initiator.lineNumber,
          isWebSocket: false,
          wsFrameCount: 0,
        };

        store.addEntry(entry);
      }),
      domain.onResponseReceived((event) => {
        if (activeTargetId !== targetId) return;
        store.patchEntry(event.requestId, {
          httpStatus: event.response.status,
          statusText: event.response.statusText,
          responseHeaders: event.response.headers,
          mimeType: event.response.mimeType,
          protocol: event.response.protocol ?? "",
          remoteAddress: event.response.remoteIPAddress
            ? `${event.response.remoteIPAddress}:${event.response.remotePort ?? ""}`
            : "",
          fromDiskCache: !!event.response.fromDiskCache,
          fromServiceWorker: !!event.response.fromServiceWorker,
          fromPrefetchCache: !!event.response.fromPrefetchCache,
          timing: event.response.timing ?? null,
          resourceType: (event.type as NetworkResourceType) ?? "Other",
          responseTimestamp: event.timestamp,
          state: event.response.fromDiskCache ? "cached" : "pending",
        });
      }),
      domain.onLoadingFinished((event) => {
        if (activeTargetId !== targetId) return;
        store.patchEntry(event.requestId, {
          transferSize: event.encodedDataLength,
          finishedTimestamp: event.timestamp,
          state: "finished",
        });
      }),
      domain.onLoadingFailed((event) => {
        if (activeTargetId !== targetId) return;
        store.patchEntry(event.requestId, {
          finishedTimestamp: event.timestamp,
          state: "failed",
          errorText: event.errorText,
          canceled: event.canceled,
          blocked: !!event.blockedReason,
        });
      }),
      domain.onRequestServedFromCache((event) => {
        if (activeTargetId === targetId) {
          store.patchEntry(event.requestId, { state: "cached" });
        }
      }),
      domain.onWebSocketCreated((event) => {
        if (activeTargetId !== targetId || !store.isRecording) return;
        store.addEntry({
          requestId: event.requestId,
          url: event.url,
          method: "WS",
          requestHeaders: {},
          hasPostData: false,
          httpStatus: null,
          statusText: "",
          responseHeaders: {},
          mimeType: "",
          protocol: "websocket",
          remoteAddress: "",
          startedAt: event.timestamp * 1000,
          startTimestamp: event.timestamp,
          responseTimestamp: null,
          finishedTimestamp: null,
          timing: null,
          transferSize: 0,
          state: "pending",
          resourceType: "WebSocket",
          fromDiskCache: false,
          fromServiceWorker: false,
          fromPrefetchCache: false,
          initiatorType: event.initiator?.type ?? "other",
          initiatorUrl: event.initiator?.url,
          isWebSocket: true,
          wsFrameCount: 0,
        });
      }),
      domain.onWebSocketHandshakeResponseReceived((event) => {
        if (activeTargetId !== targetId) return;
        store.patchEntry(event.requestId, {
          httpStatus: event.response.status,
          statusText: event.response.statusText,
          responseHeaders: event.response.headers,
          state: "finished",
          responseTimestamp: event.timestamp,
        });
      }),
      domain.onWebSocketClosed((event) => {
        if (activeTargetId !== targetId) return;
        store.patchEntry(event.requestId, {
          finishedTimestamp: event.timestamp,
          state: "finished",
        });
      }),
      domain.onWebSocketFrameSent((event) => {
        if (activeTargetId !== targetId) return;
        const existing = store.getEntry(event.requestId);
        if (existing) {
          store.patchEntry(event.requestId, { wsFrameCount: existing.wsFrameCount + 1 });
        }
      }),
      domain.onWebSocketFrameReceived((event) => {
        if (activeTargetId !== targetId) return;
        const existing = store.getEntry(event.requestId);
        if (existing) {
          store.patchEntry(event.requestId, { wsFrameCount: existing.wsFrameCount + 1 });
        }
      }),
    ];
  }

  async function startCapture(nextTarget = target.value) {
    if (!nextTarget) {
      await stopCapture();
      return;
    }
    if (bindingTargetId === nextTarget.id) return;
    if (
      activeTargetId === nextTarget.id &&
      store.captureStatus === "live" &&
      getClient(nextTarget.id)
    ) {
      return;
    }

    clearRetry();
    const attempt = ++revision;
    bindingTargetId = nextTarget.id;
    store.setCaptureState("connecting", nextTarget.id);

    try {
      await clearBindings();
      const client = getClient(nextTarget.id) ?? (await connectToTarget(nextTarget));
      if (attempt !== revision || targetsStore.selectedTarget?.id !== nextTarget.id) return;

      const domain = new NetworkDomain(client);
      activeDomain = domain;
      activeTargetId = nextTarget.id;
      attachListeners(client, domain, nextTarget.id);
      const [networkEnable] = await Promise.allSettled([
        domain.enable({
          maxTotalBufferSize: 16 * 1024 * 1024,
          maxResourceBufferSize: 2 * 1024 * 1024,
          maxPostDataSize: 64 * 1024,
        }),
        client.send("Page.enable", {}),
      ]);
      if (networkEnable.status === "rejected") {
        throw networkEnable.reason;
      }

      if (attempt !== revision) return;
      retryDelay = initialRetryDelay;
      store.setCaptureState("live", nextTarget.id);
    } catch (error) {
      if (attempt !== revision) return;
      await clearBindings();
      const message = error instanceof Error ? error.message : String(error);
      store.setCaptureState("error", nextTarget.id, message);
      scheduleRetry(nextTarget);
    } finally {
      if (attempt === revision) {
        bindingTargetId = null;
      }
    }
  }

  async function stopCapture() {
    revision += 1;
    bindingTargetId = null;
    clearRetry();
    await clearBindings();
    store.setCaptureState("idle", null);
  }

  watch(
    () =>
      [
        target.value?.id ?? null,
        target.value?.webSocketDebuggerUrl ?? null,
        target.value
          ? (connectionStore.connections.get(target.value.id)?.status ?? "disconnected")
          : "disconnected",
      ] as const,
    ([targetId], previous) => {
      const previousTargetId = previous?.[0] ?? null;
      const nextTarget = target.value;
      if (targetId !== previousTargetId) {
        store.clear();
        retryDelay = initialRetryDelay;
      }
      if (nextTarget) {
        void startCapture(nextTarget);
      } else {
        void stopCapture();
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    void stopCapture();
  });

  return { store, target, startCapture, stopCapture };
}
