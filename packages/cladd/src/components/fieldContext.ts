import {
  inject,
  provide,
  ref,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue';

import type { FieldDensity, FieldOrientation } from './field.contracts.ts';

export interface FieldContextValue {
  controlId: ComputedRef<string>;
  density: ComputedRef<FieldDensity>;
  describedBy: ComputedRef<string | undefined>;
  disabled: ComputedRef<boolean>;
  invalid: ComputedRef<boolean>;
  labelId: ComputedRef<string>;
  orientation: ComputedRef<FieldOrientation>;
  registerDescription: (id: string) => void;
  registerError: (id: string) => void;
  required: ComputedRef<boolean>;
  unregisterDescription: (id: string) => void;
  unregisterError: (id: string) => void;
}

const fieldContextKey: InjectionKey<FieldContextValue> = Symbol('cladd-field');

export function provideFieldContext(
  value: FieldContextValue,
): FieldContextValue {
  provide(fieldContextKey, value);
  return value;
}

export function useFieldContext(): FieldContextValue | null {
  return inject(fieldContextKey, null);
}

export function useOptionalFieldContext(): FieldContextValue | null {
  return inject(fieldContextKey, null);
}

export interface FieldSetContextValue {
  disabled: ComputedRef<boolean>;
}

const fieldSetContextKey: InjectionKey<FieldSetContextValue> =
  Symbol('cladd-field-set');

export function provideFieldSetContext(
  value: FieldSetContextValue,
): FieldSetContextValue {
  provide(fieldSetContextKey, value);
  return value;
}

export function useFieldSetContext(): FieldSetContextValue | null {
  return inject(fieldSetContextKey, null);
}

export function createFieldDescriptionRegistry(): {
  ids: Ref<string[]>;
  register: (id: string) => void;
  unregister: (id: string) => void;
} {
  const ids = ref<string[]>([]);
  return {
    ids,
    register: (id: string) => {
      if (!ids.value.includes(id)) ids.value = [...ids.value, id];
    },
    unregister: (id: string) => {
      ids.value = ids.value.filter((entry) => entry !== id);
    },
  };
}

export { fieldContextKey };
