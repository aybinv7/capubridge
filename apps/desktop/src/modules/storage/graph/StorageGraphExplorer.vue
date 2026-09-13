<script setup lang="ts">
import { computed, markRaw, nextTick, ref, watch } from "vue";
import { SelectionMode, VueFlow, useVueFlow } from "@vue-flow/core";
import { toast } from "vue-sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StorageGraphCanvasDock from "@/modules/storage/graph/StorageGraphCanvasDock.vue";
import StorageGraphEntityNode from "@/modules/storage/graph/StorageGraphEntityNode.vue";
import StorageGraphGroupFrameNode from "@/modules/storage/graph/StorageGraphGroupFrameNode.vue";
import StorageGraphInspector from "@/modules/storage/graph/StorageGraphInspector.vue";
import StorageGraphNoteNode from "@/modules/storage/graph/StorageGraphNoteNode.vue";
import StorageGraphRoutedEdge from "@/modules/storage/graph/StorageGraphRoutedEdge.vue";
import StorageGraphSelectionToolbar from "@/modules/storage/graph/StorageGraphSelectionToolbar.vue";
import type { StorageGraphCanvasMode } from "@/modules/storage/graph/storageGraphCanvas.utils";
import StorageGraphViewportToolbar from "@/modules/storage/graph/StorageGraphViewportToolbar.vue";
import { layoutStorageGraphWithElk } from "@/modules/storage/graph/storageGraphElkLayout";
import { useStorageGraphCanvasInteractions } from "@/modules/storage/graph/useStorageGraphCanvasInteractions";
import { useStorageGraphCanvasNodes } from "@/modules/storage/graph/useStorageGraphCanvasNodes";
import { useStorageGraphData } from "@/modules/storage/graph/useStorageGraphData";
import { useStorageGraphHistory } from "@/modules/storage/graph/useStorageGraphHistory";
import { useStorageGraphStore } from "@/modules/storage/stores/useStorageGraphStore";
import type { StorageGraphNodeAnnotation } from "@/types/storageGraph.types";
import { useRouter } from "vue-router";

const router = useRouter();
const graphStore = useStorageGraphStore();
const {
  scopeKey,
  entities,
  notes,
  persistedPositions,
  relationships,
  schemaRelationships,
  autoLayoutPositions,
  schemaLayoutPositions,
  selectedOrigin,
  availableOrigins,
  setSelectedOrigin,
  isLoading,
  error,
} = useStorageGraphData();
const history = useStorageGraphHistory(scopeKey);

const nodeTypes = {
  entity: markRaw(StorageGraphEntityNode),
  "group-frame": markRaw(StorageGraphGroupFrameNode),
  note: markRaw(StorageGraphNoteNode),
};
const edgeTypes = {
  routed: markRaw(StorageGraphRoutedEdge),
};

const { fitView, getViewport, setCenter, zoomIn, zoomOut } = useVueFlow();

const search = ref("");
const sourceFilter = ref<"all" | "indexeddb" | "localforage" | "sqlite">("all");
const graphStrategy = ref<"inferred" | "schema">("inferred");
const showHeuristicEdges = ref(true);
const canvasMode = ref<StorageGraphCanvasMode>("pan");
const selectedNodeId = ref("");
const selectedEdgeId = ref("");
const selectedClusterId = ref("");
const fittedScopeKey = ref("");
const zoomPercent = ref(100);
const selectedOriginModel = computed({
  get: () => selectedOrigin.value,
  set: (value: string) => setSelectedOrigin(value),
});
const sourceFilterModel = computed({
  get: () => sourceFilter.value,
  set: (value: string) => {
    if (value === "all" || value === "indexeddb" || value === "localforage" || value === "sqlite") {
      sourceFilter.value = value;
    }
  },
});
const graphStrategyModel = computed({
  get: () => graphStrategy.value,
  set: (value: string) => {
    if (value === "inferred" || value === "schema") {
      graphStrategy.value = value;
    }
  },
});
const activeRelationships = computed(() =>
  graphStrategy.value === "schema" ? schemaRelationships.value : relationships.value,
);
const activeAutoLayoutPositions = computed(() =>
  graphStrategy.value === "schema" ? schemaLayoutPositions.value : autoLayoutPositions.value,
);

const filteredEntities = computed(() => {
  const query = search.value.trim().toLowerCase();

  return entities.value.filter((entity) => {
    if (sourceFilter.value !== "all" && entity.storageKind !== sourceFilter.value) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      entity.title,
      entity.subtitle,
      entity.containerLabel,
      entity.fields.map((field) => `${field.name} ${field.valueType ?? ""}`).join(" "),
      entity.annotation?.label ?? "",
      entity.annotation?.note ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
});

const visibleNodeIds = computed(() => {
  const ids = new Set(filteredEntities.value.map((entity) => entity.id));
  for (const note of notes.value) {
    ids.add(note.id);
  }
  return ids;
});

const visibleRelationships = computed(() =>
  activeRelationships.value.filter((relationship) => {
    if (!showHeuristicEdges.value && relationship.kind === "field-match") {
      return false;
    }

    return (
      visibleNodeIds.value.has(relationship.source) && visibleNodeIds.value.has(relationship.target)
    );
  }),
);

const persistedGroups = computed(() => graphStore.getScope(scopeKey.value).groups);
const entityCount = computed(() => filteredEntities.value.length);
const relationshipCount = computed(() => visibleRelationships.value.length);

const {
  nodes,
  edges,
  routedEdgePoints,
  clusterMembersByFrameId,
  isGroupFrameNode,
  getInteractiveNodes,
  getNodeSize,
  buildNodes,
  syncCanvasNodes,
  buildEdges,
} = useStorageGraphCanvasNodes({
  scopeKey,
  graphStore,
  canvasMode,
  graphStrategy,
  filteredEntities,
  notes,
  persistedPositions,
  activeAutoLayoutPositions,
  persistedGroups,
  visibleRelationships,
  selectedEdgeId,
});

const {
  selectedNodes,
  canArrangeSelection,
  selectedNode,
  selectedEdge,
  selectedCluster,
  entityTitleById,
  relatedTables,
  persistNodePositions,
  setSelectedNodeIds,
  clearSelection,
  fitCanvas,
  invalidateRoutesForNodeIds,
  onNodesChange,
  onEdgesChange,
  onConnect,
  handleNodeClick,
  handleEdgeClick,
  handleNodeDragStart,
  handleNodeDragStop,
  handleViewportChange,
  handleSelectionAction,
} = useStorageGraphCanvasInteractions({
  scopeKey,
  graphStore,
  history,
  entities,
  notes,
  relationships,
  visibleRelationships,
  persistedGroups,
  nodes,
  edges,
  routedEdgePoints,
  clusterMembersByFrameId,
  isGroupFrameNode,
  getInteractiveNodes,
  syncCanvasNodes,
  buildEdges,
  selectedNodeId,
  selectedEdgeId,
  selectedClusterId,
  zoomPercent,
  getViewport,
  fitView,
});

async function handleAutoLayout() {
  const currentNodes = getInteractiveNodes(nodes.value);
  const toastId = toast.loading("Calculating clean graph layout...");
  try {
    const layout = await layoutStorageGraphWithElk(
      currentNodes.map((node) => ({
        id: node.id,
        name: node.data.nodeKind === "group-frame" ? node.id : node.data.title,
        ...getNodeSize(node),
      })),
      visibleRelationships.value,
      graphStrategy.value === "inferred",
    );
    history.commit();
    routedEdgePoints.value = layout.routes;
    const baseNodes = currentNodes.map((node) => ({
      ...node,
      position: layout.positions[node.id] ?? node.position,
    }));
    syncCanvasNodes(baseNodes);
    persistNodePositions(baseNodes);
    edges.value = buildEdges();
    await fitCanvas(0.12, 260);
    toast.success("ELK layout applied. Use Undo to restore previous positions.", { id: toastId });
  } catch (error) {
    toast.error(`Failed to calculate graph layout: ${String(error)}`, { id: toastId });
  }
}

function handleAddNote() {
  history.commit();
  const note = graphStore.upsertNote(scopeKey.value, {
    note: "",
    title: "Note",
    position: activeAutoLayoutPositions.value[`note-${notes.value.length}`] ?? {
      x: 1120,
      y: 40 + notes.value.length * 220,
    },
  });
  selectedNodeId.value = note.id;
  selectedEdgeId.value = "";
  selectedClusterId.value = "";
}

function handleToggleHeuristicEdges() {
  showHeuristicEdges.value = !showHeuristicEdges.value;
}

function handleSaveAnnotation(nodeId: string, annotation: StorageGraphNodeAnnotation) {
  history.commit();
  graphStore.setNodeAnnotation(scopeKey.value, nodeId, annotation);
  toast.success("Node annotation saved");
}

function handleSaveCluster(payload: { id: string; name: string; note?: string }) {
  history.commit();
  graphStore.setNodeAnnotation(scopeKey.value, payload.id, {
    label: payload.name.trim() || "Cluster",
    note: payload.note?.trim() || undefined,
  });
  syncCanvasNodes();
  toast.success("Cluster metadata saved");
}

async function handleFocusNode(nodeId: string) {
  const node = getInteractiveNodes(nodes.value).find((candidate) => candidate.id === nodeId);
  if (!node) {
    return;
  }
  selectedClusterId.value = "";
  selectedEdgeId.value = "";
  selectedNodeId.value = nodeId;
  setSelectedNodeIds([nodeId]);
  const size = getNodeSize(node);
  await setCenter(node.position.x + size.width / 2, node.position.y + size.height / 2, {
    zoom: Math.max(getViewport().zoom, 0.65),
    duration: 260,
  });
}

function handleSaveNote(payload: { id: string; title: string; note: string; accent: string }) {
  history.commit();
  const currentNode = getInteractiveNodes(nodes.value).find((node) => node.id === payload.id);
  graphStore.upsertNote(scopeKey.value, {
    ...payload,
    position: currentNode
      ? { x: currentNode.position.x, y: currentNode.position.y }
      : persistedPositions.value[payload.id],
  });
  toast.success("Note saved");
}

function handleDeleteNote(noteId: string) {
  history.commit();
  graphStore.removeNote(scopeKey.value, noteId);
  selectedNodeId.value = "";
  toast.success("Note removed");
}

function handleOpenNode(path: string) {
  void router.push(path);
}

function handleSaveEdge(payload: { id: string; label: string }) {
  const existing = relationships.value.find((edge) => edge.id === payload.id);
  if (!existing || existing.kind !== "manual") {
    return;
  }

  history.commit();
  graphStore.upsertManualEdge(scopeKey.value, {
    id: existing.id,
    source: existing.source,
    target: existing.target,
    label: payload.label,
  });
  toast.success("Link saved");
}

function handleDeleteEdge(edgeId: string) {
  history.commit();
  graphStore.removeManualEdge(scopeKey.value, edgeId);
  selectedEdgeId.value = "";
  toast.success("Link removed");
}

function handleUndo() {
  if (!history.undo()) {
    return;
  }

  routedEdgePoints.value = {};
  edges.value = buildEdges();
  clearSelection();
}

function handleRedo() {
  if (!history.redo()) {
    return;
  }

  routedEdgePoints.value = {};
  edges.value = buildEdges();
  clearSelection();
}

function handleZoomIn() {
  void zoomIn({ duration: 120 });
}

function handleZoomOut() {
  void zoomOut({ duration: 120 });
}

function handleResetZoom() {
  void fitCanvas();
}

watch(
  () => availableOrigins.value,
  (origins) => {
    if (!selectedOrigin.value && origins.length > 0) {
      setSelectedOrigin(origins[0] ?? "");
    }
  },
  { immediate: true },
);

watch(
  () => scopeKey.value,
  () => {
    fittedScopeKey.value = "";
    history.reset();
    clearSelection();
  },
);

watch(selectedNodes, (value) => {
  if (value.length === 1) {
    selectedNodeId.value = value[0]?.id ?? "";
    selectedEdgeId.value = "";
    return;
  }

  selectedNodeId.value = "";
  if (value.length > 0) {
    selectedEdgeId.value = "";
  }
});

watch(
  [
    filteredEntities,
    notes,
    visibleRelationships,
    autoLayoutPositions,
    schemaLayoutPositions,
    graphStrategy,
    canvasMode,
    persistedPositions,
    persistedGroups,
    scopeKey,
  ],
  async () => {
    const baseNodes = buildNodes();
    syncCanvasNodes(baseNodes);
    edges.value = buildEdges();

    await nextTick();
    if (nodes.value.length > 0 && fittedScopeKey.value !== scopeKey.value) {
      fittedScopeKey.value = scopeKey.value;
      await fitCanvas();
      return;
    }

    updateZoomPercent();
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="border-b border-border/20 bg-surface-0 px-4 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <Select v-model:model-value="selectedOriginModel">
          <SelectTrigger
            class="h-9 min-w-[14rem] rounded-xl border-border/30 bg-surface-2 text-xs font-mono"
          >
            <SelectValue placeholder="Select origin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="originOption in availableOrigins"
              :key="originOption"
              :value="originOption"
            >
              {{ originOption }}
            </SelectItem>
          </SelectContent>
        </Select>

        <div
          class="flex min-w-[16rem] flex-1 items-center gap-2 rounded-xl border border-border/30 bg-surface-2 px-3 py-2"
        >
          <Input
            v-model="search"
            class="h-5 border-0 bg-transparent px-0 text-xs font-mono focus-visible:ring-0"
            placeholder="Search tables, stores, fields, notes..."
          />
        </div>

        <Select v-model:model-value="sourceFilterModel">
          <SelectTrigger class="h-9 min-w-[10rem] rounded-xl border-border/30 bg-surface-2 text-xs">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="indexeddb">IndexedDB</SelectItem>
            <SelectItem value="localforage">LocalForage</SelectItem>
            <SelectItem value="sqlite">SQLite</SelectItem>
          </SelectContent>
        </Select>

        <Select v-model:model-value="graphStrategyModel">
          <SelectTrigger class="h-9 min-w-[11rem] rounded-xl border-border/30 bg-surface-2 text-xs">
            <SelectValue placeholder="Graph strategy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inferred">Inferred graph</SelectItem>
            <SelectItem value="schema">Schema graph</SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="outline">{{ entityCount }} nodes</Badge>
        <Badge variant="outline">{{ relationshipCount }} links</Badge>
      </div>

      <div
        v-if="error"
        class="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
      >
        {{ error }}
      </div>
    </div>

    <ResizablePanelGroup direction="horizontal" class="min-h-0 flex-1">
      <ResizablePanel :default-size="76" :min-size="45" class="min-h-0">
        <div
          class="relative h-full bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.04),_transparent_38%),linear-gradient(180deg,var(--color-surface-0),var(--color-surface-1))]"
        >
          <div
            class="pointer-events-none absolute inset-0 z-0 opacity-70"
            style="
              background-image: radial-gradient(
                circle,
                rgba(255, 255, 255, 0.11) 1px,
                transparent 1.5px
              );
              background-position: 0 0;
              background-size: 24px 24px;
            "
          />

          <div
            v-if="!isLoading && entityCount === 0"
            class="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground/35"
          >
            No graphable schema for current origin or package.
          </div>

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
            @nodes-change="onNodesChange"
            @edges-change="onEdgesChange"
            @connect="onConnect"
            @node-click="handleNodeClick"
            @edge-click="handleEdgeClick"
            @node-drag-start="handleNodeDragStart"
            @node-drag-stop="handleNodeDragStop"
            @viewport-change="handleViewportChange"
            @pane-click="clearSelection"
          />

          <StorageGraphSelectionToolbar
            :visible="canArrangeSelection"
            @action="handleSelectionAction"
          />

          <StorageGraphCanvasDock
            v-model:mode="canvasMode"
            :show-heuristic-edges="showHeuristicEdges"
            @add-note="handleAddNote"
            @auto-layout="handleAutoLayout"
            @toggle-heuristic-edges="handleToggleHeuristicEdges"
          />

          <StorageGraphViewportToolbar
            :zoom-percent="zoomPercent"
            :can-undo="history.canUndo.value"
            :can-redo="history.canRedo.value"
            @zoom-out="handleZoomOut"
            @zoom-in="handleZoomIn"
            @reset-zoom="handleResetZoom"
            @undo="handleUndo"
            @redo="handleRedo"
          />
        </div>
      </ResizablePanel>

      <ResizableHandle with-handle />

      <ResizablePanel :default-size="24" :min-size="20" :max-size="40" class="min-h-0">
        <StorageGraphInspector
          :selected-node="selectedNode"
          :selected-edge="selectedEdge"
          :selected-cluster="selectedCluster"
          :related-tables="relatedTables"
          :entity-title-by-id="entityTitleById"
          @save-annotation="handleSaveAnnotation"
          @save-note="handleSaveNote"
          @delete-note="handleDeleteNote"
          @open-node="handleOpenNode"
          @save-edge="handleSaveEdge"
          @delete-edge="handleDeleteEdge"
          @save-cluster="handleSaveCluster"
          @focus-node="handleFocusNode"
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
