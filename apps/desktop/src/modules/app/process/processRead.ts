import type { AppCpuInfo, AppMemInfo } from "@/types/app-inspector.types";
import { parseCpuInfo } from "./cpuinfo";
import { parseMemInfo } from "./meminfo";

const CPU_MARK = "__capubridge_cpu__";

/**
 * One shell for one reading: the app's memory, then only its lines from the processor report,
 * so the app is found however far down the report it sits. `packageName` must be checked first.
 */
export function processReadCommand(packageName: string): string {
  return `dumpsys meminfo ${packageName}; echo ${CPU_MARK}; dumpsys cpuinfo | grep -F "/${packageName}"`;
}

export interface ProcessSample {
  at: number;
  running: boolean;
  pid: number | null;
  memory: AppMemInfo;
  cpu: AppCpuInfo | null;
  threads: number | null;
}

/** Splits the combined output and reads both halves; a stopped app has no processor share. */
export function parseProcessRead(output: string, packageName: string, at: number): ProcessSample {
  const mark = output.indexOf(CPU_MARK);
  const memOut = mark < 0 ? output : output.slice(0, mark);
  const cpuOut = mark < 0 ? "" : output.slice(mark + CPU_MARK.length);
  const memory = parseMemInfo(memOut);
  return {
    at,
    running: memory.isRunning,
    pid: memory.pid,
    memory,
    cpu: memory.isRunning ? parseCpuInfo(cpuOut, packageName) : null,
    threads: memory.isRunning ? memory.threadCount : null,
  };
}

/** The values one reading adds to the history; a stopped app leaves a gap. */
export function sampleChannels(sample: ProcessSample): Record<string, number | null> {
  if (!sample.running) return { pss: null, cpu: null, threads: null };
  return {
    pss: sample.memory.totalPssKb / 1024,
    cpu: sample.cpu?.totalPct ?? null,
    threads: sample.threads,
  };
}
