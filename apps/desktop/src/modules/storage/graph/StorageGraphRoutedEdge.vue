<script setup lang="ts">
import { computed } from "vue";
import { BaseEdge, getBezierPath, type EdgeProps } from "@vue-flow/core";
import type { StorageGraphRelationship } from "@/types/storageGraph.types";

const props = defineProps<EdgeProps<StorageGraphRelationship>>();

const fallbackPath = computed(
  () =>
    getBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      sourcePosition: props.sourcePosition,
      targetX: props.targetX,
      targetY: props.targetY,
      targetPosition: props.targetPosition,
    })[0],
);
const route = computed(() => props.data.routePoints ?? []);
const path = computed(() => {
  if (route.value.length < 2) {
    return fallbackPath.value;
  }
  return route.value
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
});
const labelPoint = computed(() => route.value[Math.floor(route.value.length / 2)]);
</script>

<template>
  <BaseEdge
    :id="props.id"
    :path="path"
    :label="props.label"
    :label-x="labelPoint?.x"
    :label-y="labelPoint?.y"
    :marker-start="props.markerStart"
    :marker-end="props.markerEnd"
    :interaction-width="props.interactionWidth"
    :style="props.style"
  />
</template>
