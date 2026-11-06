<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position, type NodeProps } from "@vue-flow/core";
import type { StorageGraphNoteNodeData } from "@/types/storageGraph.types";

const props = defineProps<NodeProps<StorageGraphNoteNodeData>>();

const accentStyle = computed(() => ({ borderColor: props.data.accent }));
</script>

<template>
  <div
    class="w-[260px] rounded-well border-2 bg-surface-0 px-3.5 py-2.5 shadow-bevel"
    :class="selected ? 'ring-2 ring-signal-select' : ''"
    :style="accentStyle"
  >
    <Handle id="target" type="target" :position="Position.Left" class="!h-3 !w-3 !border-2" />
    <p class="text-sm font-medium text-foreground">{{ data.title || "Note" }}</p>
    <p class="mt-1.5 whitespace-pre-wrap text-2xs leading-5 text-foreground">{{ data.note }}</p>
    <Handle id="source" type="source" :position="Position.Right" class="!h-3 !w-3 !border-2" />
  </div>
</template>
