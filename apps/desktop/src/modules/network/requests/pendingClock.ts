import { onScopeDispose, shallowRef } from "vue";

const now = shallowRef(Date.now());
let users = 0;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * One clock, ticking once a second, shared by every open request on screen; it stops when the
 * last one leaves, so a list with nothing pending costs nothing.
 */
export function usePendingClock() {
  users += 1;
  if (!timer) {
    now.value = Date.now();
    timer = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  }
  onScopeDispose(() => {
    users -= 1;
    if (users === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  });
  return now;
}
