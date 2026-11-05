import { computed } from "vue";
import { useTimestamp } from "@vueuse/core";
import type { DeviceVitals } from "./useDeviceVitals";
import { hasPerfReadings, perfPhase, perfPhaseCopy } from "./perfView";

/** The monitor's phase, its words, and whether there is anything to chart. Ticks once a second. */
export function usePerfPhase(vitals: DeviceVitals) {
  const now = useTimestamp({ interval: 1000 });

  const lastSampleAt = computed(() => vitals.latest.value?.timestamp ?? null);
  const sinceLastSampleMs = computed(() =>
    lastSampleAt.value === null ? null : Math.max(0, now.value - lastSampleAt.value),
  );
  const phase = computed(() =>
    perfPhase({
      error: vitals.error.value,
      paused: vitals.paused.value,
      isRunning: vitals.isRunning.value,
      tickCount: vitals.tickCount.value,
      firstSampleOverdue: vitals.firstSampleOverdue.value,
      sinceLastSampleMs: sinceLastSampleMs.value,
    }),
  );
  const staleSeconds = computed(() =>
    phase.value === "stale" ? Math.round((sinceLastSampleMs.value ?? 0) / 1000) : 0,
  );
  const copy = computed(() => perfPhaseCopy(phase.value, staleSeconds.value * 1000));
  const hasReadings = computed(() =>
    hasPerfReadings(vitals.tickCount.value, vitals.cdpLastUpdatedAt.value),
  );

  return { phase, copy, lastSampleAt, hasReadings };
}
