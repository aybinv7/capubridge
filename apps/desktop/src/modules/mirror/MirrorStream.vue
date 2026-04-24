<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { MonitorOff } from "lucide-vue-next";

const props = defineProps<{
  useCanvas?: boolean;
  isConnected: boolean;
  laserMode: boolean;
  deviceWidth: number;
  deviceHeight: number;
  inspectMode?: boolean;
}>();

const emit = defineEmits<{
  touch: [action: "down" | "move" | "up", x: number, y: number];
  wheel: [x: number, y: number, deltaX: number, deltaY: number];
  navigation: [action: "back" | "home"];
  keyboard: [
    event: {
      key: string;
      code: string;
      ctrlKey: boolean;
      metaKey: boolean;
      altKey: boolean;
      shiftKey: boolean;
    },
  ];
  inspectHover: [x: number, y: number];
  inspectSelect: [x: number, y: number];
  inspectLeave: [];
  canvasReady: [canvas: HTMLCanvasElement | null];
}>();

const containerRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();
const showLaser = ref(false);
const lastClientX = ref(0);
const lastClientY = ref(0);
const dragOrigin = ref<{ x: number; y: number } | null>(null);
const laserTrailPoints = ref<Array<{ id: number; x: number; y: number; createdAt: number }>>([]);
const laserTrailNow = ref(0);
let laserTrailFrame = 0;
let lastLaserTrailAt = 0;
let nextLaserTrailId = 0;
const LASER_TRAIL_DURATION_MS = 1000;

const aspectRatio = computed(() =>
  props.deviceWidth && props.deviceHeight
    ? `${props.deviceWidth} / ${props.deviceHeight}`
    : "9 / 19.5",
);

const pointerClass = computed(() => {
  if (!props.isConnected) return "cursor-default";
  if (props.laserMode) return "cursor-none";
  return props.inspectMode ? "cursor-default" : "cursor-pointer";
});

const visibleLaserTrailPoints = computed(() =>
  laserTrailPoints.value.filter(
    (point) => laserTrailNow.value - point.createdAt < LASER_TRAIL_DURATION_MS,
  ),
);

const laserTrailSegments = computed(() => {
  const points = visibleLaserTrailPoints.value;
  if (points.length < 2) return [];

  return points.slice(1).map((point, index) => {
    const previousPoint = points[index];
    const age = laserTrailNow.value - point.createdAt;
    const opacity = Math.max(0, 1 - age / LASER_TRAIL_DURATION_MS);

    return {
      id: point.id,
      x1: previousPoint.x,
      y1: previousPoint.y,
      x2: point.x,
      y2: point.y,
      opacity,
      width: 1.2 + opacity * 2.4,
    };
  });
});

function startLaserTrailLoop() {
  if (laserTrailFrame) return;

  const tick = (now: number) => {
    laserTrailNow.value = now;
    laserTrailPoints.value = laserTrailPoints.value.filter(
      (point) => now - point.createdAt < LASER_TRAIL_DURATION_MS,
    );

    if (showLaser.value || laserTrailPoints.value.length > 0) {
      laserTrailFrame = window.requestAnimationFrame(tick);
      return;
    }

    laserTrailFrame = 0;
  };

  laserTrailFrame = window.requestAnimationFrame(tick);
}

function pushLaserTrailPoint(x: number, y: number) {
  const now = performance.now();
  if (now - lastLaserTrailAt < 14) return;
  lastLaserTrailAt = now;
  laserTrailPoints.value = [
    ...laserTrailPoints.value,
    {
      id: nextLaserTrailId++,
      x,
      y,
      createdAt: now,
    },
  ].slice(-160);
  startLaserTrailLoop();
}

function getDeviceCoords(clientX: number, clientY: number) {
  if (!containerRef.value) return { x: 0, y: 0 };
  const rect = containerRef.value.getBoundingClientRect();
  const streamWidth = canvasRef.value?.width || props.deviceWidth || 1080;
  const streamHeight = canvasRef.value?.height || props.deviceHeight || 1920;
  const streamAspect = streamWidth / streamHeight;
  const containerAspect = rect.width / rect.height;
  let contentLeft = rect.left;
  let contentTop = rect.top;
  let contentWidth = rect.width;
  let contentHeight = rect.height;

  if (containerAspect > streamAspect) {
    contentHeight = rect.height;
    contentWidth = contentHeight * streamAspect;
    contentLeft = rect.left + (rect.width - contentWidth) / 2;
  } else {
    contentWidth = rect.width;
    contentHeight = contentWidth / streamAspect;
    contentTop = rect.top + (rect.height - contentHeight) / 2;
  }

  const clampedX = Math.min(contentLeft + contentWidth - 1, Math.max(contentLeft, clientX));
  const clampedY = Math.min(contentTop + contentHeight - 1, Math.max(contentTop, clientY));
  const scaleX = streamWidth / contentWidth;
  const scaleY = streamHeight / contentHeight;
  return {
    x: Math.min(streamWidth - 1, Math.max(0, Math.round((clampedX - contentLeft) * scaleX))),
    y: Math.min(streamHeight - 1, Math.max(0, Math.round((clampedY - contentTop) * scaleY))),
  };
}

function onMouseMove(e: MouseEvent) {
  if (!containerRef.value) return;
  lastClientX.value = e.clientX;
  lastClientY.value = e.clientY;
  const rect = containerRef.value.getBoundingClientRect();
  showLaser.value = true;
  if (props.laserMode) {
    pushLaserTrailPoint(e.clientX - rect.left, e.clientY - rect.top);
  }
  if (props.inspectMode) {
    const c = getDeviceCoords(e.clientX, e.clientY);
    emit("inspectHover", c.x, c.y);
    return;
  }
  if (!dragOrigin.value) return;
  if ((e.buttons & 1) !== 1) return;
  const c = getDeviceCoords(e.clientX, e.clientY);
  emit("touch", "move", c.x, c.y);
}

function onMouseLeave() {
  showLaser.value = false;
  startLaserTrailLoop();
  if (props.inspectMode) {
    dragOrigin.value = null;
    emit("inspectLeave");
    return;
  }
  if (dragOrigin.value) {
    const c = getDeviceCoords(lastClientX.value, lastClientY.value);
    emit("touch", "up", c.x, c.y);
    dragOrigin.value = null;
  }
}

function onMouseDown(e: MouseEvent) {
  containerRef.value?.focus({ preventScroll: true });
  if (e.button === 1) {
    e.preventDefault();
    emit("navigation", "home");
    return;
  }
  if (e.button === 2) {
    e.preventDefault();
    emit("navigation", "back");
    return;
  }
  if (e.button !== 0) return;
  lastClientX.value = e.clientX;
  lastClientY.value = e.clientY;
  if (props.inspectMode) {
    const c = getDeviceCoords(e.clientX, e.clientY);
    emit("inspectSelect", c.x, c.y);
    return;
  }
  dragOrigin.value = { x: e.clientX, y: e.clientY };
  const c = getDeviceCoords(e.clientX, e.clientY);
  emit("touch", "down", c.x, c.y);
}

function onMouseUp(e: MouseEvent) {
  if (e.button !== 0) return;
  if (props.inspectMode) return;
  if (!dragOrigin.value) return;
  lastClientX.value = e.clientX;
  lastClientY.value = e.clientY;
  const c = getDeviceCoords(e.clientX, e.clientY);
  emit("touch", "up", c.x, c.y);
  dragOrigin.value = null;
}

function onWindowMouseUp(e: MouseEvent) {
  if (props.inspectMode) return;
  if (!dragOrigin.value) return;
  const c = getDeviceCoords(e.clientX, e.clientY);
  emit("touch", "up", c.x, c.y);
  dragOrigin.value = null;
}

function onWheel(e: WheelEvent) {
  if (!props.isConnected) return;
  containerRef.value?.focus({ preventScroll: true });
  const c = getDeviceCoords(e.clientX, e.clientY);
  emit("wheel", c.x, c.y, e.deltaX, e.deltaY);
}

function onKeydown(e: KeyboardEvent) {
  if (!props.isConnected) return;
  if (e.isComposing) return;
  emit("keyboard", {
    key: e.key,
    code: e.code,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
  });
}

onMounted(() => {
  window.addEventListener("mouseup", onWindowMouseUp);
  emit("canvasReady", canvasRef.value ?? null);
});

onUnmounted(() => {
  window.removeEventListener("mouseup", onWindowMouseUp);
  if (laserTrailFrame) {
    window.cancelAnimationFrame(laserTrailFrame);
    laserTrailFrame = 0;
  }
  emit("canvasReady", null);
});

watch(
  () => props.useCanvas,
  () => {
    void nextTick(() => emit("canvasReady", canvasRef.value ?? null));
  },
);
</script>

<template>
  <div
    ref="containerRef"
    class="relative w-full overflow-hidden bg-black select-none"
    :style="{ aspectRatio }"
    :class="pointerClass"
    tabindex="0"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
    @mousedown="onMouseDown"
    @mouseup="onMouseUp"
    @contextmenu.prevent
    @wheel.prevent="onWheel"
    @keydown.prevent="onKeydown"
  >
    <canvas
      v-if="useCanvas"
      ref="canvasRef"
      class="w-full h-full object-contain pointer-events-none"
    />

    <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-3">
      <div class="relative">
        <MonitorOff class="w-8 h-8 text-muted-foreground/20" />
        <div
          class="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-muted-foreground/20 animate-pulse"
        />
      </div>
      <p class="text-xs text-muted-foreground/30 tracking-wide">Connecting…</p>
    </div>

    <Transition
      enter-active-class="transition-opacity duration-100"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <svg
        v-if="laserMode && laserTrailSegments.length > 0"
        class="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        <line
          v-for="segment in laserTrailSegments"
          :key="segment.id"
          :x1="segment.x1"
          :y1="segment.y1"
          :x2="segment.x2"
          :y2="segment.y2"
          stroke="rgba(255, 32, 32, 1)"
          stroke-linecap="round"
          :stroke-opacity="segment.opacity"
          :stroke-width="segment.width"
        />
      </svg>
    </Transition>
  </div>
</template>
