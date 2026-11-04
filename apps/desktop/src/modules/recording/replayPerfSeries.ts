import type { PerfCapuEvent, PerfCapuSample } from "@/types/replay.types";

export type SeriesPoint = Record<string, number>;

export type PerfNumericKey =
  | "cpuTotal"
  | "memUsedPct"
  | "rxBps"
  | "txBps"
  | "jsHeapUsedMb"
  | "jsHeapTotalMb"
  | "domNodes";

export interface PerfAvailability {
  cpu: boolean;
  cores: boolean;
  memory: boolean;
  network: boolean;
  battery: boolean;
  temperature: boolean;
  js: boolean;
}

export interface SeriesStats {
  now: number;
  min: number;
  max: number;
  avg: number;
}

export function upperBound(arr: PerfCapuEvent[], t: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((arr[mid]?.t ?? Infinity) <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function anySample(events: PerfCapuEvent[], predicate: (s: PerfCapuSample) => boolean): boolean {
  for (const ev of events) if (predicate(ev.data)) return true;
  return false;
}

export function detectPerfAvailability(events: PerfCapuEvent[]): PerfAvailability {
  return {
    cpu: anySample(events, (s) => s.cpuTotal != null),
    cores: anySample(events, (s) => (s.cpuCores?.length ?? 0) > 0),
    memory: anySample(events, (s) => s.memUsedPct != null),
    network: anySample(events, (s) => s.rxBps != null || s.txBps != null),
    battery: anySample(events, (s) => s.batteryLevel != null || s.batteryCharging != null),
    temperature: anySample(events, (s) => s.cpuTemp != null || s.batteryTemp != null),
    js: anySample(events, (s) => s.jsHeapUsedMb != null),
  };
}

export function buildSeries(
  events: PerfCapuEvent[],
  key: PerfNumericKey,
  outKey: string,
  scale = 1,
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let i = 0; i < events.length; i++) {
    const value = events[i]?.data[key];
    if (value == null) continue;
    out.push({ x: i, [outKey]: value * scale });
  }
  return out;
}

export function coreCountOf(events: PerfCapuEvent[]): number {
  for (const ev of events) {
    const n = ev.data.cpuCores?.length ?? 0;
    if (n > 0) return n;
  }
  return 0;
}

export function buildPerCoreSeries(events: PerfCapuEvent[]): SeriesPoint[][] {
  const n = coreCountOf(events);
  const series: SeriesPoint[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < events.length; i++) {
    const cores = events[i]?.data.cpuCores;
    if (!cores) continue;
    for (let ci = 0; ci < n; ci++) {
      const usage = cores[ci]?.usage;
      if (usage == null) continue;
      series[ci]?.push({ x: i, y: usage });
    }
  }
  return series;
}

export function toNiceAxisCeil(v: number): number {
  if (!Number.isFinite(v) || v <= 1) return 1;
  const exp = Math.floor(Math.log10(v));
  const mag = 10 ** exp;
  const n = v / mag;
  if (n <= 1) return mag;
  if (n <= 2) return 2 * mag;
  if (n <= 5) return 5 * mag;
  return 10 * mag;
}

export function makeSeriesYDomain(series: SeriesPoint[], key: string): [number, number] {
  const rawMax = series.reduce((max, p) => Math.max(max, Number(p[key] ?? 0)), 0);
  return [0, toNiceAxisCeil(rawMax > 0 ? rawMax * 1.12 : 1)];
}

export function createStats(series: SeriesPoint[], key: string): SeriesStats {
  const vals = series.map((p) => Number(p[key] ?? 0)).filter(Number.isFinite);
  if (!vals.length) return { now: 0, min: 0, max: 0, avg: 0 };
  return {
    now: vals.at(-1) ?? 0,
    min: Math.min(...vals),
    max: Math.max(...vals),
    avg: vals.reduce((s, v) => s + v, 0) / vals.length,
  };
}

export function levelColor(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  return pct >= 80 ? "text-error" : pct >= 60 ? "text-warning" : "text-success";
}

export function batteryTextColor(level: number | null): string {
  if (level == null) return "text-muted-foreground";
  return level < 20 ? "text-error" : level < 40 ? "text-warning" : "text-success";
}

export function batteryBarColor(level: number | null): string {
  if (level == null) return "bg-muted-foreground/30";
  return level < 20 ? "bg-error" : level < 40 ? "bg-warning" : "bg-success";
}

export function batteryStateLabel(charging: boolean | null): string {
  if (charging == null) return "State not recorded";
  return charging ? "Charging" : "Discharging";
}

export function fmtPct(v: number | null): string {
  return v == null ? "--%" : `${Math.round(v)}%`;
}

export function fmtBytes(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(0)} MB`;
  return `${kb} KB`;
}

export function fmtBps(kbps: number | null): string {
  if (kbps == null) return "--";
  return kbps >= 1024 ? `${(kbps / 1024).toFixed(1)} MB/s` : `${kbps.toFixed(0)} KB/s`;
}

export function fmtMb(v: number): string {
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} MB`;
}

export function fmtCount(v: number): string {
  return Math.round(v).toLocaleString();
}
