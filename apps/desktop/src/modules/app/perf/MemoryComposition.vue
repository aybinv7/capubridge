<script setup lang="ts">
import { computed } from "vue";
import type { AppMemInfo } from "@/types/app-inspector.types";
import { formatBytes } from "@/shared/format/numbers";
import { memoryComposition } from "../process/meminfo";

const TONES: Record<string, string> = {
  native: "bg-foreground/85",
  dalvik: "bg-foreground/62",
  code: "bg-foreground/44",
  graphics: "bg-foreground/30",
  stack: "bg-foreground/18",
  other: "bg-muted-foreground/25",
};

const props = defineProps<{ memory: AppMemInfo | null }>();

const segments = computed(() => memoryComposition(props.memory));
</script>

<template>
  <div v-if="segments.length" class="flex flex-col gap-2">
    <div
      class="flex h-2 gap-px overflow-hidden rounded-full bg-surface-cut shadow-cut"
      role="img"
      :aria-label="segments.map((s) => `${s.label} ${Math.round(s.share)}%`).join(', ')"
    >
      <span
        v-for="segment in segments"
        :key="segment.key"
        class="h-full"
        :class="TONES[segment.key]"
        :style="{ width: `${segment.share}%` }"
      />
    </div>
    <ul class="grid grid-cols-2 gap-x-4 gap-y-1 text-2xs text-muted-foreground @lg:grid-cols-3">
      <li
        v-for="segment in segments"
        :key="segment.key"
        class="flex min-w-0 items-center gap-1.5"
        :title="segment.hint"
      >
        <span
          class="size-1.5 shrink-0 rounded-full"
          :class="TONES[segment.key]"
          aria-hidden="true"
        />
        <span class="truncate">{{ segment.label }}</span>
        <span class="ml-auto font-mono whitespace-nowrap text-foreground tabular-nums">
          {{ formatBytes(segment.kb * 1024) }}
        </span>
        <span class="w-8 text-right font-mono text-[var(--fg-subtle)] tabular-nums">
          {{ Math.round(segment.share) }}%
        </span>
      </li>
    </ul>
  </div>
  <p v-else class="text-xs text-muted-foreground">
    The parts of the app's memory appear once its process is running.
  </p>
</template>
