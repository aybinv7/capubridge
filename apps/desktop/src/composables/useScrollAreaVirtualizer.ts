import { computed, shallowRef } from "vue";
import type { ComponentPublicInstance, Ref } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";

export interface ScrollAreaVirtualizerOptions<T> {
  /** Estimated row height in px; rows are measured once rendered. */
  estimateSize: number;
  overscan?: number;
  /** Stable key for a row, so measurements follow rows as the list shifts. */
  itemKey: (item: T, index: number) => string | number;
}

export interface VirtualListItem<T> {
  key: string | number;
  index: number;
  start: number;
  item: T;
}

/**
 * Virtualises a list rendered inside the shared `ScrollArea`: binds `@tanstack/vue-virtual` to
 * the area's viewport and measures rows of any height. Bind `bindScrollArea` with `:ref` on the
 * `ScrollArea`, and `measure` with `:ref` plus `:data-index` on each row. `items` may be an
 * array updated in place; every trigger re-keys the rows.
 */
export function useScrollAreaVirtualizer<T>(
  items: Ref<readonly T[]>,
  options: ScrollAreaVirtualizerOptions<T>,
) {
  let scrollArea: ComponentPublicInstance | null = null;
  const viewport = shallowRef<HTMLElement | null>(null);

  function resolveViewport() {
    const root: unknown = scrollArea?.$el;
    viewport.value =
      root instanceof HTMLElement
        ? root.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
        : null;
  }

  const virtualizer = useVirtualizer(
    computed(() => {
      const list = items.value;
      const element = viewport.value;
      return {
        count: list.length,
        getScrollElement: () => (element?.isConnected ? element : null),
        estimateSize: () => options.estimateSize,
        overscan: options.overscan ?? 12,
        getItemKey: (index: number) => {
          const item = list[index];
          return item === undefined ? index : options.itemKey(item, index);
        },
      };
    }),
  );

  const visible = computed<VirtualListItem<T>[]>(() => {
    const list = items.value;
    const result: VirtualListItem<T>[] = [];
    for (const row of virtualizer.value.getVirtualItems()) {
      const item = list[row.index];
      if (item !== undefined) {
        result.push({
          key: options.itemKey(item, row.index),
          index: row.index,
          start: row.start,
          item,
        });
      }
    }
    return result;
  });
  const totalSize = computed(() => virtualizer.value.getTotalSize());

  function measure(element: Element | ComponentPublicInstance | null) {
    if (element instanceof Element) {
      virtualizer.value.measureElement(element);
    }
  }

  function bindScrollArea(instance: Element | ComponentPublicInstance | null) {
    scrollArea = instance instanceof Element ? null : instance;
    resolveViewport();
  }

  return { bindScrollArea, virtualizer, visible, totalSize, measure };
}
