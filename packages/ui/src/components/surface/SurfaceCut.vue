<script setup lang="ts">
import { computed, type Component } from "vue";

import { provideSurfaceContext, useSurface } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent } from "../../foundations/contracts.ts";
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

provideSurfaceContext(providedLevel, currentAccent);
</script>

<template>
  <component
    :is="props.as"
    v-bind="$attrs"
    class="cui-surface-cut"
    :class="[
      (props.color || props.accent) && `cui-accent-${currentAccent}`,
      props.outline && 'cui-surface-cut--outlined',
      props.hoverable && 'cui-surface-cut--hoverable',
      props.clickable && 'cui-surface-cut--clickable',
      props.pressed && 'cui-surface-cut--pressed',
    ]"
    :data-cui-accent="currentAccent"
    :data-cui-surface-cut-from-level="parentSurface.level.value"
  >
    <component :is="innerElement" class="cui-surface-cut__background" :class="props.bgClassName" />
    <component
      :is="innerElement"
      v-if="(props.hoverable || props.clickable) && props.overlayPosition === 'below'"
      class="cui-surface-cut__overlay cui-surface-cut__overlay--below"
      :class="props.overlayClassName"
    />
    <slot name="beforeContent" />
    <component
      :is="innerElement"
      v-if="props.wrapContent"
      class="cui-surface-cut__content"
      :class="props.contentClassName"
    >
      <slot />
    </component>
    <slot v-else />
    <component
      :is="innerElement"
      v-if="(props.hoverable || props.clickable) && props.overlayPosition === 'above'"
      class="cui-surface-cut__overlay cui-surface-cut__overlay--above"
      :class="props.overlayClassName"
    />
  </component>
</template>
