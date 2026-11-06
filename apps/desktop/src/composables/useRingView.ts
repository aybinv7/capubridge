import { onScopeDispose, shallowRef, triggerRef, watch } from "vue";
import type { Ref, ShallowRef } from "vue";
import type { RingBuffer } from "@/lib/ring-buffer";
import type { StreamChange, StreamFeed } from "@/lib/stream-feed";

export interface RingViewSource<T> {
  ring: RingBuffer<T>;
  feed: StreamFeed<T>;
}

export interface RingViewOptions {
  /** While true the rows stop changing; they catch up when it turns false. */
  frozen?: Ref<boolean>;
}

export interface RingView<T> {
  /** The matching items, oldest first. The array is updated in place; read it reactively. */
  rows: ShallowRef<T[]>;
  /** Items that arrived while frozen and are not shown yet. */
  pending: Ref<number>;
}

/**
 * A filtered, live view over a ring-backed stream. The filter runs over the whole ring only
 * when the predicate changes; each flush tests just the appended items and drops evicted ones
 * from the front, so a flush costs O(batch), not O(buffer).
 */
export function useRingView<T extends { seq: number }>(
  source: RingViewSource<T>,
  predicate: Ref<((item: T) => boolean) | null>,
  options: RingViewOptions = {},
): RingView<T> {
  const rows = shallowRef<T[]>([]);
  const pending = shallowRef(0);
  let stale = false;

  function rebuild() {
    const test = predicate.value;
    const next: T[] = [];
    source.ring.forEach((item) => {
      if (!test || test(item)) {
        next.push(item);
      }
    });
    rows.value = next;
    pending.value = 0;
    stale = false;
  }

  function apply(change: StreamChange<T>) {
    if (options.frozen?.value) {
      stale = true;
      pending.value = change.kind === "clear" ? 0 : pending.value + change.items.length;
      return;
    }
    if (change.kind === "clear") {
      rows.value = [];
      return;
    }

    const list = rows.value;
    const lastEvicted = change.evicted.at(-1);
    if (lastEvicted) {
      let drop = 0;
      while (drop < list.length && (list[drop]?.seq ?? Infinity) <= lastEvicted.seq) {
        drop += 1;
      }
      if (drop > 0) {
        list.splice(0, drop);
      }
    }
    const test = predicate.value;
    for (const item of change.items) {
      if (!test || test(item)) {
        list.push(item);
      }
    }
    triggerRef(rows);
  }

  const unsubscribe = source.feed.subscribe(apply);
  watch(predicate, rebuild, { immediate: true });
  if (options.frozen) {
    watch(
      options.frozen,
      (frozen) => {
        if (!frozen && stale) {
          rebuild();
        }
      },
      { flush: "sync" },
    );
  }
  onScopeDispose(unsubscribe);

  return { rows, pending };
}
