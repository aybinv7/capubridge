import { onScopeDispose, shallowRef, watch, type Ref } from "vue";
import { useDocumentVisibility } from "@vueuse/core";

/** The strip never paints more often than this. */
export const MIN_TICK_MS = 100;
const MAX_TICK_MS = 500;

/** How often a window `windowMs` wide drawn `width` px wide moves by a pixel, within 0.1–0.5 s. */
export function tickInterval(windowMs: number, width: number): number {
  if (width <= 0) return MAX_TICK_MS;
  return Math.min(MAX_TICK_MS, Math.max(MIN_TICK_MS, windowMs / width));
}

/**
 * Host time, moved on at most 10 times a second while `active` and the window is visible, and
 * not at all while hidden or minimised. One self-scheduling timeout, so ticks never pile up.
 */
export function useStripTicker(active: Ref<boolean>, intervalMs: Ref<number>) {
  const now = shallowRef(Date.now());
  const visibility = useDocumentVisibility();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function stop() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function schedule() {
    timer = setTimeout(
      () => {
        now.value = Date.now();
        schedule();
      },
      Math.max(MIN_TICK_MS, intervalMs.value),
    );
  }

  watch(
    [active, visibility],
    ([on, shown]) => {
      stop();
      if (!on || shown === "hidden") return;
      now.value = Date.now();
      schedule();
    },
    { immediate: true },
  );

  onScopeDispose(stop);

  return now;
}
