<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { FieldLegendProps } from './field.contracts.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<FieldLegendProps>(), {
  as: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('FieldLegend', props, {});

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-field-legend text-cladd-xs font-semibold text-cladd-fg',
    attrs.class,
  ),
);
</script>

<template>
  <component
    :is="d.as ?? 'legend'"
    v-bind="rootAttrs"
    :class="rootClass"
    data-slot="field-legend"
  >
    <slot />
  </component>
</template>
