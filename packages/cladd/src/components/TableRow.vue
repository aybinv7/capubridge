<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { TableRowProps } from './table.contracts.ts';
import { useTableContext } from './tableContext.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<TableRowProps>(), {
  hoverable: undefined,
  selected: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('TableRow', props, {
  selected: false,
});

const table = useTableContext();
const hoverable = computed(
  () => d.value.hoverable ?? table?.hoverable.value ?? false,
);
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-table-row border-cladd-outline transition-colors duration-200',
    hoverable.value && 'hover:bg-cladd-surface-hover',
    d.value.selected && 'bg-cladd-surface',
    attrs.class,
  ),
);
</script>

<template>
  <tr
    v-bind="rootAttrs"
    :class="rootClass"
    :data-selected="d.selected || undefined"
    :data-state="d.selected ? 'selected' : undefined"
    data-slot="table-row"
  >
    <slot />
  </tr>
</template>
