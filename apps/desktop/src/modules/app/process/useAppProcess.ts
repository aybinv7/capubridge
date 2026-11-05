import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import { useDocumentVisibility } from "@vueuse/core";
import { useAdb } from "@/composables/useAdb";
import type { SeriesPoint } from "@/shared/perf/perfSeries";
import { SampleRing } from "@/shared/perf/sampleRing";
import type { AppSubject } from "../subject/subject.types";
import { PROCESS_PERIOD_MS } from "./processPhase";
import {
  parseProcessRead,
  processReadCommand,
  sampleChannels,
  type ProcessSample,
} from "./processRead";

/** Five minutes of readings. */
const HISTORY_SAMPLES = 120;

function subjectKey(subject: AppSubject | null): string | null {
  return subject ? `${subject.serial}/${subject.packageName}` : null;
}

/**
 * Reads the app's process (memory, processor share, threads) every 2.5 s while `wanted`, the
 * window is shown and the person has not paused it. Each read waits for the previous one, a read
 * that comes back after the app or phone changed is dropped, and a new app starts a new history.
 */
export function createAppProcess(
  subject: Readonly<Ref<AppSubject | null>>,
  wanted: Readonly<Ref<boolean>>,
) {
  const { shellCommand } = useAdb();
  const visibility = useDocumentVisibility();
  const history = new SampleRing(HISTORY_SAMPLES, PROCESS_PERIOD_MS);
  const version = shallowRef(0);

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

  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function stop() {
    generation += 1;
    if (timer) clearTimeout(timer);
    timer = null;
    isRunning.value = false;
  }

  function reset() {
    history.clear();
    latest.value = null;
    lastSampleAt.value = null;
    error.value = null;
    version.value += 1;
  }

  async function tick(ticket: number, current: AppSubject) {
    try {
      const output = await shellCommand(current.serial, processReadCommand(current.packageName));
      if (ticket !== generation) return;
      const sample = parseProcessRead(output, current.packageName, Date.now());
      history.push(sample.at, sampleChannels(sample));
      latest.value = sample;
      lastSampleAt.value = sample.at;
      error.value = null;
      version.value += 1;
    } catch (err) {
      if (ticket !== generation) return;
      error.value = String(err);
    }
    if (ticket !== generation) return;
    timer = setTimeout(() => void tick(ticket, current), PROCESS_PERIOD_MS);
  }

  function start() {
    stop();
    const current = subject.value;
    if (!active.value || !current) return;
    isRunning.value = true;
    startedAt.value = Date.now();
    void tick(generation, current);
  }

  watch(
    [key, active],
    ([nextKey], previous) => {
      stop();
      if (nextKey !== previous?.[0]) reset();
      start();
    },
    { immediate: true },
  );

  onScopeDispose(stop);

  /** Chart points of `pss` (MB), `cpu` (%) or `threads`. */
  function series(channel: string): SeriesPoint[] {
    void version.value;
    return history.series(channel);
  }

  /** The newest values of one channel, gaps kept, for sparklines. */
  function values(channel: string): Array<number | null> {
    void version.value;
    return history.values(channel);
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
    values,
    /** Reads again right away, for example after the app was opened or stopped. */
    readNow: start,
    pause: () => {
      paused.value = true;
    },
    resume: () => {
      paused.value = false;
    },
    retry: () => {
      error.value = null;
      start();
    },
  };
}

export type AppProcess = ReturnType<typeof createAppProcess>;
