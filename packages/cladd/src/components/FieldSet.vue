<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { FieldSetProps } from './field.contracts.ts';
import { provideFieldSetContext } from './fieldContext.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
  legend?: () => unknown;
}>();

const props = withDefaults(defineProps<FieldSetProps>(), {
  disabled: undefined,
  legend: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('FieldSet', props, {
  disabled: false,
  legend: '',
});

const disabled = computed(() => d.value.disabled);
provideFieldSetContext({ disabled });

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-field-set m-0 border-0 p-0',
    disabled.value && 'opacity-70',
    attrs.class,
  ),
);
</script>

<template>
  <fieldset
    v-bind="rootAttrs"
    :class="rootClass"
    data-slot="field-set"
    :disabled="disabled || undefined"
  >
    <slot name="legend" />
    <slot />
  </fieldset>
</template>
