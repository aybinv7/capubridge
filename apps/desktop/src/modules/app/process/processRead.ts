import { parseMemInfo, type AppMemory } from "./meminfo";
import { parseProcStat, userOfUid, type ProcStat } from "./procStat";

const PID_MARK = "@@capubridge-pid";
const MEM_MARK = "@@capubridge-mem";
const CORES_MARK = "@@capubridge-cores";

/** The phone gives up a reading after this many seconds, so it never holds a shell for long. */
export const READ_TIME_LIMIT_S = 5;

export interface ProcessReadPlan {
  /** Also read `dumpsys meminfo`; it is far heavier than `/proc`, so not every time. */
  memory: boolean;
  /** Also ask how many processor cores the phone has. */
  cores: boolean;
}

/**
 * One shell for one reading: the phone's uptime, then `/proc/<pid>/stat` and `status` of every
 * process named after the package (one per Android user running it), and when planned the
 * memory report and the core count. `packageName` must be checked first.
 */
export function processReadCommand(packageName: string, plan: ProcessReadPlan): string {
  const parts = [
    "cat /proc/uptime",
    `for p in $(pidof ${packageName}); do echo "${PID_MARK} $p"; cat /proc/$p/stat /proc/$p/status 2>/dev/null; done`,
  ];
  if (plan.cores) parts.push(`echo "${CORES_MARK} $(nproc)"`);
  if (plan.memory) parts.push(`echo ${MEM_MARK}`, `dumpsys meminfo --local ${packageName}`);
  return `timeout ${READ_TIME_LIMIT_S} sh -c '${parts.join("; ")}'`;
}

/** Everything one reading found, before choosing the process that belongs to the user. */
export interface ProcessRead {
  /** Seconds since the phone booted, the clock processor time is measured against. */
  uptimeS: number | null;
  cores: number | null;
  processes: ProcStat[];
  /** `null` when memory was not part of this reading. */
  memories: Map<number, AppMemory> | null;
}

/** Splits the combined output into its pieces. */
export function parseProcessRead(output: string): ProcessRead {
  const memAt = output.indexOf(MEM_MARK);
  const head = memAt < 0 ? output : output.slice(0, memAt);
  const memories = memAt < 0 ? null : parseMemInfo(output.slice(memAt + MEM_MARK.length));

  const uptime = parseFloat(head.trimStart().split(/\s+/)[0] ?? "");
  const coresMatch = head.match(new RegExp(`${CORES_MARK} (\\d+)`));
  const cores = coresMatch ? parseInt(coresMatch[1] ?? "", 10) : null;

  const processes: ProcStat[] = [];
  const blocks = head.split(`${PID_MARK} `).slice(1);
  for (const block of blocks) {
    const newline = block.indexOf("\n");
    if (newline < 0) continue;
    const pid = parseInt(block.slice(0, newline), 10);
    const body = block.slice(newline + 1).split(CORES_MARK)[0] ?? "";
    const stat = Number.isFinite(pid) ? parseProcStat(pid, body) : null;
    if (stat) processes.push(stat);
  }

  return {
    uptimeS: Number.isFinite(uptime) ? uptime : null,
    cores: cores !== null && Number.isFinite(cores) && cores > 0 ? cores : null,
    processes,
    memories,
  };
}

/**
 * The app's process for the Android user it is inspected as. When the user is not known yet,
 * or no process carries a uid, the first one stands in.
 */
export function processOfUser(
  processes: readonly ProcStat[],
  user: number | null,
): ProcStat | null {
  if (user !== null) {
    const owned = processes.find(
      (process) => process.uid !== null && userOfUid(process.uid) === user,
    );
    if (owned) return owned;
    if (processes.some((process) => process.uid !== null)) return null;
  }
  return processes[0] ?? null;
}
