import { computed, inject, provide, type ComputedRef, type InjectionKey } from "vue";

import type { SurfaceVariant, UiSize } from "../../foundations/contracts.ts";

export interface ToolbarContextValue {
  outline?: boolean;
  rounded?: boolean;
  size?: UiSize;
  variant?: SurfaceVariant;
}

const toolbarContextKey: InjectionKey<ComputedRef<ToolbarContextValue>> = Symbol("cui-toolbar");
const defaultToolbarContext = computed<ToolbarContextValue>(() => ({}));

export function useToolbarContext(): ComputedRef<ToolbarContextValue> {
  return inject(toolbarContextKey, defaultToolbarContext);
}

export function provideToolbarContext(value: ComputedRef<ToolbarContextValue>): void {
  provide(toolbarContextKey, value);
}
