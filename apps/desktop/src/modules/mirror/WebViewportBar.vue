<script setup lang="ts">
import { computed } from "vue";
import { RotateCwSquare } from "lucide-vue-next";
import { NumberScrubber } from "@capubridge/cladd";
import { useMirrorStore } from "@/stores/mirror.store";
import {
  VIEWPORT_LIMITS,
  choosePreset,
  resizeViewport,
  resolveViewport,
  rotateViewport,
} from "@/lib/web-viewport";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import WebViewportPicker from "./WebViewportPicker.vue";

const props = defineProps<{ renderedWidth: number }>();

const mirrorStore = useMirrorStore();
const metrics = computed(() => resolveViewport(mirrorStore.webViewport));
const zoom = computed(() => {
  if (!(props.renderedWidth > 0)) return null;
  return Math.round((props.renderedWidth / metrics.value.width) * 100);
});

function setWidth(width: number) {
  mirrorStore.webViewport = resizeViewport(width, metrics.value.height);
}

function setHeight(height: number) {
  mirrorStore.webViewport = resizeViewport(metrics.value.width, height);
}

function choose(presetId: string) {
  mirrorStore.webViewport = choosePreset(mirrorStore.webViewport, presetId);
}

function rotate() {
  mirrorStore.webViewport = rotateViewport(mirrorStore.webViewport);
}

const scrubberClass = "w-16 shrink-0";
</script>

<template>
  <div
    class="mx-2 mb-1.5 flex h-8 shrink-0 items-center gap-1 rounded-control bg-surface-2 pr-1 pl-0.5 shadow-bevel"
    role="toolbar"
    aria-label="Viewport"
  >
    <WebViewportPicker
      :preset-id="mirrorStore.webViewport.presetId"
      :label="metrics.label"
      @choose="choose"
    />
    <span class="flex-1" />
    <NumberScrubber
      :model-value="metrics.width"
      :min="VIEWPORT_LIMITS.min"
      :max="VIEWPORT_LIMITS.max"
      size="sm"
      :class="scrubberClass"
      aria-label="Viewport width"
      @update:model-value="setWidth"
    />
    <span class="text-2xs text-[var(--fg-subtle)]" aria-hidden="true">×</span>
    <NumberScrubber
      :model-value="metrics.height"
      :min="VIEWPORT_LIMITS.min"
      :max="VIEWPORT_LIMITS.max"
      size="sm"
      :class="scrubberClass"
      aria-label="Viewport height"
      @update:model-value="setHeight"
    />
    <IconAction label="Rotate" hint="Swap width and height" size="sm" @click="rotate">
      <RotateCwSquare :stroke-width="1.8" />
    </IconAction>
    <span
      v-if="zoom !== null"
      class="w-9 shrink-0 text-right font-mono text-2xs text-[var(--fg-subtle)] tabular-nums"
      :title="`Shown at ${zoom}% to fit the column`"
    >
      {{ zoom }}%
    </span>
  </div>
</template>
