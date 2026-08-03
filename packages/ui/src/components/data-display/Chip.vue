<script setup lang="ts">
import { computed, type Component } from "vue";

import type {
  SurfaceLevelInput,
  SurfaceVariant,
  UiAccent,
  UiSize,
} from "../../foundations/contracts.ts";
import Surface from "../surface/Surface.vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    as?: string | Component;
    clickable?: boolean;
    color?: UiAccent;
    contentClassName?: string;
    disabled?: boolean;
    hoverable?: boolean;
    icon?: Component;
    iconProps?: Record<string, unknown>;
    outline?: boolean;
    rounded?: boolean;
    size?: UiSize;
    surfaceLevel?: SurfaceLevelInput;
    variant?: SurfaceVariant;
  }>(),
  {
    accent: undefined,
    as: "span",
    clickable: undefined,
    color: undefined,
    contentClassName: undefined,
    disabled: false,
    hoverable: false,
    icon: undefined,
    iconProps: () => ({}),
    outline: true,
    rounded: false,
    size: "md",
    surfaceLevel: undefined,
    variant: "gradient",
  },
);

defineSlots<{
  default?: () => unknown;
  icon?: () => unknown;
}>();

const clickable = computed(
  () =>
    props.clickable === true ||
    (props.clickable === undefined && (props.as === "a" || props.as === "button")),
);
</script>

<template>
  <Surface
    v-bind="$attrs"
    :accent="props.accent"
    :as="props.as"
    class="cui-chip"
    :class="[`cui-chip--${props.size}`, props.rounded && 'cui-chip--rounded']"
    :clickable="clickable"
    :color="props.color"
    :content-class-name="props.contentClassName"
    :data-cui-explicit-accent="props.color || props.accent ? 'true' : undefined"
    :hoverable="props.hoverable || clickable"
    :level="props.surfaceLevel"
    :outline="props.outline"
    :variant="props.variant"
    @contextmenu.prevent
  >
    <slot name="icon">
      <component :is="props.icon" v-if="props.icon" v-bind="props.iconProps" />
    </slot>
    <slot />
  </Surface>
</template>
