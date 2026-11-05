import type { NetworkEntry } from "@/types/network.types";

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

const MIN_SPAN_SECONDS = 0.001;
const MIN_WIDTH_PERCENT = 0.4;

function lastMoment(entry: NetworkEntry): number {
  return entry.finishedTimestamp ?? entry.responseTimestamp ?? entry.startTimestamp;
}

/** The earliest start and latest known moment across the rows, or null for no rows. */
export function waterfallRange(entries: readonly NetworkEntry[]): WaterfallRange | null {
  if (entries.length === 0) return null;
  let start = Infinity;
  let end = -Infinity;
  for (const entry of entries) {
    if (entry.startTimestamp < start) start = entry.startTimestamp;
    const last = lastMoment(entry);
    if (last > end) end = last;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end: Math.max(end, start + MIN_SPAN_SECONDS) };
}

function percent(seconds: number, span: number): number {
  return Math.min(100, Math.max(0, (seconds / span) * 100));
}

/**
 * Places a request on the shared time axis. Waiting runs from the start to the first byte of the
 * response; receiving from there to the end. A request still open runs to the range's end.
 */
export function waterfallBar(entry: NetworkEntry, range: WaterfallRange): WaterfallBar {
  const span = range.end - range.start;
  const open = entry.finishedTimestamp === null && entry.state !== "failed";
  const end = open ? range.end : lastMoment(entry);
  const firstByte = Math.min(entry.responseTimestamp ?? end, end);
  const left = percent(entry.startTimestamp - range.start, span);
  const room = 100 - left;
  const waiting = Math.min(room, percent(firstByte - entry.startTimestamp, span));
  const receiving = Math.min(room - waiting, percent(end - firstByte, span));
  if (waiting + receiving < MIN_WIDTH_PERCENT) {
    return {
      left: Math.min(left, 100 - MIN_WIDTH_PERCENT),
      waiting: 0,
      receiving: MIN_WIDTH_PERCENT,
      open,
    };
  }
  return { left, waiting, receiving, open };
}
