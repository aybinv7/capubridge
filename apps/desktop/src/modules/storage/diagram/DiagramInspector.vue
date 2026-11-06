<script setup lang="ts">
import { computed } from "vue";
import { X } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type {
  StorageGraphClusterSelection,
  StorageGraphNodeAnnotation,
  StorageGraphNodeData,
  StorageGraphRelatedTable,
  StorageGraphRelationship,
} from "@/types/storageGraph.types";
import DiagramClusterPanel from "./DiagramClusterPanel.vue";
import DiagramEdgePanel from "./DiagramEdgePanel.vue";
import DiagramEntityPanel from "./DiagramEntityPanel.vue";
import DiagramNotePanel from "./DiagramNotePanel.vue";

/** The pane beside the canvas for what is selected; it is not shown when nothing is. */
const props = defineProps<{
  node: { id: string; data: StorageGraphNodeData } | null;
  edge: StorageGraphRelationship | null;
  cluster: StorageGraphClusterSelection | null;
  relatedTables: readonly StorageGraphRelatedTable[];
  entityTitleById: Record<string, string>;
}>();

const emit = defineEmits<{
  close: [];
  saveAnnotation: [nodeId: string, annotation: StorageGraphNodeAnnotation];
  saveNote: [payload: { id: string; title: string; note: string; accent: string }];
  deleteNote: [noteId: string];
  openNode: [path: string];
  saveEdge: [payload: { id: string; label: string }];
  deleteEdge: [edgeId: string];
  saveCluster: [payload: { id: string; name: string; note?: string }];
  focusNode: [nodeId: string];
}>();

const KIND_WORDS = {
  indexeddb: "IndexedDB store",
  localforage: "LocalForage entry",
  sqlite: "SQLite table",
};

const heading = computed(() => {
  if (props.cluster) {
    return {
      title: props.cluster.name,
      kind: props.cluster.source === "manual" ? "Your group" : "Tables named alike",
    };
  }
  const data = props.node?.data;
  if (data?.nodeKind === "entity") {
    return { title: data.annotation?.label || data.title, kind: KIND_WORDS[data.storageKind] };
  }
  if (data?.nodeKind === "note") return { title: data.title || "Note", kind: "Note" };
  if (props.edge) return { title: props.edge.label || "Link", kind: "Link" };
  return null;
});
</script>

<template>
  <aside
    v-if="heading"
    class="flex w-80 shrink-0 flex-col overflow-hidden border-l border-border-subtle bg-surface-0"
    aria-label="Selection"
  >
    <header class="flex items-start gap-2 border-b border-border-subtle px-3 py-2.5">
      <div class="min-w-0 flex-1">
        <p class="text-2xs text-muted-foreground">{{ heading.kind }}</p>
        <h2 class="truncate text-sm font-medium text-foreground">{{ heading.title }}</h2>
      </div>
      <IconAction label="Clear the selection" size="sm" @click="emit('close')">
        <X :stroke-width="1.8" />
      </IconAction>
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto p-3">
      <DiagramClusterPanel
        v-if="cluster"
        :cluster="cluster"
        @save="emit('saveCluster', $event)"
        @focus-node="emit('focusNode', $event)"
      />
      <DiagramEntityPanel
        v-else-if="node && node.data.nodeKind === 'entity'"
        :data="node.data"
        :related-tables="relatedTables"
        :entity-title-by-id="entityTitleById"
        @open="emit('openNode', $event)"
        @save-annotation="node && emit('saveAnnotation', node.id, $event)"
        @focus-node="emit('focusNode', $event)"
      />
      <DiagramNotePanel
        v-else-if="node && node.data.nodeKind === 'note'"
        :id="node.id"
        :data="node.data"
        @save="emit('saveNote', $event)"
        @remove="emit('deleteNote', $event)"
      />
      <DiagramEdgePanel
        v-else-if="edge"
        :edge="edge"
        :entity-title-by-id="entityTitleById"
        @save="emit('saveEdge', $event)"
        @remove="emit('deleteEdge', $event)"
      />
    </div>
  </aside>
</template>
