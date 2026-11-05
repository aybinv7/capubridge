<script setup lang="ts">
import { Tooltip, type TooltipPosition } from "@capubridge/cladd";

/**
 * Explains the one element in its slot with a Cladd tooltip, in place of a native `title`.
 * Without `text` the element is rendered alone.
 */
const props = withDefaults(defineProps<{ text?: string | null; position?: TooltipPosition }>(), {
  text: null,
  position: "bottom",
});
</script>

<template>
  <Tooltip
    :disabled="!props.text"
    :position="props.position"
    :offset="6"
    content-class-name="max-w-72 px-2 py-1 text-xs"
  >
    <template #trigger>
      <slot />
    </template>
    {{ props.text }}
  </Tooltip>
</template>
