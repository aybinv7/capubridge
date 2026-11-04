export interface CpuCoreMetric {
  core: number;
  usage: number;
}

export interface PerfMetrics {
  cpuCores: CpuCoreMetric[];
  cpuTotal: number;
  memory: {
    totalKb: number;
    availableKb: number;
    usedKb: number;
    usedPct: number;
  };
  network: {
    rxBps: number;
    txBps: number;
  };
  /** Each field is `null` when `dumpsys battery` did not report it. */
  battery: {
    level: number | null;
    temperature: number | null;
    charging: boolean | null;
  };
  cpuTemp: number | null;
  cpuTempSource?: string | null;
  timestamp: number;
}
