<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import { listTitleClasses } from './list.contracts.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<{ className?: string }>(), {
  className: undefined,
});

const d = useComponentDefaults('ListTitle', props, {
  className: '',
});

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(listTitleClasses, d.value.className, attrs.class),
);
</script>

<template>
  <div v-bind="rootAttrs" :class="rootClass">
    <slot />
  </div>
</template>
