import { onScopeDispose, readonly, ref } from "vue";

const now = ref(Date.now());
let users = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function schedule() {
  timer = setTimeout(
    () => {
      now.value = Date.now();
      schedule();
    },
    60_000 - (Date.now() % 60_000) + 50,
  );
}

/**
 * The current time, moving on at each new minute, for labels like "Today at 14:05" that must
 * become "Yesterday at 14:05" without a new read. One timer serves every user and stops when
 * the last one is gone.
 */
export function useMinuteClock() {
  users += 1;
  if (users === 1) {
    now.value = Date.now();
    schedule();
  }
  onScopeDispose(() => {
    users -= 1;
    if (users === 0 && timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  });
  return readonly(now);
}
