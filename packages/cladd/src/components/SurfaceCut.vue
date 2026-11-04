<script setup lang="ts">
import { computed, useAttrs, type Component } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import {
  provideSurfaceContext,
  useSurface,
} from '../contexts/surfaceContext.ts';
import { cn } from '../shared/cn.ts';
import type { SurfaceCutProps } from './surface.contracts.ts';
import { resolveSurfaceInnerElement } from './surface.shared.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SurfaceCutProps>(), {
  as: undefined,
  bgClassName: undefined,
  clickable: undefined,
  color: undefined,
  contentClassName: undefined,
  hoverable: undefined,
  outline: undefined,
  overlayClassName: undefined,
  overlayPosition: undefined,
  pressed: undefined,
  wrapContent: undefined,
});

const d = useComponentDefaults('SurfaceCut', props, {
  as: 'div' as string | Component,
  clickable: false,
  hoverable: false,
  outline: true,
  overlayPosition: 'above' as 'above' | 'below',
  pressed: false,
  wrapContent: true,
});

defineSlots<{
  beforeContent?: () => unknown;
  default?: () => unknown;
}>();

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const parentSurface = useSurface();
// Upstream's `color = ''` — no accent-color fallback; `color || inheritedColor` is published.
const explicitColor = computed(() => d.value.color);
const providedColor = computed(
  () => explicitColor.value ?? parentSurface.color.value,
);
const providedLevel = computed(() => parentSurface.level.value - 1);
const innerElement = computed(() => resolveSurfaceInnerElement(d.value.as));

const rootClass = computed(() =>
  cn(
    'cladd-surface-cut relative',
    explicitColor.value && `cladd-color-${explicitColor.value}`,
    d.value.hoverable && 'cladd-hoverable',
    d.value.clickable && 'cladd-clickable',
    attrs.class,
  ),
);

const backgroundClass = computed(() =>
  cn(
    'cladd-surface-cut__background pointer-events-none absolute inset-0 rounded-[inherit] bg-cladd-surface-cut',
    d.value.outline && 'shadow-cladd-cut-outline',
    d.value.bgClassName,
  ),
);

const overlayClass = computed(() =>
  cn(
    'cladd-surface-cut__overlay pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 duration-200',
    d.value.hoverable &&
      !d.value.pressed &&
      'cladd-surface-hover:bg-cladd-surface-hover cladd-surface-hover:opacity-100',
    d.value.clickable &&
      (d.value.pressed
        ? 'bg-cladd-surface-pressed opacity-100'
        : 'cladd-surface-press:bg-cladd-surface-pressed cladd-surface-press:opacity-100'),
    d.value.overlayClassName,
  ),
);

const contentClass = computed(() =>
  cn(
    'cladd-surface-cut__content relative h-full',
    d.value.clickable &&
      'duration-200 cladd-surface-press:scale-95 cladd-surface-press:opacity-75',
    d.value.contentClassName,
  ),
);

provideSurfaceContext(providedLevel, providedColor);
</script>

<template>
  <component :is="d.as" v-bind="rootAttrs" :class="rootClass">
    <component :is="innerElement" :class="backgroundClass" />
    <component
      :is="innerElement"
      v-if="(d.hoverable || d.clickable) && d.overlayPosition === 'below'"
      :class="overlayClass"
    />
    <slot name="beforeContent" />
    <component :is="innerElement" v-if="d.wrapContent" :class="contentClass">
      <slot />
    </component>
    <slot v-else />
    <component
      :is="innerElement"
      v-if="(d.hoverable || d.clickable) && d.overlayPosition === 'above'"
      :class="overlayClass"
    />
  </component>
</template>
