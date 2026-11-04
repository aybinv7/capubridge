<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  /** Override the separator content. Default: a short outline bar. */
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<{ className?: string }>(), {
  className: undefined,
});

const d = useComponentDefaults('OTPFieldSeparator', props, {});

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-otp-field-separator flex items-center text-cladd-outline select-none',
    d.value.className,
    attrs.class,
  ),
);
</script>

<template>
  <div v-bind="rootAttrs" aria-hidden="true" :class="rootClass">
    <slot><span class="h-0.5 w-2 bg-cladd-outline" /></slot>
  </div>
</template>
