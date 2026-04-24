import { computed, onUnmounted, watch } from "vue";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";
import { useNetworkStore } from "@/modules/network/stores/useNetworkStore";
import { NetworkDomain } from "utils";
import type { NetworkEntry, NetworkResourceType } from "@/types/network.types";

export function useNetwork() {
  const store = useNetworkStore();
  const { getClient } = useCDP();
  const targetsStore = useTargetsStore();

  const targetId = computed(() => targetsStore.selectedTarget?.id ?? "");

  let unsubscribers: Array<() => void> = [];
  let activeDomain: NetworkDomain | null = null;

  async function startCapture() {
    const client = getClient(targetId.value);
    if (!client) return;

    const domain = new NetworkDomain(client);
    activeDomain = domain;

    unsubscribers = [
      domain.onRequestWillBeSent((e) => {
        if (!store.isRecording) return;

        // Handle redirect — patch the existing entry, then add the new one
        if (e.redirectResponse) {
          store.patchEntry(e.requestId, {
            httpStatus: e.redirectResponse.status,
            statusText: e.redirectResponse.statusText,
            state: "finished",
            finishedTimestamp: e.timestamp,
          });
        }

        const entry: NetworkEntry = {
          requestId: e.requestId,
          url: e.request.url,
          method: e.request.method,
          requestHeaders: e.request.headers,
          hasPostData: !!e.request.hasPostData || !!e.request.postData,
          httpStatus: null,
          statusText: "",
          responseHeaders: {},
          mimeType: "",
          protocol: "",
          remoteAddress: "",
          startedAt: e.wallTime * 1000,
          startTimestamp: e.timestamp,
          responseTimestamp: null,
          finishedTimestamp: null,
          timing: null,
          transferSize: 0,
          state: "pending",
          resourceType: (e.type as NetworkResourceType) ?? "Other",
          fromDiskCache: false,
          fromServiceWorker: false,
          fromPrefetchCache: false,
          initiatorType: e.initiator.type,
          initiatorUrl: e.initiator.url,
          initiatorLine: e.initiator.lineNumber,
          isWebSocket: false,
          wsFrameCount: 0,
        };

        store.addEntry(entry);
      }),

      domain.onResponseReceived((e) => {
        store.patchEntry(e.requestId, {
          httpStatus: e.response.status,
          statusText: e.response.statusText,
          responseHeaders: e.response.headers,
          mimeType: e.response.mimeType,
          protocol: e.response.protocol ?? "",
          remoteAddress: e.response.remoteIPAddress
            ? `${e.response.remoteIPAddress}:${e.response.remotePort ?? ""}`
            : "",
          fromDiskCache: !!e.response.fromDiskCache,
          fromServiceWorker: !!e.response.fromServiceWorker,
          fromPrefetchCache: !!e.response.fromPrefetchCache,
          timing: e.response.timing ?? null,
          resourceType: (e.type as NetworkResourceType) ?? "Other",
          responseTimestamp: e.timestamp,
          state: e.response.fromDiskCache ? "cached" : "pending",
        });
      }),

      domain.onLoadingFinished((e) => {
        store.patchEntry(e.requestId, {
          transferSize: e.encodedDataLength,
          finishedTimestamp: e.timestamp,
          state: "finished",
        });
      }),

      domain.onLoadingFailed((e) => {
        store.patchEntry(e.requestId, {
          finishedTimestamp: e.timestamp,
          state: "failed",
          errorText: e.errorText,
          canceled: e.canceled,
          blocked: !!e.blockedReason,
        });
      }),

      domain.onRequestServedFromCache((e) => {
        store.patchEntry(e.requestId, { state: "cached" });
      }),

      domain.onWebSocketCreated((e) => {
        if (!store.isRecording) return;
        const entry: NetworkEntry = {
          requestId: e.requestId,
          url: e.url,
          method: "WS",
          requestHeaders: {},
          hasPostData: false,
          httpStatus: null,
          statusText: "",
          responseHeaders: {},
          mimeType: "",
          protocol: "websocket",
          remoteAddress: "",
          startedAt: e.timestamp * 1000,
          startTimestamp: e.timestamp,
          responseTimestamp: null,
          finishedTimestamp: null,
          timing: null,
          transferSize: 0,
          state: "pending",
          resourceType: "WebSocket",
          fromDiskCache: false,
          fromServiceWorker: false,
          fromPrefetchCache: false,
          initiatorType: e.initiator?.type ?? "other",
          initiatorUrl: e.initiator?.url,
          isWebSocket: true,
          wsFrameCount: 0,
        };
        store.addEntry(entry);
      }),

      domain.onWebSocketHandshakeResponseReceived((e) => {
        store.patchEntry(e.requestId, {
          httpStatus: e.response.status,
          statusText: e.response.statusText,
          responseHeaders: e.response.headers,
          state: "finished",
          responseTimestamp: e.timestamp,
        });
      }),

      domain.onWebSocketClosed((e) => {
        store.patchEntry(e.requestId, {
          finishedTimestamp: e.timestamp,
          state: "finished",
        });
      }),

      domain.onWebSocketFrameSent((e) => {
        const existing = store.getEntry(e.requestId);
        if (existing) store.patchEntry(e.requestId, { wsFrameCount: existing.wsFrameCount + 1 });
      }),

      domain.onWebSocketFrameReceived((e) => {
        const existing = store.getEntry(e.requestId);
        if (existing) store.patchEntry(e.requestId, { wsFrameCount: existing.wsFrameCount + 1 });
      }),
    ];

    await domain.enable({ maxPostDataSize: 65_536 });
  }

  async function stopCapture() {
    for (const unsub of unsubscribers) unsub();
    unsubscribers = [];
    if (activeDomain) {
      await activeDomain.disable().catch(() => {});
      activeDomain = null;
    }
  }

  // Auto start/stop when target changes
  watch(
    targetId,
    async (id, prevId) => {
      if (prevId) {
        await stopCapture();
        if (!store.preserveLog) store.clear();
      }
      if (id) await startCapture();
    },
    { immediate: true },
  );

  onUnmounted(() => {
    void stopCapture();
  });

  return { store, targetId, startCapture, stopCapture };
}
