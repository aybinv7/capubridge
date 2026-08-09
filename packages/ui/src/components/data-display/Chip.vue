<script setup lang="ts">
import { computed, type Component } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import type { SurfaceVariant, UiSize } from "../../foundations/contracts.ts";
import { cn } from "../../shared/cn.ts";
import { nestedSizeClasses } from "../../shared/sizeClasses.ts";
import Surface from "../surface/Surface.vue";
import {
  chipFontSizes,
  chipIconSizes,
  chipPaddings,
  chipRoundedClasses,
} from "./chip.contracts.ts";
import type { ChipProps } from "./dataDisplay.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ChipProps>(), {
  accent: undefined,
  as: undefined,
  clickable: undefined,
  color: undefined,
  contentClassName: undefined,
  disabled: undefined,
  hoverable: undefined,
  icon: undefined,
  iconProps: undefined,
  outline: undefined,
  rounded: undefined,
  size: undefined,
  surfaceLevel: undefined,
  variant: undefined,
});

const d = useComponentDefaults("Chip", props, {
  as: "span" as string | Component,
  clickable: undefined as boolean | undefined,
  disabled: false,
  hoverable: false,
  iconProps: {} as Record<string, unknown>,
  outline: true,
  rounded: false,
  size: "md" as UiSize,
  variant: "gradient" as SurfaceVariant,
});

defineSlots<{
  default?: () => unknown;
  icon?: () => unknown;
}>();

const clickable = computed(
  () =>
    d.value.clickable === true ||
    (d.value.clickable === undefined && (d.value.as === "a" || d.value.as === "button")),
);
const isFill = computed(
  () => d.value.variant === "solid-fill" || d.value.variant === "gradient-fill",
);

const rootClass = computed(() =>
  cn(
    "cui-chip group/cui-chip relative inline-flex font-semibold select-none focus:ring-0 focus:outline-0 focus:outline-none",
    !isFill.value && "text-cui-primary",
    d.value.rounded ? "rounded-full" : chipRoundedClasses[d.value.size],
    clickable.value && "duration-200",
    clickable.value && d.value.as === "a" ? "cursor-pointer" : "cursor-auto",
    nestedSizeClasses(d.value.size, "height"),
    chipFontSizes[d.value.size],
  ),
);

const chipContentClass = computed(() =>
  cn(
    "relative flex items-center justify-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap [&>svg]:shrink-0",
    chipIconSizes[d.value.size],
    chipPaddings[d.value.size],
    d.value.contentClassName,
  ),
);
</script>

<template>
  <Surface
    v-bind="$attrs"
    :accent="d.accent"
    :as="d.as"
    :class="rootClass"
    :clickable="clickable"
    :color="d.color"
    :content-class-name="chipContentClass"
    :hoverable="d.hoverable || clickable"
    :level="d.surfaceLevel"
    :outline="d.outline"
    :variant="d.variant"
    @contextmenu.capture.prevent
  >
    <slot name="icon">
      <component :is="d.icon" v-if="d.icon" v-bind="d.iconProps" />
    </slot>
    <slot />
  </Surface>
</template>
