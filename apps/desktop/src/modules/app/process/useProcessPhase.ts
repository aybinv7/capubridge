import { computed, watch, type Ref } from "vue";
import { useTimestamp } from "@vueuse/core";
import type { AppPresence } from "@/lib/gates/presence";
import type { AppProcess } from "./useAppProcess";
import {
  appRunCopy,
  appRunState,
  processPhase,
  processPhaseCopy,
  processPhaseMark,
} from "./processPhase";

/**
 * The reading's phase, its words and mark, and whether the app is running. The clock that turns
 * live into stale only ticks while readings are being taken.
 */
export function useProcessPhase(process: AppProcess, presence: Readonly<Ref<AppPresence>>) {
  const clock = useTimestamp({ interval: 1000, controls: true, immediate: false });

  watch(
    () => process.isRunning.value,
    (running) => (running ? clock.resume() : clock.pause()),
    { immediate: true },
  );

  const sinceLastSampleMs = computed(() => {
    const at = process.lastSampleAt.value;
    return at === null ? null : Math.max(0, clock.timestamp.value - at);
  });
  const sampledSinceStart = computed(() => {
    const at = process.lastSampleAt.value;
    const started = process.startedAt.value;
    return process.isRunning.value && at !== null && started !== null && at >= started;
  });
  const running = computed(() => process.latest.value?.running ?? null);

  const phase = computed(() =>
    processPhase({
      error: process.error.value,
      paused: process.paused.value,
      sampledSinceStart: sampledSinceStart.value,
      running: running.value,
      sinceLastSampleMs: sinceLastSampleMs.value,
    }),
  );
  const copy = computed(() =>
    processPhaseCopy(
      phase.value,
      phase.value === "stale" ? sinceLastSampleMs.value : null,
      presence.value === "background",
    ),
  );
  const mark = computed(() => processPhaseMark(phase.value));
  const runState = computed(() => appRunState(running.value, presence.value));
  const run = computed(() => appRunCopy(runState.value));

  return { phase, copy, mark, run, runState, running };
}
