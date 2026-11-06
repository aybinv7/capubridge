import { computed, onScopeDispose, shallowRef, triggerRef, watch, type Ref } from "vue";
import { refDebounced, useIntervalFn } from "@vueuse/core";
import { compileConsoleQuery } from "@/lib/console/consoleQuery";
import {
  entryItem,
  exceptionItem,
  type ConsoleStreamItem,
  type ConsoleStreamRow,
} from "@/lib/console/consoleStream";
import { ConsoleStreamView } from "@/lib/console/consoleStreamView";
import { useConsoleStore } from "@/stores/console.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useTimelineStore } from "@/stores/timeline.store";
import type { ConsoleEntry } from "@/types/console.types";

const AGE_REFRESH_MS = 5_000;

/**
 * The Console view's stream rows: messages, exceptions and prompt lines merged in order, kept
 * per flush in O(batch) while following, frozen with a count of arrivals while not.
 */
export function useConsoleRows(query: Ref<string>, following: Ref<boolean>) {
  const store = useConsoleStore();
  const targets = useTargetsStore();
  const timeline = useTimelineStore();
  const settled = refDebounced(query, 150);
  const groupOverride = shallowRef<ReadonlyMap<string, boolean>>(new Map());
  const pending = shallowRef(0);
  const revision = shallowRef(0);
  let stale = false;

  function serial(): string | null {
    const target = targets.selectedTarget;
    return target?.source === "adb" ? (target.deviceSerial ?? null) : null;
  }

  const compiled = computed(() =>
    compileConsoleQuery(settled.value, {
      hostTime: (item) => timeline.toHostMs(serial(), item.time),
    }),
  );

  function isExpanded(entry: ConsoleEntry): boolean {
    return groupOverride.value.get(entry.id) ?? !entry.groupCollapsed;
  }

  const view = new ConsoleStreamView(() => ({
    entries: store.consoleSource.ring,
    exceptions: store.exceptionSource.ring,
    repl: store.replHistory,
    test: compiled.value.predicate,
    isExpanded,
  }));
  const rows = shallowRef<ConsoleStreamRow[]>([]);

  function rebuild() {
    view.rebuild();
    rows.value = view.rows;
    pending.value = 0;
    stale = false;
    revision.value += 1;
  }

  function settle() {
    if (view.rows !== rows.value) rows.value = view.rows;
    else triggerRef(rows);
    revision.value += 1;
  }

  function arrived(count: number) {
    stale = true;
    pending.value += count;
  }

  function matching(items: readonly ConsoleStreamItem[]): number {
    const test = compiled.value.predicate;
    if (!test) return items.length;
    let count = 0;
    for (const item of items) if (test(item)) count += 1;
    return count;
  }

  const unsubscribers = [
    store.consoleSource.feed.subscribe((change) => {
      if (!following.value) {
        if (change.kind === "append") arrived(matching(change.items.map(entryItem)));
        else stale = true;
        return;
      }
      view.applyEntries(change);
      settle();
    }),
    store.exceptionSource.feed.subscribe((change) => {
      if (!following.value) {
        if (change.kind === "append") arrived(matching(change.items.map(exceptionItem)));
        else stale = true;
        return;
      }
      view.applyExceptions(change);
      settle();
    }),
  ];

  watch([compiled, groupOverride], rebuild, { immediate: true });
  watch(
    () => store.replHistory,
    () => (following.value ? rebuild() : arrived(1)),
  );
  watch(following, (on) => {
    if (on && stale) rebuild();
  });

  const ageRefresh = useIntervalFn(
    () => {
      if (following.value) rebuild();
    },
    AGE_REFRESH_MS,
    { immediate: false },
  );
  watch(
    () => compiled.value.timeSensitive,
    (on) => (on ? ageRefresh.resume() : ageRefresh.pause()),
    { immediate: true },
  );

  onScopeDispose(() => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  });

  function toggleGroup(entry: ConsoleEntry) {
    const next = new Map(groupOverride.value);
    next.set(entry.id, !isExpanded(entry));
    groupOverride.value = next;
  }

  const floor = computed(() => compiled.value.levelFloor);

  return { rows, revision, pending, compiled, floor, isExpanded, toggleGroup, rebuild };
}
