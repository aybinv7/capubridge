<script setup lang="ts">
import { computed } from "vue";
import { RotateCwSquare } from "lucide-vue-next";
import { NumberScrubber } from "@capubridge/cladd";
import { useMirrorStore } from "@/stores/mirror.store";
import {
  VIEWPORT_LIMITS,
  choosePreset,
  followsArea,
  resizeViewport,
  resolveViewport,
  rotateViewport,
  type ViewportArea,
} from "@/lib/web-viewport";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import WebViewportPicker from "./WebViewportPicker.vue";

/**
 * The page's size: a device, a custom size, or Responsive, which fills the frame. Width and height
 * show the live size and turn it into a custom size when edited; they fold away when the row is
 * narrow, leaving the picker. Needs an `@container` ancestor.
 */
const props = defineProps<{ renderedWidth: number; area: ViewportArea | null }>();

const mirrorStore = useMirrorStore();
const metrics = computed(() => resolveViewport(mirrorStore.webViewport, props.area));
const fills = computed(() => followsArea(mirrorStore.webViewport));
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
</script>

<template>
  <div class="flex min-w-0 shrink-0 items-center gap-1" role="group" aria-label="Page size">
    <WebViewportPicker
      :preset-id="mirrorStore.webViewport.presetId"
      :label="metrics.label"
      @choose="choose"
    />
    <span class="hidden items-center gap-1 @2xl:flex">
      <NumberScrubber
        :model-value="metrics.width"
        :min="VIEWPORT_LIMITS.min"
        :max="VIEWPORT_LIMITS.max"
        size="sm"
        class="w-16 shrink-0"
        aria-label="Page width"
        @update:model-value="setWidth"
      />
      <span class="text-2xs text-[var(--fg-subtle)]" aria-hidden="true">×</span>
      <NumberScrubber
        :model-value="metrics.height"
        :min="VIEWPORT_LIMITS.min"
        :max="VIEWPORT_LIMITS.max"
        size="sm"
        class="w-16 shrink-0"
        aria-label="Page height"
        @update:model-value="setHeight"
      />
    </span>
    <IconAction
      label="Rotate"
      :hint="
        fills ? 'Responsive follows the frame; pick a device to turn it' : 'Swap width and height'
      "
      size="sm"
      :disabled="fills"
      @click="rotate"
    >
      <RotateCwSquare :stroke-width="1.8" />
    </IconAction>
    <span
      v-if="zoom !== null && zoom < 100"
      class="hidden w-9 shrink-0 text-right font-mono text-2xs text-[var(--fg-subtle)] tabular-nums @lg:inline"
      :title="`Shown at ${zoom}% to fit the frame`"
    >
      {{ zoom }}%
    </span>
  </div>
</template>
