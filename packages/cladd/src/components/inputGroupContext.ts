import { inject, provide, type ComputedRef, type InjectionKey } from 'vue';

export interface InputGroupContextValue {
  controlId: ComputedRef<string | undefined>;
  disabled: ComputedRef<boolean>;
}

const inputGroupContextKey: InjectionKey<InputGroupContextValue> =
  Symbol('cladd-input-group');

export function provideInputGroupContext(
  value: InputGroupContextValue,
): InputGroupContextValue {
  provide(inputGroupContextKey, value);
  return value;
}

export function useInputGroupContext(): InputGroupContextValue | null {
  return inject(inputGroupContextKey, null);
}
