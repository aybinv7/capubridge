import type { NetworkEntry } from "@/types/network.types";
import { formatMs } from "./requestCells";

/** The span of time the waterfall column covers, in CDP monotonic seconds. */
export interface WaterfallRange {
  start: number;
  end: number;
}

/** One request's bar, in percent of the column: where it starts, then waiting and receiving. */
export interface WaterfallBar {
  left: number;
  waiting: number;
  receiving: number;
  open: boolean;
}

export interface WaterfallTick {
  left: number;
  label: string;
}

const MIN_SPAN_SECONDS = 0.001;
const TICK_STEPS_MS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 30_000, 60_000];

function lastMoment(entry: NetworkEntry): number {
  return entry.finishedTimestamp ?? entry.responseTimestamp ?? entry.startTimestamp;
}

/**
 * The time the waterfall shows: from the last page load among the rows (the latest Document
 * request) to the latest known moment, so a long session does not squeeze every bar into a tick.
 * Without a page load among the rows it starts at the earliest row. Null for no rows.
 */
export function waterfallRange(entries: readonly NetworkEntry[]): WaterfallRange | null {
  if (entries.length === 0) return null;
  let earliest = Infinity;
  let pageLoad = -Infinity;
  let end = -Infinity;
  for (const entry of entries) {
    if (entry.startTimestamp < earliest) earliest = entry.startTimestamp;
    if (entry.resourceType === "Document" && entry.startTimestamp > pageLoad) {
      pageLoad = entry.startTimestamp;
    }
    const last = lastMoment(entry);
    if (last > end) end = last;
  }
  const start = Number.isFinite(pageLoad) ? pageLoad : earliest;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end: Math.max(end, start + MIN_SPAN_SECONDS) };
}

function percent(seconds: number, span: number): number {
  return Math.min(100, Math.max(0, (seconds / span) * 100));
}

/**
 * Places a request on the shared time axis. Waiting runs from the start to the first byte of the
 * response; receiving from there to the end. A request still open runs to the range's end; one
 * that ended before the range began has no bar.
 */
export function waterfallBar(entry: NetworkEntry, range: WaterfallRange): WaterfallBar | null {
  const span = range.end - range.start;
  const open = entry.finishedTimestamp === null && entry.state !== "failed";
  const end = open ? range.end : lastMoment(entry);
  if (end < range.start) return null;
  const begin = Math.max(entry.startTimestamp, range.start);
  const firstByte = Math.min(Math.max(entry.responseTimestamp ?? end, begin), end);
  const left = percent(begin - range.start, span);
  const room = 100 - left;
  const waiting = Math.min(room, percent(firstByte - begin, span));
  const receiving = Math.min(room - waiting, percent(end - firstByte, span));
  return { left, waiting, receiving, open };
}

/** Three to five labelled moments along the axis, on round steps. */
export function waterfallTicks(range: WaterfallRange): WaterfallTick[] {
  const spanMs = (range.end - range.start) * 1000;
  const step = TICK_STEPS_MS.find((candidate) => spanMs / candidate <= 4) ?? 60_000;
  const ticks: WaterfallTick[] = [];
  for (let at = step; at < spanMs * 0.9; at += step) {
    ticks.push({ left: (at / spanMs) * 100, label: formatMs(at) });
  }
  return ticks;
}
