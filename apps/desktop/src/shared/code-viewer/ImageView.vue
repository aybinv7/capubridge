<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { Maximize, Minus, Plus } from "lucide-vue-next";
import { Button, Toolbar, ToolbarSeparator } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useImageZoom } from "./useImageZoom";
import { useObjectUrl } from "./useObjectUrl";
import { zoomLabel, type Size } from "./zoomMath";

const props = defineProps<{ blob: Blob; name: string }>();

const emit = defineEmits<{ unreadable: [] }>();

const viewport = ref<HTMLElement | null>(null);
const natural = shallowRef<Size | null>(null);
const url = useObjectUrl(computed(() => props.blob));
const zoom = useImageZoom(viewport, natural);

const imageStyle = computed(() => {
  const size = natural.value;
  const { scale, x, y } = zoom.view.value;
  return {
    width: size ? `${size.width}px` : undefined,
    height: size ? `${size.height}px` : undefined,
    transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`,
  };
});
const dimensions = computed(() =>
  natural.value ? `${natural.value.width} × ${natural.value.height}` : "",
);
const pixelated = computed(() => zoom.view.value.scale >= 3);

watch(
  () => props.blob,
  () => {
    natural.value = null;
  },
);

function onLoad(event: Event) {
  const image = event.target as HTMLImageElement;
  if (!image.naturalWidth || !image.naturalHeight) {
    emit("unreadable");
    return;
  }
  natural.value = { width: image.naturalWidth, height: image.naturalHeight };
  zoom.showFit();
}
</script>

<template>
  <div class="relative h-full min-h-0 overflow-hidden bg-surface-cut">
    <div
      ref="viewport"
      class="absolute inset-0 touch-none select-none"
      :class="zoom.canPan.value ? (zoom.dragging.value ? 'cursor-grabbing' : 'cursor-grab') : ''"
      @wheel="zoom.onWheel"
      @pointerdown="zoom.onPointerDown"
      @pointermove="zoom.onPointerMove"
      @pointerup="zoom.onPointerUp"
      @pointercancel="zoom.onPointerUp"
      @dblclick="zoom.toggleActual($event)"
    >
      <img
        v-if="url"
        :src="url"
        :alt="props.name"
        draggable="false"
        class="checkerboard absolute top-1/2 left-1/2 max-w-none origin-center shadow-float transition-opacity duration-200 ease-cladd-settle motion-reduce:transition-none"
        :class="[natural ? 'opacity-100' : 'opacity-0', pixelated && 'pixelated']"
        :style="imageStyle"
        @load="onLoad"
        @error="emit('unreadable')"
      />
    </div>

    <Toolbar
      v-if="natural"
      size="sm"
      role="toolbar"
      aria-label="Zoom"
      class="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-float"
      content-class-name="gap-0.5 p-1"
    >
      <IconAction label="Zoom out" size="sm" position="top" @click="zoom.zoomBy(-1)">
        <Minus :stroke-width="1.8" />
      </IconAction>
      <Button
        size="sm"
        variant="transparent"
        :outline="false"
        class="min-w-14 font-mono text-2xs tabular-nums"
        :aria-label="zoom.isActual.value ? 'Fit to the window' : 'Show at actual size'"
        :title="zoom.isActual.value ? 'Fit to the window' : 'Show at actual size'"
        @click="zoom.toggleActual()"
      >
        {{ zoomLabel(zoom.view.value.scale) }}
      </Button>
      <IconAction label="Zoom in" size="sm" position="top" @click="zoom.zoomBy(1)">
        <Plus :stroke-width="1.8" />
      </IconAction>
      <ToolbarSeparator />
      <IconAction
        label="Fit to the window"
        size="sm"
        position="top"
        toggle
        :pressed="zoom.fitted.value"
        @click="zoom.showFit()"
      >
        <Maximize :stroke-width="1.8" />
      </IconAction>
      <ToolbarSeparator />
      <span class="px-2 font-mono text-2xs text-muted-foreground tabular-nums">
        {{ dimensions }}
      </span>
    </Toolbar>
  </div>
</template>

<style scoped>
.checkerboard {
  background-color: var(--bg-surface-cut);
  background-image: conic-gradient(
    var(--border-subtle) 25%,
    transparent 0 50%,
    var(--border-subtle) 0 75%,
    transparent 0
  );
  background-size: 16px 16px;
}

.pixelated {
  image-rendering: pixelated;
}
</style>
