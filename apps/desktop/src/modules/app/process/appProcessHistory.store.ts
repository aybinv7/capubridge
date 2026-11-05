import { shallowRef } from "vue";
import { defineStore } from "pinia";
import { SampleRing } from "@/shared/perf/sampleRing";
import type { CpuMark } from "./cpuMeter";
import { MEMORY_PERIOD_MS, PROCESS_PERIOD_MS, type ProcessSample } from "./processSample";

/** Five minutes of readings, on both cadences. */
const HISTORY_MS = 5 * 60_000;
const KEPT_APPS = 4;

/** What was read about one app on one phone, kept while the person is on other routes. */
export interface ProcessHistory {
  /** Processor (`cpu`) and `threads`, one point per reading. */
  readings: SampleRing;
  /** Memory (`pss`, MB), one point per memory report. */
  memory: SampleRing;
  latest: ProcessSample | null;
  lastSampleAt: number | null;
  /** Where processor time stood at the newest reading, to measure the next one against. */
  cpuMark: CpuMark | null;
  /** Phone cores, asked once. */
  cores: number | null;
}

function createHistory(): ProcessHistory {
  return {
    readings: new SampleRing(HISTORY_MS / PROCESS_PERIOD_MS, PROCESS_PERIOD_MS),
    memory: new SampleRing(HISTORY_MS / MEMORY_PERIOD_MS, MEMORY_PERIOD_MS),
    latest: null,
    lastSampleAt: null,
    cpuMark: null,
    cores: null,
  };
}

/**
 * Process histories keyed by phone and package, so leaving the App route and coming back keeps
 * the charts. Only the last few apps are kept. The histories are plain data; `version` tells Vue
 * that one of them changed.
 */
export const useAppProcessHistoryStore = defineStore("app-process-history", () => {
  const histories = new Map<string, ProcessHistory>();
  const version = shallowRef(0);

  function historyOf(key: string): ProcessHistory {
    const existing = histories.get(key);
    if (existing) {
      histories.delete(key);
      histories.set(key, existing);
      return existing;
    }
    const created = createHistory();
    histories.set(key, created);
    for (const old of histories.keys()) {
      if (histories.size <= KEPT_APPS) break;
      histories.delete(old);
    }
    return created;
  }

  function touch() {
    version.value += 1;
  }

  return { version, historyOf, touch };
});
