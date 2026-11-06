import { computed, nextTick, shallowRef, watch, type Ref } from "vue";
import { useEventListener } from "@vueuse/core";
import { useVirtualizer } from "@tanstack/vue-virtual";

/** Height of a collapsed row: one line, DESIGN.md compact density. */
export const ROW_HEIGHT = 22;
/** Distance from the bottom that still counts as "at the end". */
const END_SLACK = 6;

export interface StreamListOptions<R> {
  rows: Ref<readonly R[]>;
  keyOf: (row: R) => string;
  /** True while the list follows new rows at the end. */
  following: Ref<boolean>;
  /** The reader scrolled up: stop following. */
  onLeaveTail: () => void;
  /** The reader scrolled back to the end: follow again. */
  onReachTail: () => void;
}

/**
 * A virtual list of 22 px rows that can open into measured detail, which follows the end while
 * `following` and tells its owner when the reader scrolls away from it or back to it.
 */
export function useStreamList<R>(options: StreamListOptions<R>) {
  const scroller = shallowRef<HTMLElement | null>(null);
  let lastTop = 0;
  let pinning = false;

  const virtualizer = useVirtualizer(
    computed(() => {
      const list = options.rows.value;
      return {
        count: list.length,
        getScrollElement: () => scroller.value,
        estimateSize: () => ROW_HEIGHT,
        overscan: 16,
        getItemKey: (index: number) => {
          const row = list[index];
          return row === undefined ? index : options.keyOf(row);
        },
      };
    }),
  );

  const items = computed(() => {
    const list = options.rows.value;
    return virtualizer.value.getVirtualItems().flatMap((virtual) => {
      const row = list[virtual.index];
      return row === undefined
        ? []
        : [{ key: options.keyOf(row), index: virtual.index, start: virtual.start, row }];
    });
  });
  const totalSize = computed(() => virtualizer.value.getTotalSize());

  function scrollToEnd() {
    const element = scroller.value;
    if (!element) return;
    pinning = true;
    element.scrollTop = element.scrollHeight;
    lastTop = element.scrollTop;
  }

  function scrollToIndex(index: number) {
    virtualizer.value.scrollToIndex(index, { align: "center" });
  }

  function measure(element: Element | null) {
    if (element) virtualizer.value.measureElement(element);
  }

  function onScroll() {
    const element = scroller.value;
    if (!element) return;
    const top = element.scrollTop;
    const atEnd = element.scrollHeight - top - element.clientHeight <= END_SLACK;
    if (pinning) {
      pinning = false;
      lastTop = top;
      return;
    }
    if (options.following.value && !atEnd && top < lastTop - 1) options.onLeaveTail();
    else if (!options.following.value && atEnd && top > lastTop) options.onReachTail();
    lastTop = top;
  }

  useEventListener(scroller, "scroll", onScroll, { passive: true });

  watch(
    [options.rows, totalSize],
    () => {
      if (options.following.value) void nextTick(scrollToEnd);
    },
    { flush: "post" },
  );
  watch(options.following, (following) => {
    if (following) void nextTick(scrollToEnd);
  });

  return { scroller, virtualizer, items, totalSize, measure, scrollToEnd, scrollToIndex };
}
