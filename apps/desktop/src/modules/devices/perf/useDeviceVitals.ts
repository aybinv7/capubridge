import { computed, inject, provide, ref, watch, type InjectionKey, type Ref } from "vue";
import { useDocumentVisibility } from "@vueuse/core";
import { useDevicesStore } from "@/stores/devices.store";
import { usePerfMetrics } from "./usePerfMetrics";

type PerfMetricsSession = ReturnType<typeof usePerfMetrics>;

export interface DeviceVitals extends PerfMetricsSession {
  paused: Ref<boolean>;
  pause: () => void;
  resume: () => void;
  retry: () => void;
}

const DEVICE_VITALS: InjectionKey<DeviceVitals> = Symbol("device-vitals");

/**
 * Owns one device monitor for the whole Device route, so Overview and Performance share a single
 * ADB lease and one history. It reads only while `wanted` is true (a tab that shows vitals is
 * open), the device is online, the window is visible and the user has not paused it.
 */
export function provideDeviceVitals(wanted: Ref<boolean>): DeviceVitals {
  const perf = usePerfMetrics();
  const devices = useDevicesStore();
  const visibility = useDocumentVisibility();
  const paused = ref(false);

  const serial = computed(() => devices.selectedDevice?.serial ?? null);
  const online = computed(() => devices.selectedDevice?.status === "online");
  const shouldRun = computed(
    () =>
      wanted.value &&
      !paused.value &&
      online.value &&
      visibility.value === "visible" &&
      serial.value !== null,
  );

  let queue: Promise<void> = Promise.resolve();
  function enqueue(step: () => Promise<void>) {
    queue = queue.then(step, step);
  }

  watch(shouldRun, (run) => enqueue(run ? perf.start : perf.stop), { immediate: true });
  watch(serial, () => {
    if (shouldRun.value && !perf.isRunning.value) enqueue(perf.start);
  });

  const vitals: DeviceVitals = {
    ...perf,
    paused,
    pause: () => {
      paused.value = true;
    },
    resume: () => {
      paused.value = false;
    },
    retry: () => {
      if (shouldRun.value && !perf.isRunning.value) enqueue(perf.start);
    },
  };
  provide(DEVICE_VITALS, vitals);
  return vitals;
}

/** The Device route's shared monitor; only valid under `DevicesPanel`. */
export function useDeviceVitals(): DeviceVitals {
  const vitals = inject(DEVICE_VITALS, null);
  if (!vitals) throw new Error("useDeviceVitals() needs provideDeviceVitals() in DevicesPanel");
  return vitals;
}
