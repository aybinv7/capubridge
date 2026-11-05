/** What `/proc/<pid>/stat` and `/proc/<pid>/status` say about one process. */
export interface ProcStat {
  pid: number;
  /** Processor time in the process's own code, in clock ticks. */
  userTicks: number;
  /** Processor time in the kernel on its behalf, in clock ticks. */
  systemTicks: number;
  /** When the process started, in ticks since boot; a new process with a reused PID differs. */
  startTicks: number;
  /** Linux uid; the Android user is `Math.floor(uid / 100000)`. */
  uid: number | null;
  threads: number | null;
}

/** Android's kernel counts processor time in 1/100 s. */
export const CLOCK_TICKS_PER_SECOND = 100;

/** The Android user a Linux uid belongs to (user 0 owns 10406, user 10 owns 1010406). */
export function userOfUid(uid: number): number {
  return Math.floor(uid / 100_000);
}

function statusNumber(status: string, key: string): number | null {
  const match = status.match(new RegExp(String.raw`^${key}:\s+(\d+)`, "m"));
  const value = match ? parseInt(match[1] ?? "", 10) : NaN;
  return Number.isFinite(value) ? value : null;
}

/**
 * Reads one process from its `stat` line followed by its `status` lines. The process name in
 * `stat` sits in parentheses and may hold spaces, so fields are counted after the last `)`.
 */
export function parseProcStat(pid: number, text: string): ProcStat | null {
  const statLineEnd = text.indexOf("\n");
  const statLine = statLineEnd < 0 ? text : text.slice(0, statLineEnd);
  const close = statLine.lastIndexOf(")");
  if (close < 0) return null;
  const fields = statLine
    .slice(close + 1)
    .trim()
    .split(/\s+/);
  const userTicks = parseInt(fields[11] ?? "", 10);
  const systemTicks = parseInt(fields[12] ?? "", 10);
  const startTicks = parseInt(fields[19] ?? "", 10);
  if (![userTicks, systemTicks, startTicks].every(Number.isFinite)) return null;
  const status = statLineEnd < 0 ? "" : text.slice(statLineEnd + 1);
  return {
    pid,
    userTicks,
    systemTicks,
    startTicks,
    uid: statusNumber(status, "Uid"),
    threads: statusNumber(status, "Threads"),
  };
}
