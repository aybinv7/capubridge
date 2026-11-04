<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { TableFooterProps } from './table.contracts.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<TableFooterProps>(), {
  sticky: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('TableFooter', props, {
  sticky: false,
});

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-table-footer border-t border-cladd-outline bg-cladd-surface font-medium',
    d.value.sticky && 'sticky bottom-0 z-10',
    attrs.class,
  ),
);
</script>

<template>
  <tfoot v-bind="rootAttrs" :class="rootClass" data-slot="table-footer">
    <slot />
  </tfoot>
</template>
