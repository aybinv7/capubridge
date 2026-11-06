<script setup lang="ts">
import { computed, ref } from "vue";
import { TooltipPrimitive } from "@capubridge/cladd";
import { useTimelineStore } from "@/stores/timeline.store";
import { TIMELINE_LANES, type TimelineLane } from "@/types/timeline.types";
import { LANE_META } from "./laneMeta";
import { formatClock, formatCount } from "./stripFormat";

/**
 * The hover card for one second of the strip: its time, and its count per lane. Muted lanes
 * are left out. It follows the pointer through an anchor placed at the bucket's centre.
 */
const props = defineProps<{
  second: number | null;
  x: number;
  muted: ReadonlySet<TimelineLane>;
  frame: number;
  offsetNote: string | null;
}>();

const timeline = useTimelineStore();
const anchor = ref<HTMLElement | null>(null);

const open = computed({
  get: () => props.second !== null,
  set: () => {},
});

const rows = computed(() => {
  void props.frame;
  const second = props.second;
  if (second === null) return [];
  return TIMELINE_LANES.filter((lane) => !props.muted.has(lane)).map((lane) => ({
    lane,
    count: timeline.ring.bucketCount(second, lane),
  }));
});

const quiet = computed(() => rows.value.every((row) => row.count === 0));
</script>

<template>
  <span
    ref="anchor"
    class="pointer-events-none absolute top-0 size-px"
    :style="{ left: `${props.x}px` }"
    aria-hidden="true"
  />
  <TooltipPrimitive
    v-model:open="open"
    :anchor-element="anchor ?? undefined"
    position="top"
    :offset="10"
    content-class-name="flex min-w-36 flex-col gap-1 px-2.5 py-2 text-xs"
  >
    <span class="font-mono text-2xs text-muted-foreground tabular-nums">
      {{ props.second === null ? "" : formatClock(props.second * 1000) }}
    </span>
    <span v-if="quiet" class="text-muted-foreground">Nothing in this second</span>
    <template v-else>
      <span v-for="row in rows" :key="row.lane" class="flex items-center gap-2">
        <component
          :is="LANE_META[row.lane].icon"
          class="size-3 shrink-0"
          :class="LANE_META[row.lane].iconClass"
        />
        <span class="flex-1" :class="row.count ? 'text-foreground' : 'text-[var(--fg-subtle)]'">
          {{ LANE_META[row.lane].label }}
        </span>
        <span
          class="font-mono tabular-nums"
          :class="row.count ? 'text-foreground' : 'text-[var(--fg-subtle)]'"
        >
          {{ formatCount(row.count) }}
        </span>
      </span>
    </template>
    <span v-if="props.offsetNote" class="text-2xs text-[var(--fg-subtle)]">{{
      props.offsetNote
    }}</span>
    <span class="text-2xs text-[var(--fg-subtle)]">Click to see what happened</span>
  </TooltipPrimitive>
</template>
