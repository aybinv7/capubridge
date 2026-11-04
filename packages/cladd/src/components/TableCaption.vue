<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { TableCaptionProps } from './table.contracts.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<TableCaptionProps>(), {
  visuallyHidden: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('TableCaption', props, {
  visuallyHidden: false,
});

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-table-caption px-3 py-2 text-cladd-xs text-cladd-fg-soft',
    d.value.visuallyHidden && 'sr-only',
    attrs.class,
  ),
);
</script>

<template>
  <caption v-bind="rootAttrs" :class="rootClass" data-slot="table-caption">
    <slot />
  </caption>
</template>
