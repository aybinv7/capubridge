<script setup lang="ts">
import { computed, type Component } from "vue";

import { provideSurfaceContext, useSurface } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import type { SurfaceLevelInput, SurfaceVariant, UiAccent } from "../../foundations/contracts.ts";
import { resolveSurfaceLevel } from "../../foundations/surfaceLevel.ts";
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
    level?: SurfaceLevelInput;
    outline?: boolean;
    overlayClassName?: string;
    overlayPosition?: "above" | "below";
    pressed?: boolean;
    variant?: SurfaceVariant;
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
    level: undefined,
    outline: false,
    overlayClassName: undefined,
    overlayPosition: "above",
    pressed: false,
    variant: "solid",
    wrapContent: true,
  },
);

defineSlots<{
  beforeContent?: () => unknown;
  default?: () => unknown;
}>();

const parentSurface = useSurface();
const ui = useUiContext();
const currentLevel = computed(() => resolveSurfaceLevel(props.level, parentSurface.level.value));
const currentAccent = computed(
  () => props.color ?? props.accent ?? parentSurface.accent.value ?? ui.accent.value,
);
const providedLevel = computed(() =>
  props.variant === "transparent" ? currentLevel.value - 1 : currentLevel.value,
);
const innerElement = computed(() => resolveSurfaceInnerElement(props.as));
const isFill = computed(() => props.variant === "solid-fill" || props.variant === "gradient-fill");

const rootClass = computed(() =>
  cn(
    "cui-surface relative",
    `cui-surface-level-${currentLevel.value}`,
    `cui-surface--${props.variant}`,
    (props.color || props.accent) && `cui-accent-${currentAccent.value}`,
    isFill.value ? "text-cui-on-primary" : "text-cui-fg",
    props.outline && "cui-surface--outlined",
    props.hoverable && "cui-hoverable cui-surface--hoverable",
    props.clickable && "cui-clickable cui-surface--clickable",
    props.pressed && "cui-surface--pressed",
    isFill.value && "cui-surface--fill",
  ),
);

const backgroundClass = computed(() =>
  cn(
    "cui-surface__background pointer-events-none absolute inset-0 rounded-[inherit]",
    props.variant === "solid" && "bg-cui-surface",
    props.variant === "solid-fill" && "bg-cui-primary",
    props.variant === "gradient" && "bg-linear-to-br from-cui-surface-highlight to-cui-surface",
    props.variant === "gradient-fill" &&
      "bg-linear-to-br from-cui-primary to-cui-primary/85 cui-light:from-cui-primary/80 cui-light:to-cui-primary",
    props.outline && (isFill.value ? "shadow-cui-outline-fill" : "shadow-cui-outline"),
    props.variant === "transparent" &&
      props.hoverable &&
      "duration-200 cui-surface-hover:bg-cui-surface",
    props.variant === "transparent" &&
      props.hoverable &&
      props.clickable &&
      "cui-surface-press:bg-cui-surface",
    props.bgClassName,
  ),
);

const overlayClass = computed(() =>
  cn(
    "cui-surface__overlay pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 duration-200",
    props.hoverable &&
      !props.pressed &&
      cn(
        "cui-surface-hover:opacity-100",
        isFill.value
          ? "cui-surface-hover:bg-cui-surface-hover-fill"
          : "cui-surface-hover:bg-cui-surface-hover",
      ),
    props.clickable &&
      (props.pressed
        ? "bg-cui-surface-pressed opacity-100"
        : "cui-surface-press:bg-cui-surface-pressed cui-surface-press:opacity-100"),
    props.overlayClassName,
  ),
);

const contentClass = computed(() =>
  cn(
    "cui-surface__content relative h-full",
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
    :data-cui-surface-level="currentLevel"
    :data-cui-surface-variant="props.variant"
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
