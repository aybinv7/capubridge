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
 * The expanded strip's drawing: one row per lane, the time axis, a line under the pointer, and
 * the second being previewed. Hovering a second shows its counts; clicking it asks for the
 * moment preview.
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
  /** The second the moment preview shows, highlighted on the lanes. */
  selected: number | null;
}>();

const emit = defineEmits<{
  resize: [width: number];
  pick: [second: number, rect: DOMRectReadOnly];
  turnOnLogcat: [];
}>();

const box = ref<HTMLElement | null>(null);
const hovered = shallowRef<number | null>(null);
const pointerX = shallowRef<number | null>(null);
const width = shallowRef(0);

const pxPerSecond = computed(() => (1000 / props.input.scale.windowMs) * props.input.scale.width);
const cardX = computed(() =>
  hovered.value === null
    ? 0
    : secondToX(hovered.value, props.input.scale) + Math.max(1, pxPerSecond.value) / 2,
);
const logcatRowTop = LANE_TOP + LANE_ROW_HEIGHT * 3;
const SELECTED_MIN_WIDTH = 6;
const selectedBand = computed(() => {
  if (props.selected === null) return null;
  const width = Math.max(SELECTED_MIN_WIDTH, pxPerSecond.value);
  const left = secondToX(props.selected, props.input.scale) + pxPerSecond.value / 2 - width / 2;
  return { left: `${Math.max(0, left)}px`, width: `${width}px` };
});

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
  const element = box.value;
  pointerX.value =
    element && hovered.value !== null ? event.clientX - element.getBoundingClientRect().left : null;
}

function onLeave() {
  hovered.value = null;
  pointerX.value = null;
}

function rectOf(second: number): DOMRectReadOnly | null {
  const element = box.value;
  if (!element) return null;
  const bounds = element.getBoundingClientRect();
  const x = bounds.left + secondToX(second, props.input.scale);
  return new DOMRect(x, bounds.top, Math.max(2, pxPerSecond.value), AXIS_TOP);
}

function onClick(event: MouseEvent) {
  const second = secondAt(event);
  const rect = second === null ? null : rectOf(second);
  if (second === null || !rect) return;
  emit("pick", second, rect);
}

defineExpose({ rectOf });
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
      @pointerleave="onLeave"
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
        v-if="selectedBand"
        class="pointer-events-none absolute inset-y-0 rounded-[3px] bg-signal-select/15 ring-1 ring-signal-select/60 ring-inset"
        :style="selectedBand"
        aria-hidden="true"
      />
      <div
        v-if="pointerX !== null"
        class="pointer-events-none absolute inset-y-0 left-0 w-px bg-foreground/45"
        :style="{ transform: `translateX(${pointerX}px)` }"
        aria-hidden="true"
      />
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
