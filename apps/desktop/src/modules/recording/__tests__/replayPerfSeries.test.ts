import { describe, expect, test } from "vite-plus/test";
import type { PerfCapuEvent, PerfCapuSample } from "@/types/replay.types";
import {
  batteryBarColor,
  batteryStateLabel,
  batteryTextColor,
  buildPerCoreSeries,
  buildSeries,
  coreCountOf,
  createStats,
  detectPerfAvailability,
  fmtBps,
  fmtPct,
  levelColor,
  upperBound,
} from "../replayPerfSeries";

function adbSample(i: number): PerfCapuSample {
  return {
    cpuTotal: 10 + i,
    cpuCores: [
      { core: 0, usage: 5 + i },
      { core: 1, usage: 7 + i },
    ],
    memUsedPct: 40 + i,
    memUsedKb: 1_000_000 + i,
    memTotalKb: 4_000_000,
    rxBps: 2048 * (i + 1),
    txBps: 1024 * (i + 1),
    batteryLevel: 90 - i,
    batteryCharging: i % 2 === 0,
    batteryTemp: 30 + i,
    cpuTemp: null,
    jsHeapUsedMb: 20 + i,
    jsHeapTotalMb: 64,
    domNodes: 1000 + i,
  };
}

function webviewSample(i: number): PerfCapuSample {
  return {
    cpuTotal: null,
    cpuCores: null,
    memUsedPct: null,
    memUsedKb: null,
    memTotalKb: null,
    rxBps: null,
    txBps: null,
    batteryLevel: null,
    batteryCharging: null,
    batteryTemp: null,
    cpuTemp: null,
    jsHeapUsedMb: 12 + i,
    jsHeapTotalMb: 48,
    domNodes: 500 + i,
  };
}

function events(make: (i: number) => PerfCapuSample, n: number): PerfCapuEvent[] {
  return Array.from({ length: n }, (_, i) => ({ t: i * 1000, data: make(i) }));
}

describe("replayPerfSeries with device-side metrics", () => {
  const adb = events(adbSample, 4);

  test("reports every series as available", () => {
    expect(detectPerfAvailability(adb)).toEqual({
      cpu: true,
      cores: true,
      memory: true,
      network: true,
      battery: true,
      temperature: true,
      js: true,
    });
  });

  test("keeps one point per sample with the recorded value", () => {
    expect(buildSeries(adb, "cpuTotal", "cpu")).toEqual([
      { x: 0, cpu: 10 },
      { x: 1, cpu: 11 },
      { x: 2, cpu: 12 },
      { x: 3, cpu: 13 },
    ]);
    expect(buildSeries(adb, "rxBps", "rx", 1 / 1024)).toEqual([
      { x: 0, rx: 2 },
      { x: 1, rx: 4 },
      { x: 2, rx: 6 },
      { x: 3, rx: 8 },
    ]);
    expect(coreCountOf(adb)).toBe(2);
    expect(buildPerCoreSeries(adb)[1]).toEqual([
      { x: 0, y: 7 },
      { x: 1, y: 8 },
      { x: 2, y: 9 },
      { x: 3, y: 10 },
    ]);
  });

  test("computes stats over the recorded values", () => {
    expect(createStats(buildSeries(adb, "jsHeapUsedMb", "heapUsed"), "heapUsed")).toEqual({
      now: 23,
      min: 20,
      max: 23,
      avg: 21.5,
    });
  });
});

describe("replayPerfSeries without device-side metrics", () => {
  const webview = events(webviewSample, 3);

  test("hides device series and keeps WebView series", () => {
    expect(detectPerfAvailability(webview)).toEqual({
      cpu: false,
      cores: false,
      memory: false,
      network: false,
      battery: false,
      temperature: false,
      js: true,
    });
  });

  test("never fabricates zeros for null fields", () => {
    expect(buildSeries(webview, "cpuTotal", "cpu")).toEqual([]);
    expect(buildSeries(webview, "memUsedPct", "mem")).toEqual([]);
    expect(buildSeries(webview, "txBps", "tx", 1 / 1024)).toEqual([]);
    expect(coreCountOf(webview)).toBe(0);
    expect(buildPerCoreSeries(webview)).toEqual([]);
  });

  test("renders JS heap and DOM node series", () => {
    expect(buildSeries(webview, "jsHeapUsedMb", "heapUsed")).toEqual([
      { x: 0, heapUsed: 12 },
      { x: 1, heapUsed: 13 },
      { x: 2, heapUsed: 14 },
    ]);
    expect(buildSeries(webview, "domNodes", "domNodes")).toEqual([
      { x: 0, domNodes: 500 },
      { x: 1, domNodes: 501 },
      { x: 2, domNodes: 502 },
    ]);
  });

  test("skips only the null samples in a mixed track", () => {
    const mixed: PerfCapuEvent[] = [
      { t: 0, data: adbSample(0) },
      { t: 1000, data: webviewSample(1) },
      { t: 2000, data: adbSample(2) },
    ];
    expect(buildSeries(mixed, "cpuTotal", "cpu")).toEqual([
      { x: 0, cpu: 10 },
      { x: 2, cpu: 12 },
    ]);
    expect(detectPerfAvailability(mixed).cpu).toBe(true);
  });
});

describe("replayPerfSeries formatters", () => {
  test("battery tones treat null as absent, not full", () => {
    expect(batteryTextColor(null)).toBe("text-muted-foreground");
    expect(batteryBarColor(null)).toBe("bg-muted-foreground/30");
    expect(batteryBarColor(15)).toBe("bg-error");
    expect(batteryBarColor(35)).toBe("bg-warning");
    expect(batteryBarColor(80)).toBe("bg-success");
    expect(batteryStateLabel(null)).toBe("State not recorded");
    expect(batteryStateLabel(true)).toBe("Charging");
  });

  test("percent and throughput formatters show placeholders for null", () => {
    expect(fmtPct(null)).toBe("--%");
    expect(fmtPct(42.6)).toBe("43%");
    expect(fmtBps(null)).toBe("--");
    expect(fmtBps(2048)).toBe("2.0 MB/s");
    expect(levelColor(null)).toBe("text-muted-foreground");
    expect(levelColor(85)).toBe("text-error");
  });

  test("upperBound locates the sample count at a position", () => {
    const adb = events(adbSample, 4);
    expect(upperBound(adb, -1)).toBe(0);
    expect(upperBound(adb, 1000)).toBe(2);
    expect(upperBound(adb, 99_999)).toBe(4);
  });
});
