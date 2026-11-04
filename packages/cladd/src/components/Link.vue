<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import FocusRing from './FocusRing.vue';
import type { LinkProps } from './link.contracts.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<LinkProps>(), {
  as: undefined,
  color: undefined,
  disabled: undefined,
  focusable: undefined,
  href: undefined,
  readOnly: undefined,
});

const d = useComponentDefaults('Link', props, {
  disabled: false,
  focusable: true,
  readOnly: false,
});

defineSlots<{
  default?: () => unknown;
}>();

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

const component = computed(() => {
  if (d.value.as !== undefined) return d.value.as;
  return typeof d.value.href === 'string' ? 'a' : 'button';
});

const inactive = computed(() => d.value.disabled || d.value.readOnly);
const showFocusRing = computed(() => d.value.focusable && !inactive.value);

const rootClass = computed(() =>
  cn(
    'group/cladd-link cladd-link relative appearance-none outline-0 select-none focus:ring-0 focus:outline-0',
    inactive.value && 'pointer-events-none',
    !inactive.value &&
      'cursor-pointer duration-200 active:opacity-50 active:duration-0',
    d.value.disabled && 'opacity-50',
    d.value.color && `cladd-color-${d.value.color} text-cladd-primary`,
    attrs.class,
  ),
);
</script>

<template>
  <component
    :is="component"
    v-bind="rootAttrs"
    :class="rootClass"
    :data-disabled="d.disabled || undefined"
    :data-readonly="d.readOnly || undefined"
    :disabled="d.disabled"
    :href="d.href"
    :read-only="d.readOnly"
    :tabindex="showFocusRing ? 0 : -1"
  >
    <slot />
    <FocusRing
      v-if="showFocusRing"
      class="rounded-cladd"
      :color="d.color"
      group="link"
    />
  </component>
</template>
