<script setup lang="ts">
import { computed } from "vue";
import type { NodeProps } from "@vue-flow/core";
import type { StorageGraphGroupFrameNodeData } from "@/types/storageGraph.types";

const props = defineProps<NodeProps<StorageGraphGroupFrameNodeData>>();

const movable = computed(
  () => props.data.variant === "manual" || props.data.variant === "inferred",
);
const tone = computed(() => {
  switch (props.data.variant) {
    case "relationship":
      return { frame: "border-success/45 bg-success/[0.035]", label: "text-success" };
    case "inferred":
      return { frame: "border-warning/35 bg-warning/[0.025]", label: "text-warning" };
    case "container":
      return { frame: "border-border bg-surface-1/25", label: "text-muted-foreground" };
    default:
      return { frame: "border-signal-select/55 bg-signal-select/5", label: "text-signal-select" };
  }
});
</script>

<template>
  <div
    class="rounded-surface border-2 border-dashed"
    :class="[movable ? 'pointer-events-auto cursor-move' : 'pointer-events-none', tone.frame]"
    :style="{ width: `${data.width}px`, height: `${data.height}px` }"
  >
    <div class="flex h-12 items-center px-4">
      <span
        class="max-w-[calc(100%_-_1rem)] truncate rounded-inner bg-surface-0 px-2 py-0.5 text-2xs font-medium shadow-bevel"
        :class="tone.label"
      >
        {{ data.title }}
      </span>
    </div>
  </div>
</template>
