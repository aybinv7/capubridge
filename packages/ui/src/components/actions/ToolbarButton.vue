<script setup lang="ts">
import { computed, useAttrs } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import Button from "./Button.vue";
import type { ButtonProps } from "./button.contracts.ts";
import { useToolbarContext } from "./toolbarContext.ts";

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

defineSlots<{
  default?: () => unknown;
}>();

const attrs = useAttrs();
const toolbar = useToolbarContext();
const d = useComponentDefaults("ToolbarButton", props, {});

const buttonProps = computed(() => ({
  accent: d.value.accent,
  as: d.value.as,
  clickable: d.value.clickable,
  color: d.value.color,
  contentClassName: d.value.contentClassName,
  disabled: d.value.disabled,
  focusable: d.value.focusable,
  focused: d.value.focused,
  hoverable: d.value.hoverable,
  loading: d.value.loading,
  multiline: d.value.multiline,
  outline: d.value.outline ?? toolbar.value.outline ?? false,
  pressed: d.value.pressed,
  readOnly: d.value.readOnly,
  rounded: d.value.rounded ?? toolbar.value.rounded ?? true,
  size: d.value.size ?? toolbar.value.size ?? "md",
  square: d.value.square,
  surface: d.value.surface,
  surfaceLevel: d.value.surfaceLevel,
  tightFocusRing: d.value.tightFocusRing,
  variant: d.value.variant ?? toolbar.value.variant ?? "transparent",
}));
</script>

<template>
  <Button v-bind="{ ...buttonProps, ...attrs }">
    <slot />
  </Button>
</template>
