<script setup lang="ts">
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import {
  computed,
  effectScope,
  markRaw,
  nextTick,
  onBeforeUnmount,
  ref,
  toRef,
  watch,
  type EffectScope,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { SelectionMode, VueFlow, useVueFlow } from "@vue-flow/core";
import { Button } from "@capubridge/cladd";
import DataState from "@/modules/storage/frame/DataState.vue";
import { useIndexedDBChangesLease } from "@/modules/storage/changes/useIndexedDBChangesTracking";
import { useStorageGraphStore } from "@/modules/storage/stores/useStorageGraphStore";
import DiagramCanvasDock from "./DiagramCanvasDock.vue";
import DiagramEntityNode from "./DiagramEntityNode.vue";
import DiagramFrameNode from "./DiagramFrameNode.vue";
import DiagramInspector from "./DiagramInspector.vue";
import DiagramNoteNode from "./DiagramNoteNode.vue";
import DiagramRoutedEdge from "./DiagramRoutedEdge.vue";
import DiagramSelectionBar from "./DiagramSelectionBar.vue";
import DiagramToolbar from "./DiagramToolbar.vue";
import DiagramViewportBar from "./DiagramViewportBar.vue";
import { readIncludeOther, rememberDiagramPath, writeIncludeOther } from "./diagramPlaces";
import type { DiagramSubject } from "./diagramSubject";
import type { StorageGraphCanvasMode } from "./storageGraphCanvas.utils";
import { useDiagramEditing } from "./useDiagramEditing";
import { useDiagramFilters } from "./useDiagramFilters";
import { useDiagramModel } from "./useDiagramModel";
import { useStorageGraphCanvasInteractions } from "./useStorageGraphCanvasInteractions";
import { useStorageGraphCanvasNodes } from "./useStorageGraphCanvasNodes";
import { useStorageGraphHistory } from "./useStorageGraphHistory";

/**
 * One database as a diagram: its tables or stores and how they link, read from the copy its
 * tab already has open, with "Include the app's other data" for the app-wide map. Layouts,
 * notes, your links and descriptions are kept per database and never touch the data.
 */
const props = defineProps<{ subject: DiagramSubject }>();

const route = useRoute();
const router = useRouter();
const graphStore = useStorageGraphStore();
const subject = toRef(props, "subject");

const includeOther = ref(readIncludeOther(props.subject.place.kind));
watch(includeOther, (value) => writeIncludeOther(props.subject.place.kind, value));
const canIncludeOther = computed(
  () => props.subject.place.packageName !== "file" && props.subject.place.serial !== "",
);
const includeEffective = computed(() => includeOther.value && canIncludeOther.value);
const nodeWord = computed(() => {
  if (includeEffective.value) return { one: "table or store", many: "tables and stores" };
  return props.subject.kind === "sqlite"
    ? { one: "table", many: "tables" }
    : { one: "store", many: "stores" };
});

const model = useDiagramModel(subject, includeEffective);
const { scopeKey } = model;
const history = useStorageGraphHistory(scopeKey);

const filters = useDiagramFilters(
  {
    entities: model.entities,
    notes: model.notes,
    relationships: model.relationships,
    schemaRelationships: model.schemaRelationships,
    autoLayoutPositions: model.autoLayoutPositions,
    schemaLayoutPositions: model.schemaLayoutPositions,
  },
  props.subject.kind === "sqlite" ? "schema" : "inferred",
);
watch(includeEffective, (on) => {
  if (!on) filters.sourceFilter.value = "all";
});

const nodeTypes = {
  entity: markRaw(DiagramEntityNode),
  "group-frame": markRaw(DiagramFrameNode),
  note: markRaw(DiagramNoteNode),
};
const edgeTypes = { routed: markRaw(DiagramRoutedEdge) };

const { fitView, getViewport, setCenter, zoomIn, zoomOut } = useVueFlow();

const canvasMode = ref<StorageGraphCanvasMode>("pan");
const selectedNodeId = ref("");
const selectedEdgeId = ref("");
const selectedClusterId = ref("");
const fittedScopeKey = ref("");
const zoomPercent = ref(100);

const canvas = useStorageGraphCanvasNodes({
  scopeKey,
  graphStore,
  canvasMode,
  graphStrategy: filters.strategy,
  filteredEntities: filters.filteredEntities,
  notes: filters.filteredNotes,
  persistedPositions: model.persistedPositions,
  activeAutoLayoutPositions: filters.activeAutoLayoutPositions,
  persistedGroups: model.persistedGroups,
  visibleRelationships: filters.visibleRelationships,
  selectedEdgeId,
});
const { nodes, edges } = canvas;

const interactions = useStorageGraphCanvasInteractions({
  scopeKey,
  graphStore,
  history,
  entities: model.entities,
  notes: model.notes,
  relationships: model.relationships,
  visibleRelationships: filters.visibleRelationships,
  persistedGroups: model.persistedGroups,
  nodes,
  edges,
  routedEdgePoints: canvas.routedEdgePoints,
  clusterMembersByFrameId: canvas.clusterMembersByFrameId,
  isGroupFrameNode: canvas.isGroupFrameNode,
  getInteractiveNodes: canvas.getInteractiveNodes,
  syncCanvasNodes: canvas.syncCanvasNodes,
  buildEdges: canvas.buildEdges,
  selectedNodeId,
  selectedEdgeId,
  selectedClusterId,
  zoomPercent,
  getViewport,
  fitView,
});

const editing = useDiagramEditing({
  scopeKey,
  graphStore,
  history,
  canvas,
  interactions,
  notes: model.notes,
  relationships: model.relationships,
  visibleRelationships: filters.visibleRelationships,
  persistedPositions: model.persistedPositions,
  activeAutoLayoutPositions: filters.activeAutoLayoutPositions,
  inferred: () => filters.strategy.value === "inferred",
  selectedNodeId,
  selectedEdgeId,
  selectedClusterId,
  setCenter,
  getViewport,
});

const entityCount = computed(() => filters.filteredEntities.value.length);
const hasEntities = computed(() => model.entities.value.length > 0);
const emptyText = computed(() =>
  props.subject.kind === "sqlite"
    ? "This database has no tables yet."
    : "This database has no stores yet.",
);

let leaseScope: EffectScope | null = null;
watch(
  () => props.subject.kind === "indexeddb" || includeEffective.value,
  (needed) => {
    if (needed && !leaseScope) {
      leaseScope = effectScope();
      leaseScope.run(() => useIndexedDBChangesLease());
    } else if (!needed && leaseScope) {
      leaseScope.stop();
      leaseScope = null;
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => leaseScope?.stop());

watch(
  () => route.fullPath,
  (path) => rememberDiagramPath(path),
  { immediate: true },
);

watch(scopeKey, () => {
  fittedScopeKey.value = "";
  history.reset();
  interactions.clearSelection();
});

watch(interactions.selectedNodes, (value) => {
  if (value.length === 1) {
    selectedNodeId.value = value[0]?.id ?? "";
    selectedEdgeId.value = "";
    return;
  }
  selectedNodeId.value = "";
  if (value.length > 0) selectedEdgeId.value = "";
});

watch(
  [
    filters.filteredEntities,
    filters.filteredNotes,
    filters.visibleRelationships,
    filters.activeAutoLayoutPositions,
    filters.strategy,
    canvasMode,
    model.persistedPositions,
    model.persistedGroups,
    scopeKey,
  ],
  async () => {
    canvas.syncCanvasNodes(canvas.buildNodes());
    edges.value = canvas.buildEdges();
    await nextTick();
    if (nodes.value.length > 0 && fittedScopeKey.value !== scopeKey.value) {
      fittedScopeKey.value = scopeKey.value;
      await interactions.fitCanvas();
      return;
    }
    interactions.updateZoomPercent();
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <DiagramToolbar
      v-model:search="filters.search.value"
      v-model:strategy="filters.strategy.value"
      v-model:include-other="includeOther"
      v-model:source-filter="filters.sourceFilter.value"
      :origin="model.origin.value"
      :origins="model.availableOrigins.value"
      :can-include-other="canIncludeOther"
      :node-count="entityCount"
      :node-word="nodeWord"
      :link-count="filters.visibleRelationships.value.length"
      @set-origin="model.setOrigin"
    />
    <DataState
      v-if="hasEntities && model.error.value"
      compact
      kind="error"
      title="Could not read the database again; this is the last read"
      :detail="model.error.value"
      class="shrink-0 border-b border-border-subtle"
      @retry="model.refetch()"
    />
    <DataState
      v-if="model.otherError.value"
      compact
      kind="error"
      title="Some of the app's other data could not be read"
      :detail="model.otherError.value"
      class="shrink-0 border-b border-border-subtle"
      @retry="model.refetch()"
    />
    <div class="flex min-h-0 flex-1">
      <div class="diagram-canvas relative min-w-0 flex-1 overflow-hidden bg-surface-cut">
        <DataState
          v-if="!hasEntities && model.loading.value"
          kind="loading"
          :title="
            subject.kind === 'sqlite' ? 'Reading how the tables are built' : 'Reading the stores'
          "
          class="absolute inset-0 z-20"
        />
        <DataState
          v-else-if="!hasEntities && model.error.value"
          kind="error"
          title="Could not draw this database"
          :detail="model.error.value"
          class="absolute inset-0 z-20"
          @retry="model.refetch()"
        />
        <DataState
          v-else-if="!hasEntities"
          kind="empty"
          title="Nothing to draw"
          :text="emptyText"
          class="absolute inset-0 z-20"
        />
        <DataState
          v-else-if="entityCount === 0"
          kind="empty"
          title="Nothing matches"
          text="No table, field or note matches the search and the source chosen."
          class="pointer-events-none absolute inset-x-0 top-6 z-20"
        >
          <Button
            size="sm"
            variant="transparent"
            class="pointer-events-auto"
            @click="
              filters.search.value = '';
              filters.sourceFilter.value = 'all';
            "
          >
            Clear the search
          </Button>
        </DataState>

        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          class="relative z-10 h-full w-full"
          :apply-default="false"
          :fit-view-on-init="false"
          :zoom-on-double-click="false"
          :min-zoom="0.01"
          :max-zoom="2"
          :only-render-visible-elements="false"
          :pan-on-drag="canvasMode === 'pan' ? true : [1]"
          :selection-key-code="canvasMode === 'select'"
          multi-selection-key-code="Shift"
          :selection-mode="SelectionMode.Partial"
          :nodes-draggable="canvasMode === 'select'"
          :elements-selectable="true"
          :nodes-connectable="canvasMode === 'select'"
          :node-types="nodeTypes"
          :edge-types="edgeTypes"
          @nodes-change="interactions.onNodesChange"
          @edges-change="interactions.onEdgesChange"
          @connect="interactions.onConnect"
          @node-click="interactions.handleNodeClick"
          @edge-click="interactions.handleEdgeClick"
          @node-drag-start="interactions.handleNodeDragStart"
          @node-drag-stop="interactions.handleNodeDragStop"
          @viewport-change="interactions.handleViewportChange"
          @pane-click="interactions.clearSelection"
        />

        <DiagramSelectionBar
          v-if="interactions.canArrangeSelection.value"
          :count="interactions.selectedNodes.value.length"
          @action="interactions.handleSelectionAction"
        />
        <DiagramCanvasDock
          v-if="hasEntities"
          v-model:mode="canvasMode"
          :show-guessed="filters.showGuessed.value"
          :laying="editing.laying.value"
          @add-note="editing.addNote"
          @auto-layout="editing.autoLayout"
          @toggle-guessed="filters.showGuessed.value = !filters.showGuessed.value"
        />
        <DiagramViewportBar
          v-if="hasEntities"
          :zoom-percent="zoomPercent"
          :can-undo="history.canUndo.value"
          :can-redo="history.canRedo.value"
          @zoom-out="zoomOut({ duration: 120 })"
          @zoom-in="zoomIn({ duration: 120 })"
          @fit="interactions.fitCanvas()"
          @undo="editing.undo"
          @redo="editing.redo"
        />
      </div>

      <DiagramInspector
        :node="interactions.selectedNode.value"
        :edge="interactions.selectedEdge.value"
        :cluster="interactions.selectedCluster.value"
        :related-tables="interactions.relatedTables.value"
        :entity-title-by-id="interactions.entityTitleById.value"
        @close="interactions.clearSelection"
        @save-annotation="editing.saveAnnotation"
        @save-note="editing.saveNote"
        @delete-note="editing.deleteNote"
        @open-node="router.push($event)"
        @save-edge="editing.saveEdge"
        @delete-edge="editing.deleteEdge"
        @save-cluster="editing.saveCluster"
        @focus-node="editing.focusNode"
      />
    </div>
  </div>
</template>

<style scoped>
.diagram-canvas {
  background-image: radial-gradient(
    circle,
    color-mix(in srgb, var(--color-foreground) 10%, transparent) 1px,
    transparent 1.5px
  );
  background-size: 24px 24px;
}
</style>
