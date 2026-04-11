import { ref, computed, onUnmounted, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useDevicesStore } from "@/stores/devices.store";
import { useConnectionStore } from "@/stores/connection.store";

const HISTORY = 60;

export interface CpuCoreMetric {
  core: number;
  usage: number;
}

export interface PerfMetrics {
  cpuCores: CpuCoreMetric[];
  cpuTotal: number;
  memory: {
    totalKb: number;
    availableKb: number;
    usedKb: number;
    usedPct: number;
  };
  network: { rxBps: number; txBps: number };
  battery: { level: number; temperature: number; charging: boolean };
  cpuTemp: number | null;
  cpuTempSource?: string | null;
  timestamp: number;
}

export type CdpMetricsStatus = "idle" | "waiting" | "active" | "degraded" | "error";

function emptyHistory<T>(defaultVal: T): T[] {
  return Array.from({ length: HISTORY }, () => defaultVal);
}

export function usePerfMetrics() {
  const devicesStore = useDevicesStore();
  const connectionStore = useConnectionStore();

  // Rolling buffers
  const cpuTotalHistory = ref<number[]>(emptyHistory(0));
  const memHistory = ref<number[]>(emptyHistory(0));
  const rxHistory = ref<number[]>(emptyHistory(0));
  const txHistory = ref<number[]>(emptyHistory(0));
  const batteryHistory = ref<number[]>(emptyHistory(0));

  // Live snapshot
  const latest = ref<PerfMetrics | null>(null);
  const isRunning = ref(false);
  const error = ref<string | null>(null);
  const tickCount = ref(0);
  const coreCount = ref(0);
  const perCoreLatest = ref<CpuCoreMetric[]>([]);
  const perCoreHistory = ref<number[][]>([]);

  // CDP WebView metrics
  const jsHeapUsed = ref<number[]>(emptyHistory(0));
  const domNodes = ref<number[]>(emptyHistory(0));
  const jsHeapTotal = ref<number[]>(emptyHistory(0));
  const cdpMetricsStatus = ref<CdpMetricsStatus>("idle");
  const cdpMetricsMessage = ref("Not started");
  const cdpMetricsSource = ref<"none" | "performance" | "runtime-fallback">("none");
  const cdpLastUpdatedAt = ref<number | null>(null);
  const cdpTargetId = ref<string | null>(null);

  let unlisten: UnlistenFn | null = null;
  let unlistenError: UnlistenFn | null = null;
  let unlistenStopped: UnlistenFn | null = null;
  let cdpTimer: ReturnType<typeof setInterval> | null = null;

  function push<T>(arr: T[], val: T): T[] {
    return [...arr.slice(1), val];
  }

  function pushWithCarry(arr: number[], next: number | null): number[] {
    const fallback = arr.at(-1) ?? 0;
    return push(arr, next ?? fallback);
  }

  function stopCdpMetricsPolling() {
    if (cdpTimer) {
      clearInterval(cdpTimer);
      cdpTimer = null;
    }
  }

  function onMetrics(metrics: PerfMetrics) {
    tickCount.value++;
    latest.value = metrics;
    error.value = null;

    cpuTotalHistory.value = push(cpuTotalHistory.value, metrics.cpuTotal);
    memHistory.value = push(memHistory.value, metrics.memory.usedPct);
    rxHistory.value = push(rxHistory.value, metrics.network.rxBps / 1024);
    txHistory.value = push(txHistory.value, metrics.network.txBps / 1024);
    batteryHistory.value = push(batteryHistory.value, metrics.battery.level);

    const cores = metrics.cpuCores;
    if (cores.length !== coreCount.value) {
      coreCount.value = cores.length;
      perCoreHistory.value = Array.from({ length: cores.length }, () => emptyHistory(0));
    }
    perCoreLatest.value = cores;
    perCoreHistory.value = perCoreHistory.value.map((hist, i) => push(hist, cores[i]?.usage ?? 0));
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

        jsHeapUsed.value = pushWithCarry(jsHeapUsed.value, heapUsedMb);
        jsHeapTotal.value = pushWithCarry(jsHeapTotal.value, heapTotalMb);
        domNodes.value = pushWithCarry(domNodes.value, nodes);

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
    if (isRunning.value) return;
    const serial = devicesStore.selectedDevice?.serial;
    if (!serial) {
      console.warn("[perf] no selected device, cannot start");
      error.value = "No device selected";
      return;
    }

    error.value = null;
    isRunning.value = true;

    unlisten = await listen<PerfMetrics>("perf:metrics", (e) => {
      onMetrics(e.payload);
    });

    unlistenError = await listen<string>("perf:error", (e) => {
      console.error("[perf] device error event:", e.payload);
      error.value = e.payload;
      isRunning.value = false;
    });

    unlistenStopped = await listen<string>("perf:stopped", (e) => {
      isRunning.value = false;
    });

    try {
      await invoke("adb_perf_start", { serial });
    } catch (e) {
      console.error("[perf] invoke adb_perf_start FAILED:", e);
      error.value = String(e);
      isRunning.value = false;
      unlisten?.();
      unlisten = null;
      unlistenError?.();
      unlistenError = null;
      unlistenStopped?.();
      unlistenStopped = null;
      return;
    }

    void startCdpMetrics();
  }

  async function stop() {
    if (!isRunning.value) return;
    isRunning.value = false;

    const serial = devicesStore.selectedDevice?.serial;
    if (serial) {
      await invoke("adb_perf_stop", { serial }).catch((e) => console.warn("[perf] stop error:", e));
    }

    unlisten?.();
    unlisten = null;
    unlistenError?.();
    unlistenError = null;
    unlistenStopped?.();
    unlistenStopped = null;

    stopCdpMetricsPolling();
    cdpMetricsStatus.value = "idle";
    cdpMetricsMessage.value = "Stopped";
    cdpMetricsSource.value = "none";
    cdpTargetId.value = null;
  }

  watch(
    () => isRunning.value,
    (running) => {
      if (running) {
        void startCdpMetrics();
        return;
      }
      stopCdpMetricsPolling();
      cdpMetricsStatus.value = "idle";
      cdpMetricsMessage.value = "Stopped";
      cdpMetricsSource.value = "none";
      cdpTargetId.value = null;
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

  onUnmounted(() => void stop());

  function toSeries(
    history: number[],
    key: string,
    latestTick: number,
  ): Array<Record<string, number>> {
    const xStart = latestTick - history.length + 1;
    return history.map((value, i) => ({ x: xStart + i, [key]: value }));
  }

  function toLegacySeries(history: number[], latestTick: number): Array<{ x: number; y: number }> {
    const xStart = latestTick - history.length + 1;
    return history.map((y, i) => ({ x: xStart + i, y }));
  }

  const cpuSeries = computed(() => toSeries(cpuTotalHistory.value, "cpu", tickCount.value));
  const memSeries = computed(() => toSeries(memHistory.value, "mem", tickCount.value));
  const rxSeries = computed(() => toSeries(rxHistory.value, "rx", tickCount.value));
  const txSeries = computed(() => toSeries(txHistory.value, "tx", tickCount.value));
  const batterySeries = computed(() => toSeries(batteryHistory.value, "battery", tickCount.value));
  const heapUsedSeries = computed(() => toSeries(jsHeapUsed.value, "heapUsed", tickCount.value));
  const heapTotalSeries = computed(() => toSeries(jsHeapTotal.value, "heapTotal", tickCount.value));
  const domNodesSeries = computed(() => toSeries(domNodes.value, "domNodes", tickCount.value));
  const perCoreSeries = computed(() =>
    perCoreHistory.value.map((hist) => toLegacySeries(hist, tickCount.value)),
  );

  return {
    start,
    stop,
    isRunning,
    error,
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
