<script setup lang="ts">
import { computed, type Component } from "vue";

import { provideSurfaceContext, useSurface } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import type { SurfaceLevelInput, SurfaceVariant, UiAccent } from "../../foundations/contracts.ts";
import { resolveSurfaceLevel } from "../../foundations/surfaceLevel.ts";
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

provideSurfaceContext(providedLevel, currentAccent);
</script>

<template>
  <component
    :is="props.as"
    v-bind="$attrs"
    class="cui-surface"
    :class="[
      `cui-surface-level-${currentLevel}`,
      `cui-surface--${props.variant}`,
      (props.color || props.accent) && `cui-accent-${currentAccent}`,
      props.outline && 'cui-surface--outlined',
      props.hoverable && 'cui-surface--hoverable',
      props.clickable && 'cui-surface--clickable',
      props.pressed && 'cui-surface--pressed',
      isFill && 'cui-surface--fill',
    ]"
    :data-cui-accent="currentAccent"
    :data-cui-surface-level="currentLevel"
    :data-cui-surface-variant="props.variant"
  >
    <component :is="innerElement" class="cui-surface__background" :class="props.bgClassName" />
    <component
      :is="innerElement"
      v-if="(props.hoverable || props.clickable) && props.overlayPosition === 'below'"
      class="cui-surface__overlay cui-surface__overlay--below"
      :class="props.overlayClassName"
    />
    <slot name="beforeContent" />
    <component
      :is="innerElement"
      v-if="props.wrapContent"
      class="cui-surface__content"
      :class="props.contentClassName"
    >
      <slot />
    </component>
    <slot v-else />
    <component
      :is="innerElement"
      v-if="(props.hoverable || props.clickable) && props.overlayPosition === 'above'"
      class="cui-surface__overlay cui-surface__overlay--above"
      :class="props.overlayClassName"
    />
  </component>
</template>
