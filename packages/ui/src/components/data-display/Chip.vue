<script setup lang="ts">
import { computed, type Component } from "vue";

import type {
  SurfaceLevelInput,
  SurfaceVariant,
  UiAccent,
  UiSize,
} from "../../foundations/contracts.ts";
import { cn } from "../../shared/cn.ts";
import { nestedSizeClasses } from "../../shared/sizeClasses.ts";
import Surface from "../surface/Surface.vue";
import {
  chipFontSizes,
  chipIconSizes,
  chipPaddings,
  chipRoundedClasses,
} from "./chip.contracts.ts";

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
const isFill = computed(() => props.variant === "solid-fill" || props.variant === "gradient-fill");
const explicitAccent = computed(() => props.color ?? props.accent);

const rootClass = computed(() =>
  cn(
    "cui-chip group/cui-chip relative inline-flex font-semibold select-none focus:ring-0 focus:outline-0 focus:outline-none",
    !isFill.value && "text-cui-primary",
    props.rounded ? "rounded-full" : chipRoundedClasses[props.size],
    clickable.value && "duration-200",
    clickable.value && props.as === "a" ? "cursor-pointer" : "cursor-auto",
    nestedSizeClasses(props.size, "height"),
    chipFontSizes[props.size],
  ),
);

const chipContentClass = computed(() =>
  cn(
    "relative flex items-center justify-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap [&>svg]:shrink-0",
    chipIconSizes[props.size],
    chipPaddings[props.size],
    props.contentClassName,
  ),
);
</script>

<template>
  <Surface
    v-bind="$attrs"
    :accent="props.accent"
    :as="props.as"
    :class="rootClass"
    :clickable="clickable"
    :color="props.color"
    :content-class-name="chipContentClass"
    :data-cui-explicit-accent="explicitAccent && explicitAccent !== 'neutral' ? 'true' : undefined"
    :hoverable="props.hoverable || clickable"
    :level="props.surfaceLevel"
    :outline="props.outline"
    :variant="props.variant"
    @contextmenu.capture.prevent
  >
    <slot name="icon">
      <component :is="props.icon" v-if="props.icon" v-bind="props.iconProps" />
    </slot>
    <slot />
  </Surface>
</template>
