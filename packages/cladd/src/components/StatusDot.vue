<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import {
  statusDotSizeClasses,
  type StatusDotProps,
  type StatusDotSize,
  type StatusDotVariant,
} from './statusDot.contracts.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<StatusDotProps>(), {
  color: undefined,
  label: undefined,
  pulse: undefined,
  size: undefined,
  variant: undefined,
});

const d = useComponentDefaults('StatusDot', props, {
  pulse: false,
  size: 'sm' as StatusDotSize,
  variant: 'solid' as StatusDotVariant,
});

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

const tone = computed(() => {
  const accent = Boolean(d.value.color);
  if (d.value.variant === 'hollow') {
    return accent
      ? 'ring-1 ring-cladd-primary ring-inset'
      : 'ring-1 ring-cladd-fg-softer ring-inset';
  }
  return accent ? 'bg-cladd-primary' : 'bg-cladd-fg-softer';
});

const rootClass = computed(() =>
  cn(
    'cladd-status-dot inline-block shrink-0 rounded-full',
    statusDotSizeClasses[d.value.size],
    d.value.color && `cladd-color-${d.value.color}`,
    tone.value,
    d.value.pulse && 'motion-safe:animate-pulse',
    attrs.class,
  ),
);
</script>

<template>
  <span
    v-bind="rootAttrs"
    :class="rootClass"
    :role="d.label ? 'img' : undefined"
    :aria-label="d.label || undefined"
    :aria-hidden="d.label ? undefined : 'true'"
    :data-color="d.color"
    :data-variant="d.variant"
    :data-pulse="d.pulse || undefined"
  />
</template>
