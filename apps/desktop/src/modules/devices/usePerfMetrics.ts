import { ref, computed, onUnmounted } from "vue";
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
  gpuUsage: number | null;
  timestamp: number;
}

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
  const gpuHistory = ref<number[]>(emptyHistory(0));
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

  let unlisten: UnlistenFn | null = null;
  let unlistenError: UnlistenFn | null = null;
  let unlistenStopped: UnlistenFn | null = null;
  let cdpTimer: ReturnType<typeof setInterval> | null = null;

  function push<T>(arr: T[], val: T): T[] {
    return [...arr.slice(1), val];
  }

  function onMetrics(metrics: PerfMetrics) {
    tickCount.value++;
    latest.value = metrics;
    error.value = null;

    console.log("[perf] tick", tickCount.value, {
      cpu: metrics.cpuTotal.toFixed(1),
      cores: metrics.cpuCores.length,
      memPct: metrics.memory.usedPct.toFixed(1),
      battery: metrics.battery.level,
      temp: metrics.cpuTemp,
      gpu: metrics.gpuUsage,
    });

    cpuTotalHistory.value = push(cpuTotalHistory.value, metrics.cpuTotal);
    memHistory.value = push(memHistory.value, metrics.memory.usedPct);
    rxHistory.value = push(rxHistory.value, metrics.network.rxBps / 1024);
    txHistory.value = push(txHistory.value, metrics.network.txBps / 1024);
    gpuHistory.value = push(gpuHistory.value, metrics.gpuUsage ?? 0);
    batteryHistory.value = push(batteryHistory.value, metrics.battery.level);

    const cores = metrics.cpuCores;
    if (cores.length !== coreCount.value) {
      console.log("[perf] detected", cores.length, "CPU cores");
      coreCount.value = cores.length;
      perCoreHistory.value = Array.from({ length: cores.length }, () => emptyHistory(0));
    }
    perCoreLatest.value = cores;
    perCoreHistory.value = perCoreHistory.value.map((hist, i) => push(hist, cores[i]?.usage ?? 0));
  }

  async function startCdpMetrics() {
    if (cdpTimer) clearInterval(cdpTimer);
    const conn = connectionStore.activeConnection;
    if (!conn || conn.status !== "connected") {
      console.log("[perf] no active CDP connection, skipping WebView metrics");
      return;
    }
    const client = connectionStore.getClient(conn.targetId);
    if (!client) return;

    try {
      await client.send("Performance.enable", {});
      console.log("[perf] CDP Performance domain enabled");
    } catch (e) {
      console.warn("[perf] could not enable CDP Performance domain:", e);
      return;
    }

    cdpTimer = setInterval(async () => {
      try {
        const res = (await client.send("Performance.getMetrics", {})) as {
          metrics: Array<{ name: string; value: number }>;
        };
        const map: Record<string, number> = {};
        for (const m of res.metrics) map[m.name] = m.value;
        jsHeapUsed.value = push(jsHeapUsed.value, (map["JSHeapUsedSize"] ?? 0) / 1024 / 1024);
        jsHeapTotal.value = push(jsHeapTotal.value, (map["JSHeapTotalSize"] ?? 0) / 1024 / 1024);
        domNodes.value = push(domNodes.value, map["Nodes"] ?? 0);
      } catch (e) {
        console.warn("[perf] CDP poll error, stopping:", e);
        if (cdpTimer) clearInterval(cdpTimer);
        cdpTimer = null;
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

    console.log("[perf] starting for device:", serial);
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
      console.log("[perf] stopped event for:", e.payload);
      isRunning.value = false;
    });

    try {
      await invoke("adb_perf_start", { serial });
      console.log("[perf] invoke adb_perf_start OK");
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

    if (cdpTimer) clearInterval(cdpTimer);
    cdpTimer = null;
  }

  onUnmounted(() => void stop());

  function toSeries(history: number[]): Array<{ x: number; y: number }> {
    return history.map((y, x) => ({ x, y }));
  }

  const cpuSeries = computed(() => toSeries(cpuTotalHistory.value));
  const memSeries = computed(() => toSeries(memHistory.value));
  const rxSeries = computed(() => toSeries(rxHistory.value));
  const txSeries = computed(() => toSeries(txHistory.value));
  const gpuSeries = computed(() => toSeries(gpuHistory.value));
  const batterySeries = computed(() => toSeries(batteryHistory.value));
  const heapUsedSeries = computed(() => toSeries(jsHeapUsed.value));
  const heapTotalSeries = computed(() => toSeries(jsHeapTotal.value));
  const domNodesSeries = computed(() => toSeries(domNodes.value));
  const perCoreSeries = computed(() => perCoreHistory.value.map((hist) => toSeries(hist)));

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
    gpuSeries,
    batterySeries,
    heapUsedSeries,
    heapTotalSeries,
    domNodesSeries,
    perCoreSeries,
    perCoreHistory,
  };
}
