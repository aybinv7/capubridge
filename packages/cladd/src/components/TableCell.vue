<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { TableCellProps } from './table.contracts.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<TableCellProps>(), {
  numeric: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('TableCell', props, {
  numeric: false,
});

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-table-cell',
    d.value.numeric && 'text-right tabular-nums',
    attrs.class,
  ),
);
</script>

<template>
  <td v-bind="rootAttrs" :class="rootClass" data-slot="table-cell">
    <slot />
  </td>
</template>
