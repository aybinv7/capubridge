import { computed, onUnmounted, watch } from "vue";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";
import { useMockStore } from "@/modules/network/stores/useMockStore";
import { earlierScopeFor, mockScopeKey } from "@/modules/network/stores/mockScope";
import { useMockCdpEngine } from "./useMockCdpEngine";
import { useMockHttpEngine } from "./useMockHttpEngine";

/**
 * Keeps mock interception in step with the selected app and its mode: rules follow the app,
 * the WebView engine runs while that app's DevTools link is up, the local server until it is
 * turned off (it outlives the screen).
 */
export function useMockServer() {
  const store = useMockStore();
  const { getClient, connectionStore } = useCDP();
  const targetsStore = useTargetsStore();
  const cdp = useMockCdpEngine();
  const http = useMockHttpEngine();

  const targetId = computed(() => targetsStore.cdpTargetId);
  const scope = computed(() => {
    const target = targetsStore.selectedTarget;
    return {
      key: mockScopeKey(target),
      earlier: target ? earlierScopeFor(target) : null,
    };
  });
  const connectionStatus = computed(() => {
    if (!targetId.value) return "disconnected";
    return connectionStore.connections.get(targetId.value)?.status ?? "disconnected";
  });

  let modeTransition = Promise.resolve();

  watch(
    () => scope.value.key,
    () => store.setScope(scope.value.key, scope.value.earlier),
    { immediate: true },
  );

  async function startCDP() {
    const client = getClient(targetId.value);
    if (!client) {
      await cdp.stop();
      return;
    }
    await cdp.start(client);
  }

  watch(
    [() => store.interceptMode, targetId, connectionStatus],
    ([mode, id, status], [previousMode, previousTargetId, previousStatus]) => {
      modeTransition = modeTransition
        .catch((error: unknown) => {
          console.error("Previous mock mode transition failed", error);
        })
        .then(async () => {
          const modeChanged = mode !== previousMode;
          const targetChanged = id !== previousTargetId;
          const connected = status === "connected";

          if (previousMode === "cdp" && (mode !== "cdp" || targetChanged || !connected)) {
            await cdp.stop();
          }
          if (previousMode === "http" && mode !== "http") await http.stop();
          if (
            mode === "cdp" &&
            id &&
            connected &&
            (modeChanged || targetChanged || previousStatus !== "connected")
          ) {
            await startCDP();
          }
          if (mode === "http" && modeChanged) await http.start();
        });
    },
    { immediate: true },
  );

  watch(
    () => store.activeRules,
    (rules) => void http.sync(rules),
  );

  onUnmounted(() => {
    void cdp.stop();
  });

  return { startCDP, stopCDP: cdp.stop, startHTTP: http.start, stopHTTP: http.stop };
}
