<script setup lang="ts">
import { computed, useAttrs, type Component } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import {
  provideSurfaceContext,
  useSurface,
} from '../contexts/surfaceContext.ts';
import type { SurfaceVariant } from '../foundations/contracts.ts';
import { resolveSurfaceLevel } from '../foundations/surfaceLevel.ts';
import { cn } from '../shared/cn.ts';
import type { SurfaceProps } from './surface.contracts.ts';
import { resolveSurfaceInnerElement } from './surface.shared.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SurfaceProps>(), {
  as: undefined,
  bgClassName: undefined,
  clickable: undefined,
  color: undefined,
  contentClassName: undefined,
  hoverable: undefined,
  level: undefined,
  outline: undefined,
  overlayClassName: undefined,
  overlayPosition: undefined,
  pressed: undefined,
  variant: undefined,
  wrapContent: undefined,
});

const d = useComponentDefaults('Surface', props, {
  as: 'div' as string | Component,
  clickable: false,
  hoverable: false,
  outline: false,
  overlayPosition: 'above' as 'above' | 'below',
  pressed: false,
  variant: 'solid' as SurfaceVariant,
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
const currentLevel = computed(() =>
  resolveSurfaceLevel(d.value.level, parentSurface.level.value),
);
// Upstream's `color = ''` — no accent-color fallback here; a Surface is only "colored" when the
// consumer says so. The published region color is `color || inheritedColor`.
const explicitColor = computed(() => d.value.color);
const providedColor = computed(
  () => explicitColor.value ?? parentSurface.color.value,
);
const providedLevel = computed(() =>
  d.value.variant === 'transparent'
    ? currentLevel.value - 1
    : currentLevel.value,
);
const innerElement = computed(() => resolveSurfaceInnerElement(d.value.as));
const isFill = computed(
  () => d.value.variant === 'solid-fill' || d.value.variant === 'gradient-fill',
);

const rootClass = computed(() =>
  cn(
    'cladd-surface relative',
    `cladd-surface-level-${currentLevel.value}`,
    explicitColor.value && `cladd-color-${explicitColor.value}`,
    isFill.value ? 'text-cladd-on-primary' : 'text-cladd-fg',
    d.value.hoverable && 'cladd-hoverable',
    d.value.clickable && 'cladd-clickable',
    attrs.class,
  ),
);

const backgroundClass = computed(() =>
  cn(
    'cladd-surface__background pointer-events-none absolute inset-0 rounded-[inherit]',
    d.value.variant === 'solid' && 'bg-cladd-surface',
    d.value.variant === 'solid-fill' && 'bg-cladd-primary',
    d.value.variant === 'gradient' &&
      'bg-linear-to-br from-cladd-surface-highlight to-cladd-surface',
    d.value.variant === 'gradient-fill' &&
      'bg-linear-to-br from-cladd-primary to-cladd-primary/85 light:from-cladd-primary/80 light:to-cladd-primary',
    d.value.outline &&
      (isFill.value ? 'shadow-cladd-outline-fill' : 'shadow-cladd-outline'),
    d.value.variant === 'transparent' &&
      d.value.hoverable &&
      'duration-200 cladd-surface-hover:bg-cladd-surface',
    d.value.variant === 'transparent' &&
      d.value.hoverable &&
      d.value.clickable &&
      'cladd-surface-press:bg-cladd-surface',
    d.value.bgClassName,
  ),
);

const overlayClass = computed(() =>
  cn(
    'cladd-surface__overlay pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 duration-200',
    d.value.hoverable &&
      !d.value.pressed &&
      cn(
        'cladd-surface-hover:opacity-100',
        isFill.value
          ? 'cladd-surface-hover:bg-cladd-surface-hover-fill'
          : 'cladd-surface-hover:bg-cladd-surface-hover',
      ),
    d.value.clickable &&
      (d.value.pressed
        ? 'bg-cladd-surface-pressed opacity-100'
        : 'cladd-surface-press:bg-cladd-surface-pressed cladd-surface-press:opacity-100'),
    d.value.overlayClassName,
  ),
);

const contentClass = computed(() =>
  cn(
    'cladd-surface__content relative h-full',
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
