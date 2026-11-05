import { computed, watch } from "vue";
import { useTimestamp } from "@vueuse/core";
import type { DeviceVitals } from "./useDeviceVitals";
import { perfPhase, perfPhaseCopy, sampledSince } from "./perfView";

/**
 * The monitor's phase and its words. The clock that turns live into stale only ticks while the
 * monitor is running; otherwise nothing on screen depends on the time.
 */
export function usePerfPhase(vitals: DeviceVitals) {
  const clock = useTimestamp({ interval: 1000, controls: true, immediate: false });

  watch(
    () => vitals.isRunning.value && vitals.active.value,
    (running) => {
      if (running) clock.resume();
      else clock.pause();
    },
    { immediate: true },
  );

  const sinceLastSampleMs = computed(() => {
    const at = vitals.lastSampleAt.value;
    return at === null ? null : Math.max(0, clock.timestamp.value - at);
  });
  const phase = computed(() =>
    perfPhase({
      error: vitals.error.value,
      paused: vitals.paused.value,
      offline: vitals.offline.value,
      active: vitals.active.value,
      isRunning: vitals.isRunning.value,
      firstSampleOverdue: vitals.firstSampleOverdue.value,
      sampledSinceStart: sampledSince(vitals.lastSampleAt.value, vitals.startedAt.value),
      sinceLastSampleMs: sinceLastSampleMs.value,
    }),
  );
  const copy = computed(() =>
    perfPhaseCopy(phase.value, phase.value === "stale" ? sinceLastSampleMs.value : null),
  );

  return { phase, copy, lastSampleAt: vitals.lastSampleAt };
}
