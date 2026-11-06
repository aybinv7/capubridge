<script setup lang="ts">
import { computed } from "vue";

/** "×12": how many times a line repeated in a row, with the first and last time on hover. */
const props = defineProps<{ count: number; first: string; last: string }>();

const count = new Intl.NumberFormat();
const title = computed(
  () => `${count.format(props.count)} times in a row, from ${props.first} to ${props.last}`,
);
</script>

<template>
  <span
    class="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-2xs leading-none text-muted-foreground tabular-nums shadow-bevel"
    :title="title"
    :aria-label="title"
  >
    ×{{ count.format(props.count) }}
  </span>
</template>
