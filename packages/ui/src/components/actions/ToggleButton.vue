<script setup lang="ts">
import { computed, shallowRef } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import SegmentedButton from "./SegmentedButton.vue";
import type { ButtonProps } from "./button.contracts.ts";
import { provideSegmentedContext, useSegmentedContext } from "./segmentedContext.ts";
import type { ToggleButtonOwnProps } from "./toggleGroup.contracts.ts";
import { useToggleGroupContext } from "./toggleGroupContext.ts";
import { useToolbarContext } from "./toolbarContext.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<Omit<ButtonProps, "as"> & ToggleButtonOwnProps>(), {
  accent: undefined,
  activeColor: undefined,
  activeOutline: undefined,
  activeVariant: undefined,
  clickable: undefined,
  color: undefined,
  contentClassName: undefined,
  defaultSelected: undefined,
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
  selected: undefined,
  size: undefined,
  square: undefined,
  surface: undefined,
  surfaceLevel: undefined,
  tightFocusRing: undefined,
  value: undefined,
  variant: undefined,
});

const emit = defineEmits<{
  change: [selected: boolean, event: MouseEvent];
}>();

defineSlots<{
  default?: () => unknown;
}>();

const ui = useUiContext();
const toolbar = useToolbarContext();
const group = useToggleGroupContext();
const seg = useSegmentedContext();
const d = useComponentDefaults("ToggleButton", props, {
  defaultSelected: false,
});

const internalSelected = shallowRef(d.value.defaultSelected);

const selected = computed(() => {
  if (group) {
    return group.value.multiple
      ? Array.isArray(group.value.value) &&
          d.value.value != null &&
          group.value.value.includes(d.value.value)
      : group.value.value === d.value.value;
  }
  return d.value.selected !== undefined ? d.value.selected : internalSelected.value;
});

provideSegmentedContext(
  computed(() => ({
    size: d.value.size ?? seg.value.size ?? toolbar.value.size ?? "md",
    rounded: d.value.rounded ?? seg.value.rounded ?? toolbar.value.rounded ?? true,
    color: d.value.color ?? seg.value.color ?? "",
    variant: d.value.variant ?? seg.value.variant ?? "transparent",
    outline: d.value.outline ?? seg.value.outline ?? false,
    activeColor: d.value.activeColor ?? seg.value.activeColor ?? ui.accentColor.value,
    activeVariant: d.value.activeVariant ?? seg.value.activeVariant ?? "gradient",
    activeOutline: d.value.activeOutline ?? seg.value.activeOutline ?? true,
  })),
);

function onClick(event: MouseEvent): void {
  if (group) {
    if (d.value.value != null) group.value.toggleValue(d.value.value);
    return;
  }

  const next = !selected.value;
  if (d.value.selected === undefined) internalSelected.value = next;
  emit("change", next, event);
}
</script>

<template>
  <SegmentedButton
    v-bind="$attrs"
    :accent="d.accent"
    :active="selected"
    :aria-pressed="selected"
    :clickable="d.clickable"
    :content-class-name="d.contentClassName"
    :data-value="d.value"
    :disabled="d.disabled"
    :focusable="d.focusable"
    :focused="d.focused"
    :hoverable="d.hoverable"
    :loading="d.loading"
    :multiline="d.multiline"
    :pressed="d.pressed"
    :read-only="false"
    :square="d.square"
    :surface="d.surface"
    :surface-level="d.surfaceLevel"
    :tight-focus-ring="d.tightFocusRing"
    @click="onClick"
  >
    <slot />
  </SegmentedButton>
</template>
