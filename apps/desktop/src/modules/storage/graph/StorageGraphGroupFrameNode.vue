<script setup lang="ts">
import type { NodeProps } from "@vue-flow/core";
import type { StorageGraphGroupFrameNodeData } from "@/types/storageGraph.types";

defineProps<NodeProps<StorageGraphGroupFrameNodeData>>();
</script>

<template>
  <div
    class="pointer-events-none rounded-[34px] border-2 border-dashed"
    :class="
      data.variant === 'relationship'
        ? 'border-success/45 bg-success/[0.035]'
        : data.variant === 'inferred'
          ? 'border-warning/35 bg-warning/[0.025]'
          : data.variant === 'container'
            ? 'border-border/40 bg-surface-1/25'
            : 'border-primary/55 bg-primary/5 shadow-[0_24px_80px_-50px_rgba(90,78,255,0.65)]'
    "
    :style="{ width: `${data.width}px`, height: `${data.height}px` }"
  >
    <div class="pl-4 pt-3">
      <span
        class="rounded-full bg-surface-0/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] shadow-sm"
        :class="
          data.variant === 'relationship'
            ? 'text-success'
            : data.variant === 'inferred'
              ? 'text-warning'
              : 'text-primary'
        "
      >
        {{ data.title }}
      </span>
    </div>
  </div>
</template>
