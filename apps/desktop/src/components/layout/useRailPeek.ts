import { onScopeDispose, ref, watch, type Ref } from "vue";

const REVEAL_DWELL_MS = 60;
const CONCEAL_DELAY_MS = 240;

/**
 * Shows the hidden navigation rail while the pointer rests on the window's left edge, and hides
 * it again once the pointer has left the rail for a moment. A short dwell keeps a pointer that only
 * sweeps past the edge from flashing it open; a drag in progress never opens it.
 */
export function useRailPeek(hidden: Readonly<Ref<boolean>>) {
  const peeking = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clear() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  function reveal(event: PointerEvent) {
    if (!hidden.value || event.buttons !== 0) return;
    clear();
    timer = setTimeout(() => {
      timer = null;
      peeking.value = true;
    }, REVEAL_DWELL_MS);
  }

  function hold() {
    clear();
  }

  function conceal() {
    clear();
    timer = setTimeout(() => {
      timer = null;
      peeking.value = false;
    }, CONCEAL_DELAY_MS);
  }

  watch(hidden, (isHidden) => {
    if (isHidden) return;
    clear();
    peeking.value = false;
  });

  onScopeDispose(clear);

  return { peeking, reveal, hold, conceal };
}
