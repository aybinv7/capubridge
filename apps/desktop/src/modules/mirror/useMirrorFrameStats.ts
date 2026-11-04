import { onScopeDispose, shallowRef, watch, type Ref } from "vue";
import { EMPTY_FRAME_READING, type FrameReading } from "./mirrorFrameClock";

const POLL_MS = 500;

/**
 * Samples the frame clock twice a second while `active`, so the frame rate and frame age stay
 * current without making every decoded frame reactive. Stops sampling, and reads empty, when idle.
 */
export function useMirrorFrameStats(read: () => FrameReading, active: Ref<boolean>) {
  const frames = shallowRef<FrameReading>(EMPTY_FRAME_READING);
  let timer: ReturnType<typeof setInterval> | null = null;

  function sample() {
    const next = read();
    const current = frames.value;
    if (
      next.fps !== current.fps ||
      next.lastFrameAt !== current.lastFrameAt ||
      Math.floor((next.ageMs ?? -1) / 1000) !== Math.floor((current.ageMs ?? -1) / 1000)
    ) {
      frames.value = next;
    }
  }

  function stop() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  watch(
    active,
    (isActive) => {
      stop();
      if (!isActive) {
        frames.value = EMPTY_FRAME_READING;
        return;
      }
      sample();
      timer = setInterval(sample, POLL_MS);
    },
    { immediate: true },
  );

  onScopeDispose(stop);

  return { frames };
}
