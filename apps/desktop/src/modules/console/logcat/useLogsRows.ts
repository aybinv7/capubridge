import { computed, toRef, watch, type Ref } from "vue";
import { refDebounced, useIntervalFn } from "@vueuse/core";
import { useRepeatRingView } from "@/composables/useRepeatRingView";
import { compileLogcatQuery, isWebViewEcho, logcatLevelAt } from "@/lib/logcat/logcatQuery";
import type { RepeatRow } from "@/lib/stream-rows/repeatRows";
import { useLogcatStore } from "@/stores/logcat.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useTimelineStore } from "@/stores/timeline.store";
import type { LogcatEntry } from "@/types/logcat.types";
import { useLogsPrefs } from "./logsPrefs";

const AGE_REFRESH_MS = 5_000;

export type LogsRow = RepeatRow<LogcatEntry>;

function sameLine(a: LogcatEntry, b: LogcatEntry): boolean {
  return (
    !a.marker &&
    !b.marker &&
    a.level === b.level &&
    a.pid === b.pid &&
    a.tag === b.tag &&
    a.message === b.message
  );
}

/**
 * The Logs view's rows: the query compiled once per change (150 ms after typing stops), WebView
 * echoes hidden on request, repeats folded, and the list frozen while it is not following.
 */
export function useLogsRows(query: Ref<string>) {
  const logcat = useLogcatStore();
  const targets = useTargetsStore();
  const timeline = useTimelineStore();
  const prefs = useLogsPrefs();
  const settled = refDebounced(query, 150);

  const myPackage = computed(() => targets.selectedTarget?.packageName ?? null);
  const compiled = computed(() =>
    compileLogcatQuery(settled.value, {
      myPackage: myPackage.value,
      hostTime: (entry) => timeline.toHostMs(entry.serial, entry.tsMs),
    }),
  );
  const predicate = computed(() => {
    const test = compiled.value.predicate;
    if (!prefs.hideEchoes.value) return test;
    return test
      ? (entry: LogcatEntry) => !isWebViewEcho(entry) && test(entry)
      : (entry: LogcatEntry) => !isWebViewEcho(entry);
  });

  const view = useRepeatRingView(logcat, predicate, {
    rule: { keyOf: (entry) => entry.id, same: sameLine },
    frozen: toRef(logcat, "isPaused"),
  });

  const ageRefresh = useIntervalFn(
    () => {
      if (!logcat.isPaused) view.rebuild();
    },
    AGE_REFRESH_MS,
    { immediate: false },
  );
  watch(
    () => compiled.value.timeSensitive,
    (timeSensitive) => (timeSensitive ? ageRefresh.resume() : ageRefresh.pause()),
    { immediate: true },
  );

  const floor = computed(() => {
    const rank = compiled.value.levelFloor;
    return rank === null ? null : logcatLevelAt(rank);
  });
  const filtering = computed(() => predicate.value !== null);

  return {
    rows: view.rows,
    pending: view.pending,
    evictedWhileFrozen: view.evictedWhileFrozen,
    matched: view.matched,
    revision: view.revision,
    compiled,
    predicate,
    floor,
    filtering,
    myPackage,
  };
}
