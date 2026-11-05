import { computed, watch, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import type { AppPresence } from "@/lib/gates/presence";
import { PERFORMANCE_CALL_TIMEOUT_MS } from "@/shared/perf/webview/performanceDomain";
import { useConnectionStore } from "@/stores/connection.store";
import { useTargetsStore } from "@/stores/targets.store";
import { parseRuntimeProbe, RUNTIME_PROBE_EXPRESSION } from "./runtimeProbe";

/**
 * Asks the selected page which WebView it runs in and whether a Capacitor bridge is loaded. The
 * answer is kept per page address, read again when the app comes back to the foreground (it may
 * have loaded another bundle), and never asked while the app is in the background: Android may
 * freeze it and the call would only time out.
 */
export function useWebViewRuntime(presence: Readonly<Ref<AppPresence>>) {
  const connections = useConnectionStore();
  const targets = useTargetsStore();
  const target = computed(() => {
    const selected = targets.selectedTarget;
    if (!selected) return null;
    return connections.connections.get(selected.id)?.status === "connected" ? selected : null;
  });

  const query = useQuery({
    queryKey: computed(() => [
      "app-webview-runtime",
      target.value?.id ?? "",
      target.value?.url ?? "",
    ]),
    queryFn: async () => {
      const id = target.value?.id;
      const client = id ? connections.getClient(id) : undefined;
      if (!client) throw new Error("The WebView is not connected");
      const result = await client.send<{ result?: { value?: unknown } }>(
        "Runtime.evaluate",
        { expression: RUNTIME_PROBE_EXPRESSION, returnByValue: true },
        undefined,
        { timeoutMs: PERFORMANCE_CALL_TIMEOUT_MS },
      );
      return parseRuntimeProbe(result.result?.value);
    },
    enabled: computed(() => target.value !== null && presence.value !== "background"),
    staleTime: 60_000,
    retry: false,
  });

  watch(presence, (now, before) => {
    if (before === "background" && now !== "background" && target.value) void query.refetch();
  });

  return query;
}
