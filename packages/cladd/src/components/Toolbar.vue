<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import { roundedClasses } from '../shared/roundedClasses.ts';
import Surface from './Surface.vue';
import type { ToolbarProps } from './toolbar.contracts.ts';
import { provideToolbarContext } from './toolbarContext.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToolbarProps>(), {
  as: undefined,
  buttonOutline: undefined,
  buttonVariant: undefined,
  color: undefined,
  contentClassName: undefined,
  outline: undefined,
  rounded: undefined,
  size: undefined,
  surfaceLevel: undefined,
  variant: undefined,
});

defineSlots<{
  default?: () => unknown;
}>();

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const d = useComponentDefaults('Toolbar', props, {
  as: 'div' as NonNullable<ToolbarProps['as']>,
  buttonOutline: false,
  buttonVariant: 'transparent' as NonNullable<ToolbarProps['buttonVariant']>,
  outline: true,
  rounded: true,
  size: 'md' as NonNullable<ToolbarProps['size']>,
  variant: 'gradient' as NonNullable<ToolbarProps['variant']>,
});

provideToolbarContext(
  computed(() => ({
    outline: d.value.buttonOutline,
    rounded: d.value.rounded,
    size: d.value.size,
    variant: d.value.buttonVariant,
  })),
);

const radii = computed(() => roundedClasses(d.value.size, d.value.rounded));
const rootClass = computed(() =>
  cn('cladd-toolbar flex', radii.value.wrapRoundedClasses, attrs.class),
);
const contentClass = computed(() =>
  cn('flex h-auto items-center justify-center p-1', d.value.contentClassName),
);
</script>

<template>
  <Surface
    v-bind="rootAttrs"
    :as="d.as"
    :class="rootClass"
    :color="d.color"
    :content-class-name="contentClass"
    :level="d.surfaceLevel"
    :outline="d.outline"
    :variant="d.variant"
    @contextmenu.capture.prevent
  >
    <slot />
  </Surface>
</template>
