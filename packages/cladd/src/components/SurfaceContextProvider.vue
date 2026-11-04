<script setup lang="ts">
import { provideSurfaceContext } from '../contexts/surfaceContext.ts';
import type { Color } from '../types.ts';

const props = withDefaults(
  defineProps<{
    /** Region color published to descendants. Defaults to no region color. */
    color?: Color;
    /** Surface depth published to descendants. */
    level: number;
  }>(),
  { color: undefined },
);

defineSlots<{
  /** Subtree to publish the values to. */
  default?: () => unknown;
}>();

provideSurfaceContext(
  () => props.level,
  () => props.color,
);
</script>

<template>
  <slot />
</template>
