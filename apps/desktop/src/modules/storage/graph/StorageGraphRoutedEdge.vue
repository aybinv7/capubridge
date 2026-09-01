<script setup lang="ts">
import { computed } from "vue";
import { BaseEdge, getBezierPath, type EdgeProps } from "@vue-flow/core";
import type { StorageGraphRelationship } from "@/types/storageGraph.types";

const props = defineProps<EdgeProps<StorageGraphRelationship>>();

const fallback = computed(() =>
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  }),
);
const route = computed(() => props.data.routePoints ?? []);
const path = computed(() => {
  if (route.value.length < 2) {
    return fallback.value[0];
  }
  return route.value
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
});
const labelPoint = computed(() => {
  if (route.value.length < 2) {
    return { x: fallback.value[1], y: fallback.value[2] };
  }
  const segments = route.value.slice(1).map((point, index) => {
    const previous = route.value[index];
    return {
      from: previous,
      to: point,
      length: Math.hypot(point.x - previous.x, point.y - previous.y),
    };
  });
  const targetDistance = segments.reduce((total, segment) => total + segment.length, 0) / 2;
  let traversed = 0;
  for (const segment of segments) {
    if (traversed + segment.length >= targetDistance) {
      const progress = segment.length === 0 ? 0 : (targetDistance - traversed) / segment.length;
      return {
        x: segment.from.x + (segment.to.x - segment.from.x) * progress,
        y: segment.from.y + (segment.to.y - segment.from.y) * progress,
      };
    }
    traversed += segment.length;
  }
  return route.value[route.value.length - 1] ?? { x: fallback.value[1], y: fallback.value[2] };
});
const labelStyle = {
  fill: "var(--color-foreground)",
  fontSize: "11px",
  fontWeight: 600,
};
const labelBackgroundStyle = {
  fill: "var(--color-surface-1)",
  fillOpacity: 0.98,
  stroke: "var(--color-border)",
  strokeWidth: 1,
};
</script>

<template>
  <BaseEdge
    :id="props.id"
    :path="path"
    :label="props.label"
    :label-x="labelPoint.x"
    :label-y="labelPoint.y"
    :label-style="labelStyle"
    :label-show-bg="true"
    :label-bg-style="labelBackgroundStyle"
    :label-bg-padding="[8, 6]"
    :label-bg-border-radius="6"
    :marker-start="props.markerStart"
    :marker-end="props.markerEnd"
    :interaction-width="props.interactionWidth"
    :style="props.style"
  />
</template>
