/** A rolling metric history. `null` marks a tick with no sample, which charts draw as a gap. */
export type MetricHistory = Array<number | null>;

export type SeriesPoint = { x: number } & Record<string, number | null>;

export interface SeriesStats {
  now: number;
  min: number;
  max: number;
  avg: number;
}

export const HISTORY_LENGTH = 60;

/** An empty history: no sample yet, so nothing is drawn instead of a flat line at zero. */
export function emptyHistory(length = HISTORY_LENGTH): MetricHistory {
  return Array.from({ length }, () => null);
}

/** Appends a sample (or a gap) and drops the oldest tick. */
export function pushSample(
  history: MetricHistory,
  value: number | null | undefined,
): MetricHistory {
  const next = value !== null && value !== undefined && Number.isFinite(value) ? value : null;
  return [...history.slice(1), next];
}

export function hasSamples(history: MetricHistory): boolean {
  return history.some((value) => value !== null);
}

/** Maps a history onto chart points ending at `latestTick`, keeping gaps as `null`. */
export function toSeries(history: MetricHistory, key: string, latestTick: number): SeriesPoint[] {
  const xStart = latestTick - history.length + 1;
  return history.map((value, i) => ({ x: xStart + i, [key]: value }) as SeriesPoint);
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
