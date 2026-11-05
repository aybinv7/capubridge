<script setup lang="ts">
import { computed } from "vue";
import { formatBytes } from "@/shared/format/numbers";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { memoryComposition, type AppMemory, type MemoryPartKey } from "../process/meminfo";

const TONES: Record<MemoryPartKey, string> = {
  java: "bg-foreground/85",
  native: "bg-foreground/65",
  graphics: "bg-foreground/48",
  code: "bg-foreground/34",
  stack: "bg-foreground/22",
  other: "fill-hatch bg-muted-foreground/10",
  shared: "bg-muted-foreground/35",
  swapped: "bg-muted-foreground/20",
};

const props = defineProps<{ memory: AppMemory | null }>();

const segments = computed(() => memoryComposition(props.memory));
const label = computed(() =>
  segments.value.map((segment) => `${segment.label} ${Math.round(segment.share)}%`).join(", "),
);
</script>

<template>
  <div v-if="segments.length" class="flex flex-col gap-2.5">
    <div
      class="flex h-2 gap-px overflow-hidden rounded-full bg-surface-cut shadow-cut"
      role="img"
      :aria-label="label"
    >
      <span
        v-for="segment in segments"
        :key="segment.key"
        class="h-full"
        :class="TONES[segment.key]"
        :style="{ width: `${segment.share}%` }"
      />
    </div>
    <ul
      class="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-5 gap-y-1 text-2xs text-muted-foreground"
    >
      <li v-for="segment in segments" :key="segment.key">
        <HintTooltip :text="segment.hint">
          <span class="flex min-w-0 items-center gap-1.5">
            <span
              class="size-2 shrink-0 rounded-[2px]"
              :class="TONES[segment.key]"
              aria-hidden="true"
            />
            <span class="truncate">{{ segment.label }}</span>
            <span class="ml-auto font-mono whitespace-nowrap text-foreground tabular-nums">
              {{ formatBytes(segment.kb * 1024) }}
            </span>
            <span class="w-7 text-right font-mono text-[var(--fg-subtle)] tabular-nums">
              {{ Math.round(segment.share) }}%
            </span>
          </span>
        </HintTooltip>
      </li>
    </ul>
  </div>
  <p v-else class="text-xs text-muted-foreground">
    The parts of the app's memory appear with its first memory report.
  </p>
</template>
