import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import type { AppPresence } from "@/lib/gates/presence";
import { useConnectionStore } from "@/stores/connection.store";
import { WEBVIEW_CALL_TIMEOUT_MS, withTimeout } from "@/shared/perf/webview/webViewSample";
import { parseRuntimeProbe, RUNTIME_PROBE_EXPRESSION } from "./runtimeProbe";

/**
 * Asks the connected page which WebView it runs in and whether a Capacitor bridge is loaded.
 * It waits while the app is in the background: Android may freeze it and the call would hang.
 */
export function useWebViewRuntime(presence: Readonly<Ref<AppPresence>>) {
  const connections = useConnectionStore();
  const targetId = computed(() => connections.activeConnection?.targetId ?? null);

  return useQuery({
    queryKey: computed(() => ["app-webview-runtime", targetId.value ?? ""]),
    queryFn: async () => {
      const id = targetId.value;
      const client = id ? connections.getClient(id) : undefined;
      if (!client) throw new Error("The WebView is not connected");
      const result = await withTimeout(
        client.send<{ result?: { value?: unknown } }>("Runtime.evaluate", {
          expression: RUNTIME_PROBE_EXPRESSION,
          returnByValue: true,
        }),
        WEBVIEW_CALL_TIMEOUT_MS,
      );
      return parseRuntimeProbe(result.result?.value);
    },
    enabled: computed(() => targetId.value !== null && presence.value !== "background"),
    staleTime: 60_000,
    retry: false,
  });
}
