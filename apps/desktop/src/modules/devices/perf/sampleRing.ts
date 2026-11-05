import type { SeriesPoint } from "./perfSeries";

/** Two samples further apart than this many periods are drawn with a gap between them. */
const GAP_PERIODS = 2.5;

/**
 * A fixed-size history of timed samples with any number of named channels. Pushing never
 * allocates once a channel exists: values live in typed arrays and `NaN` marks a missing sample.
 * It is plain data, so the owner bumps a version ref to tell Vue something changed.
 */
export class SampleRing {
  readonly capacity: number;
  private readonly periodMs: number;
  private readonly times: Float64Array;
  private readonly channels = new Map<string, Float64Array>();
  private head = 0;
  private count = 0;

  constructor(capacity: number, periodMs: number) {
    this.capacity = Math.max(1, Math.floor(capacity));
    this.periodMs = periodMs;
    this.times = new Float64Array(this.capacity);
  }

  get size(): number {
    return this.count;
  }

  /** Time of the newest sample, or `null` when empty. */
  get latestTime(): number | null {
    return this.count ? (this.times[this.slot(this.count - 1)] ?? null) : null;
  }

  /** Appends one sample; channels missing from `values`, or non-finite values, become gaps. */
  push(time: number, values: Readonly<Record<string, number | null | undefined>>): void {
    for (const key of Object.keys(values)) this.channel(key);
    const slot = this.head;
    this.times[slot] = time;
    for (const [key, data] of this.channels) {
      const value = values[key];
      data[slot] = typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
    }
    this.head = (this.head + 1) % this.capacity;
    this.count = Math.min(this.capacity, this.count + 1);
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
    this.channels.clear();
  }

  /** Values of one channel, oldest first, `null` for gaps. */
  values(key: string): Array<number | null> {
    const data = this.channels.get(key);
    const out: Array<number | null> = [];
    for (let index = 0; index < this.count; index += 1) {
      const value = data ? data[this.slot(index)] : Number.NaN;
      out.push(value !== undefined && Number.isFinite(value) ? value : null);
    }
    return out;
  }

  /**
   * Chart points of one channel, oldest first, with `x` the sample time in milliseconds. A pause
   * longer than a few periods adds an empty point so the chart shows the gap instead of a ramp.
   */
  series(key: string): SeriesPoint[] {
    const data = this.channels.get(key);
    const points: SeriesPoint[] = [];
    let previous: number | null = null;
    for (let index = 0; index < this.count; index += 1) {
      const slot = this.slot(index);
      const time = this.times[slot] ?? 0;
      if (previous !== null && time - previous > this.periodMs * GAP_PERIODS) {
        points.push({ x: previous + this.periodMs, [key]: null } as SeriesPoint);
      }
      const value = data ? data[slot] : Number.NaN;
      points.push({
        x: time,
        [key]: value !== undefined && Number.isFinite(value) ? value : null,
      } as SeriesPoint);
      previous = time;
    }
    return points;
  }

  private channel(key: string): Float64Array {
    let data = this.channels.get(key);
    if (!data) {
      data = new Float64Array(this.capacity).fill(Number.NaN);
      this.channels.set(key, data);
    }
    return data;
  }

  private slot(index: number): number {
    return (this.head - this.count + index + this.capacity) % this.capacity;
  }
}
