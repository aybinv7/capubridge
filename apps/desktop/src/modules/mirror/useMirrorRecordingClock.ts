import { onScopeDispose, ref, watch, type Ref } from "vue";

/** `mm:ss`, or `h:mm:ss` past an hour. */
export function formatTimecode(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes % 60).padStart(2, "0")}:${ss}`;
  return `${String(minutes).padStart(2, "0")}:${ss}`;
}

/** Counts up from the moment `recording` turns true; ticks once a second only while recording. */
export function useMirrorRecordingClock(recording: Ref<boolean>) {
  const timecode = ref(formatTimecode(0));
  let startedAt = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  function stop() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  watch(
    recording,
    (isRecording) => {
      stop();
      timecode.value = formatTimecode(0);
      if (!isRecording) return;
      startedAt = Date.now();
      timer = setInterval(() => {
        timecode.value = formatTimecode(Date.now() - startedAt);
      }, 1000);
    },
    { immediate: true },
  );

  onScopeDispose(stop);

  return { timecode };
}
