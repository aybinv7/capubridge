<script setup lang="ts">
import { ref, watch } from "vue";
import { TIMELINE_LANES, type TimelineLane, type TimelineMarker } from "@/types/timeline.types";
import { laneAlpha } from "./laneMeta";
import TimelineCanvas from "./TimelineCanvas.vue";
import type { StripPalette } from "./stripPaint";

/**
 * One second, magnified: every marker in it placed by millisecond on its lane's row, so a burst
 * reads as a sequence rather than one bar.
 */
const props = defineProps<{
  second: number;
  markers: readonly TimelineMarker[];
  muted: ReadonlySet<TimelineLane>;
  palette: StripPalette;
}>();

const ROW = 6;
const HEIGHT = ROW * TIMELINE_LANES.length + 4;
const QUARTERS = [0.25, 0.5, 0.75];
const frame = ref(0);

watch(
  () => [props.second, props.markers, props.muted, props.palette],
  () => {
    frame.value += 1;
  },
);

function paint(ctx: CanvasRenderingContext2D, width: number) {
  const startMs = props.second * 1000;
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = props.palette.hairline;
  for (const quarter of QUARTERS) ctx.fillRect(Math.round(quarter * width), 0, 1, HEIGHT);
  TIMELINE_LANES.forEach((lane, row) => {
    ctx.globalAlpha = laneAlpha(lane, props.muted.has(lane), true);
    ctx.fillStyle = props.palette.lanes[lane];
    const tickWidth = lane === "errors" ? 2 : 1;
    for (const marker of props.markers) {
      if (marker.lane !== lane) continue;
      const x = Math.min(width - tickWidth, ((marker.t - startMs) / 1000) * width);
      ctx.fillRect(x, 2 + row * ROW, tickWidth, ROW - 1);
    }
  });
}
</script>

<template>
  <figure class="flex flex-col gap-1">
    <div class="rounded-inner bg-surface-cut px-2 py-1.5 shadow-cut">
      <TimelineCanvas :height="HEIGHT" :frame="frame" :paint="paint" />
    </div>
    <figcaption
      class="flex justify-between font-mono text-2xs text-[var(--fg-subtle)] tabular-nums"
    >
      <span>0 ms</span>
      <span>500</span>
      <span>1 s</span>
    </figcaption>
  </figure>
</template>
