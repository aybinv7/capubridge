export interface SparklineGeometry {
  /** One `M … L …` run per stretch of consecutive samples; a missing sample breaks the line. */
  line: string;
  /** The same runs closed down to the baseline, for a soft fill. */
  area: string;
  /** The newest sample, or `null` when the last tick has none. */
  last: { x: number; y: number } | null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Lays a rolling history out in a `width × height` box. Gaps (`null`) split the line instead of
 * dropping to zero; values outside `domain` are clamped so a spike never leaves the box.
 */
export function sparklineGeometry(
  values: readonly (number | null)[],
  width: number,
  height: number,
  domain: readonly [number, number],
): SparklineGeometry {
  const [min, max] = domain;
  const span = max - min > 0 ? max - min : 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const runs: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> | null = null;

  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      current = null;
      return;
    }
    const clamped = Math.min(max, Math.max(min, value));
    const point = { x: round(index * step), y: round(height - ((clamped - min) / span) * height) };
    if (!current) {
      current = [];
      runs.push(current);
    }
    current.push(point);
  });

  const line = runs
    .map((run) => run.map((point, i) => `${i === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" "))
    .join(" ");
  const area = runs
    .map((run) => {
      const first = run[0];
      const last = run.at(-1);
      if (!first || !last) return "";
      const body = run.map((point) => `L${point.x} ${point.y}`).join(" ");
      return `M${first.x} ${height} ${body} L${last.x} ${height} Z`;
    })
    .join(" ");
  const lastValue = values.at(-1);
  const lastRun = runs.at(-1)?.at(-1) ?? null;
  const last =
    lastValue !== null && lastValue !== undefined && Number.isFinite(lastValue) ? lastRun : null;

  return { line, area, last };
}

/** A domain that starts at zero and leaves headroom above the largest sample. */
export function headroomDomain(values: readonly (number | null)[], floor = 1): [number, number] {
  const peak = values.reduce<number>(
    (acc, value) => (value !== null && Number.isFinite(value) ? Math.max(acc, value) : acc),
    0,
  );
  return [0, Math.max(floor, peak * 1.15)];
}
