<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { useElementSize } from "@vueuse/core";
import { useDevicesStore } from "@/stores/devices.store";
import { useDrawerStore } from "@/stores/drawer.store";
import { useLogcatStore } from "@/stores/logcat.store";
import { useTimelineStore } from "@/stores/timeline.store";
import { useTimelineStripStore } from "@/stores/timelineStrip.store";
import { EXPANDED_HEIGHT, REST_HEIGHT, unkeptWidth } from "./stripGeometry";
import { formatClockOffset } from "./stripFormat";
import type { PaintInput } from "./stripPainters";
import TimelineDensity from "./TimelineDensity.vue";
import TimelineLaneLabels from "./TimelineLaneLabels.vue";
import TimelineLanes from "./TimelineLanes.vue";
import TimelineMomentPopover from "./TimelineMomentPopover.vue";
import TimelineRightCluster from "./TimelineRightCluster.vue";
import TimelineTray from "./TimelineTray.vue";
import { useStripFrame } from "./useStripFrame";
import { useStripPalette } from "./useStripPalette";
import { tickInterval, useStripTicker } from "./useStripTicker";

/**
 * The global timeline strip at the foot of the work column: quiet density at rest, four lanes
 * with labels and an axis on hover, and a preview of any second on click. It reads markers
 * from the timeline store and never imports a module; "Go to" goes through the reveal registry.
 */
const EXPAND_DELAY_MS = 90;
const COLLAPSE_DELAY_MS = 260;
const LIVE_WITHIN_MS = 2000;
const RISE = EXPANDED_HEIGHT - REST_HEIGHT;
const MOMENT_REQUEST_TTL_MS = 4000;

const strip = useTimelineStripStore();
const timeline = useTimelineStore();
const logcat = useLogcatStore();
const drawer = useDrawerStore();
const devices = useDevicesStore();

const cluster = ref<HTMLElement | null>(null);
const lanes = ref<InstanceType<typeof TimelineLanes> | null>(null);
const { width: clusterWidth } = useElementSize(cluster);
const restWidth = shallowRef(0);
const laneWidth = shallowRef(0);
const expanded = shallowRef(false);
const pointerInside = shallowRef(false);
const momentOpen = shallowRef(false);
const momentSecond = shallowRef<number | null>(null);
const momentRect = shallowRef<DOMRectReadOnly | undefined>(undefined);
let expandTimer: ReturnType<typeof setTimeout> | undefined;
let collapseTimer: ReturnType<typeof setTimeout> | undefined;

const interval = computed(() =>
  tickInterval(strip.windowMs, Math.max(restWidth.value, laneWidth.value)),
);
const now = useStripTicker(ref(true), interval);
const muted = computed<ReadonlySet<(typeof strip.mutedLanes)[number]>>(
  () => new Set(strip.mutedLanes),
);
const { geometry, frame, totals, restScale, laneScale, since } = useStripFrame({
  now,
  windowMs: computed(() => strip.windowMs),
  restWidth,
  laneWidth,
  muted,
});
const palette = useStripPalette();

function paintInput(rects: PaintInput["rects"], scale: PaintInput["scale"]): PaintInput {
  return {
    rects,
    scale,
    palette: palette.value,
    muted: muted.value,
    overlays: timeline.overlays,
    now: now.value,
  };
}

const restInput = computed(() => paintInput(geometry.rest, restScale.value));
const laneInput = computed(() => paintInput(geometry.lanes, laneScale.value));
const restUnkept = computed(() => unkeptWidth(since.value, restScale.value));
const laneUnkept = computed(() => unkeptWidth(since.value, laneScale.value));
const paintFrame = shallowRef(0);
watch([frame, muted, palette], () => {
  paintFrame.value += 1;
});
const live = computed(() => {
  void frame.value;
  return now.value - timeline.ring.newestTime < LIVE_WITHIN_MS;
});
const logcatOff = computed(() => !logcat.isStreaming);
const offsetNote = computed(() => {
  const serial = devices.selectedDevice?.serial;
  return formatClockOffset(serial ? timeline.clockOffsets[serial]?.offsetMs : null);
});

function clearTimers() {
  if (expandTimer !== undefined) clearTimeout(expandTimer);
  if (collapseTimer !== undefined) clearTimeout(collapseTimer);
  expandTimer = undefined;
  collapseTimer = undefined;
}

function expandSoon() {
  clearTimers();
  if (expanded.value) return;
  expandTimer = setTimeout(() => {
    expanded.value = true;
  }, EXPAND_DELAY_MS);
}

function collapseSoon() {
  clearTimers();
  if (momentOpen.value) return;
  collapseTimer = setTimeout(() => {
    expanded.value = false;
  }, COLLAPSE_DELAY_MS);
}

function onPointerEnter() {
  pointerInside.value = true;
  expandSoon();
}

function onPointerLeave() {
  pointerInside.value = false;
  collapseSoon();
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget;
  if (next instanceof Node && (event.currentTarget as HTMLElement).contains(next)) return;
  if (!pointerInside.value) collapseSoon();
}

function pick(second: number, rect: DOMRectReadOnly) {
  momentSecond.value = second;
  momentRect.value = rect;
  momentOpen.value = true;
}

function onMomentOpen(open: boolean) {
  momentOpen.value = open;
  if (!open && !pointerInside.value) collapseSoon();
}

async function showRequestedMoment() {
  const request = strip.takeMomentRequest();
  if (!request || Date.now() - request.at > MOMENT_REQUEST_TTL_MS) return;
  clearTimers();
  expanded.value = true;
  await nextTick();
  const second = Math.floor(request.t / 1000);
  const rect = lanes.value?.rectOf(second);
  if (rect) pick(second, rect);
}

watch(
  () => strip.momentRequest,
  (request) => {
    if (request) void showRequestedMoment();
  },
  { immediate: true },
);

const edge = computed(() => strip.edge);
const clip = computed(() => {
  if (expanded.value) return "inset(0 round 10px)";
  return edge.value === "bottom"
    ? `inset(${RISE}px 0 0 0 round 10px)`
    : `inset(0 0 ${RISE}px 0 round 10px)`;
});
const lanesHidden = computed(() =>
  edge.value === "bottom"
    ? "pointer-events-none translate-y-2 opacity-0"
    : "pointer-events-none -translate-y-2 opacity-0",
);

onBeforeUnmount(clearTimers);
</script>

<template>
  <section
    class="relative z-20 shrink-0"
    :style="{ height: `${REST_HEIGHT}px` }"
    aria-label="Timeline"
  >
    <TimelineTray :expanded="expanded" :edge="edge" />
    <div
      class="absolute inset-x-0 transition-[clip-path] duration-500 ease-cladd-spring motion-reduce:transition-none"
      :style="{
        [edge]: '0px',
        height: `${EXPANDED_HEIGHT}px`,
        clipPath: clip,
      }"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
      @focusin="expandSoon"
      @focusout="onFocusOut"
    >
      <div
        class="absolute inset-x-0 top-0 flex transition-[opacity,translate] duration-500 ease-cladd-spring motion-reduce:transition-none"
        :class="expanded ? 'translate-y-0 opacity-100' : lanesHidden"
        :inert="expanded ? undefined : true"
      >
        <TimelineLaneLabels
          :totals="totals"
          :muted="muted"
          :logcat-off="logcatOff"
          @toggle="strip.toggleLane"
        />
        <TimelineLanes
          ref="lanes"
          :frame="paintFrame"
          :input="laneInput"
          :unkept="laneUnkept"
          :live="live"
          :span="strip.span"
          :since="since"
          :logcat-off="logcatOff"
          :offset-note="offsetNote"
          :card-suppressed="momentOpen"
          :selected="momentOpen ? momentSecond : null"
          @resize="laneWidth = $event"
          @pick="pick"
          @turn-on-logcat="drawer.open('logs')"
        />
        <div class="shrink-0" :style="{ width: `${clusterWidth}px` }" aria-hidden="true" />
      </div>

      <div
        class="pointer-events-none absolute inset-x-0 flex items-center"
        :style="{ [edge]: '0px', height: `${REST_HEIGHT}px` }"
      >
        <TimelineDensity
          class="ml-2.5 transition-opacity duration-200 ease-in-out"
          :class="expanded ? 'opacity-0' : 'opacity-100'"
          :frame="paintFrame"
          :input="restInput"
          :unkept="restUnkept"
          :live="live"
          @resize="restWidth = $event"
        />
        <div ref="cluster" class="pointer-events-auto shrink-0">
          <TimelineRightCluster :now="now" />
        </div>
      </div>
    </div>

    <TimelineMomentPopover
      :open="momentOpen"
      :second="momentSecond"
      :anchor-rect="momentRect"
      :muted="muted"
      :position="edge === 'bottom' ? 'top' : 'bottom'"
      @update:open="onMomentOpen"
    />
  </section>
</template>
