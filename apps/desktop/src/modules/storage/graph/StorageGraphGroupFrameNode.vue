<script setup lang="ts">
import type { NodeProps } from "@vue-flow/core";
import type { StorageGraphGroupFrameNodeData } from "@/types/storageGraph.types";

defineProps<NodeProps<StorageGraphGroupFrameNodeData>>();
</script>

<template>
  <div
    class="pointer-events-none rounded-[34px] border-2 border-dashed border-primary/55 bg-primary/5 shadow-[0_24px_80px_-50px_rgba(90,78,255,0.65)]"
    :style="{ width: `${data.width}px`, height: `${data.height}px` }"
  >
    <div class="pl-4 pt-3">
      <span
        class="rounded-full bg-surface-0/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-primary shadow-sm"
      >
        {{ data.title }}
      </span>
    </div>
  </div>
</template>
