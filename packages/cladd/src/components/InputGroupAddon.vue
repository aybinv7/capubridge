<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { InputGroupAddonProps } from './inputGroup.contracts.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<InputGroupAddonProps>(), {
  as: undefined,
  decorative: undefined,
  interactive: undefined,
  side: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('InputGroupAddon', props, {
  decorative: true,
  interactive: false,
  side: 'inline-start',
});

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-input-group-addon flex shrink-0 items-center px-2.5 text-cladd-xs text-cladd-fg-softer',
    d.value.side === 'inline-start' ? 'order-first' : 'order-last',
    !d.value.interactive && 'pointer-events-none select-none',
    attrs.class,
  ),
);
</script>

<template>
  <component
    :is="d.as ?? 'span'"
    v-bind="rootAttrs"
    :aria-hidden="(!d.interactive && d.decorative) || undefined"
    :class="rootClass"
    :data-side="d.side"
    data-slot="input-group-addon"
  >
    <slot />
  </component>
</template>
