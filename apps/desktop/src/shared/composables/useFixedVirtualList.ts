import { computed, ref, watch } from "vue";
import type { ComputedRef, Ref } from "vue";
import { useEventListener, useResizeObserver } from "@vueuse/core";

export interface FixedVirtualListOptions {
  itemHeight: number;
  overscan?: number;
}

export interface FixedVirtualItem<T> {
  data: T;
  index: number;
}

export function useFixedVirtualList<T>(
  source: ComputedRef<readonly T[]> | Ref<readonly T[]>,
  container: Ref<HTMLElement | null>,
  options: FixedVirtualListOptions,
) {
  const scrollTop = ref(0);
  const viewportHeight = ref(0);
  const overscan = Math.max(0, options.overscan ?? 8);
  const itemHeight = Math.max(1, options.itemHeight);

  function measure() {
    const element = container.value;
    if (!element) return;
    scrollTop.value = element.scrollTop;
    viewportHeight.value = element.clientHeight;
  }

  useEventListener(container, "scroll", measure, { passive: true });
  useResizeObserver(container, measure);

  const startIndex = computed(() =>
    Math.max(0, Math.floor(scrollTop.value / itemHeight) - overscan),
  );
  const endIndex = computed(() =>
    Math.min(
      source.value.length,
      Math.ceil((scrollTop.value + viewportHeight.value) / itemHeight) + overscan,
    ),
  );
  const items = computed<FixedVirtualItem<T>[]>(() => {
    const result: FixedVirtualItem<T>[] = [];
    for (let index = startIndex.value; index < endIndex.value; index += 1) {
      const data = source.value[index];
      if (data !== undefined) result.push({ data, index });
    }
    return result;
  });
  const topSpacerHeight = computed(() => startIndex.value * itemHeight);
  const bottomSpacerHeight = computed(() =>
    Math.max(0, (source.value.length - endIndex.value) * itemHeight),
  );

  watch(
    () => source.value.length,
    () => {
      const element = container.value;
      if (!element) return;
      const maximum = Math.max(0, source.value.length * itemHeight - element.clientHeight);
      if (element.scrollTop > maximum) element.scrollTop = maximum;
      measure();
    },
    { flush: "post", immediate: true },
  );

  return {
    items,
    topSpacerHeight,
    bottomSpacerHeight,
    measure,
  };
}
