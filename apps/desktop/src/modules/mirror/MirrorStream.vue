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
  inspectHover: [x: number, y: number];
  inspectSelect: [x: number, y: number];
  inspectLeave: [];
  canvasReady: [canvas: HTMLCanvasElement | null];
}>();

const containerRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();
const laserX = ref(0);
const laserY = ref(0);
const showLaser = ref(false);
const lastClientX = ref(0);
const lastClientY = ref(0);
const dragOrigin = ref<{ x: number; y: number } | null>(null);

const aspectRatio = computed(() =>
  props.deviceWidth && props.deviceHeight
    ? `${props.deviceWidth} / ${props.deviceHeight}`
    : "9 / 19.5",
);

function getDeviceCoords(clientX: number, clientY: number) {
  if (!containerRef.value) return { x: 0, y: 0 };
  const rect = containerRef.value.getBoundingClientRect();
  const deviceWidth = props.deviceWidth || 1080;
  const deviceHeight = props.deviceHeight || 1920;
  const scaleX = deviceWidth / rect.width;
  const scaleY = deviceHeight / rect.height;
  return {
    x: Math.min(deviceWidth - 1, Math.max(0, Math.round((clientX - rect.left) * scaleX))),
    y: Math.min(deviceHeight - 1, Math.max(0, Math.round((clientY - rect.top) * scaleY))),
  };
}

function onMouseMove(e: MouseEvent) {
  if (!containerRef.value) return;
  lastClientX.value = e.clientX;
  lastClientY.value = e.clientY;
  const rect = containerRef.value.getBoundingClientRect();
  laserX.value = e.clientX - rect.left;
  laserY.value = e.clientY - rect.top;
  showLaser.value = true;
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

onMounted(() => {
  window.addEventListener("mouseup", onWindowMouseUp);
  emit("canvasReady", canvasRef.value ?? null);
});

onUnmounted(() => {
  window.removeEventListener("mouseup", onWindowMouseUp);
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
    :class="isConnected ? (inspectMode ? 'cursor-default' : 'cursor-pointer') : 'cursor-default'"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
    @mousedown="onMouseDown"
    @mouseup="onMouseUp"
  >
    <!-- Stream frame (WebCodecs path) -->
    <canvas
      v-if="useCanvas"
      ref="canvasRef"
      class="w-full h-full object-contain pointer-events-none"
    />

    <!-- Connecting placeholder -->
    <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-3">
      <div class="relative">
        <MonitorOff class="w-8 h-8 text-muted-foreground/20" />
        <div
          class="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-muted-foreground/20 animate-pulse"
        />
      </div>
      <p class="text-xs text-muted-foreground/30 tracking-wide">Connecting…</p>
    </div>

    <!-- Laser pointer -->
    <Transition
      enter-active-class="transition-opacity duration-100"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="laserMode && showLaser"
        class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
        :style="{ left: `${laserX}px`, top: `${laserY}px` }"
      >
        <!-- Outer glow ring -->
        <div
          class="absolute w-8 h-8 rounded-full border border-red-500/40 -translate-x-1/2 -translate-y-1/2 animate-ping"
        />
        <!-- Inner dot -->
        <div
          class="w-3 h-3 rounded-full bg-red-500/90 shadow-[0_0_10px_3px_rgba(239,68,68,0.5)] -translate-x-1/2 -translate-y-1/2"
        />
      </div>
    </Transition>
  </div>
</template>
