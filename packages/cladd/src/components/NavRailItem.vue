<script setup lang="ts">
import { computed, shallowRef, useAttrs, type Component } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { useNavRailTooltip } from '../composables/useNavRailTooltip.ts';
import { cn } from '../shared/cn.ts';
import Button from './Button.vue';
import type {
  NavRailItemCurrent,
  NavRailItemProps,
} from './navRail.contracts.ts';
import { useNavRailContext } from './navRailContext.ts';
import NavRailTooltip from './NavRailTooltip.vue';
import { resolveOverlayElement } from './overlay.contracts.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavRailItemProps>(), {
  active: undefined,
  as: undefined,
  current: undefined,
  disabled: undefined,
  hideLabel: undefined,
  tooltip: undefined,
});

const slots = defineSlots<{
  hint?: () => unknown;
  icon?: (props: { active: boolean }) => unknown;
  indicator?: () => unknown;
}>();

const d = useComponentDefaults('NavRailItem', props, {
  active: false,
  as: 'a' as string | Component,
  current: 'page' as NavRailItemCurrent,
  disabled: false,
  hideLabel: false,
  tooltip: true,
});

const rail = useNavRailContext();
const railLabels = computed(() => rail?.labels.value ?? true);
const labelVisible = computed(() => railLabels.value && !d.value.hideLabel);
const tooltipEnabled = computed(
  () => d.value.tooltip && !labelVisible.value && !d.value.disabled,
);
const tooltip = useNavRailTooltip(tooltipEnabled);
const button = shallowRef<unknown>();
const anchor = computed(() => resolveOverlayElement(button.value));

function setButton(value: unknown): void {
  button.value = value;
}

const attrs = useAttrs();
const forwardAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

const rootClass = computed(() =>
  cn(
    'cladd-nav-rail-item shrink-0 text-cladd-2xs font-normal',
    railLabels.value ? 'h-12.5 w-13.5' : 'size-11',
    d.value.active
      ? 'font-medium text-cladd-fg'
      : 'text-cladd-fg-softer hover:text-cladd-fg',
    attrs.class,
  ),
);

const contentClass = computed(() =>
  cn(
    'flex-col gap-0.75 px-0 py-0',
    railLabels.value ? '[&>svg]:size-4.25' : '[&>svg]:size-5',
  ),
);

const indicatorClass = computed(() =>
  cn(
    'cladd-nav-rail-item__indicator pointer-events-none absolute flex',
    railLabels.value ? 'top-1.5 right-2.5' : 'top-2 right-2',
  ),
);
</script>

<template>
  <Button
    v-bind="forwardAttrs"
    :ref="setButton"
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
    @focusin="tooltip.onFocusin"
    @focusout="tooltip.onFocusout"
    @keydown="tooltip.onKeydown"
    @pointerdown="tooltip.onPointerdown"
    @pointerenter="tooltip.onPointerenter"
    @pointerleave="tooltip.onPointerleave"
  >
    <slot name="icon" :active="d.active" />
    <span
      v-if="labelVisible"
      class="cladd-nav-rail-item__label max-w-full truncate px-0.5"
      data-slot="nav-rail-item-label"
    >
      {{ d.label }}
    </span>
    <span
      v-if="slots.indicator"
      :class="indicatorClass"
      data-slot="nav-rail-item-indicator"
    >
      <slot name="indicator" />
    </span>
  </Button>
  <NavRailTooltip
    v-if="tooltipEnabled"
    v-model:open="tooltip.open.value"
    :anchor-element="anchor"
  >
    <span data-slot="nav-rail-item-tooltip-label">{{ d.label }}</span>
    <slot name="hint" />
  </NavRailTooltip>
</template>
