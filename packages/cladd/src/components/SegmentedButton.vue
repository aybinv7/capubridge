<script setup lang="ts">
import { computed } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import type { ButtonProps } from './button.contracts.ts';
import Button from './Button.vue';
import type { SegmentedButtonProps } from './segmented.contracts.ts';
import { useSegmentedContext } from './segmentedContext.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ButtonProps & SegmentedButtonProps>(), {
  active: undefined,
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

const d = useComponentDefaults('SegmentedButton', props, {
  active: false,
});

const segmented = useSegmentedContext();

const size = computed(() => segmented.value.size ?? 'md');
const rounded = computed(() => segmented.value.rounded ?? true);
const color = computed(() => segmented.value.color);
const variant = computed(() => segmented.value.variant);
const outline = computed(() => segmented.value.outline);
const activeColor = computed(() => segmented.value.activeColor);
const activeVariant = computed(() => segmented.value.activeVariant);
const activeOutline = computed(() => segmented.value.activeOutline);

const buttonProps = computed(() => ({
  size: d.value.size ?? size.value,
  rounded: d.value.rounded ?? rounded.value,
  color:
    d.value.color ??
    (d.value.active && activeColor.value ? activeColor.value : color.value),
  variant:
    d.value.variant ??
    (d.value.active && activeVariant.value
      ? activeVariant.value
      : variant.value),
  outline:
    d.value.outline ?? (d.value.active ? activeOutline.value : outline.value),
  surfaceLevel: d.value.surfaceLevel ?? (d.value.active ? '+2' : undefined),
  readOnly: d.value.readOnly ?? d.value.active,
  as: d.value.as,
  clickable: d.value.clickable,
  contentClassName: d.value.contentClassName,
  disabled: d.value.disabled,
  focusable: d.value.focusable,
  focused: d.value.focused,
  hoverable: d.value.hoverable,
  loading: d.value.loading,
  multiline: d.value.multiline,
  pressed: d.value.pressed,
  square: d.value.square,
  surface: d.value.surface,
  tightFocusRing: d.value.tightFocusRing,
}));
</script>

<template>
  <Button
    v-bind="{ ...buttonProps, ...$attrs }"
    :data-active="d.active || undefined"
  >
    <slot />
  </Button>
</template>
