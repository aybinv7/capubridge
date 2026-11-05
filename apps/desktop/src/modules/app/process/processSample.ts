import type { AppCpu } from "./cpuMeter";
import type { AppMemory } from "./meminfo";

/** One reading of the app's process as the screen shows it. */
export interface ProcessSample {
  at: number;
  running: boolean;
  pid: number | null;
  /** `null` on the first reading of a process: processor use needs two readings. */
  cpu: AppCpu | null;
  threads: number | null;
  /** The newest memory report, read less often than the rest; `null` until one arrived. */
  memory: AppMemory | null;
}

/** The process is read every this many milliseconds while it runs and the phone answers. */
export const PROCESS_PERIOD_MS = 2500;

/** Memory is read on every this many readings: `dumpsys meminfo` is far heavier than `/proc`. */
export const MEMORY_EVERY = 4;

/** The memory history's spacing between points. */
export const MEMORY_PERIOD_MS = PROCESS_PERIOD_MS * MEMORY_EVERY;

const NOT_RUNNING_PERIOD_MS = 10_000;
const LONGEST_BACKOFF_MS = 20_000;

/**
 * The wait before the next reading: the usual period, 10 s while the app has no process, and
 * twice as long after each failure in a row (5, 10, then 20 s) so an unanswering phone is not
 * pressed.
 */
export function nextReadDelay(failures: number, running: boolean | null): number {
  if (failures > 0) return Math.min(LONGEST_BACKOFF_MS, PROCESS_PERIOD_MS * 2 ** failures);
  if (running === false) return NOT_RUNNING_PERIOD_MS;
  return PROCESS_PERIOD_MS;
}

/** The values one reading adds to the processor and threads history; no process leaves a gap. */
export function sampleChannels(sample: ProcessSample): Record<string, number | null> {
  if (!sample.running) return { cpu: null, threads: null };
  return { cpu: sample.cpu?.totalPct ?? null, threads: sample.threads };
}
