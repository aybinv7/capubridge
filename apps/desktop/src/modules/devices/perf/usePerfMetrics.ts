import { computed, ref, shallowRef } from "vue";
import {
  runSessionEffect,
  startPerfLeaseEffect,
  stopPerfLeaseEffect,
  subscribeSessionEventsEffect,
} from "@/runtime/session";
import type { PerfMetrics } from "@/types/perf.types";
import type { SessionEvent } from "@/types/session.types";
import type { SeriesPoint } from "./perfSeries";
import { SampleRing } from "./sampleRing";

/** The name this monitor holds the device's perf lease under, beside a recording's. */
export const DEVICE_VITALS_HOLDER = "device-vitals";

const SAMPLE_PERIOD_MS = 1000;
const HISTORY_SAMPLES = 60;
const CHARGE_PERIOD_MS = 30_000;
const CHARGE_SAMPLES = 120;
/** How long a running monitor may go without its first device sample before the UI says so. */
const FIRST_SAMPLE_DEADLINE_MS = 6000;

/** Channel name of core `index` in the history. */
export function coreChannel(index: number): string {
  return `core${index}`;
}

function channelsOf(metrics: PerfMetrics): Record<string, number | null> {
  const channels: Record<string, number | null> = {
    cpu: metrics.cpuTotal,
    mem: metrics.memory.usedPct,
    rx: metrics.network.rxBps / 1024,
    tx: metrics.network.txBps / 1024,
    battery: metrics.battery.level,
  };
  for (const core of metrics.cpuCores) channels[coreChannel(core.core)] = core.usage;
  return channels;
}

/**
 * The device side of the monitor: one ADB perf lease, the event stream while it runs, and a
 * minute of history in a ring buffer. The caller decides when it runs (`start` / `stop`) and
 * clears it with `reset` when the phone changes.
 */
export function usePerfMetrics() {
  const history = new SampleRing(HISTORY_SAMPLES, SAMPLE_PERIOD_MS);
  const charge = new SampleRing(CHARGE_SAMPLES, CHARGE_PERIOD_MS);
  const version = shallowRef(0);

  const latest = shallowRef<PerfMetrics | null>(null);
  const isRunning = ref(false);
  const error = ref<string | null>(null);
  const tickCount = ref(0);
  const coreCount = ref(0);
  const firstSampleOverdue = ref(false);
  const startedAt = ref<number | null>(null);

  let currentSerial: string | null = null;
  let stopEvents: (() => void) | null = null;
  let subscription: Promise<void> | null = null;
  let firstSampleTimer: ReturnType<typeof setTimeout> | null = null;

  function clearFirstSampleDeadline() {
    if (firstSampleTimer) clearTimeout(firstSampleTimer);
    firstSampleTimer = null;
    firstSampleOverdue.value = false;
  }

  function armFirstSampleDeadline() {
    clearFirstSampleDeadline();
    firstSampleTimer = setTimeout(() => {
      firstSampleTimer = null;
      if (isRunning.value) firstSampleOverdue.value = true;
    }, FIRST_SAMPLE_DEADLINE_MS);
  }

  function onMetrics(metrics: PerfMetrics) {
    tickCount.value += 1;
    latest.value = metrics;
    error.value = null;
    clearFirstSampleDeadline();
    history.push(metrics.timestamp, channelsOf(metrics));
    const level = metrics.battery.level;
    const lastCharge = charge.latestTime;
    if (
      level !== null &&
      (lastCharge === null || metrics.timestamp - lastCharge >= CHARGE_PERIOD_MS)
    )
      charge.push(metrics.timestamp, { battery: level });
    coreCount.value = metrics.cpuCores.length;
    version.value += 1;
  }

  function markStopped() {
    currentSerial = null;
    isRunning.value = false;
    startedAt.value = null;
    clearFirstSampleDeadline();
  }

  function handleSessionEvent(event: SessionEvent) {
    if (event.type === "perfMetrics") {
      if (event.serial === currentSerial) onMetrics(event.metrics);
      return;
    }
    if (event.type === "perfError") {
      if (event.serial !== currentSerial) return;
      error.value = event.message;
      markStopped();
      return;
    }
    if (event.type === "leaseStateChanged") {
      const lease = event.lease;
      if (lease.kind !== "perf" || lease.serial !== currentSerial || lease.active) return;
      markStopped();
    }
  }

  async function subscribe() {
    if (stopEvents) return;
    subscription ??= runSessionEffect(subscribeSessionEventsEffect(handleSessionEvent), {
      operation: "session.subscribePerf",
    })
      .then((unsubscribe) => {
        stopEvents = unsubscribe;
      })
      .finally(() => {
        subscription = null;
      });
    await subscription;
  }

  function unsubscribe() {
    stopEvents?.();
    stopEvents = null;
  }

  /** Takes the perf lease for `serial` and listens to its readings. Does nothing if already on it. */
  async function start(serial: string) {
    if (isRunning.value && currentSerial === serial) return;
    error.value = null;
    currentSerial = serial;
    startedAt.value = Date.now();
    try {
      await subscribe();
      await runSessionEffect(startPerfLeaseEffect(serial, DEVICE_VITALS_HOLDER), {
        operation: "session.startPerfLease",
      });
      if (currentSerial !== serial) {
        await releaseLease(serial);
        return;
      }
      isRunning.value = true;
      armFirstSampleDeadline();
    } catch (err) {
      if (currentSerial !== serial) return;
      error.value = String(err);
      markStopped();
      unsubscribe();
    }
  }

  async function releaseLease(serial: string) {
    try {
      await runSessionEffect(stopPerfLeaseEffect(serial, DEVICE_VITALS_HOLDER), {
        operation: "session.stopPerfLease",
      });
    } catch (err) {
      console.warn("[perf] stop lease error:", err);
    }
  }

  /** Gives the lease back and stops listening. Other holders, such as a recording, keep theirs. */
  async function stop() {
    const serial = currentSerial;
    markStopped();
    unsubscribe();
    if (serial) await releaseLease(serial);
  }

  /** Forgets every reading, for a different phone. */
  function reset() {
    history.clear();
    charge.clear();
    latest.value = null;
    tickCount.value = 0;
    coreCount.value = 0;
    error.value = null;
    clearFirstSampleDeadline();
    version.value += 1;
  }

  /** Chart points of one channel. Reads the history version, so a computed around it updates. */
  function series(channel: string): SeriesPoint[] {
    void version.value;
    return history.series(channel);
  }

  /** Values of one channel for sparklines, gaps as `null`. */
  function values(channel: string): Array<number | null> {
    void version.value;
    return history.values(channel);
  }

  /** Battery level about every 30 s, for the last hour, as chart points. */
  function chargeSeries(): SeriesPoint[] {
    void version.value;
    return charge.series("battery");
  }

  const lastSampleAt = computed(() => latest.value?.timestamp ?? null);
  const perCoreLatest = computed(() => latest.value?.cpuCores ?? []);

  return {
    start,
    stop,
    reset,
    series,
    values,
    chargeSeries,
    isRunning,
    error,
    firstSampleOverdue,
    startedAt,
    tickCount,
    latest,
    lastSampleAt,
    coreCount,
    perCoreLatest,
  };
}
