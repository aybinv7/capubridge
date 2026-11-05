/**
 * The app's share of the phone's processor for people: one decimal below 10 % so a quiet app
 * does not read as 0 %, whole numbers above.
 */
export function formatCpu(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value > 0 && value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

/** "of 8 cores": what 100 % means for the app's processor share. */
export function coresWords(cores: number | null): string | undefined {
  return cores ? `of ${cores} cores` : undefined;
}

/**
 * A 0-based processor scale that keeps a quiet app readable: at least 0–10 %, rounded up to the
 * next ten above the busiest reading, never past 100 %.
 */
export function cpuDomain(values: readonly (number | null)[]): [number, number] {
  const peak = values.reduce<number>(
    (top, value) => (value !== null && value > top ? value : top),
    0,
  );
  return [0, Math.min(100, Math.max(10, Math.ceil((peak * 1.2) / 10) * 10))];
}
