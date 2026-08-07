<script setup lang="ts">
import { computed, useAttrs, type Component } from "vue";

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
  type ButtonSurface,
} from "./button.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    as?: string | Component;
    clickable?: boolean;
    color?: UiAccent;
    contentClassName?: string;
    disabled?: boolean;
    focusable?: boolean;
    focused?: boolean;
    hoverable?: boolean;
    loading?: boolean;
    multiline?: boolean;
    outline?: boolean;
    pressed?: boolean;
    readOnly?: boolean;
    rounded?: boolean;
    size?: UiSize;
    square?: boolean;
    surface?: ButtonSurface;
    surfaceLevel?: SurfaceLevelInput;
    tightFocusRing?: boolean;
    variant?: SurfaceVariant;
  }>(),
  {
    accent: undefined,
    as: "button",
    clickable: true,
    color: undefined,
    contentClassName: undefined,
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
    size: "md",
    square: false,
    surface: "surface",
    surfaceLevel: undefined,
    tightFocusRing: false,
    variant: "gradient",
  },
);

defineSlots<{
  default?: () => unknown;
}>();

const inactive = computed(() => props.disabled || props.readOnly);
const explicitAccent = computed(() => props.color ?? props.accent);
const attrs = useAttrs();
const surfaceComponent = computed(() => (props.surface === "cut" ? SurfaceCut : Surface));
const surfaceProps = computed(() => ({
  accent: props.accent,
  as: props.as,
  clickable: props.clickable && !inactive.value,
  color: props.color,
  contentClassName: buttonContentClass.value,
  hoverable: props.hoverable && !inactive.value,
  outline: props.outline,
  pressed: props.pressed,
  ...(props.surface === "surface"
    ? { level: props.surfaceLevel, variant: props.variant }
    : undefined),
}));
const rootProps = computed(() => ({ ...surfaceProps.value, ...attrs }));
const isNativeButton = computed(() => props.as === "button");
const radii = computed(() => roundedClasses(props.size, props.rounded, props.multiline));
const heightClass = computed(() =>
  rootSizeClasses(props.size, props.multiline ? "min-height" : "height"),
);
const isLink = computed(() => props.as === "a" || "href" in attrs);

const rootClass = computed(() =>
  cn(
    "cui-button group/cui-button inline-block appearance-none text-left font-semibold outline-0 select-none focus:ring-0 focus:outline-0",
    buttonFontSizes[props.size],
    heightClass.value,
    radii.value.itemRoundedClasses,
    props.square && "aspect-square",
    props.disabled && "pointer-events-none",
    !inactive.value && isLink.value ? "cursor-pointer" : "cursor-auto",
  ),
);

const buttonContentClass = computed(() =>
  cn(
    "flex w-full items-center justify-center gap-2 [&>svg]:shrink-0",
    buttonVerticalPaddings[props.size],
    props.multiline && heightClass.value,
    buttonIconSizes[props.size],
    props.disabled && "opacity-40",
    !props.square && buttonPaddings[props.size],
    props.loading && "scale-0 opacity-0!",
    props.contentClassName,
  ),
);

const spinnerClass = computed(() =>
  cn(
    "cui-button__spinner absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-100 opacity-100 duration-200 starting:scale-0 starting:opacity-0",
  ),
);

const focusRingClass = computed(() =>
  props.tightFocusRing ? "rounded-[inherit]" : radii.value.focusRoundedClasses,
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
    :aria-busy="props.loading || undefined"
    :aria-disabled="!isNativeButton && inactive ? 'true' : undefined"
    :data-cui-explicit-accent="explicitAccent && explicitAccent !== 'neutral' ? 'true' : undefined"
    :data-disabled="props.disabled || undefined"
    :data-loading="props.loading || undefined"
    :data-pressed="props.pressed || undefined"
    :data-readonly="props.readOnly || undefined"
    :disabled="isNativeButton && inactive ? true : undefined"
    :tabindex="inactive ? -1 : undefined"
    @click.capture="guardActivation"
    @contextmenu.capture.prevent
  >
    <template #beforeContent>
      <Spinner
        v-if="props.loading"
        :accent="props.accent"
        :class="spinnerClass"
        :color="props.color"
        :size="buttonSpinnerSizes[props.size]"
      />
      <FocusRing
        v-if="props.focused || (props.focusable && !inactive)"
        :accent="props.accent"
        :class="focusRingClass"
        :color="props.color"
        :force="props.focused"
        group="button"
        :offset="!props.tightFocusRing"
      />
    </template>
    <slot />
  </component>
</template>
