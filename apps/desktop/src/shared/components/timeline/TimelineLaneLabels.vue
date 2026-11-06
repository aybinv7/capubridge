<script setup lang="ts">
import { formatCount } from "./stripFormat";
import { LANE_META } from "./laneMeta";
import { LANE_ROW_HEIGHT, LANE_TOP } from "./stripGeometry";
import { TIMELINE_LANES, type TimelineLane } from "@/types/timeline.types";

const props = defineProps<{
  totals: Record<TimelineLane, number>;
  muted: ReadonlySet<TimelineLane>;
  logcatOff: boolean;
}>();

const emit = defineEmits<{
  toggle: [lane: TimelineLane];
}>();

function countText(lane: TimelineLane): string {
  if (lane === "logcat" && props.logcatOff) return "off";
  return formatCount(props.totals[lane]);
}

function title(lane: TimelineLane): string {
  const name = LANE_META[lane].label;
  return props.muted.has(lane) ? `Show ${name} again` : `Dim ${name}`;
}
</script>

<template>
  <ul class="flex w-24 shrink-0 flex-col" :style="{ paddingTop: `${LANE_TOP}px` }">
    <li v-for="lane in TIMELINE_LANES" :key="lane">
      <button
        type="button"
        class="group flex w-full items-center gap-1.5 rounded-inner pr-1.5 pl-2.5 text-left text-2xs leading-none outline-none focus-visible:ring-1 focus-visible:ring-ring"
        :style="{ height: `${LANE_ROW_HEIGHT}px` }"
        :aria-pressed="!props.muted.has(lane)"
        :aria-label="title(lane)"
        @click="emit('toggle', lane)"
      >
        <span
          class="size-1.5 shrink-0 rounded-full transition-opacity duration-120"
          :class="[LANE_META[lane].dotClass, props.muted.has(lane) ? 'opacity-25' : 'opacity-80']"
          aria-hidden="true"
        />
        <span
          class="flex-1 truncate transition-colors duration-120"
          :class="
            props.muted.has(lane)
              ? 'text-[var(--fg-subtle)] opacity-60'
              : 'text-muted-foreground group-hover:text-foreground'
          "
        >
          {{ LANE_META[lane].label }}
        </span>
        <span
          class="font-mono tabular-nums"
          :class="
            props.muted.has(lane) ? 'text-[var(--fg-subtle)] opacity-60' : 'text-[var(--fg-subtle)]'
          "
        >
          {{ countText(lane) }}
        </span>
      </button>
    </li>
  </ul>
</template>
