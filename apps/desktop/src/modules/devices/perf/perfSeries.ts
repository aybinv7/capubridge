export type SeriesPoint = { x: number } & Record<string, number | null>;

export interface SeriesStats {
  now: number;
  min: number;
  max: number;
  avg: number;
}

function sampledValues(series: readonly SeriesPoint[], key: string): number[] {
  return series
    .map((point) => point[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

/** Now / min / max / average over real samples only, or `null` when there are none. */
export function seriesStats(series: readonly SeriesPoint[], key: string): SeriesStats | null {
  const values = sampledValues(series, key);
  const now = values.at(-1);
  if (now === undefined) return null;
  return {
    now,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

/** A zero-based y domain with headroom above the largest real sample. */
export function seriesYDomain(series: readonly SeriesPoint[], key: string): [number, number] {
  const max = Math.max(0, ...sampledValues(series, key));
  return [0, niceCeil(max > 0 ? max * 1.12 : 1)];
}

/** Chart accessor that leaves gaps for missing samples instead of plotting zero. */
export function sampleAccessor(key: string): (point: SeriesPoint) => number | undefined {
  return (point) => {
    const value = point[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  };
}

/** Joins series that share the same ticks into one point per tick, for multi-line charts. */
export function mergeSeries(...series: ReadonlyArray<readonly SeriesPoint[]>): SeriesPoint[] {
  const [first, ...rest] = series;
  if (!first) return [];
  return first.map((point, index) =>
    rest.reduce<SeriesPoint>((merged, other) => ({ ...merged, ...other[index], x: point.x }), {
      ...point,
    }),
  );
}

/** The newest values of one key, gaps kept, for sparklines. */
export function seriesValues(series: readonly SeriesPoint[], key: string): Array<number | null> {
  return series.map((point) => {
    const value = point[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  });
}
