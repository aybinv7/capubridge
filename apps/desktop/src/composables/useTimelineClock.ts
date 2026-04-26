import { ref, computed, onUnmounted } from "vue";

const _raf: (cb: (now: number) => void) => number =
  typeof requestAnimationFrame !== "undefined"
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(Date.now()), 16) as unknown as number;

const _caf: (id: number) => void =
  typeof cancelAnimationFrame !== "undefined"
    ? (id) => cancelAnimationFrame(id)
    : (id) => clearTimeout(id);

export function useTimelineClock(initialDurationMs = 0) {
  const positionMs = ref(0);
  const durationMs = ref(initialDurationMs);
  const playing = ref(false);

  let lastTick = 0;
  let rafId: number | null = null;

  const isPlaying = computed(() => playing.value);
  const progress = computed(() => (durationMs.value > 0 ? positionMs.value / durationMs.value : 0));

  function tick(now: number) {
    if (!playing.value) return;
    if (lastTick > 0) {
      const delta = now - lastTick;
      positionMs.value = Math.min(positionMs.value + delta, durationMs.value);
      if (positionMs.value >= durationMs.value) {
        playing.value = false;
        lastTick = 0;
        rafId = null;
        return;
      }
    }
    lastTick = now;
    rafId = _raf(tick);
  }

  function play() {
    if (playing.value) return;
    if (positionMs.value >= durationMs.value) {
      positionMs.value = 0;
    }
    playing.value = true;
    lastTick = 0;
    rafId = _raf(tick);
  }

  function pause() {
    playing.value = false;
    lastTick = 0;
    if (rafId !== null) {
      _caf(rafId);
      rafId = null;
    }
  }

  function seek(ms: number) {
    positionMs.value = Math.max(0, Math.min(ms, durationMs.value));
  }

  function setDuration(ms: number) {
    durationMs.value = ms;
    if (positionMs.value > ms) positionMs.value = ms;
  }

  onUnmounted(() => {
    pause();
  });

  return { positionMs, durationMs, isPlaying, progress, play, pause, seek, setDuration };
}

export type TimelineClock = ReturnType<typeof useTimelineClock>;
