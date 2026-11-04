<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { CollapsibleIndicatorProps } from './collapsible.contracts.ts';
import { useCollapsibleContext } from './collapsibleContext.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CollapsibleIndicatorProps>(), {
  as: undefined,
});

defineSlots<{
  default?: (state: { disabled: boolean; open: boolean }) => unknown;
}>();

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const collapsible = useCollapsibleContext();
const d = useComponentDefaults('CollapsibleIndicator', props, {
  as: 'span' as NonNullable<CollapsibleIndicatorProps['as']>,
});
const rootClass = computed(() =>
  cn('cladd-collapsible-indicator inline-flex', attrs.class),
);
</script>

<template>
  <component
    :is="d.as"
    v-bind="rootAttrs"
    aria-hidden="true"
    :class="rootClass"
    :data-disabled="collapsible.disabled || undefined"
    :data-open="collapsible.open || undefined"
  >
    <slot :disabled="collapsible.disabled" :open="collapsible.open" />
  </component>
</template>
