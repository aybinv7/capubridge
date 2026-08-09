<script setup lang="ts">
import { computed, useAttrs, type Component } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";

import type {
  SurfaceLevelInput,
  SurfaceVariant,
  UiAccent,
  UiSize,
} from "../../foundations/contracts.ts";
import { cn } from "../../shared/cn.ts";
import { roundedClasses } from "../../shared/roundedClasses.ts";
import { rootSizeClasses } from "../../shared/sizeClasses.ts";
import Spinner from "../feedback/Spinner.vue";
import FocusRing from "../feedback/FocusRing.vue";
import Surface from "../surface/Surface.vue";
import SurfaceCut from "../surface/SurfaceCut.vue";
import {
  buttonFontSizes,
  buttonIconSizes,
  buttonPaddings,
  buttonSpinnerSizes,
  buttonVerticalPaddings,
  type ButtonProps,
  type ButtonSurface,
} from "./button.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ButtonProps>(), {
  accent: undefined,
  as: undefined,
  clickable: undefined,
  color: undefined,
  contentClassName: undefined,
  disabled: undefined,
  focusable: undefined,
  focused: undefined,
  hoverable: undefined,
  loading: undefined,
  multiline: undefined,
  outline: undefined,
  pressed: undefined,
  readOnly: undefined,
  rounded: undefined,
  size: undefined,
  square: undefined,
  surface: undefined,
  surfaceLevel: undefined,
  tightFocusRing: undefined,
  variant: undefined,
});

const d = useComponentDefaults("Button", props, {
  as: "button" as string | Component,
  clickable: true,
  disabled: false,
  focusable: true,
  focused: false,
  hoverable: true,
  loading: false,
  multiline: false,
  outline: true,
  pressed: false,
  readOnly: false,
  rounded: false,
  size: "md" as UiSize,
  square: false,
  surface: "surface" as ButtonSurface,
  tightFocusRing: false,
  variant: "gradient" as SurfaceVariant,
});

defineSlots<{
  default?: () => unknown;
}>();

const inactive = computed(() => d.value.disabled || d.value.readOnly);
const explicitAccent = computed(() => d.value.color ?? d.value.accent);
const attrs = useAttrs();
const surfaceComponent = computed(() => (d.value.surface === "cut" ? SurfaceCut : Surface));
const surfaceProps = computed(() => ({
  accent: d.value.accent,
  as: d.value.as,
  clickable: d.value.clickable && !inactive.value,
  color: d.value.color,
  contentClassName: buttonContentClass.value,
  hoverable: d.value.hoverable && !inactive.value,
  outline: d.value.outline,
  pressed: d.value.pressed,
  ...(d.value.surface === "surface"
    ? { level: d.value.surfaceLevel, variant: d.value.variant }
    : undefined),
}));
const rootProps = computed(() => ({ ...surfaceProps.value, ...attrs }));
const isNativeButton = computed(() => d.value.as === "button");
const radii = computed(() => roundedClasses(d.value.size, d.value.rounded, d.value.multiline));
const heightClass = computed(() =>
  rootSizeClasses(d.value.size, d.value.multiline ? "min-height" : "height"),
);
const isLink = computed(() => d.value.as === "a" || "href" in attrs);
const isFill = computed(
  () => d.value.variant === "solid-fill" || d.value.variant === "gradient-fill",
);

const rootClass = computed(() =>
  cn(
    "cui-button group/cui-button inline-block appearance-none text-left font-semibold outline-0 select-none focus:ring-0 focus:outline-0",
    explicitAccent.value &&
      explicitAccent.value !== "neutral" &&
      (isFill.value ? "text-cui-on-primary" : "text-cui-primary"),
    explicitAccent.value &&
      explicitAccent.value === "neutral" &&
      isFill.value &&
      "text-cui-on-primary",
    buttonFontSizes[d.value.size],
    heightClass.value,
    radii.value.itemRoundedClasses,
    d.value.square && "aspect-square",
    d.value.disabled && "pointer-events-none",
    !inactive.value && isLink.value ? "cursor-pointer" : "cursor-auto",
  ),
);

const buttonContentClass = computed(() =>
  cn(
    "flex w-full items-center justify-center gap-2 [&>svg]:shrink-0",
    buttonVerticalPaddings[d.value.size],
    d.value.multiline && heightClass.value,
    buttonIconSizes[d.value.size],
    d.value.disabled && "opacity-40",
    !d.value.square && buttonPaddings[d.value.size],
    d.value.loading && "scale-0 opacity-0!",
    d.value.contentClassName,
  ),
);

const spinnerClass = computed(() =>
  cn(
    "cui-button__spinner absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-100 opacity-100 duration-200 starting:scale-0 starting:opacity-0",
  ),
);

const focusRingClass = computed(() =>
  d.value.tightFocusRing ? "rounded-[inherit]" : radii.value.focusRoundedClasses,
);

function guardActivation(event: Event): void {
  if (!inactive.value) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
}
</script>

<template>
  <component
    :is="surfaceComponent"
    v-bind="rootProps"
    :class="rootClass"
    :aria-busy="d.loading || undefined"
    :aria-disabled="!isNativeButton && inactive ? 'true' : undefined"
    :data-disabled="d.disabled || undefined"
    :data-loading="d.loading || undefined"
    :data-pressed="d.pressed || undefined"
    :data-readonly="d.readOnly || undefined"
    :disabled="isNativeButton && inactive ? true : undefined"
    :tabindex="attrs.tabindex ?? (inactive ? -1 : undefined)"
    @click.capture="guardActivation"
    @contextmenu.capture.prevent
  >
    <template #beforeContent>
      <Spinner
        v-if="d.loading"
        :accent="d.accent"
        :class="spinnerClass"
        :color="d.color"
        :size="buttonSpinnerSizes[d.size]"
      />
      <FocusRing
        v-if="d.focused || (d.focusable && !inactive)"
        :accent="d.accent"
        :class="focusRingClass"
        :color="d.color"
        :force="d.focused"
        group="button"
        :offset="!d.tightFocusRing"
      />
    </template>
    <slot />
  </component>
</template>
