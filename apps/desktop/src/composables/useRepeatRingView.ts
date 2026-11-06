import { onScopeDispose, shallowRef, triggerRef, watch } from "vue";
import type { Ref, ShallowRef } from "vue";
import { RepeatRows, type RepeatRow, type RepeatRule } from "@/lib/stream-rows/repeatRows";
import type { RingViewSource } from "@/composables/useRingView";
import type { StreamChange } from "@/lib/stream-feed";

export interface RepeatRingViewOptions<T> {
  rule: RepeatRule<T>;
  /** While true the rows stop changing and arrivals are counted; they catch up when it turns false. */
  frozen?: Ref<boolean>;
}

export interface RepeatRingView<T> {
  /** Rows of repeats, oldest first. The array is updated in place; read it reactively. */
  rows: ShallowRef<RepeatRow<T>[]>;
  /** Matching items that arrived while frozen. */
  pending: Ref<number>;
  /** Items the ring evicted while frozen, so the view can say they are no longer kept. */
  evictedWhileFrozen: Ref<number>;
  /** Re-runs the filter over the whole ring (for time-based filters). */
  rebuild(): void;
}

/**
 * A filtered view over a ring-backed stream with consecutive repeats folded into one row. The
 * filter runs over the whole ring only when the predicate changes; a flush tests just the new
 * items, and evicted ones shrink the first rows, so a flush costs O(batch).
 */
export function useRepeatRingView<T>(
  source: RingViewSource<T>,
  predicate: Ref<((item: T) => boolean) | null>,
  options: RepeatRingViewOptions<T>,
): RepeatRingView<T> {
  const groups = new RepeatRows<T>(options.rule);
  const rows = shallowRef<RepeatRow<T>[]>(groups.rows);
  const pending = shallowRef(0);
  const evictedWhileFrozen = shallowRef(0);
  let stale = false;

  function rebuild() {
    const test = predicate.value;
    groups.reset();
    source.ring.forEach((item) => {
      if (!test || test(item)) groups.push(item);
    });
    rows.value = groups.rows;
    pending.value = 0;
    evictedWhileFrozen.value = 0;
    stale = false;
  }

  function countMatches(items: readonly T[]): number {
    const test = predicate.value;
    if (!test) return items.length;
    let matches = 0;
    for (const item of items) if (test(item)) matches += 1;
    return matches;
  }

  function apply(change: StreamChange<T>) {
    if (options.frozen?.value) {
      stale = true;
      if (change.kind === "clear") {
        pending.value = 0;
        return;
      }
      pending.value += countMatches(change.items);
      evictedWhileFrozen.value += change.evicted.length;
      return;
    }
    if (change.kind === "clear") {
      groups.reset();
      rows.value = groups.rows;
      return;
    }
    const gone = countMatches(change.evicted);
    if (gone > 0) groups.evict(gone);
    const test = predicate.value;
    for (const item of change.items) {
      if (!test || test(item)) groups.push(item);
    }
    triggerRef(rows);
  }

  const unsubscribe = source.feed.subscribe(apply);
  watch(predicate, rebuild, { immediate: true });
  if (options.frozen) {
    watch(
      options.frozen,
      (frozen) => {
        if (!frozen && stale) rebuild();
      },
      { flush: "sync" },
    );
  }
  onScopeDispose(unsubscribe);

  return { rows, pending, evictedWhileFrozen, rebuild };
}
