import type { LogcatEntry } from "@/types/logcat.types";

export interface ProcessTracker {
  /** The app whose process is followed; a change starts over without a marker. */
  setPackage(packageName: string | null): void;
  /** Rows to show before `entry`: "ended" and "started" when the app's process changed. */
  observe(entry: LogcatEntry): LogcatEntry[];
  reset(): void;
}

function marker(
  kind: "process-started" | "process-ended",
  pid: number,
  packageName: string,
  before: LogcatEntry,
  offset: number,
): LogcatEntry {
  const seq = before.seq - offset;
  return {
    ...before,
    id: `${before.serial}:${kind}:${pid}:${before.seq}`,
    seq,
    pid,
    tid: pid,
    level: "I",
    tag: "Process",
    processName: packageName,
    packageName,
    message: `Process ${pid} ${kind === "process-started" ? "started" : "ended"}`,
    marker: kind,
  };
}

/**
 * Follows the inspected app's process id through logcat and, like Android Studio, adds
 * "Process N ended" and "Process M started" rows when it changes. The first pid seen is taken
 * as the running process, so starting a capture on a running app adds nothing.
 */
export function createProcessTracker(): ProcessTracker {
  let watched: string | null = null;
  let pid: number | null = null;

  return {
    setPackage(packageName) {
      if (packageName === watched) return;
      watched = packageName;
      pid = null;
    },
    observe(entry) {
      if (!watched || entry.marker || entry.packageName !== watched || entry.pid === null) {
        return [];
      }
      if (pid === entry.pid) return [];
      const previous = pid;
      pid = entry.pid;
      if (previous === null) return [];
      return [
        marker("process-ended", previous, watched, entry, 0.6),
        marker("process-started", entry.pid, watched, entry, 0.3),
      ];
    },
    reset() {
      pid = null;
    },
  };
}
