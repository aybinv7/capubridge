<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import { backdropClasses } from './overlay.contracts.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<{ className?: string }>(), {
  className: undefined,
});

const d = useComponentDefaults('Backdrop', props, {
  className: '',
});

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(backdropClasses, d.value.className, attrs.class),
);
</script>

<template>
  <div v-bind="rootAttrs" :class="rootClass" data-part="backdrop">
    <slot />
  </div>
</template>
