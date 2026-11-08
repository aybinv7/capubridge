import { computed, onScopeDispose, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue";
import { invokeCommand } from "@/runtime/ipc/client";
import type { WirelessDiscovery } from "@/types/wireless.types";

let consumers = 0;

async function releaseDiscovery() {
  consumers = Math.max(0, consumers - 1);
  if (consumers > 0) return;
  try {
    await invokeCommand("wireless_discover_stop");
  } catch (error) {
    console.warn("Could not stop Wi-Fi discovery", error);
  }
}

/**
 * Polls the adb services visible on the network while `active` is true and the window is
 * visible. Each poll is scheduled after the previous one answers, so slow replies never pile
 * up. Discovery stops in the backend once no consumer is left.
 */
export function useWirelessDiscovery(
  intervalMs: MaybeRefOrGetter<number>,
  active: MaybeRefOrGetter<boolean> = true,
) {
  const discovery = shallowRef<WirelessDiscovery | null>(null);
  const error = shallowRef<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let holding = false;
  let disposed = false;

  const services = computed(() => discovery.value?.services ?? []);
  const status = computed(() => discovery.value?.status ?? null);

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function shouldRun() {
    return !disposed && toValue(active) && document.visibilityState === "visible";
  }

  function schedule(delay: number) {
    clearTimer();
    if (shouldRun()) timer = setTimeout(() => void poll(), delay);
  }

  async function poll() {
    if (running || !shouldRun()) return;
    running = true;
    if (!holding) {
      holding = true;
      consumers += 1;
    }
    try {
      discovery.value = await invokeCommand("wireless_discover");
      error.value = null;
    } catch (cause) {
      error.value = String(cause);
    } finally {
      running = false;
      schedule(toValue(intervalMs));
    }
  }

  function release() {
    clearTimer();
    if (!holding) return;
    holding = false;
    void releaseDiscovery();
  }

  function onVisibility() {
    if (shouldRun()) schedule(0);
    else clearTimer();
  }

  watch(
    () => toValue(active),
    (isActive) => {
      if (isActive) schedule(0);
      else release();
    },
    { immediate: true },
  );

  document.addEventListener("visibilitychange", onVisibility);

  onScopeDispose(() => {
    disposed = true;
    document.removeEventListener("visibilitychange", onVisibility);
    release();
  });

  return { discovery, services, status, error, refresh: () => schedule(0) };
}
