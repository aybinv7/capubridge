<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { Link } from "@capubridge/cladd";
import type { StripWindow } from "@/lib/timeline/stripWindows";
import TimelineAxis from "./TimelineAxis.vue";
import TimelineBucketCard from "./TimelineBucketCard.vue";
import TimelineCanvas from "./TimelineCanvas.vue";
import { AXIS_TOP, LANE_ROW_HEIGHT, LANE_TOP, secondToX, xToSecond } from "./stripGeometry";
import { paintLanes, type PaintInput } from "./stripPainters";

/**
 * The expanded strip's drawing: one row per lane, the time axis, and the pointer. Hovering a
 * second shows its counts; clicking it asks for the moment preview.
 */
const props = defineProps<{
  frame: number;
  input: PaintInput;
  unkept: number;
  live: boolean;
  span: StripWindow;
  since: number;
  logcatOff: boolean;
  offsetNote: string | null;
  cardSuppressed: boolean;
}>();

const emit = defineEmits<{
  resize: [width: number];
  pick: [second: number, rect: DOMRectReadOnly];
  turnOnLogcat: [];
}>();

const box = ref<HTMLElement | null>(null);
const hovered = shallowRef<number | null>(null);
const width = shallowRef(0);

const pxPerSecond = computed(() => (1000 / props.input.scale.windowMs) * props.input.scale.width);
const cardX = computed(() =>
  hovered.value === null
    ? 0
    : secondToX(hovered.value, props.input.scale) + Math.max(1, pxPerSecond.value) / 2,
);
const logcatRowTop = LANE_TOP + LANE_ROW_HEIGHT * 3;

function paint(ctx: CanvasRenderingContext2D) {
  paintLanes(ctx, props.input);
}

function onResize(next: number) {
  width.value = next;
  emit("resize", next);
}

function secondAt(event: PointerEvent | MouseEvent): number | null {
  const element = box.value;
  if (!element || props.input.scale.width <= 0) return null;
  const x = event.clientX - element.getBoundingClientRect().left;
  if (x < 0 || x > props.input.scale.width) return null;
  return xToSecond(x, props.input.scale);
}

function onMove(event: PointerEvent) {
  hovered.value = secondAt(event);
}

function onClick(event: MouseEvent) {
  const second = secondAt(event);
  const element = box.value;
  if (second === null || !element) return;
  const bounds = element.getBoundingClientRect();
  const x = bounds.left + secondToX(second, props.input.scale);
  emit("pick", second, new DOMRect(x, bounds.top, Math.max(2, pxPerSecond.value), AXIS_TOP));
}
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <div
      ref="box"
      class="relative cursor-pointer"
      :style="{ height: `${AXIS_TOP}px` }"
      role="img"
      aria-label="Activity per second, by lane"
      @pointermove="onMove"
      @pointerleave="hovered = null"
      @click="onClick"
    >
      <TimelineCanvas :height="AXIS_TOP" :frame="props.frame" :paint="paint" @resize="onResize" />
      <div
        v-if="props.unkept > 0"
        class="prov-stale pointer-events-none absolute inset-y-0.5 left-0 rounded-l-inner opacity-60"
        :style="{ width: `${props.unkept}px` }"
        aria-hidden="true"
      />
      <div
        v-if="props.logcatOff"
        class="absolute inset-x-0 flex items-center gap-2"
        :style="{ top: `${logcatRowTop}px`, height: `${LANE_ROW_HEIGHT}px` }"
      >
        <span class="h-0 flex-1 border-t border-dashed border-border-default" aria-hidden="true" />
        <span class="text-2xs leading-none text-[var(--fg-subtle)]">Logcat is off</span>
        <Link class="pr-1 text-2xs leading-none" @click.stop="emit('turnOnLogcat')">Turn on</Link>
      </div>
      <div
        class="pointer-events-none absolute inset-y-0.5 right-0 w-px transition-colors duration-200"
        :class="props.live ? 'bg-signal-live/70' : 'bg-[var(--fg-subtle)]/25'"
        aria-hidden="true"
      />
      <TimelineBucketCard
        :second="props.cardSuppressed ? null : hovered"
        :x="cardX"
        :muted="props.input.muted"
        :frame="props.frame"
        :offset-note="props.offsetNote"
      />
    </div>
    <TimelineAxis :span="props.span" :width="width" :unkept="props.unkept" :since="props.since" />
  </div>
</template>
