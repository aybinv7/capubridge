/**
 * How many items each live evidence stream keeps in memory. One place, so the dock, the
 * timeline and the recorder agree on what is still available.
 */
export const STREAM_CAPS = {
  logcat: 50_000,
  console: 10_000,
  exceptions: 1_000,
} as const;

export type StreamCapKey = keyof typeof STREAM_CAPS;
