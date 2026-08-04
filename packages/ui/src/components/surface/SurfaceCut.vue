<script setup lang="ts">
import { computed, type Component } from "vue";

import { provideSurfaceContext, useSurface } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent } from "../../foundations/contracts.ts";
import { cn } from "../../shared/cn.ts";
import { resolveSurfaceInnerElement } from "./surface.shared.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    as?: string | Component;
    bgClassName?: string;
    clickable?: boolean;
    color?: UiAccent;
    contentClassName?: string;
    hoverable?: boolean;
    outline?: boolean;
    overlayClassName?: string;
    overlayPosition?: "above" | "below";
    pressed?: boolean;
    wrapContent?: boolean;
  }>(),
  {
    accent: undefined,
    as: "div",
    bgClassName: undefined,
    clickable: false,
    color: undefined,
    contentClassName: undefined,
    hoverable: false,
    outline: true,
    overlayClassName: undefined,
    overlayPosition: "above",
    pressed: false,
    wrapContent: true,
  },
);

defineSlots<{
  beforeContent?: () => unknown;
  default?: () => unknown;
}>();

const parentSurface = useSurface();
const ui = useUiContext();
const currentAccent = computed(
  () => props.color ?? props.accent ?? parentSurface.accent.value ?? ui.accent.value,
);
const providedLevel = computed(() => parentSurface.level.value - 1);
const innerElement = computed(() => resolveSurfaceInnerElement(props.as));

const rootClass = computed(() =>
  cn(
    "cui-surface-cut relative text-cui-fg",
    (props.color || props.accent) && `cui-accent-${currentAccent.value}`,
    props.outline && "cui-surface-cut--outlined",
    props.hoverable && "cui-hoverable cui-surface-cut--hoverable",
    props.clickable && "cui-clickable cui-surface-cut--clickable",
    props.pressed && "cui-surface-cut--pressed",
  ),
);

const backgroundClass = computed(() =>
  cn(
    "cui-surface-cut__background pointer-events-none absolute inset-0 rounded-[inherit] bg-cui-surface-cut",
    props.outline && "shadow-cui-cut-outline",
    props.bgClassName,
  ),
);

const overlayClass = computed(() =>
  cn(
    "cui-surface-cut__overlay pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 duration-200",
    props.hoverable &&
      !props.pressed &&
      "cui-surface-hover:bg-cui-surface-hover cui-surface-hover:opacity-100",
    props.clickable &&
      (props.pressed
        ? "bg-cui-surface-pressed opacity-100"
        : "cui-surface-press:bg-cui-surface-pressed cui-surface-press:opacity-100"),
    props.overlayClassName,
  ),
);

const contentClass = computed(() =>
  cn(
    "cui-surface-cut__content relative",
    props.clickable && "duration-200 cui-surface-press:scale-95 cui-surface-press:opacity-75",
    props.contentClassName,
  ),
);

provideSurfaceContext(providedLevel, currentAccent);
</script>

<template>
  <component
    :is="props.as"
    v-bind="$attrs"
    :class="rootClass"
    :data-cui-accent="currentAccent"
    :data-cui-surface-cut-from-level="parentSurface.level.value"
  >
    <component :is="innerElement" :class="backgroundClass" />
    <component
      :is="innerElement"
      v-if="(props.hoverable || props.clickable) && props.overlayPosition === 'below'"
      :class="overlayClass"
    />
    <slot name="beforeContent" />
    <component :is="innerElement" v-if="props.wrapContent" :class="contentClass">
      <slot />
    </component>
    <slot v-else />
    <component
      :is="innerElement"
      v-if="(props.hoverable || props.clickable) && props.overlayPosition === 'above'"
      :class="overlayClass"
    />
  </component>
</template>
