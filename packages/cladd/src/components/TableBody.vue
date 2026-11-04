<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { TableBodyProps } from './table.contracts.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
  empty?: () => unknown;
}>();

const props = withDefaults(defineProps<TableBodyProps>(), {
  empty: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('TableBody', props, {
  empty: false,
});

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn('cladd-table-body divide-y divide-cladd-outline', attrs.class),
);
</script>

<template>
  <tbody v-bind="rootAttrs" :class="rootClass" data-slot="table-body">
    <slot />
    <tr v-if="d.empty && !$slots.default" data-slot="table-empty-row">
      <td class="px-3 py-6 text-center text-cladd-fg-softer">
        <slot name="empty">No rows.</slot>
      </td>
    </tr>
  </tbody>
</template>
