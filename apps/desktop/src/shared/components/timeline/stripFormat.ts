const secondFormat = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const countFormat = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Wall time to the second: `14:05:23`. */
export function formatClock(ms: number): string {
  return secondFormat.format(ms);
}

/** Wall time with milliseconds: `14:05:23.481`. */
export function formatClockMs(ms: number): string {
  const millis = String(Math.floor(((ms % 1000) + 1000) % 1000)).padStart(3, "0");
  return `${secondFormat.format(ms)}.${millis}`;
}

/** A count that fits a narrow column: `7`, `1.2K`. */
export function formatCount(count: number): string {
  return count < 1000 ? String(count) : countFormat.format(count);
}

/** A device clock offset in words, or null when it is under a second and not worth saying. */
export function formatClockOffset(offsetMs: number | null | undefined): string | null {
  if (offsetMs === null || offsetMs === undefined || Math.abs(offsetMs) < 1000) return null;
  const seconds = (Math.abs(offsetMs) / 1000).toFixed(1);
  return `Device clock ${seconds} s ${offsetMs > 0 ? "ahead" : "behind"}, corrected`;
}
