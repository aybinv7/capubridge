<script setup lang="ts">
import { computed } from "vue";
import type { CpuCoreMetric } from "@/types/perf.types";
import Sparkline from "../shared/Sparkline.vue";
import { loadTone } from "./perfView";

const CORE_DOMAIN = [0, 100] as const;

const props = defineProps<{
  cores: readonly CpuCoreMetric[];
  /** Recent load of one core, oldest first. */
  values: (core: number) => readonly (number | null)[];
  live: boolean;
}>();

const cells = computed(() =>
  props.cores.map((core) => ({
    core: core.core,
    usage: Math.round(core.usage),
    values: props.values(core.core),
  })),
);
</script>

<template>
  <ul
    v-if="cells.length"
    class="grid grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-2"
    aria-label="Load per core"
  >
    <li
      v-for="cell in cells"
      :key="cell.core"
      class="flex flex-col gap-1.5 rounded-control bg-surface-cut px-2.5 py-2 shadow-cut"
    >
      <span class="flex items-baseline justify-between text-2xs">
        <span class="text-muted-foreground">Core {{ cell.core }}</span>
        <span class="font-mono tabular-nums" :class="loadTone(cell.usage)">{{ cell.usage }}%</span>
      </span>
      <Sparkline
        :values="cell.values"
        :domain="CORE_DOMAIN"
        :live="props.live"
        class="h-6 text-cat-device"
      />
    </li>
  </ul>
  <p v-else class="text-xs text-muted-foreground">The phone has not reported its cores yet.</p>
</template>
