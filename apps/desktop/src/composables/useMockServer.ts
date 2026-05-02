import { computed, onUnmounted, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";
import { useMockStore } from "@/modules/network/stores/useMockStore";
import { FetchDomain } from "utils";
import type { RequestPausedEvent } from "utils";
import type { MockLogEntry } from "@/types/mock.types";

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(bin);
}

export function useMockServer() {
  const store = useMockStore();
  const { getClient } = useCDP();
  const targetsStore = useTargetsStore();

  const targetId = computed(() => targetsStore.selectedTarget?.id ?? "");

  let fetchDomain: FetchDomain | null = null;
  let unsubPaused: (() => void) | null = null;
  let unsubHttpEvent: (() => void) | null = null;

  async function startCDP() {
    await stopCDP();
    const client = getClient(targetId.value);
    if (!client) return;

    fetchDomain = new FetchDomain(client);

    unsubPaused = fetchDomain.onRequestPaused((e) => {
      void handleIntercepted(e);
    });

    await fetchDomain.enable({
      patterns: [
        { requestStage: "Request", resourceType: "Fetch" },
        { requestStage: "Request", resourceType: "XHR" },
        { requestStage: "Request", resourceType: "Document" },
        { requestStage: "Request", resourceType: "Other" },
      ],
    });
  }

  async function stopCDP() {
    if (unsubPaused) {
      unsubPaused();
      unsubPaused = null;
    }
    if (fetchDomain) {
      await fetchDomain.disable().catch(() => {});
      fetchDomain = null;
    }
  }

  async function handleIntercepted(e: RequestPausedEvent) {
    const { method, url } = e.request;
    const matched = store.findMatchingRule(method, url);

    const logEntry: MockLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      method,
      url,
      matchedRuleId: matched?.id ?? null,
      matchedRuleName: matched?.name ?? null,
      responseStatus: matched && !matched.passThrough ? matched.statusCode : null,
      mode: "cdp",
      delayApplied: matched?.delayMs ?? 0,
      passedThrough: !matched || matched.passThrough,
      noMatch: !matched,
    };
    store.addLogEntry(logEntry);

    if (!matched || matched.passThrough) {
      await fetchDomain?.continueRequest({ requestId: e.requestId }).catch(() => {});
      return;
    }

    store.incrementHitCount(matched.id);

    if (matched.delayMs > 0) {
      await new Promise((r) => setTimeout(r, matched.delayMs));
    }

    const headers = [
      ...(matched.contentType ? [{ name: "content-type", value: matched.contentType }] : []),
      ...matched.responseHeaders.map((h) => ({ name: h.name, value: h.value })),
    ];

    await fetchDomain
      ?.fulfillRequest({
        requestId: e.requestId,
        responseCode: matched.statusCode,
        responseHeaders: headers,
        body: matched.responseBody ? toBase64(matched.responseBody) : undefined,
      })
      .catch(() => {
        void fetchDomain?.continueRequest({ requestId: e.requestId }).catch(() => {});
      });
  }

  async function startHTTP() {
    await stopHTTP();
    try {
      await invoke("mock_server_start", { port: store.httpPort });
      store.httpServerRunning = true;
      unsubHttpEvent = await listen<{
        ruleId: string;
        method: string;
        url: string;
        statusCode: number;
        timestamp: number;
      }>("mock-server-request", (event) => {
        const d = event.payload;
        const matched = store.rules.find((r) => r.id === d.ruleId) ?? null;
        store.addLogEntry({
          id: crypto.randomUUID(),
          timestamp: d.timestamp,
          method: d.method,
          url: d.url,
          matchedRuleId: matched?.id ?? null,
          matchedRuleName: matched?.name ?? null,
          responseStatus: d.statusCode,
          mode: "http",
          delayApplied: 0,
          passedThrough: false,
          noMatch: !matched,
        });
        if (matched) store.incrementHitCount(matched.id);
      });
    } catch {
      store.httpServerRunning = false;
    }
  }

  async function stopHTTP() {
    if (unsubHttpEvent) {
      unsubHttpEvent();
      unsubHttpEvent = null;
    }
    try {
      await invoke("mock_server_stop");
    } catch {
      // ignore
    }
    store.httpServerRunning = false;
  }

  async function syncHTTPRules() {
    if (!store.httpServerRunning) return;
    try {
      await invoke("mock_server_sync_rules", {
        rules: store.activeRules.map((r) => ({
          id: r.id,
          method: r.method,
          url_pattern: r.urlPattern,
          url_match_type: r.urlMatchType,
          status_code: r.statusCode,
          response_headers: r.responseHeaders.map((h) => [h.name, h.value]),
          response_body: r.responseBody,
          delay_ms: r.delayMs,
        })),
      });
    } catch {
      // ignore
    }
  }

  // React to mode changes and target changes
  watch(
    [() => store.interceptMode, targetId],
    async ([mode, id], [prevMode]) => {
      if (prevMode === "cdp" && mode !== "cdp") {
        await stopCDP();
      }
      if (prevMode === "http" && mode !== "http") {
        await stopHTTP();
      }
      if (mode === "cdp" && id) {
        await startCDP();
      }
      if (mode === "http") {
        await startHTTP();
      }
    },
    { immediate: true },
  );

  // Sync rules to HTTP server whenever active rules change
  watch(() => store.activeRules, syncHTTPRules, { deep: true });

  onUnmounted(async () => {
    await stopCDP();
    // Don't stop HTTP server on unmount — it should persist until user clicks "Off"
  });

  return { startCDP, stopCDP, startHTTP, stopHTTP };
}
