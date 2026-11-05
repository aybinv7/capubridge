import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import { useDocumentVisibility } from "@vueuse/core";
import { useAdb } from "@/composables/useAdb";
import { withTimeout } from "@/shared/async/withTimeout";
import type { SeriesPoint } from "@/shared/perf/perfSeries";
import type { AppSubject } from "../subject/subject.types";
import { useAppProcessHistoryStore, type ProcessHistory } from "./appProcessHistory.store";
import { cpuBetween, cpuMark } from "./cpuMeter";
import {
  parseProcessRead,
  processOfUser,
  processReadCommand,
  READ_TIME_LIMIT_S,
} from "./processRead";
import { MEMORY_EVERY, nextReadDelay, sampleChannels, type ProcessSample } from "./processSample";

/** The desktop stops waiting a second after the phone's own time limit. */
const GIVE_UP_MS = (READ_TIME_LIMIT_S + 1) * 1000;

function subjectKey(subject: AppSubject | null): string | null {
  return subject ? `${subject.serial}/${subject.packageName}` : null;
}

/**
 * Reads the app's process (processor share, threads, and every fourth time its memory) while
 * `wanted`, the window is shown and the person has not paused it. Readings run beside the
 * phone's command queue, each waits for the previous one, failures back off, and an app without
 * a process is read less often. The history lives in a store keyed by phone and app, so it
 * survives leaving the route; a late answer about another app is dropped.
 */
export function createAppProcess(
  subject: Readonly<Ref<AppSubject | null>>,
  wanted: Readonly<Ref<boolean>>,
  /** The Android user the app runs as; picks its process when several users run it. */
  user: Readonly<Ref<number | null>>,
) {
  const { readShell } = useAdb();
  const store = useAppProcessHistoryStore();
  const visibility = useDocumentVisibility();

  const paused = ref(false);
  const isRunning = ref(false);
  const latest = shallowRef<ProcessSample | null>(null);
  const lastSampleAt = ref<number | null>(null);
  const startedAt = ref<number | null>(null);
  const error = ref<string | null>(null);

  const key = computed(() => subjectKey(subject.value));
  const active = computed(
    () => wanted.value && !paused.value && visibility.value === "visible" && subject.value !== null,
  );

  let history: ProcessHistory | null = null;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let readAgain = false;
  let readings = 0;
  let failures = 0;

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function stop() {
    generation += 1;
    clearTimer();
    inFlight = false;
    readAgain = false;
    isRunning.value = false;
  }

  function adopt(nextKey: string | null) {
    history = nextKey ? store.historyOf(nextKey) : null;
    latest.value = history?.latest ?? null;
    lastSampleAt.value = history?.lastSampleAt ?? null;
    error.value = null;
    readings = 0;
    failures = 0;
    store.touch();
  }

  function record(target: ProcessHistory, sample: ProcessSample, memoryRead: boolean) {
    target.readings.push(sample.at, sampleChannels(sample));
    if (memoryRead || !sample.running) {
      target.memory.push(sample.at, {
        pss: sample.running && sample.memory ? sample.memory.totalPssKb / 1024 : null,
      });
    }
    target.latest = sample;
    target.lastSampleAt = sample.at;
    latest.value = sample;
    lastSampleAt.value = sample.at;
    store.touch();
  }

  async function read(ticket: number, current: AppSubject, target: ProcessHistory): Promise<void> {
    const last = target.latest;
    const memoryRead =
      last?.running !== false &&
      (readings % MEMORY_EVERY === 0 || !last?.memory || last.memory.pid !== last.pid);
    const output = await withTimeout(
      readShell(
        current.serial,
        processReadCommand(current.packageName, { memory: memoryRead, cores: !target.cores }),
      ),
      GIVE_UP_MS,
      "The phone did not answer",
    );
    if (ticket !== generation) return;
    const parsed = parseProcessRead(output);
    target.cores ??= parsed.cores;
    const stat = processOfUser(parsed.processes, user.value);
    const at = Date.now();
    const mark = stat && parsed.uptimeS !== null ? cpuMark(stat, parsed.uptimeS) : null;
    const cpu = mark ? cpuBetween(target.cpuMark, mark, target.cores ?? 1) : null;
    const previousMemory =
      target.latest?.pid === stat?.pid ? (target.latest?.memory ?? null) : null;
    const memory = stat ? (parsed.memories?.get(stat.pid) ?? previousMemory) : null;
    target.cpuMark = mark;
    readings += 1;
    record(
      target,
      {
        at,
        running: stat !== null,
        pid: stat?.pid ?? null,
        cpu,
        threads: stat?.threads ?? null,
        memory,
      },
      memoryRead,
    );
  }

  async function tick(ticket: number) {
    const current = subject.value;
    const target = history;
    if (!current || !target || ticket !== generation) return;
    inFlight = true;
    readAgain = false;
    try {
      await read(ticket, current, target);
      if (ticket !== generation) return;
      failures = 0;
      error.value = null;
    } catch (err) {
      if (ticket !== generation) return;
      failures += 1;
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      if (ticket === generation) inFlight = false;
    }
    if (ticket !== generation) return;
    const delay = readAgain ? 0 : nextReadDelay(failures, latest.value?.running ?? null);
    timer = setTimeout(() => void tick(ticket), delay);
  }

  function start() {
    stop();
    if (!active.value || !history) return;
    isRunning.value = true;
    startedAt.value = Date.now();
    void tick(generation);
  }

  watch(
    [key, active],
    ([nextKey], previous) => {
      if (nextKey !== previous?.[0]) {
        stop();
        adopt(nextKey);
      }
      if (active.value && !isRunning.value) start();
      else if (!active.value) stop();
    },
    { immediate: true },
  );

  onScopeDispose(stop);

  /** The phone's processor cores, what 100 % of the processor share stands for. */
  const cores = computed(() => {
    void store.version;
    return history?.cores ?? null;
  });

  /** Reads again as soon as the reading in flight, if any, comes back; the loop keeps going. */
  function readNow() {
    if (!isRunning.value) return;
    if (inFlight) {
      readAgain = true;
      return;
    }
    clearTimer();
    void tick(generation);
  }

  /** Chart points of `cpu` (%) or `threads`, one per reading. */
  function series(channel: "cpu" | "threads"): SeriesPoint[] {
    void store.version;
    return history?.readings.series(channel) ?? [];
  }

  /** Chart points of the memory (`pss`, MB), one per memory report. */
  function memorySeries(): SeriesPoint[] {
    void store.version;
    return history?.memory.series("pss") ?? [];
  }

  /** The newest values of one channel, gaps kept, for sparklines. */
  function values(channel: "cpu" | "threads" | "pss"): Array<number | null> {
    void store.version;
    if (!history) return [];
    return channel === "pss" ? history.memory.values("pss") : history.readings.values(channel);
  }

  return {
    paused,
    active,
    isRunning,
    latest,
    lastSampleAt,
    startedAt,
    error,
    series,
    memorySeries,
    values,
    cores,
    readNow,
    pause: () => {
      paused.value = true;
    },
    resume: () => {
      paused.value = false;
    },
    retry: () => {
      error.value = null;
      failures = 0;
      start();
    },
  };
}

export type AppProcess = ReturnType<typeof createAppProcess>;
