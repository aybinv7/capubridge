<script setup lang="ts">
import { computed, useId, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { FieldProps } from './field.contracts.ts';
import {
  createFieldDescriptionRegistry,
  provideFieldContext,
  useFieldSetContext,
} from './fieldContext.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<FieldProps>(), {
  as: undefined,
  controlId: undefined,
  density: undefined,
  disabled: undefined,
  invalid: undefined,
  orientation: undefined,
  required: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('Field', props, {
  density: 'comfortable',
  disabled: false,
  invalid: false,
  orientation: 'vertical',
  required: false,
});

const baseId = useId();
const fieldSet = useFieldSetContext();
const descriptions = createFieldDescriptionRegistry();
const errors = createFieldDescriptionRegistry();

const controlId = computed(() => props.controlId ?? `${baseId}-control`);
const labelId = computed(() => `${baseId}-label`);
const disabled = computed(
  () => d.value.disabled || fieldSet?.disabled.value || false,
);
const invalid = computed(() => d.value.invalid);
const required = computed(() => d.value.required);
const describedBy = computed(() => {
  const ids = [
    ...descriptions.ids.value,
    ...(invalid.value ? errors.ids.value : []),
  ];
  return ids.length > 0 ? ids.join(' ') : undefined;
});

provideFieldContext({
  controlId,
  density: computed(() => d.value.density),
  describedBy,
  disabled,
  invalid,
  labelId,
  orientation: computed(() => d.value.orientation),
  registerDescription: descriptions.register,
  registerError: errors.register,
  required,
  unregisterDescription: descriptions.unregister,
  unregisterError: errors.unregister,
});

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-field flex',
    d.value.orientation === 'horizontal'
      ? 'flex-row items-start gap-3'
      : 'flex-col gap-1.5',
    d.value.density === 'compact' && 'gap-1',
    attrs.class,
  ),
);
</script>

<template>
  <component
    :is="d.as ?? 'div'"
    v-bind="rootAttrs"
    :class="rootClass"
    :data-disabled="disabled || undefined"
    :data-invalid="invalid || undefined"
    data-slot="field"
  >
    <slot />
  </component>
</template>
