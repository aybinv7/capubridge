<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import {
  popupCardClasses,
  popupCardContentClasses,
  type PopupContentProps,
} from './popup.contracts.ts';
import Surface from './Surface.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopupContentProps>(), {
  contentClassName: undefined,
  outline: undefined,
  surfaceLevel: undefined,
  variant: undefined,
});

defineSlots<{
  default?: () => unknown;
}>();

const attrs = useAttrs();
const d = useComponentDefaults('PopupContent', props, {
  outline: true,
  surfaceLevel: 1,
  variant: 'solid' as NonNullable<PopupContentProps['variant']>,
});
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() => cn(popupCardClasses, attrs.class));
const contentClass = computed(() =>
  cn(popupCardContentClasses, d.value.contentClassName),
);
</script>

<template>
  <Surface
    v-bind="rootAttrs"
    :class="rootClass"
    :content-class-name="contentClass"
    :level="d.surfaceLevel"
    :outline="d.outline"
    :variant="d.variant"
  >
    <slot />
  </Surface>
</template>
