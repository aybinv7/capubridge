import { ref, computed, onUnmounted, watch } from "vue";
import {
  runSessionEffect,
  startPerfLeaseEffect,
  stopPerfLeaseEffect,
  subscribeSessionEventsEffect,
} from "@/runtime/session";
import { useDevicesStore } from "@/stores/devices.store";
import { useConnectionStore } from "@/stores/connection.store";
import type { CpuCoreMetric, PerfMetrics } from "@/types/perf.types";
import type { SessionEvent } from "@/types/session.types";
import { emptyHistory, pushSample, toSeries, type MetricHistory } from "./perfSeries";

export type CdpMetricsStatus = "idle" | "waiting" | "active" | "degraded" | "error";

/** How long a running monitor may go without its first device sample before the UI says so. */
const FIRST_SAMPLE_DEADLINE_MS = 6000;

export function usePerfMetrics() {
  const devicesStore = useDevicesStore();
  const connectionStore = useConnectionStore();

  const cpuTotalHistory = ref<MetricHistory>(emptyHistory());
  const memHistory = ref<MetricHistory>(emptyHistory());
  const rxHistory = ref<MetricHistory>(emptyHistory());
  const txHistory = ref<MetricHistory>(emptyHistory());
  const batteryHistory = ref<MetricHistory>(emptyHistory());

  // Live snapshot
  const latest = ref<PerfMetrics | null>(null);
  const isRunning = ref(false);
  const error = ref<string | null>(null);
  const tickCount = ref(0);
  const coreCount = ref(0);
  const perCoreLatest = ref<CpuCoreMetric[]>([]);
  const perCoreHistory = ref<MetricHistory[]>([]);
  const firstSampleOverdue = ref(false);

  const jsHeapUsed = ref<MetricHistory>(emptyHistory());
  const domNodes = ref<MetricHistory>(emptyHistory());
  const jsHeapTotal = ref<MetricHistory>(emptyHistory());
  const cdpMetricsStatus = ref<CdpMetricsStatus>("idle");
  const cdpMetricsMessage = ref("Not started");
  const cdpMetricsSource = ref<"none" | "performance" | "runtime-fallback">("none");
  const cdpLastUpdatedAt = ref<number | null>(null);
  const cdpTargetId = ref<string | null>(null);

  let currentSerial: string | null = null;
  let initializePromise: Promise<void> | null = null;
  let stopSessionEvents: (() => void) | null = null;
  let cdpTimer: ReturnType<typeof setInterval> | null = null;
  let firstSampleTimer: ReturnType<typeof setTimeout> | null = null;

  function clearFirstSampleDeadline() {
    if (firstSampleTimer) {
      clearTimeout(firstSampleTimer);
      firstSampleTimer = null;
    }
    firstSampleOverdue.value = false;
  }

  function armFirstSampleDeadline() {
    clearFirstSampleDeadline();
    if (tickCount.value > 0) return;
    firstSampleTimer = setTimeout(() => {
      firstSampleTimer = null;
      if (tickCount.value === 0 && isRunning.value) firstSampleOverdue.value = true;
    }, FIRST_SAMPLE_DEADLINE_MS);
  }

  function stopCdpMetricsPolling() {
    if (cdpTimer) {
      clearInterval(cdpTimer);
      cdpTimer = null;
    }
  }

  function resetCdpMetricsState(message = "Stopped") {
    stopCdpMetricsPolling();
    cdpMetricsStatus.value = "idle";
    cdpMetricsMessage.value = message;
    cdpMetricsSource.value = "none";
    cdpTargetId.value = null;
  }

  function onMetrics(metrics: PerfMetrics) {
    tickCount.value++;
    latest.value = metrics;
    error.value = null;
    clearFirstSampleDeadline();

    cpuTotalHistory.value = pushSample(cpuTotalHistory.value, metrics.cpuTotal);
    memHistory.value = pushSample(memHistory.value, metrics.memory.usedPct);
    rxHistory.value = pushSample(rxHistory.value, metrics.network.rxBps / 1024);
    txHistory.value = pushSample(txHistory.value, metrics.network.txBps / 1024);
    batteryHistory.value = pushSample(batteryHistory.value, metrics.battery.level);

    const cores = metrics.cpuCores;
    if (cores.length !== coreCount.value) {
      coreCount.value = cores.length;
      perCoreHistory.value = Array.from({ length: cores.length }, () => emptyHistory());
    }
    perCoreLatest.value = cores;
    perCoreHistory.value = perCoreHistory.value.map((hist, i) => pushSample(hist, cores[i]?.usage));
  }

  function handleSessionEvent(event: SessionEvent) {
    if (event.type === "perfMetrics") {
      if (event.serial !== currentSerial) {
        return;
      }

      onMetrics(event.metrics);
      return;
    }

    if (event.type === "perfError") {
      if (event.serial !== currentSerial) {
        return;
      }

      error.value = event.message;
      currentSerial = null;
      isRunning.value = false;
      clearFirstSampleDeadline();
      return;
    }

    if (event.type === "leaseStateChanged") {
      if (event.lease.kind !== "perf") {
        return;
      }

      if (event.lease.serial !== currentSerial) {
        return;
      }

      if (!event.lease.active) {
        currentSerial = null;
      }

      isRunning.value = event.lease.active;
    }
  }

  async function initialize() {
    if (initializePromise) {
      return initializePromise;
    }

    initializePromise = (async () => {
      if (stopSessionEvents) {
        return;
      }

      stopSessionEvents = await runSessionEffect(subscribeSessionEventsEffect(handleSessionEvent), {
        operation: "session.subscribePerf",
      });
    })().finally(() => {
      initializePromise = null;
    });

    return initializePromise;
  }

  async function startCdpMetrics() {
    stopCdpMetricsPolling();
    const conn = connectionStore.activeConnection;
    if (!conn || conn.status !== "connected") {
      cdpMetricsStatus.value = "waiting";
      cdpMetricsMessage.value = "Waiting for a connected WebView target";
      cdpMetricsSource.value = "none";
      cdpTargetId.value = null;
      return;
    }

    const client = connectionStore.getClient(conn.targetId);
    if (!client) {
      cdpMetricsStatus.value = "waiting";
      cdpMetricsMessage.value = "Connected target has no active CDP client";
      cdpMetricsSource.value = "none";
      cdpTargetId.value = conn.targetId;
      return;
    }

    cdpTargetId.value = conn.targetId;
    cdpMetricsStatus.value = "waiting";
    cdpMetricsMessage.value = "Enabling CDP performance stream…";

    let performanceEnabled = false;
    try {
      await client.send("Performance.enable", {});
      performanceEnabled = true;
    } catch (e) {
      console.warn("[perf] Performance domain unavailable, using fallbacks:", e);
    }

    try {
      await client.send("Runtime.enable", {});
    } catch (e) {
      console.warn("[perf] Runtime domain enable failed:", e);
    }

    cdpTimer = setInterval(async () => {
      try {
        const activeTargetId = connectionStore.activeConnection?.targetId ?? null;
        if (activeTargetId !== conn.targetId) {
          stopCdpMetricsPolling();
          cdpMetricsStatus.value = "waiting";
          cdpMetricsMessage.value = "WebView target changed, reconnecting…";
          cdpMetricsSource.value = "none";
          return;
        }

        let heapUsedMb: number | null = null;
        let heapTotalMb: number | null = null;
        let nodes: number | null = null;
        let usedFallback = false;

        if (performanceEnabled) {
          try {
            const res = (await client.send("Performance.getMetrics", {})) as {
              metrics: Array<{ name: string; value: number }>;
            };
            const map: Record<string, number> = {};
            for (const m of res.metrics) {
              map[m.name] = m.value;
            }
            if (Number.isFinite(map["JSHeapUsedSize"])) {
              heapUsedMb = map["JSHeapUsedSize"] / 1024 / 1024;
            }
            if (Number.isFinite(map["JSHeapTotalSize"])) {
              heapTotalMb = map["JSHeapTotalSize"] / 1024 / 1024;
            }
            if (Number.isFinite(map["Nodes"])) {
              nodes = map["Nodes"];
            }
          } catch (e) {
            console.warn("[perf] Performance.getMetrics failed:", e);
          }
        }

        if (heapUsedMb === null || heapTotalMb === null) {
          try {
            const heap = (await client.send("Runtime.getHeapUsage", {})) as {
              usedSize: number;
              totalSize: number;
            };
            if (Number.isFinite(heap.usedSize)) {
              heapUsedMb = heap.usedSize / 1024 / 1024;
            }
            if (Number.isFinite(heap.totalSize)) {
              heapTotalMb = heap.totalSize / 1024 / 1024;
            }
            usedFallback = true;
          } catch (e) {
            console.warn("[perf] Runtime.getHeapUsage fallback failed:", e);
          }
        }

        if (nodes === null) {
          try {
            const counters = (await client.send("Memory.getDOMCounters", {})) as {
              documents: number;
              nodes: number;
              jsEventListeners: number;
            };
            if (Number.isFinite(counters.nodes)) {
              nodes = counters.nodes;
              usedFallback = true;
            }
          } catch (e) {
            console.warn("[perf] Memory.getDOMCounters fallback failed:", e);
          }
        }

        const hasFreshSample = heapUsedMb !== null || heapTotalMb !== null || nodes !== null;

        jsHeapUsed.value = pushSample(jsHeapUsed.value, heapUsedMb);
        jsHeapTotal.value = pushSample(jsHeapTotal.value, heapTotalMb);
        domNodes.value = pushSample(domNodes.value, nodes);

        cdpLastUpdatedAt.value = Date.now();
        if (!hasFreshSample) {
          cdpMetricsStatus.value = "degraded";
          cdpMetricsMessage.value = "Connected, but this target exposes limited metrics";
          cdpMetricsSource.value = "none";
          return;
        }

        cdpMetricsStatus.value = usedFallback || !performanceEnabled ? "degraded" : "active";
        cdpMetricsMessage.value =
          usedFallback || !performanceEnabled
            ? "Live metrics (runtime/memory fallback)"
            : "Live metrics (performance domain)";
        cdpMetricsSource.value =
          usedFallback || !performanceEnabled ? "runtime-fallback" : "performance";
      } catch (e) {
        console.warn("[perf] CDP poll error, stopping:", e);
        stopCdpMetricsPolling();
        cdpMetricsStatus.value = "error";
        cdpMetricsMessage.value = `CDP stream failed: ${String(e)}`;
        cdpMetricsSource.value = "none";
      }
    }, 1000);
  }

  async function start() {
    await initialize();
    if (isRunning.value) return;
    const serial = devicesStore.selectedDevice?.serial;
    if (!serial) {
      console.warn("[perf] no selected device, cannot start");
      error.value = "No device selected";
      return;
    }

    error.value = null;
    currentSerial = serial;

    try {
      await runSessionEffect(startPerfLeaseEffect(serial), {
        operation: "session.startPerfLease",
      });
      isRunning.value = true;
    } catch (e) {
      console.error("[perf] start lease failed:", e);
      error.value = String(e);
      currentSerial = null;
      isRunning.value = false;
      return;
    }

    void startCdpMetrics();
  }

  async function stop() {
    const serial = currentSerial;
    if (!serial) {
      isRunning.value = false;
      resetCdpMetricsState();
      return;
    }

    isRunning.value = false;
    currentSerial = null;

    try {
      await runSessionEffect(stopPerfLeaseEffect(serial), {
        operation: "session.stopPerfLease",
      });
    } catch (e) {
      console.warn("[perf] stop lease error:", e);
    }

    resetCdpMetricsState();
  }

  watch(
    () => isRunning.value,
    (running) => {
      if (running) {
        armFirstSampleDeadline();
        void startCdpMetrics();
        return;
      }
      clearFirstSampleDeadline();
      resetCdpMetricsState();
    },
  );

  watch(
    () => connectionStore.activeConnection?.targetId ?? null,
    () => {
      if (!isRunning.value) {
        return;
      }
      void startCdpMetrics();
    },
  );

  watch(
    () => devicesStore.selectedDevice?.serial ?? null,
    (nextSerial, previousSerial) => {
      if (!isRunning.value) {
        return;
      }

      if (nextSerial === previousSerial) {
        return;
      }

      void (async () => {
        if (previousSerial) {
          try {
            await runSessionEffect(stopPerfLeaseEffect(previousSerial), {
              operation: "session.stopPerfLease",
            });
          } catch (e) {
            console.warn("[perf] stop previous lease error:", e);
          }
        }

        if (!nextSerial) {
          currentSerial = null;
          isRunning.value = false;
          return;
        }

        currentSerial = nextSerial;
        error.value = null;

        try {
          await runSessionEffect(startPerfLeaseEffect(nextSerial), {
            operation: "session.startPerfLease",
          });
          isRunning.value = true;
          void startCdpMetrics();
        } catch (e) {
          console.error("[perf] restart lease failed:", e);
          error.value = String(e);
          currentSerial = null;
          isRunning.value = false;
        }
      })();
    },
  );

  onUnmounted(() => {
    clearFirstSampleDeadline();
    void stop();
    stopSessionEvents?.();
    stopSessionEvents = null;
  });

  const cpuSeries = computed(() => toSeries(cpuTotalHistory.value, "cpu", tickCount.value));
  const memSeries = computed(() => toSeries(memHistory.value, "mem", tickCount.value));
  const rxSeries = computed(() => toSeries(rxHistory.value, "rx", tickCount.value));
  const txSeries = computed(() => toSeries(txHistory.value, "tx", tickCount.value));
  const batterySeries = computed(() => toSeries(batteryHistory.value, "battery", tickCount.value));
  const heapUsedSeries = computed(() => toSeries(jsHeapUsed.value, "heapUsed", tickCount.value));
  const heapTotalSeries = computed(() => toSeries(jsHeapTotal.value, "heapTotal", tickCount.value));
  const domNodesSeries = computed(() => toSeries(domNodes.value, "domNodes", tickCount.value));
  const perCoreSeries = computed(() =>
    perCoreHistory.value.map((hist) => toSeries(hist, "y", tickCount.value)),
  );

  return {
    start,
    stop,
    isRunning,
    error,
    firstSampleOverdue,
    tickCount,
    latest,
    coreCount,
    perCoreLatest,
    cpuSeries,
    memSeries,
    rxSeries,
    txSeries,
    batterySeries,
    heapUsedSeries,
    heapTotalSeries,
    domNodesSeries,
    cdpMetricsStatus,
    cdpMetricsMessage,
    cdpMetricsSource,
    cdpLastUpdatedAt,
    cdpTargetId,
    perCoreSeries,
    perCoreHistory,
  };
}
