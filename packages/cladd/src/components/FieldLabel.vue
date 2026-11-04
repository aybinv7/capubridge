<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { FieldLabelProps } from './field.contracts.ts';
import { useFieldContext } from './fieldContext.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<FieldLabelProps>(), {
  as: undefined,
  controlId: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('FieldLabel', props, {});

const field = useFieldContext();
if (!field) {
  throw new Error('cladd-vue: `FieldLabel` must be used inside a `Field`.');
}

const targetId = computed(() => props.controlId ?? field.controlId.value);
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-field-label text-cladd-xs font-semibold text-cladd-fg',
    field.required.value &&
      'after:ml-0.5 after:text-cladd-primary after:content-["*"]',
    attrs.class,
  ),
);
</script>

<template>
  <component
    :is="d.as ?? 'label'"
    v-bind="rootAttrs"
    :id="field.labelId.value"
    :class="rootClass"
    data-slot="field-label"
    :for="targetId"
  >
    <slot />
  </component>
</template>
