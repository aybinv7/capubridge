<script setup lang="ts">
import { Crosshair } from "lucide-vue-next";
import { useInspectStore } from "@/stores/inspect.store";
import { useInspector } from "./useInspector";
import DomTree from "./DomTree.vue";
import ElementDetailPanel from "./ElementDetailPanel.vue";

const store = useInspectStore();
const inspector = useInspector();
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Inspect mode toolbar -->
    <div class="h-8 flex items-center gap-1 px-2 border-b border-border/30 bg-surface-0 shrink-0">
      <button
        class="h-6 px-2 flex items-center gap-1.5 rounded text-xs transition-colors"
        :class="
          store.inspectMode
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            : 'text-muted-foreground/50 hover:text-foreground hover:bg-surface-2'
        "
        title="Select an element in the page to inspect it"
        @click="inspector.toggleInspectMode()"
      >
        <Crosshair class="w-3.5 h-3.5" />
        <span>Inspect</span>
      </button>
    </div>

    <!-- Split: DOM tree (top) + Detail panel (bottom) -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="flex-1 overflow-hidden min-h-0">
        <DomTree
          @select="inspector.selectNode($event)"
          @expand="inspector.expandNode($event)"
          @hover="inspector.highlightNode($event)"
          @unhover="inspector.clearHighlight()"
          @refresh="inspector.refreshDocument()"
        />
      </div>

      <div class="h-64 shrink-0 overflow-hidden">
        <ElementDetailPanel />
      </div>
    </div>
  </div>
</template>
