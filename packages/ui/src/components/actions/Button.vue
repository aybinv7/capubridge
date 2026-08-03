<script setup lang="ts">
import { computed, useAttrs, type Component } from "vue";

import type {
  SurfaceLevelInput,
  SurfaceVariant,
  UiAccent,
  UiSize,
} from "../../foundations/contracts.ts";
import Spinner from "../feedback/Spinner.vue";
import FocusRing from "../feedback/FocusRing.vue";
import Surface from "../surface/Surface.vue";
import SurfaceCut from "../surface/SurfaceCut.vue";
import { buttonSpinnerSizes, type ButtonSurface } from "./button.contracts.ts";

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
const attrs = useAttrs();
const surfaceComponent = computed(() => (props.surface === "cut" ? SurfaceCut : Surface));
const surfaceProps = computed(() => ({
  accent: props.accent,
  as: props.as,
  clickable: props.clickable && !inactive.value,
  color: props.color,
  contentClassName: props.contentClassName,
  hoverable: props.hoverable && !inactive.value,
  outline: props.outline,
  pressed: props.pressed,
  ...(props.surface === "surface"
    ? { level: props.surfaceLevel, variant: props.variant }
    : undefined),
}));
const rootProps = computed(() => ({ ...surfaceProps.value, ...attrs }));
const isNativeButton = computed(() => props.as === "button");

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
    class="cui-button"
    :class="[
      `cui-button--${props.size}`,
      props.rounded && 'cui-button--rounded',
      props.multiline && 'cui-button--multiline',
      props.square && 'cui-button--square',
      inactive && 'cui-button--inactive',
      props.disabled && 'cui-button--disabled',
    ]"
    :aria-busy="props.loading || undefined"
    :aria-disabled="!isNativeButton && inactive ? 'true' : undefined"
    :data-cui-explicit-accent="props.color || props.accent ? 'true' : undefined"
    :data-disabled="props.disabled || undefined"
    :data-loading="props.loading || undefined"
    :data-readonly="props.readOnly || undefined"
    :disabled="isNativeButton && inactive ? true : undefined"
    :tabindex="inactive ? -1 : undefined"
    @click.capture="guardActivation"
    @contextmenu.prevent
  >
    <template #beforeContent>
      <Spinner
        v-if="props.loading"
        class="cui-button__spinner"
        :accent="props.accent"
        :color="props.color"
        :size="buttonSpinnerSizes[props.size]"
      />
      <FocusRing
        v-if="props.focused || (props.focusable && !inactive)"
        :accent="props.accent"
        :force="props.focused"
        :multiline="props.multiline"
        :offset="!props.tightFocusRing"
        :rounded="props.rounded"
        :size="props.size"
      />
    </template>
    <slot />
  </component>
</template>
