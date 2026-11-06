<script setup lang="ts">
import TimelineCanvas from "./TimelineCanvas.vue";
import { REST_HEIGHT } from "./stripGeometry";
import { paintDensity, type PaintInput } from "./stripPainters";

/** The resting strip's drawing: combined density, error caps, the unkept edge and now. */
const props = defineProps<{
  frame: number;
  input: PaintInput;
  unkept: number;
  live: boolean;
}>();

const emit = defineEmits<{
  resize: [width: number];
}>();

function paint(ctx: CanvasRenderingContext2D) {
  paintDensity(ctx, props.input);
}
</script>

<template>
  <div class="relative min-w-0 flex-1">
    <TimelineCanvas
      :height="REST_HEIGHT"
      :frame="props.frame"
      :paint="paint"
      @resize="emit('resize', $event)"
    />
    <div
      v-if="props.unkept > 0"
      class="prov-stale pointer-events-none absolute inset-y-2 left-0 rounded-l-inner opacity-60"
      :style="{ width: `${props.unkept}px` }"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute inset-y-2 right-0 w-px transition-colors duration-200"
      :class="props.live ? 'bg-signal-live/70' : 'bg-[var(--fg-subtle)]/25'"
      aria-hidden="true"
    />
  </div>
</template>
