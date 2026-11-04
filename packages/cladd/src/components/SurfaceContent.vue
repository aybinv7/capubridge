<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { SurfaceContentProps } from './surface.contracts.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SurfaceContentProps>(), {
  as: undefined,
});

const d = useComponentDefaults('SurfaceContent', props, {
  as: 'div' as NonNullable<SurfaceContentProps['as']>,
});

defineSlots<{
  default?: () => unknown;
}>();

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() => cn('relative h-full', attrs.class));
</script>

<template>
  <component :is="d.as" v-bind="rootAttrs" :class="rootClass">
    <slot />
  </component>
</template>
