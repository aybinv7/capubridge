import type { ComputedRef, InjectionKey, Ref } from "vue";

export interface RadioGroupContext {
  disabled: ComputedRef<boolean>;
  name: ComputedRef<string | undefined>;
  required: ComputedRef<boolean>;
  value: Ref<string>;
}

export const radioGroupKey: InjectionKey<RadioGroupContext> = Symbol("cui-radio-group");
