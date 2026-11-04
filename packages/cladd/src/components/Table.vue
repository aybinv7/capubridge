<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { TableProps } from './table.contracts.ts';
import { provideTableContext } from './tableContext.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<TableProps>(), {
  dense: undefined,
  hoverable: undefined,
  stickyHeader: undefined,
  wrapperClassName: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('Table', props, {
  dense: false,
  hoverable: false,
  stickyHeader: false,
  wrapperClassName: '',
});

const dense = computed(() => d.value.dense);
const hoverable = computed(() => d.value.hoverable);
provideTableContext({ dense, hoverable });

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const wrapperClass = computed(() =>
  cn(
    'cladd-table-container w-full overflow-x-auto rounded-cladd-md border border-cladd-outline',
    d.value.wrapperClassName,
    attrs.class,
  ),
);
const tableClass = computed(() =>
  cn(
    'cladd-table w-full border-collapse text-left text-cladd-xs text-cladd-fg',
    d.value.dense
      ? '[&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1'
      : '[&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2',
  ),
);
</script>

<template>
  <div v-bind="rootAttrs" :class="wrapperClass" data-slot="table-container">
    <table
      :class="tableClass"
      :data-dense="dense || undefined"
      data-slot="table"
    >
      <slot />
    </table>
  </div>
</template>
