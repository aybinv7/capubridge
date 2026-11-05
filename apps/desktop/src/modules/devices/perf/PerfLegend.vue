<script setup lang="ts">
import type { PerfChartLine } from "./perfChart.types";

const props = defineProps<{ lines: readonly PerfChartLine[] }>();
</script>

<template>
  <ul class="flex items-center gap-3 text-2xs text-muted-foreground" aria-label="Legend">
    <li v-for="line in props.lines" :key="line.key" class="flex items-center gap-1.5">
      <svg width="14" height="4" viewBox="0 0 14 4" aria-hidden="true">
        <line
          x1="0"
          y1="2"
          x2="14"
          y2="2"
          :stroke="line.color"
          stroke-width="1.5"
          :stroke-dasharray="line.dashed ? '4 3' : undefined"
        />
      </svg>
      {{ line.label }}
    </li>
  </ul>
</template>
