import {
  computed,
  inject,
  onScopeDispose,
  provide,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from "vue";
import { useDocumentVisibility } from "@vueuse/core";
import { useDevicesStore } from "@/stores/devices.store";
import { usePerfMetrics } from "./usePerfMetrics";

type PerfMetricsSession = ReturnType<typeof usePerfMetrics>;

export interface DeviceVitals extends Omit<PerfMetricsSession, "start" | "stop" | "reset"> {
  paused: Ref<boolean>;
  /** The monitor should be reading now: a vitals tab is open, the phone online, the window shown. */
  active: ComputedRef<boolean>;
  offline: ComputedRef<boolean>;
  pause: () => void;
  resume: () => void;
  retry: () => void;
}

const DEVICE_VITALS: InjectionKey<DeviceVitals> = Symbol("device-vitals");

/**
 * The single owner of the Device route's monitor. Every change of phone, tab, window visibility
 * or pause goes through one queue that first clears the history when the phone changed, then
 * starts or stops the lease, so two transitions never race.
 */
export function createDeviceVitals(wanted: Readonly<Ref<boolean>>): DeviceVitals {
  const perf = usePerfMetrics();
  const devices = useDevicesStore();
  const visibility = useDocumentVisibility();
  const paused = ref(false);

  const serial = computed(() => devices.selectedDevice?.serial ?? null);
  const offline = computed(
    () => serial.value !== null && devices.selectedDevice?.status !== "online",
  );
  const active = computed(
    () =>
      wanted.value &&
      !paused.value &&
      !offline.value &&
      visibility.value === "visible" &&
      serial.value !== null,
  );

  let ownedSerial: string | null = null;
  let queue: Promise<void> = Promise.resolve();

  function enqueue(step: () => Promise<void>) {
    queue = queue.then(step, step);
  }

  async function sync() {
    if (ownedSerial !== serial.value) {
      await perf.stop();
      perf.reset();
      ownedSerial = serial.value;
    }
    const target = active.value ? serial.value : null;
    if (target) await perf.start(target);
    else await perf.stop();
  }

  watch([serial, active], () => enqueue(sync), { immediate: true });
  onScopeDispose(() => enqueue(perf.stop));

  return {
    series: perf.series,
    values: perf.values,
    chargeSeries: perf.chargeSeries,
    isRunning: perf.isRunning,
    error: perf.error,
    firstSampleOverdue: perf.firstSampleOverdue,
    startedAt: perf.startedAt,
    tickCount: perf.tickCount,
    latest: perf.latest,
    lastSampleAt: perf.lastSampleAt,
    coreCount: perf.coreCount,
    perCoreLatest: perf.perCoreLatest,
    paused,
    active,
    offline,
    pause: () => {
      paused.value = true;
    },
    resume: () => {
      paused.value = false;
    },
    retry: () => {
      perf.error.value = null;
      enqueue(sync);
    },
  };
}

/** Creates the route's monitor and hands it to every tab below `DevicesPanel`. */
export function provideDeviceVitals(wanted: Readonly<Ref<boolean>>): DeviceVitals {
  const vitals = createDeviceVitals(wanted);
  provide(DEVICE_VITALS, vitals);
  return vitals;
}

/** The Device route's shared monitor; only valid under `DevicesPanel`. */
export function useDeviceVitals(): DeviceVitals {
  const vitals = inject(DEVICE_VITALS, null);
  if (!vitals) throw new Error("useDeviceVitals() needs provideDeviceVitals() in DevicesPanel");
  return vitals;
}
