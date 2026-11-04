<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { SurfaceCutContentProps } from './surface.contracts.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SurfaceCutContentProps>(), {
  as: undefined,
  fullHeight: undefined,
});

const d = useComponentDefaults('SurfaceCutContent', props, {
  as: 'div' as NonNullable<SurfaceCutContentProps['as']>,
  fullHeight: true,
});

defineSlots<{
  default?: () => unknown;
}>();

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn('relative', d.value.fullHeight && 'h-full', attrs.class),
);
</script>

<template>
  <component :is="d.as" v-bind="rootAttrs" :class="rootClass">
    <slot />
  </component>
</template>
