<script setup lang="ts">
import { computed } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import { useSurface } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import { cn } from "../../shared/cn.ts";
import { provideSegmentedContext } from "./segmentedContext.ts";
import type { SegmentedProps } from "./segmented.contracts.ts";
import { useToolbarContext } from "./toolbarContext.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SegmentedProps>(), {
  as: undefined,
  activeColor: undefined,
  activeOutline: undefined,
  activeVariant: undefined,
  color: undefined,
  disabled: undefined,
  outline: undefined,
  rounded: undefined,
  size: undefined,
  variant: undefined,
});

defineSlots<{
  default?: () => unknown;
}>();

const ui = useUiContext();
const surface = useSurface();
const toolbar = useToolbarContext();
const d = useComponentDefaults("Segmented", props, {
  as: "div" as SegmentedProps["as"],
  disabled: false,
  outline: false,
  rounded: toolbar.value.rounded ?? true,
  size: toolbar.value.size ?? ("md" as SegmentedProps["size"]),
  variant: "transparent" as SegmentedProps["variant"],
});

provideSegmentedContext(
  computed(() => ({
    activeColor: d.value.activeColor ?? surface.color.value ?? ui.accentColor.value,
    activeOutline: d.value.activeOutline ?? true,
    activeVariant: d.value.activeVariant ?? "gradient",
    color: d.value.color,
    outline: d.value.outline,
    rounded: d.value.rounded,
    size: d.value.size,
    variant: d.value.variant,
  })),
);

const rootClass = computed(() =>
  cn(
    d.value.color && `cui-color-${d.value.color}`,
    "cui-segmented",
    d.value.disabled && "pointer-events-none opacity-40",
    "flex items-center justify-center",
  ),
);
</script>

<template>
  <component :is="d.as" v-bind="$attrs" :class="rootClass" @contextmenu.capture.prevent>
    <slot />
  </component>
</template>
