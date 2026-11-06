<script setup lang="ts">
import { computed } from "vue";
import { axisTicks, type StripWindow } from "@/lib/timeline/stripWindows";
import { formatClock } from "./stripFormat";

const props = defineProps<{
  span: StripWindow;
  width: number;
  /** Px from the left edge that lie before the timeline started keeping markers. */
  unkept: number;
  since: number;
}>();

const SINCE_ROOM = 72;

interface PlacedTick {
  key: string;
  label: string;
  left: number;
  align: "start" | "center" | "end";
}

const ticks = computed<PlacedTick[]>(() =>
  axisTicks(props.span)
    .map<PlacedTick>((tick, index, all) => ({
      key: tick.label,
      label: tick.label,
      left: tick.fraction * props.width,
      align: index === 0 ? "start" : index === all.length - 1 ? "end" : "center",
    }))
    .filter((tick) => props.unkept <= 0 || tick.left > props.unkept + SINCE_ROOM),
);

const sinceLabel = computed(() => (props.unkept > 0 ? `since ${formatClock(props.since)}` : null));

function tickStyle(tick: PlacedTick) {
  if (tick.align === "start") return { left: "0px" };
  if (tick.align === "end") return { right: "0px" };
  return { left: `${tick.left}px`, transform: "translateX(-50%)" };
}
</script>

<template>
  <div class="relative h-3.5 font-mono text-2xs leading-3.5 text-[var(--fg-subtle)] tabular-nums">
    <span
      v-for="tick in ticks"
      :key="tick.key"
      class="absolute top-0 whitespace-nowrap"
      :style="tickStyle(tick)"
    >
      {{ tick.label }}
    </span>
    <span
      v-if="sinceLabel"
      class="absolute top-0 whitespace-nowrap pl-1 text-muted-foreground"
      :style="{ left: `${Math.min(props.unkept, Math.max(0, props.width - SINCE_ROOM))}px` }"
    >
      {{ sinceLabel }}
    </span>
  </div>
</template>
