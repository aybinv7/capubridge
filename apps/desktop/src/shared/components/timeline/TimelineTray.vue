<script setup lang="ts">
import { computed } from "vue";
import type { StripEdge } from "@/stores/timelineStrip.store";
import { EXPANDED_HEIGHT, REST_HEIGHT } from "./stripGeometry";

/**
 * The strip's surface: a bevelled card on the page's own background that grows away from its
 * `edge` from the resting height to the expanded height with transforms only. The cap on the
 * edge stays, the far cap slides, and the middle scales between them, so the bevel lines never
 * stretch.
 */
const props = defineProps<{ expanded: boolean; edge: StripEdge }>();

const CAP = REST_HEIGHT / 2;
const RISE = EXPANDED_HEIGHT - REST_HEIGHT;

const near = computed(() => props.edge);
const far = computed(() => (props.edge === "bottom" ? "top" : "bottom"));
const slide = computed(() => {
  if (props.expanded) return "translateY(0)";
  return `translateY(${props.edge === "bottom" ? RISE : -RISE}px)`;
});
</script>

<template>
  <div
    class="pointer-events-none absolute inset-x-0"
    :style="{ [near]: '0px', height: `${EXPANDED_HEIGHT}px` }"
    aria-hidden="true"
  >
    <div class="absolute inset-x-0 overflow-hidden" :style="{ [near]: '0px', height: `${CAP}px` }">
      <div
        class="absolute inset-x-0 rounded-well bg-surface-0 shadow-bevel"
        :style="{ [near]: '0px', height: `${REST_HEIGHT}px` }"
      />
    </div>
    <div
      class="absolute inset-x-0 overflow-hidden transition-transform duration-300 ease-cladd-spring motion-reduce:transition-none"
      :style="{
        [near]: `${CAP}px`,
        height: `${RISE}px`,
        transformOrigin: props.edge,
        transform: `scaleY(${props.expanded ? 1 : 0})`,
      }"
    >
      <div
        class="absolute inset-x-0 bg-surface-0 shadow-bevel"
        :style="{ top: `-${CAP}px`, bottom: `-${CAP}px` }"
      />
    </div>
    <div
      class="absolute inset-x-0 overflow-hidden transition-transform duration-300 ease-cladd-spring motion-reduce:transition-none"
      :style="{ [far]: '0px', height: `${CAP}px`, transform: slide }"
    >
      <div
        class="absolute inset-x-0 rounded-well bg-surface-0 shadow-bevel"
        :style="{ [far]: '0px', height: `${REST_HEIGHT}px` }"
      />
    </div>
  </div>
</template>
