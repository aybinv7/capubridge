import {
  computed,
  inject,
  provide,
  type ComputedRef,
  type InjectionKey,
} from 'vue';

import type { SurfaceVariant, UiSize } from '../foundations/contracts.ts';
import type { Color } from '../types.ts';

export interface SegmentedContextValue {
  activeColor?: Color;
  activeOutline?: boolean;
  activeVariant?: SurfaceVariant;
  color?: Color;
  outline?: boolean;
  rounded?: boolean;
  size?: UiSize;
  variant?: SurfaceVariant;
}

const segmentedContextKey: InjectionKey<ComputedRef<SegmentedContextValue>> =
  Symbol('cladd-segmented');
const defaultSegmentedContext = computed<SegmentedContextValue>(() => ({}));

export function useSegmentedContext(): ComputedRef<SegmentedContextValue> {
  return inject(segmentedContextKey, defaultSegmentedContext);
}

export function provideSegmentedContext(
  value: ComputedRef<SegmentedContextValue>,
): void {
  provide(segmentedContextKey, value);
}
