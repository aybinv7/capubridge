<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { TableHeaderProps } from './table.contracts.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<TableHeaderProps>(), {
  sticky: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('TableHeader', props, {
  sticky: false,
});

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-table-header border-b border-cladd-outline bg-cladd-surface text-cladd-2xs font-semibold tracking-wide text-cladd-fg-soft uppercase',
    d.value.sticky && 'sticky top-0 z-10 [&_th]:sticky [&_th]:top-0',
    attrs.class,
  ),
);
</script>

<template>
  <thead v-bind="rootAttrs" :class="rootClass" data-slot="table-header">
    <slot />
  </thead>
</template>
