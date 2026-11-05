import { isAppFile } from "../requestCells";
import type { NetworkEntry, NetworkTiming } from "@/types/network.types";

export type TimingPhaseId =
  | "queued"
  | "stalled"
  | "dns"
  | "connect"
  | "ssl"
  | "send"
  | "wait"
  | "download";

export interface TimingPhase {
  id: TimingPhaseId;
  label: string;
  start: number;
  duration: number;
}

export interface TimingBreakdown {
  phases: TimingPhase[];
  total: number;
}

const LABELS: Record<TimingPhaseId, string> = {
  queued: "Queued",
  stalled: "Stalled",
  dns: "DNS lookup",
  connect: "Initial connection",
  ssl: "SSL",
  send: "Request sent",
  wait: "Waiting for the server",
  download: "Content download",
};

function known(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function span(from: number, to: number): number {
  return known(from) && known(to) && to > from ? to - from : 0;
}

function firstKnown(...values: number[]): number {
  return values.find(known) ?? -1;
}

/**
 * Splits a request's time the way DevTools does, in milliseconds from the moment it was issued.
 * CDP timing is relative to `requestTime`, so the queue before it is added in front; the initial
 * connection is shown without its SSL share so the phases add up.
 */
export function timingBreakdown(entry: NetworkEntry): TimingBreakdown | null {
  const timing: NetworkTiming | null = entry.timing;
  if (!timing) return null;
  const queued = Math.max(0, (timing.requestTime - entry.startTimestamp) * 1000);
  const firstWork = firstKnown(timing.dnsStart, timing.connectStart, timing.sendStart);
  const ssl = span(timing.sslStart, timing.sslEnd);
  const end = entry.finishedTimestamp
    ? (entry.finishedTimestamp - timing.requestTime) * 1000
    : timing.receiveHeadersEnd;

  const raw: Array<[TimingPhaseId, number, number]> = [
    ["stalled", 0, known(firstWork) ? firstWork : 0],
    ["dns", timing.dnsStart, span(timing.dnsStart, timing.dnsEnd)],
    [
      "connect",
      timing.connectStart,
      Math.max(0, span(timing.connectStart, timing.connectEnd) - ssl),
    ],
    ["ssl", timing.sslStart, ssl],
    ["send", timing.sendStart, span(timing.sendStart, timing.sendEnd)],
    ["wait", timing.sendEnd, span(timing.sendEnd, timing.receiveHeadersEnd)],
    ["download", timing.receiveHeadersEnd, span(timing.receiveHeadersEnd, end)],
  ];

  const phases: TimingPhase[] = [];
  if (queued > 0) phases.push({ id: "queued", label: LABELS.queued, start: 0, duration: queued });
  for (const [id, start, duration] of raw) {
    if (duration > 0) phases.push({ id, label: LABELS[id], start: queued + start, duration });
  }
  const finished = entry.finishedTimestamp
    ? (entry.finishedTimestamp - entry.startTimestamp) * 1000
    : 0;
  const reach = phases.reduce((max, phase) => Math.max(max, phase.start + phase.duration), 0);
  return { phases, total: Math.max(finished, reach) };
}

/** Where a request's response came from when it was not the network. */
export function cacheSource(entry: NetworkEntry): string {
  if (entry.fromDiskCache) return "Disk cache";
  if (entry.fromServiceWorker) return "Service worker";
  if (entry.fromPrefetchCache) return "Prefetch cache";
  if (isAppFile(entry)) return "The app's own files";
  return "Network";
}
