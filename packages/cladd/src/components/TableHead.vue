<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { TableHeadProps } from './table.contracts.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<TableHeadProps>(), {
  numeric: undefined,
  scope: undefined,
  sortDirection: undefined,
});

const emit = defineEmits<{
  sort: [];
}>();

const attrs = useAttrs();
const d = useComponentDefaults('TableHead', props, {
  numeric: false,
  scope: 'col',
  sortDirection: 'none',
});

const sortable = computed(() => d.value.sortDirection !== 'none');
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-table-head font-semibold',
    d.value.numeric && 'text-right tabular-nums',
    attrs.class,
  ),
);
</script>

<template>
  <th
    v-bind="rootAttrs"
    :aria-sort="
      d.sortDirection === 'none'
        ? undefined
        : d.sortDirection === 'asc'
          ? 'ascending'
          : 'descending'
    "
    :class="rootClass"
    data-slot="table-head"
    :scope="d.scope"
  >
    <button
      v-if="sortable"
      class="inline-flex items-center gap-1 font-semibold"
      data-slot="table-sort-button"
      type="button"
      @click="emit('sort')"
    >
      <slot />
      <span aria-hidden="true" data-slot="table-sort-glyph">{{
        d.sortDirection === 'asc' ? '▲' : '▼'
      }}</span>
    </button>
    <slot v-else />
  </th>
</template>
