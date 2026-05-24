<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useInspectStore } from "@/stores/inspect.store";
import { useElementStyles } from "./useElementStyles";
import StylesTab from "./StylesTab.vue";
import ComputedTab from "./ComputedTab.vue";
import BoxModelDiagram from "./BoxModelDiagram.vue";

const store = useInspectStore();
const { activeDetailTab, selectedNodeId } = storeToRefs(store);
const { matchedStyles, computedStyles, boxModel, isLoading, refetch } = useElementStyles();

const tabs = [
  { id: "styles" as const, label: "Styles" },
  { id: "computed" as const, label: "Computed" },
  { id: "boxmodel" as const, label: "Box Model" },
] as const;

const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null;
  return store.nodeMap.get(selectedNodeId.value) ?? null;
});
</script>

<template>
  <div class="flex flex-col h-full border-t border-border/30">
    <div
      v-if="selectedNode"
      class="h-7 flex items-center px-2 text-xs font-mono bg-surface-1 border-b border-border/20 shrink-0"
    >
      <span class="text-purple-400">&lt;{{ selectedNode.localName }}&gt;</span>
    </div>

    <div class="h-7 flex items-center gap-0 border-b border-border/20 shrink-0 px-1">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="px-2.5 py-1 text-[11px] rounded transition-colors"
        :class="
          activeDetailTab === tab.id
            ? 'text-foreground bg-surface-3'
            : 'text-muted-foreground/50 hover:text-muted-foreground'
        "
        @click="activeDetailTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-hidden">
      <StylesTab
        v-if="activeDetailTab === 'styles'"
        :styles="matchedStyles"
        :is-loading="isLoading"
        @refresh="refetch"
      />
      <ComputedTab
        v-if="activeDetailTab === 'computed'"
        :styles="computedStyles"
        :is-loading="isLoading"
      />
      <BoxModelDiagram
        v-if="activeDetailTab === 'boxmodel'"
        :box-model="boxModel"
        :computed-styles="computedStyles"
      />
    </div>
  </div>
</template>
