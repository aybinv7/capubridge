/** The spans the global strip can show, right edge at now. */
export const STRIP_WINDOWS = ["1m", "5m", "15m"] as const;
export type StripWindow = (typeof STRIP_WINDOWS)[number];

export const STRIP_WINDOW_MS: Readonly<Record<StripWindow, number>> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
};

export const DEFAULT_STRIP_WINDOW: StripWindow = "5m";

export function isStripWindow(value: unknown): value is StripWindow {
  return typeof value === "string" && (STRIP_WINDOWS as readonly string[]).includes(value);
}

/** One axis label: where it sits (0 = left edge, 1 = now) and what it says. */
export interface AxisTick {
  fraction: number;
  label: string;
}

const AXIS_STEPS: Readonly<Record<StripWindow, number>> = {
  "1m": 15_000,
  "5m": 60_000,
  "15m": 5 * 60_000,
};

function offsetLabel(ms: number): string {
  if (ms === 0) return "now";
  if (ms < 60_000) return `-${Math.round(ms / 1000)} s`;
  return `-${Math.round(ms / 60_000)} min`;
}

/** Relative labels for a window, oldest first: `-5 min … -1 min … now`. */
export function axisTicks(window: StripWindow): AxisTick[] {
  const span = STRIP_WINDOW_MS[window];
  const step = AXIS_STEPS[window];
  const ticks: AxisTick[] = [];
  for (let offset = span; offset >= 0; offset -= step) {
    ticks.push({ fraction: 1 - offset / span, label: offsetLabel(offset) });
  }
  return ticks;
}
