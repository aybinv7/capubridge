import {
  runSessionEffect,
  startPerfLeaseEffect,
  stopPerfLeaseEffect,
  subscribeSessionEventsEffect,
} from "@/runtime/session";
import type { CDPClient } from "@capubridge/cdp-protocol";
import type { useSessionWriter } from "./useSessionWriter";
import type { PerfCapuSample } from "@/types/replay.types";
import type { SessionEvent } from "@/types/session.types";
import type { PerfMetrics } from "@/types/perf.types";

type Writer = ReturnType<typeof useSessionWriter>;

export function usePerfRecorder(
  serial: string,
  client: CDPClient | null,
  writer: Writer,
  startedAt: number,
) {
  let latestMetrics: PerfMetrics | null = null;
  let jsHeapUsedMb: number | null = null;
  let jsHeapTotalMb: number | null = null;
  let domNodes: number | null = null;
  let cdpTimer: ReturnType<typeof setInterval> | null = null;
  let stopEvents: (() => void) | null = null;
  let performanceEnabled = false;
  let sampleCount = 0;

  function handleSessionEvent(event: SessionEvent) {
    if (event.type !== "perfMetrics" || event.serial !== serial) return;
    latestMetrics = event.metrics;
    writeSample(event.metrics.timestamp);
  }

  function writeSample(wallMs: number) {
    const m = latestMetrics;
    if (!m) return;
    sampleCount++;
    if (sampleCount <= 3 || sampleCount % 10 === 0) {
      console.log(
        `[perf-recorder] sample #${sampleCount} at +${wallMs - startedAt}ms`,
        `cpu=${m.cpuTotal.toFixed(1)}% mem=${m.memory.usedPct.toFixed(1)}%`,
        `jsHeap=${jsHeapUsedMb?.toFixed(1) ?? "?"}MB domNodes=${domNodes ?? "?"}`,
      );
    }
    const sample: PerfCapuSample = {
      cpuTotal: m.cpuTotal,
      cpuCores: m.cpuCores,
      memUsedPct: m.memory.usedPct,
      memUsedKb: m.memory.usedKb,
      memTotalKb: m.memory.totalKb,
      rxBps: m.network.rxBps,
      txBps: m.network.txBps,
      batteryLevel: m.battery.level,
      batteryCharging: m.battery.charging,
      batteryTemp: m.battery.temperature,
      cpuTemp: m.cpuTemp ?? null,
      jsHeapUsedMb,
      jsHeapTotalMb,
      domNodes,
    };
    writer.pushAt("perf", sample, wallMs);
  }

  async function startCdpPolling() {
    if (!client) return;
    try {
      await client.send("Performance.enable", {});
      performanceEnabled = true;
    } catch {
      void 0;
    }
    try {
      await client.send("Runtime.enable", {});
    } catch {
      void 0;
    }

    cdpTimer = setInterval(async () => {
      if (!client) return;
      try {
        if (performanceEnabled) {
          const res = (await client.send("Performance.getMetrics", {})) as {
            metrics: Array<{ name: string; value: number }>;
          };
          const map: Record<string, number> = {};
          for (const m of res.metrics) map[m.name] = m.value;
          if (Number.isFinite(map["JSHeapUsedSize"]))
            jsHeapUsedMb = map["JSHeapUsedSize"]! / 1024 / 1024;
          if (Number.isFinite(map["JSHeapTotalSize"]))
            jsHeapTotalMb = map["JSHeapTotalSize"]! / 1024 / 1024;
          if (Number.isFinite(map["Nodes"])) domNodes = map["Nodes"]!;
        }
      } catch {
        try {
          const heap = (await client.send("Runtime.getHeapUsage", {})) as {
            usedSize: number;
            totalSize: number;
          };
          jsHeapUsedMb = heap.usedSize / 1024 / 1024;
          jsHeapTotalMb = heap.totalSize / 1024 / 1024;
        } catch {
          void 0;
        }
        try {
          const counters = (await client.send("Memory.getDOMCounters", {})) as {
            nodes: number;
          };
          domNodes = counters.nodes;
        } catch {
          void 0;
        }
      }
    }, 1000);
  }

  async function start() {
    console.log("[perf-recorder] start — serial:", serial, "cdp:", client ? "yes" : "no");
    try {
      await runSessionEffect(startPerfLeaseEffect(serial), {
        operation: "session.startPerfLease",
      });
      console.log("[perf-recorder] perf lease started");
    } catch (e) {
      console.warn("[perf-recorder] failed to start perf lease:", e);
    }

    try {
      stopEvents = await runSessionEffect(subscribeSessionEventsEffect(handleSessionEvent), {
        operation: "session.subscribePerf",
      });
      console.log("[perf-recorder] subscribed to session events");
    } catch (e) {
      console.warn("[perf-recorder] failed to subscribe to session events:", e);
    }

    await startCdpPolling();
    console.log("[perf-recorder] ready — cdpPolling:", cdpTimer !== null);
  }

  async function stop() {
    console.log("[perf-recorder] stop — samples collected:", sampleCount);
    if (cdpTimer) {
      clearInterval(cdpTimer);
      cdpTimer = null;
    }
    stopEvents?.();
    stopEvents = null;

    writeSample(Date.now());

    try {
      await runSessionEffect(stopPerfLeaseEffect(serial), {
        operation: "session.stopPerfLease",
      });
    } catch {
      void 0;
    }

    if (client && performanceEnabled) {
      try {
        await client.send("Performance.disable", {});
      } catch {
        void 0;
      }
    }
  }

  return { start, stop };
}
