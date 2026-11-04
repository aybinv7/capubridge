<script setup lang="ts">
import { computed, useAttrs, type Component } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import Button from './Button.vue';
import type {
  NavRailItemCurrent,
  NavRailItemProps,
} from './navRail.contracts.ts';
import { useNavRailContext } from './navRailContext.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavRailItemProps>(), {
  active: undefined,
  as: undefined,
  current: undefined,
  disabled: undefined,
  hideLabel: undefined,
});

defineSlots<{
  icon?: () => unknown;
  indicator?: () => unknown;
}>();

const d = useComponentDefaults('NavRailItem', props, {
  active: false,
  as: 'a' as string | Component,
  current: 'page' as NavRailItemCurrent,
  disabled: false,
  hideLabel: false,
});

const rail = useNavRailContext();
const railLabels = computed(() => rail?.labels.value ?? true);
const labelVisible = computed(() => railLabels.value && !d.value.hideLabel);

const attrs = useAttrs();
const forwardAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

const rootClass = computed(() =>
  cn(
    'cladd-nav-rail-item shrink-0 text-cladd-2xs font-normal',
    railLabels.value ? 'h-12.5 w-13.5' : 'size-10',
    d.value.active
      ? 'font-medium text-cladd-fg'
      : 'text-cladd-fg-softer hover:text-cladd-fg',
    attrs.class,
  ),
);

const contentClass = 'flex-col gap-0.75 px-0 py-0 [&>svg]:size-4.25';
</script>

<template>
  <Button
    v-bind="forwardAttrs"
    :aria-current="d.active ? d.current : undefined"
    :aria-label="labelVisible ? undefined : d.label"
    :as="d.as"
    :class="rootClass"
    :content-class-name="contentClass"
    :data-active="d.active || undefined"
    :disabled="d.disabled"
    :outline="d.active"
    :surface-level="d.active ? '+2' : undefined"
    tight-focus-ring
    :variant="d.active ? 'solid' : 'transparent'"
  >
    <slot name="icon" />
    <span
      v-if="labelVisible"
      class="cladd-nav-rail-item__label max-w-full truncate px-0.5"
      data-slot="nav-rail-item-label"
    >
      {{ d.label }}
    </span>
    <span
      v-if="$slots.indicator"
      class="cladd-nav-rail-item__indicator pointer-events-none absolute top-1.5 right-2.5 flex"
      data-slot="nav-rail-item-indicator"
    >
      <slot name="indicator" />
    </span>
  </Button>
</template>
