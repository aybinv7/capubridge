<script setup lang="ts">
import { onMounted, ref, shallowRef, watch } from "vue";
import { useDevicePixelRatio, useResizeObserver } from "@vueuse/core";

/**
 * A canvas sized to its box at the device pixel ratio. It repaints through `paint` whenever
 * `frame` moves on or its size changes, and reports its width so geometry can be built for it.
 */
const props = defineProps<{
  height: number;
  frame: number;
  paint: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}>();

const emit = defineEmits<{
  resize: [width: number];
}>();

const box = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const width = shallowRef(0);
const { pixelRatio } = useDevicePixelRatio();

useResizeObserver(box, (entries) => {
  const next = Math.round(entries[0]?.contentRect.width ?? 0);
  if (next === width.value) return;
  width.value = next;
  emit("resize", next);
});

function draw() {
  const element = canvas.value;
  const ctx = element?.getContext("2d");
  if (!element || !ctx) return;
  const ratio = pixelRatio.value || 1;
  const pixelWidth = Math.round(width.value * ratio);
  const pixelHeight = Math.round(props.height * ratio);
  if (element.width !== pixelWidth) element.width = pixelWidth;
  if (element.height !== pixelHeight) element.height = pixelHeight;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, width.value, props.height);
  if (width.value > 0) props.paint(ctx, width.value, props.height);
}

watch(() => [props.frame, props.height, width.value, pixelRatio.value], draw, { flush: "post" });
onMounted(draw);
</script>

<template>
  <div ref="box" class="relative w-full" :style="{ height: `${props.height}px` }">
    <canvas
      ref="canvas"
      class="absolute inset-0 block size-full"
      :style="{ height: `${props.height}px` }"
      aria-hidden="true"
    />
  </div>
</template>
