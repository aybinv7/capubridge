import { CLOCK_TICKS_PER_SECOND, type ProcStat } from "./procStat";

/** The app's share of the whole phone's processor, 0–100 like the Device route's, split in two. */
export interface AppCpu {
  totalPct: number;
  /** Time in the app's own code. */
  userPct: number;
  /** Time the kernel worked for it. */
  systemPct: number;
}

/** One point to measure the next reading against. */
export interface CpuMark {
  pid: number;
  startTicks: number;
  userTicks: number;
  systemTicks: number;
  uptimeS: number;
}

export function cpuMark(stat: ProcStat, uptimeS: number): CpuMark {
  return {
    pid: stat.pid,
    startTicks: stat.startTicks,
    userTicks: stat.userTicks,
    systemTicks: stat.systemTicks,
    uptimeS,
  };
}

/**
 * Processor use between two readings of the same process, from the change in its tick counters
 * over the change in the phone's uptime, divided by the cores so a busy app reads like Device
 * reads the phone. `null` for the first reading, or when the process restarted in between.
 */
export function cpuBetween(previous: CpuMark | null, next: CpuMark, cores: number): AppCpu | null {
  if (!previous || previous.pid !== next.pid || previous.startTicks !== next.startTicks) {
    return null;
  }
  const elapsed = next.uptimeS - previous.uptimeS;
  if (!(elapsed > 0) || !(cores > 0)) return null;
  const capacity = elapsed * CLOCK_TICKS_PER_SECOND * cores;
  const share = (ticks: number) => Math.min(100, Math.max(0, (ticks / capacity) * 100));
  const userPct = share(next.userTicks - previous.userTicks);
  const systemPct = share(next.systemTicks - previous.systemTicks);
  return { totalPct: Math.min(100, userPct + systemPct), userPct, systemPct };
}
