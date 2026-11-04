import { inject, provide, type ComputedRef, type InjectionKey } from 'vue';

export interface ToggleGroupContextValue {
  multiple: boolean;
  toggleValue: (value: string) => void;
  value: string | string[] | undefined;
}

const toggleGroupContextKey: InjectionKey<
  ComputedRef<ToggleGroupContextValue>
> = Symbol('cladd-toggle-group');

export function useToggleGroupContext(): ComputedRef<ToggleGroupContextValue> | null {
  return inject(toggleGroupContextKey, null);
}

export function provideToggleGroupContext(
  value: ComputedRef<ToggleGroupContextValue>,
): void {
  provide(toggleGroupContextKey, value);
}
