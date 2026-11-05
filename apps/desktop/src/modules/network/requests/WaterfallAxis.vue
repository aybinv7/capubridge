<script setup lang="ts">
import { computed } from "vue";
import { waterfallTicks, type WaterfallRange } from "./waterfall";

const props = defineProps<{ range: WaterfallRange | null }>();

const ticks = computed(() => (props.range ? waterfallTicks(props.range) : []));
</script>

<template>
  <span class="pointer-events-none absolute inset-0" aria-hidden="true">
    <span
      v-for="tick in ticks"
      :key="tick.label"
      class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-2xs text-[var(--fg-subtle)] tabular-nums"
      :style="{ left: `${tick.left}%` }"
    >
      {{ tick.label }}
    </span>
  </span>
</template>
