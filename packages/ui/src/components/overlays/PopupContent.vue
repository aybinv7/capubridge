<script setup lang="ts">
import { computed, useAttrs } from "vue";

import type { SurfaceLevelInput, SurfaceVariant } from "../../foundations/contracts.ts";
import { cn } from "../../shared/cn.ts";
import Surface from "../surface/Surface.vue";
import { popupCardClasses, popupCardContentClasses } from "./popup.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    contentClassName?: string;
    outline?: boolean;
    surfaceLevel?: SurfaceLevelInput;
    variant?: SurfaceVariant;
  }>(),
  {
    contentClassName: undefined,
    outline: true,
    surfaceLevel: 1,
    variant: "solid",
  },
);

defineSlots<{
  default?: () => unknown;
}>();

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() => cn(popupCardClasses, attrs.class));
const contentClass = computed(() => cn(popupCardContentClasses, props.contentClassName));
</script>

<template>
  <Surface
    v-bind="rootAttrs"
    :class="rootClass"
    :content-class-name="contentClass"
    :level="props.surfaceLevel"
    :outline="props.outline"
    :variant="props.variant"
  >
    <slot />
  </Surface>
</template>
