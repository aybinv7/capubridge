import { computed, ref, watch } from "vue";
import { acceptHMRUpdate, defineStore } from "pinia";
import { useTargetsStore } from "@/stores/targets.store";
import { invokeCommand } from "@/runtime/ipc/client";
import {
  INITIAL_PRESENCE,
  nextPresence,
  portFromWebSocketUrl,
  type PresenceState,
} from "@/lib/gates/presence";

const PROBE_INTERVAL_MS = 2500;

interface ProbeSubject {
  key: string;
  targetId: string;
  port: number;
}

/**
 * Polls the selected ADB target's forwarded DevTools port so the UI can tell
 * "app in background" and "target gone" apart from a healthy connection.
 * One request at a time, paused while Capubridge itself is hidden.
 */
export const useTargetPresenceStore = defineStore("target-presence", () => {
  const targetsStore = useTargetsStore();
  const state = ref<PresenceState>(INITIAL_PRESENCE);
  const checkedAt = ref<number | null>(null);

  const subject = computed<ProbeSubject | null>(() => {
    const target = targetsStore.selectedTarget;
    if (!target || target.source !== "adb") return null;
    const port = portFromWebSocketUrl(target.webSocketDebuggerUrl);
    if (port === null) return null;
    return { key: `${target.id}@${port}`, targetId: target.id, port };
  });

  const presence = computed(() => (subject.value ? state.value.presence : "unknown"));

  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;
  let inFlight = false;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function pageHidden() {
    return typeof document !== "undefined" && document.visibilityState === "hidden";
  }

  function schedule(delay = PROBE_INTERVAL_MS) {
    clearTimer();
    if (!subject.value || pageHidden()) return;
    timer = setTimeout(() => void probe(), delay);
  }

  async function probe() {
    const current = subject.value;
    if (!current || inFlight) return;
    const ticket = generation;
    inFlight = true;
    try {
      const result = await invokeCommand("cdp_probe_target", {
        port: current.port,
        targetId: current.targetId,
      });
      if (ticket !== generation) return;
      state.value = nextPresence(state.value, result);
      checkedAt.value = Date.now();
    } catch (error) {
      if (ticket === generation) console.warn("Target presence probe failed", error);
    } finally {
      inFlight = false;
      if (ticket === generation) schedule();
    }
  }

  function probeNow() {
    clearTimer();
    void probe();
  }

  watch(
    () => subject.value?.key ?? null,
    () => {
      generation += 1;
      inFlight = false;
      state.value = INITIAL_PRESENCE;
      checkedAt.value = null;
      clearTimer();
      if (subject.value) void probe();
    },
    { immediate: true },
  );

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (pageHidden()) clearTimer();
      else probeNow();
    });
  }

  return { presence, checkedAt, probeNow };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTargetPresenceStore, import.meta.hot));
}
