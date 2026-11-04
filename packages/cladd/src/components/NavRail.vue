<script setup lang="ts">
import { computed, useAttrs, type Component } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { NavRailProps } from './navRail.contracts.ts';
import { provideNavRailContext } from './navRailContext.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavRailProps>(), {
  as: undefined,
  labels: undefined,
});

defineSlots<{
  default?: () => unknown;
  footer?: () => unknown;
}>();

const d = useComponentDefaults('NavRail', props, {
  as: 'nav' as string | Component,
  labels: true,
});

const labels = computed(() => d.value.labels);
provideNavRailContext({ labels });

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

const rootClass = computed(() =>
  cn(
    'cladd-nav-rail flex shrink-0 flex-col items-center gap-1 pt-1',
    labels.value ? 'w-16' : 'w-12',
    attrs.class,
  ),
);
</script>

<template>
  <component
    :is="d.as"
    v-bind="rootAttrs"
    :class="rootClass"
    :data-labels="labels || undefined"
  >
    <slot />
    <div
      v-if="$slots.footer"
      class="cladd-nav-rail__footer mt-auto flex flex-col items-center gap-1"
      data-slot="nav-rail-footer"
    >
      <slot name="footer" />
    </div>
  </component>
</template>
