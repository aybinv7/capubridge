import { ref, watch, onUnmounted } from "vue";

export interface LiveRefreshOptions {
  intervalMs?: number;
  immediate?: boolean;
}

export function useLiveRefresh(
  refresh: () => void | Promise<void>,
  options: LiveRefreshOptions = {},
) {
  const intervalMs = ref(options.intervalMs ?? 5000);
  const enabled = ref(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  function stop() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();
    timer = setInterval(() => {
      void refresh();
    }, intervalMs.value);
  }

  watch([enabled, intervalMs], ([on]) => {
    if (on) start();
    else stop();
  });

  if (options.immediate) {
    enabled.value = true;
  }

  onUnmounted(stop);

  function toggle() {
    enabled.value = !enabled.value;
  }

  return { enabled, intervalMs, toggle };
}
