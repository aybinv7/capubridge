import { computed, inject, provide, type ComputedRef, type InjectionKey } from "vue";

import type { SurfaceVariant, UiAccent, UiSize } from "../../foundations/contracts.ts";

export interface SegmentedContextValue {
  activeColor?: UiAccent;
  activeOutline?: boolean;
  activeVariant?: SurfaceVariant;
  color?: UiAccent;
  outline?: boolean;
  rounded?: boolean;
  size?: UiSize;
  variant?: SurfaceVariant;
}

const segmentedContextKey: InjectionKey<ComputedRef<SegmentedContextValue>> =
  Symbol("cui-segmented");
const defaultSegmentedContext = computed<SegmentedContextValue>(() => ({}));

export function useSegmentedContext(): ComputedRef<SegmentedContextValue> {
  return inject(segmentedContextKey, defaultSegmentedContext);
}

export function provideSegmentedContext(value: ComputedRef<SegmentedContextValue>): void {
  provide(segmentedContextKey, value);
}
