<script setup lang="ts">
import { Surface } from "@capubridge/ui";

withDefaults(
  defineProps<{
    surfaceLevel?: number | string;
  }>(),
  {
    surfaceLevel: undefined,
  },
);
</script>

<template>
  <Surface
    class="example-toolbar"
    content-class-name="example-toolbar__content"
    :level="surfaceLevel"
    outline
    variant="gradient"
  >
    <slot />
  </Surface>
</template>
