import { computed, onUnmounted, ref, watch } from "vue";
import type { ComputedRef, Ref } from "vue";
import type { CDPClient } from "utils";
import { useConnectionStore } from "@/stores/connection.store";

const HISTORY = 36;

type MetricStatus = "idle" | "waiting" | "active" | "degraded" | "error";

function emptyHistory(defaultValue: number) {
  return Array.from({ length: HISTORY }, () => defaultValue);
}

function push<T>(values: T[], next: T) {
  return [...values.slice(1), next];
}

function pushWithCarry(values: number[], next: number | null) {
  return push(values, next ?? values.at(-1) ?? 0);
}

function toSeries(values: number[], key: string, tick: number) {
  return values.map((value, index) => ({
    x: tick - values.length + index + 1,
    [key]: value,
  }));
}

export function useAppWebMetrics(targetId: Ref<string>, enabled: ComputedRef<boolean>) {
  const connectionStore = useConnectionStore();

  const heapUsed = ref<number[]>(emptyHistory(0));
  const heapTotal = ref<number[]>(emptyHistory(0));
  const domNodes = ref<number[]>(emptyHistory(0));
  const tickCount = ref(0);
  const lastUpdatedAt = ref<number | null>(null);
  const status = ref<MetricStatus>("idle");
  const message = ref("Waiting for selected target");
  const source = ref<"none" | "performance" | "runtime-fallback">("none");

  let timer: ReturnType<typeof setInterval> | null = null;

  function stopPolling(nextStatus: MetricStatus = "idle", nextMessage = "Stopped") {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    status.value = nextStatus;
    message.value = nextMessage;
    source.value = "none";
  }

  function resetHistory() {
    heapUsed.value = emptyHistory(0);
    heapTotal.value = emptyHistory(0);
    domNodes.value = emptyHistory(0);
    tickCount.value = 0;
    lastUpdatedAt.value = null;
  }

  async function pollClient(client: CDPClient, performanceEnabled: boolean) {
    let nextHeapUsed: number | null = null;
    let nextHeapTotal: number | null = null;
    let nextDomNodes: number | null = null;
    let usedFallback = false;

    if (performanceEnabled) {
      try {
        const response = (await client.send("Performance.getMetrics", {})) as {
          metrics: Array<{ name: string; value: number }>;
        };
        const metricsMap: Record<string, number> = {};
        for (const entry of response.metrics) {
          metricsMap[entry.name] = entry.value;
        }
        if (Number.isFinite(metricsMap["JSHeapUsedSize"])) {
          nextHeapUsed = metricsMap["JSHeapUsedSize"] / 1024 / 1024;
        }
        if (Number.isFinite(metricsMap["JSHeapTotalSize"])) {
          nextHeapTotal = metricsMap["JSHeapTotalSize"] / 1024 / 1024;
        }
        if (Number.isFinite(metricsMap["Nodes"])) {
          nextDomNodes = metricsMap["Nodes"];
        }
      } catch {}
    }

    if (nextHeapUsed === null || nextHeapTotal === null) {
      try {
        const heapUsage = (await client.send("Runtime.getHeapUsage", {})) as {
          usedSize: number;
          totalSize: number;
        };
        if (Number.isFinite(heapUsage.usedSize)) {
          nextHeapUsed = heapUsage.usedSize / 1024 / 1024;
        }
        if (Number.isFinite(heapUsage.totalSize)) {
          nextHeapTotal = heapUsage.totalSize / 1024 / 1024;
        }
        usedFallback = true;
      } catch {}
    }

    if (nextDomNodes === null) {
      try {
        const counters = (await client.send("Memory.getDOMCounters", {})) as {
          nodes: number;
        };
        if (Number.isFinite(counters.nodes)) {
          nextDomNodes = counters.nodes;
          usedFallback = true;
        }
      } catch {}
    }

    tickCount.value += 1;
    heapUsed.value = pushWithCarry(heapUsed.value, nextHeapUsed);
    heapTotal.value = pushWithCarry(heapTotal.value, nextHeapTotal);
    domNodes.value = pushWithCarry(domNodes.value, nextDomNodes);
    lastUpdatedAt.value = Date.now();

    if (nextHeapUsed === null && nextHeapTotal === null && nextDomNodes === null) {
      status.value = "degraded";
      message.value = "Connected target exposes limited WebView metrics";
      source.value = "none";
      return;
    }

    status.value = usedFallback || !performanceEnabled ? "degraded" : "active";
    message.value =
      usedFallback || !performanceEnabled
        ? "Live metrics via runtime fallback"
        : "Live metrics via performance domain";
    source.value = usedFallback || !performanceEnabled ? "runtime-fallback" : "performance";
  }

  async function startPolling() {
    if (!enabled.value || !targetId.value) {
      stopPolling("idle", "Waiting for selected app target");
      return;
    }

    const connection = connectionStore.connections.get(targetId.value);
    const client = connectionStore.getClient(targetId.value);

    if (!connection || connection.status !== "connected" || !client) {
      stopPolling("waiting", "Connect selected target to unlock WebView metrics");
      return;
    }

    stopPolling("waiting", "Preparing WebView metrics");

    let performanceEnabled = false;
    try {
      await client.send("Performance.enable", {});
      performanceEnabled = true;
    } catch {}

    try {
      await client.send("Runtime.enable", {});
    } catch {}

    timer = setInterval(() => {
      const liveConnection = connectionStore.connections.get(targetId.value);
      const liveClient = connectionStore.getClient(targetId.value);
      if (!liveConnection || liveConnection.status !== "connected" || !liveClient) {
        stopPolling("waiting", "Target disconnected");
        return;
      }

      void pollClient(liveClient, performanceEnabled).catch((error: unknown) => {
        stopPolling("error", `WebView metrics failed: ${String(error)}`);
      });
    }, 1000);

    await pollClient(client, performanceEnabled).catch((error: unknown) => {
      stopPolling("error", `WebView metrics failed: ${String(error)}`);
    });
  }

  const heapUsedSeries = computed(() => toSeries(heapUsed.value, "heapUsed", tickCount.value));
  const heapTotalSeries = computed(() => toSeries(heapTotal.value, "heapTotal", tickCount.value));
  const domNodesSeries = computed(() => toSeries(domNodes.value, "domNodes", tickCount.value));

  watch(
    [targetId, enabled, () => connectionStore.activeConnection?.targetId ?? null],
    ([nextTargetId]) => {
      resetHistory();
      if (!nextTargetId) {
        stopPolling("idle", "Waiting for selected app target");
        return;
      }
      void startPolling();
    },
    { immediate: true },
  );

  onUnmounted(() => {
    stopPolling();
  });

  return {
    status,
    message,
    source,
    lastUpdatedAt,
    heapUsedSeries,
    heapTotalSeries,
    domNodesSeries,
  };
}
