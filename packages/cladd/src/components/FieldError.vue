<script setup lang="ts">
import { computed, onBeforeUnmount, useAttrs, useId } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { FieldErrorProps } from './field.contracts.ts';
import { useFieldContext } from './fieldContext.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<FieldErrorProps>(), {
  as: undefined,
  errorId: undefined,
  live: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('FieldError', props, {
  live: false,
});

const field = useFieldContext();
if (!field) {
  throw new Error('cladd-vue: `FieldError` must be used inside a `Field`.');
}

const baseId = useId();
const errorId = computed(() => props.errorId ?? `${baseId}-error`);
field.registerError(errorId.value);
onBeforeUnmount(() => {
  field.unregisterError(errorId.value);
});

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-field-error text-cladd-2xs font-medium text-cladd-primary',
    attrs.class,
  ),
);
</script>

<template>
  <component
    :is="d.as ?? 'p'"
    v-bind="rootAttrs"
    :id="errorId"
    :class="rootClass"
    data-slot="field-error"
    :role="d.live ? 'alert' : undefined"
  >
    <slot />
  </component>
</template>
