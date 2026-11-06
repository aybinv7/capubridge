import { TIMELINE_LANES, type TimelineLane } from "@/types/timeline.types";

/** Height of the resting strip, and the band its stacked density bars live in. */
export const REST_HEIGHT = 34;
const REST_BAND_TOP = 9;
const REST_BAND_BOTTOM = 26;

/** Height of the expanded strip: four lane rows, then the time axis. */
export const EXPANDED_HEIGHT = 90;
export const LANE_TOP = 6;
export const LANE_ROW_HEIGHT = 16;
export const AXIS_TOP = LANE_TOP + LANE_ROW_HEIGHT * TIMELINE_LANES.length;

const REST_STACK_ORDER: readonly TimelineLane[] = ["logcat", "console", "network"];

/** Per-lane counts for consecutive epoch seconds, starting at `fromSecond`. */
export interface BucketWindow {
  fromSecond: number;
  counts: Readonly<Record<TimelineLane, ArrayLike<number>>>;
}

/** Maps host time onto a strip `width` px wide whose right edge is `startMs + windowMs`. */
export interface StripScale {
  startMs: number;
  windowMs: number;
  width: number;
}

/** Rectangles as `x, y, width, height` quadruples in px; only the first `count` are valid. */
export interface RectList {
  data: Float32Array;
  count: number;
}

export type LaneRects = Record<TimelineLane, RectList>;

export interface StripGeometry {
  /** Resting strip: stacked density for network, console and logcat; errors as caps on top. */
  rest: LaneRects;
  /** Expanded strip: one row of bars per lane. */
  lanes: LaneRects;
}

/** Left edge in px of the epoch second `second`. */
export function secondToX(second: number, scale: StripScale): number {
  return ((second * 1000 - scale.startMs) / scale.windowMs) * scale.width;
}

/** The epoch second under `x` px. */
export function xToSecond(x: number, scale: StripScale): number {
  return Math.floor((scale.startMs + (x / scale.width) * scale.windowMs) / 1000);
}

function createRects(capacity: number): RectList {
  return { data: new Float32Array(capacity * 4), count: 0 };
}

function createLaneRects(capacity: number): LaneRects {
  return {
    errors: createRects(capacity),
    network: createRects(capacity),
    console: createRects(capacity),
    logcat: createRects(capacity),
  };
}

/** Buffers for {@link buildStripGeometry}, sized for `seconds` buckets and reused per paint. */
export function createStripGeometry(seconds: number): StripGeometry {
  const capacity = seconds + 2;
  return { rest: createLaneRects(capacity), lanes: createLaneRects(capacity) };
}

function reset(rects: LaneRects) {
  for (const lane of TIMELINE_LANES) rects[lane].count = 0;
}

function pushRect(list: RectList, x: number, y: number, width: number, height: number) {
  const offset = list.count * 4;
  if (offset + 4 > list.data.length) return;
  list.data[offset] = x;
  list.data[offset + 1] = y;
  list.data[offset + 2] = width;
  list.data[offset + 3] = height;
  list.count += 1;
}

function bucketLength(buckets: BucketWindow): number {
  let length = 0;
  for (const lane of TIMELINE_LANES) length = Math.max(length, buckets.counts[lane].length);
  return length;
}

/** Below this many items a second never reaches full height, so a few lines stay low. */
const QUIET_PEAK = 6;
/** Bends the log scale so quiet seconds sit lower and busy ones keep their height. */
const QUIET_CURVE = 1.6;

/**
 * Log scale against the window's busiest second, bent toward the floor: a quiet second still
 * shows, but sits clearly lower than a busy one.
 */
export function scaleHeight(count: number, peak: number, height: number): number {
  if (count <= 0) return 0;
  const ratio = Math.min(1, Math.log1p(count) / Math.log1p(Math.max(peak, QUIET_PEAK)));
  return Math.max(1, height * ratio ** QUIET_CURVE);
}

/** Share of each second left empty between bars once a second is wide enough to show a gap. */
const BAR_GAP_SHARE = 0.3;

interface SlotCursor {
  pxPerSecond: number;
  gap: number;
  x: number;
  width: number;
}

/** The gap between two bars: none while a second is under 4 px, then about a third of it. */
export function barGap(pxPerSecond: number): number {
  return pxPerSecond >= 4 ? Math.max(1.5, pxPerSecond * BAR_GAP_SHARE) : 0;
}

function cursorFor(scale: StripScale): SlotCursor {
  const pxPerSecond = (1000 / scale.windowMs) * scale.width;
  return { pxPerSecond, gap: barGap(pxPerSecond), x: 0, width: 0 };
}

function placeSlot(cursor: SlotCursor, second: number, scale: StripScale): boolean {
  const left = secondToX(second, scale);
  const width = Math.max(1, cursor.pxPerSecond - cursor.gap);
  if (left + width <= 0 || left >= scale.width) return false;
  cursor.x = Math.max(0, left);
  cursor.width = Math.min(width - (cursor.x - left), scale.width - cursor.x);
  return true;
}

function restTotal(buckets: BucketWindow, index: number): number {
  const { logcat, console: consoleCounts, network } = buckets.counts;
  return (logcat[index] ?? 0) + (consoleCounts[index] ?? 0) + (network[index] ?? 0);
}

function buildRest(buckets: BucketWindow, scale: StripScale, out: LaneRects) {
  const length = bucketLength(buckets);
  const errors = buckets.counts.errors;
  const cursor = cursorFor(scale);
  const band = REST_BAND_BOTTOM - REST_BAND_TOP;
  let peak = 0;
  for (let index = 0; index < length; index += 1) peak = Math.max(peak, restTotal(buckets, index));
  for (let index = 0; index < length; index += 1) {
    const total = restTotal(buckets, index);
    const hasError = (errors[index] ?? 0) > 0;
    if (total === 0 && !hasError) continue;
    if (!placeSlot(cursor, buckets.fromSecond + index, scale)) continue;
    const stack = scaleHeight(total, peak, band);
    let bottom = REST_BAND_BOTTOM;
    for (const lane of REST_STACK_ORDER) {
      const count = buckets.counts[lane][index] ?? 0;
      if (count === 0) continue;
      const height = (stack * count) / total;
      pushRect(out[lane], cursor.x, bottom - height, cursor.width, height);
      bottom -= height;
    }
    if (hasError) pushRect(out.errors, cursor.x, bottom - 3, Math.max(2, cursor.width), 2);
  }
}

function buildLanes(buckets: BucketWindow, scale: StripScale, out: LaneRects) {
  const length = bucketLength(buckets);
  const cursor = cursorFor(scale);
  const barSpace = LANE_ROW_HEIGHT - 3;
  TIMELINE_LANES.forEach((lane, row) => {
    const counts = buckets.counts[lane];
    const list = out[lane];
    let peak = 0;
    for (let index = 0; index < length; index += 1) peak = Math.max(peak, counts[index] ?? 0);
    const rowBottom = LANE_TOP + row * LANE_ROW_HEIGHT + LANE_ROW_HEIGHT - 2;
    const isErrors = lane === "errors";
    for (let index = 0; index < length; index += 1) {
      const count = counts[index] ?? 0;
      if (count === 0 || !placeSlot(cursor, buckets.fromSecond + index, scale)) continue;
      const height = Math.max(isErrors ? 3 : 1, scaleHeight(count, peak, barSpace));
      const width = isErrors ? Math.max(2, cursor.width) : cursor.width;
      pushRect(list, cursor.x, rowBottom - height, width, height);
    }
  });
}

/**
 * Turns per-second buckets into rectangles per lane, for the resting strip (`restScale`) and
 * the expanded lanes (`laneScale`), written into the reusable `out` buffers. Pure apart from
 * `out`, and cheap enough to run on every paint.
 */
export function buildStripGeometry(
  buckets: BucketWindow,
  restScale: StripScale,
  laneScale: StripScale,
  out: StripGeometry = createStripGeometry(bucketLength(buckets)),
): StripGeometry {
  reset(out.rest);
  reset(out.lanes);
  if (restScale.width > 0) buildRest(buckets, restScale, out.rest);
  if (laneScale.width > 0) buildLanes(buckets, laneScale, out.lanes);
  return out;
}

/** A span of host time, `end` null while still open. */
export interface TimeSpan {
  start: number;
  end: number | null;
}

/** One rectangle in px. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Thin bars for recording ranges at `y`, clipped to the window; open ranges run to now. */
export function rangeRects(
  spans: readonly TimeSpan[],
  scale: StripScale,
  y: number,
  nowMs: number,
): Rect[] {
  const rects: Rect[] = [];
  const endMs = scale.startMs + scale.windowMs;
  for (const span of spans) {
    const start = Math.max(span.start, scale.startMs);
    const end = Math.min(span.end ?? nowMs, endMs);
    if (end <= start) continue;
    const x = ((start - scale.startMs) / scale.windowMs) * scale.width;
    const width = Math.max(1, ((end - start) / scale.windowMs) * scale.width);
    rects.push({ x, y, width, height: 1.5 });
  }
  return rects;
}

/** 1 px verticals for navigations and target switches, between `top` and `bottom`. */
export function hairlineRects(
  times: readonly number[],
  scale: StripScale,
  top: number,
  bottom: number,
): Rect[] {
  const rects: Rect[] = [];
  for (const t of times) {
    const x = ((t - scale.startMs) / scale.windowMs) * scale.width;
    if (x < 0 || x > scale.width) continue;
    rects.push({ x: Math.min(x, scale.width - 1), y: top, width: 1, height: bottom - top });
  }
  return rects;
}

/** How much of the strip, from its left edge, lies before `sinceMs` (evidence not kept). */
export function unkeptWidth(sinceMs: number, scale: StripScale): number {
  const x = ((sinceMs - scale.startMs) / scale.windowMs) * scale.width;
  return Math.min(scale.width, Math.max(0, x));
}
