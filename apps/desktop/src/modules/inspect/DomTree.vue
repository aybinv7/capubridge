<script setup lang="ts">
import { computed } from "vue";
import { Search, RefreshCw } from "lucide-vue-next";
import { useInspectStore } from "@/stores/inspect.store";
import DomTreeNode from "./DomTreeNode.vue";

const emit = defineEmits<{
  select: [nodeId: number];
  expand: [nodeId: number];
  hover: [nodeId: number];
  unhover: [];
  refresh: [];
}>();

const store = useInspectStore();

const rootNodes = computed(() => {
  const doc = store.documentRoot;
  if (!doc) return [];
  return (doc.children ?? []).filter((c) => c.nodeType === 1);
});
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="h-8 flex items-center gap-1 px-2 border-b border-border/30 shrink-0">
      <div class="flex items-center gap-1 flex-1 px-1">
        <Search class="w-3 h-3 text-muted-foreground/40" />
        <input
          v-model="store.searchQuery"
          placeholder="Search DOM..."
          class="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground/30"
        />
      </div>
      <button
        class="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-2 text-muted-foreground/50 hover:text-foreground transition-colors"
        title="Refresh DOM tree"
        @click="emit('refresh')"
      >
        <RefreshCw class="w-3 h-3" />
      </button>
    </div>

    <div class="flex-1 overflow-auto py-1 select-none">
      <template v-if="rootNodes.length > 0">
        <DomTreeNode
          v-for="node in rootNodes"
          :key="node.nodeId"
          :node="node"
          :depth="0"
          @select="emit('select', $event)"
          @expand="emit('expand', $event)"
          @hover="emit('hover', $event)"
          @unhover="emit('unhover')"
        />
      </template>
      <div v-else class="text-xs text-muted-foreground/40 px-4 py-8 text-center">
        No DOM tree loaded. Connect to a target first.
      </div>
    </div>
  </div>
</template>
