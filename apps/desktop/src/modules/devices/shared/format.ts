const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** A byte count for people: "—" when unknown, "0 B", then one decimal below 100 of a unit. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits).replace(/\.0$/, "")} ${BYTE_UNITS[unit]}`;
}

/** A transfer rate in bytes per second, "—" when unknown. */
export function formatRate(bytesPerSecond: number | null | undefined): string {
  if (bytesPerSecond === null || bytesPerSecond === undefined) return "—";
  if (bytesPerSecond < 1024) return `${Math.round(Math.max(0, bytesPerSecond))} B/s`;
  return `${formatBytes(bytesPerSecond)}/s`;
}

/** A whole percentage, "—" when unknown. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

/** Share of `part` in `total` as a 0–100 number, or `null` when the total is unknown. */
export function share(part: number, total: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return null;
  return Math.min(100, Math.max(0, (part / total) * 100));
}

const clockFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Wall-clock time of a millisecond timestamp, as HH:MM:SS. */
export function formatClock(timestamp: number): string {
  return clockFormatter.format(timestamp);
}
