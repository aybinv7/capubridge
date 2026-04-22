<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position, type NodeProps } from "@vue-flow/core";
import type { StorageGraphNoteNodeData } from "@/types/storageGraph.types";

const props = defineProps<NodeProps<StorageGraphNoteNodeData>>();

const accentStyle = computed(() => ({
  borderColor: props.data.accent,
  boxShadow: `${props.data.accent}22 0px 10px 30px -20px`,
}));
</script>

<template>
  <div
    class="w-[260px] rounded-2xl border-2 bg-surface-0 px-4 py-3 shadow-md"
    :style="accentStyle"
  >
    <Handle id="target" type="target" :position="Position.Left" class="!h-3 !w-3 !border-2" />

    <p class="text-[13px] font-semibold text-foreground">{{ data.title || "Note" }}</p>
    <p class="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-foreground/75">{{ data.note }}</p>

    <Handle id="source" type="source" :position="Position.Right" class="!h-3 !w-3 !border-2" />
  </div>
</template>
