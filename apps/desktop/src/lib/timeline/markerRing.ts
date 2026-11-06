import {
  TIMELINE_LANES,
  TIMELINE_SEVERITIES,
  type TimelineLane,
  type TimelineMarker,
  type TimelineMarkerInput,
  type TimelineMarkerRef,
  type TimelineSeverity,
} from "@/types/timeline.types";

export const TIMELINE_MAX_MARKERS = 20_000;
export const TIMELINE_MAX_AGE_MS = 10 * 60 * 1000;
export const TIMELINE_LABEL_MAX = 80;

const LANE_COUNT = TIMELINE_LANES.length;
const laneIndex = new Map<TimelineLane, number>(TIMELINE_LANES.map((lane, index) => [lane, index]));
const severityIndex = new Map<TimelineSeverity, number>(
  TIMELINE_SEVERITIES.map((severity, index) => [severity, index]),
);

export interface MarkerRingOptions {
  capacity?: number;
  maxAgeMs?: number;
}

/**
 * Timeline markers in a ring of typed arrays (time, lane, severity) beside plain arrays for the
 * reference and label. It holds at most `capacity` markers and nothing older than `maxAgeMs`
 * behind the newest one. Per-lane one-second buckets are kept in step with every push and
 * eviction, so a density strip reads counts without scanning markers.
 */
export class MarkerRing {
  readonly capacity: number;
  readonly maxAgeMs: number;
  private readonly times: Float64Array;
  private readonly seqs: Float64Array;
  private readonly lanes: Uint8Array;
  private readonly severities: Uint8Array;
  private readonly refs: Array<TimelineMarkerRef | undefined>;
  private readonly labels: Array<string | undefined>;
  private readonly bucketSlots: number;
  private readonly bucketSeconds: Float64Array;
  private readonly bucketCounts: Uint32Array;
  private head = 0;
  private length = 0;
  private nextSeq = 1;
  private newest = Number.NEGATIVE_INFINITY;

  constructor(options: MarkerRingOptions = {}) {
    this.capacity = options.capacity ?? TIMELINE_MAX_MARKERS;
    this.maxAgeMs = options.maxAgeMs ?? TIMELINE_MAX_AGE_MS;
    this.times = new Float64Array(this.capacity);
    this.seqs = new Float64Array(this.capacity);
    this.lanes = new Uint8Array(this.capacity);
    this.severities = new Uint8Array(this.capacity);
    this.refs = Array.from<TimelineMarkerRef | undefined>({ length: this.capacity });
    this.labels = Array.from<string | undefined>({ length: this.capacity });
    this.bucketSlots = Math.ceil(this.maxAgeMs / 1000) + 1;
    this.bucketSeconds = new Float64Array(this.bucketSlots).fill(Number.NaN);
    this.bucketCounts = new Uint32Array(this.bucketSlots * LANE_COUNT);
  }

  get size(): number {
    return this.length;
  }

  /** Host time of the newest marker seen, or -Infinity when empty. */
  get newestTime(): number {
    return this.newest;
  }

  private slotOf(second: number): number {
    return ((second % this.bucketSlots) + this.bucketSlots) % this.bucketSlots;
  }

  private countBucket(t: number, lane: number, delta: 1 | -1) {
    const second = Math.floor(t / 1000);
    const slot = this.slotOf(second);
    if (this.bucketSeconds[slot] !== second) {
      if (delta < 0) return;
      this.bucketSeconds[slot] = second;
      this.bucketCounts.fill(0, slot * LANE_COUNT, slot * LANE_COUNT + LANE_COUNT);
    }
    const index = slot * LANE_COUNT + lane;
    const current = this.bucketCounts[index] ?? 0;
    this.bucketCounts[index] = delta > 0 ? current + 1 : Math.max(0, current - 1);
  }

  private evictOldest() {
    if (this.length === 0) return;
    const index = this.head;
    this.countBucket(this.times[index] ?? 0, this.lanes[index] ?? 0, -1);
    this.refs[index] = undefined;
    this.labels[index] = undefined;
    this.head = (this.head + 1) % this.capacity;
    this.length -= 1;
  }

  /** Drops markers older than `maxAgeMs` before `now` (default: the newest marker). */
  ageOut(now: number = this.newest): number {
    const cutoff = now - this.maxAgeMs;
    let dropped = 0;
    while (this.length > 0 && (this.times[this.head] ?? 0) < cutoff) {
      this.evictOldest();
      dropped += 1;
    }
    return dropped;
  }

  /** Adds a marker; returns false when it is already too old to keep. */
  push(input: TimelineMarkerInput): boolean {
    const lane = laneIndex.get(input.lane);
    const severity = severityIndex.get(input.severity);
    if (lane === undefined || severity === undefined || !Number.isFinite(input.t)) {
      return false;
    }
    if (input.t < Math.max(this.newest, input.t) - this.maxAgeMs) {
      return false;
    }
    if (this.length === this.capacity) {
      this.evictOldest();
    }
    const index = (this.head + this.length) % this.capacity;
    this.times[index] = input.t;
    this.seqs[index] = this.nextSeq;
    this.nextSeq += 1;
    this.lanes[index] = lane;
    this.severities[index] = severity;
    this.refs[index] = input.ref;
    this.labels[index] =
      input.label.length > TIMELINE_LABEL_MAX
        ? input.label.slice(0, TIMELINE_LABEL_MAX)
        : input.label;
    this.length += 1;
    this.countBucket(input.t, lane, 1);
    this.newest = Math.max(this.newest, input.t);
    this.ageOut();
    return true;
  }

  /** The marker at `index` (0 = oldest kept), or undefined. */
  at(index: number): TimelineMarker | undefined {
    if (index < 0 || index >= this.length) return undefined;
    const slot = (this.head + index) % this.capacity;
    const ref = this.refs[slot];
    if (!ref) return undefined;
    return {
      seq: this.seqs[slot] ?? 0,
      t: this.times[slot] ?? 0,
      lane: TIMELINE_LANES[this.lanes[slot] ?? 0] ?? "errors",
      severity: TIMELINE_SEVERITIES[this.severities[slot] ?? 0] ?? "verbose",
      ref,
      label: this.labels[slot] ?? "",
    };
  }

  /** Markers with `from <= t < to`, in arrival order, at most `limit`. */
  inRange(from: number, to: number, limit = Number.POSITIVE_INFINITY): TimelineMarker[] {
    const found: TimelineMarker[] = [];
    for (let index = 0; index < this.length && found.length < limit; index += 1) {
      const t = this.times[(this.head + index) % this.capacity] ?? 0;
      if (t >= from && t < to) {
        const marker = this.at(index);
        if (marker) found.push(marker);
      }
    }
    return found;
  }

  /** How many kept markers of `lane` fall in the epoch second `second`. */
  bucketCount(second: number, lane: TimelineLane): number {
    const laneSlot = laneIndex.get(lane);
    if (laneSlot === undefined || second < Math.floor((this.newest - this.maxAgeMs) / 1000)) {
      return 0;
    }
    const slot = this.slotOf(second);
    if (this.bucketSeconds[slot] !== second) return 0;
    return this.bucketCounts[slot * LANE_COUNT + laneSlot] ?? 0;
  }

  /** Counts of `lane` for each second in `[fromSecond, toSecond)`. */
  bucketRange(fromSecond: number, toSecond: number, lane: TimelineLane): Uint32Array {
    const counts = new Uint32Array(Math.max(0, toSecond - fromSecond));
    for (let second = fromSecond; second < toSecond; second += 1) {
      counts[second - fromSecond] = this.bucketCount(second, lane);
    }
    return counts;
  }

  clear(): void {
    this.refs.fill(undefined);
    this.labels.fill(undefined);
    this.bucketSeconds.fill(Number.NaN);
    this.bucketCounts.fill(0);
    this.head = 0;
    this.length = 0;
    this.newest = Number.NEGATIVE_INFINITY;
  }
}
