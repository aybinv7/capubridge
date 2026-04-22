<script setup lang="ts">
import { computed, markRaw, nextTick, ref, shallowRef, watch } from "vue";
import {
  MarkerType,
  Position,
  SelectionMode,
  VueFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeMouseEvent,
  type Node,
  type NodeChange,
  type NodeDragEvent,
  type NodeMouseEvent,
  type ViewportTransform,
  useVueFlow,
} from "@vue-flow/core";
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
import StorageGraphSelectionToolbar from "@/modules/storage/graph/StorageGraphSelectionToolbar.vue";
import {
  applySelectionAction,
  getSelectedCanvasNodes,
  type StorageGraphCanvasMode,
  type StorageGraphSelectionAction,
} from "@/modules/storage/graph/storageGraphCanvas.utils";
import StorageGraphViewportToolbar from "@/modules/storage/graph/StorageGraphViewportToolbar.vue";
import { useStorageGraphData } from "@/modules/storage/graph/useStorageGraphData";
import { useStorageGraphHistory } from "@/modules/storage/graph/useStorageGraphHistory";
import { useStorageGraphStore } from "@/modules/storage/stores/useStorageGraphStore";
import type {
  StorageGraphGroupRecord,
  StorageGraphNodeAnnotation,
  StorageGraphNodeData,
  StorageGraphRelationship,
} from "@/types/storageGraph.types";
import { useRouter } from "vue-router";

const GROUP_FRAME_PADDING = 26;

const router = useRouter();
const graphStore = useStorageGraphStore();
const {
  scopeKey,
  entities,
  notes,
  persistedPositions,
  relationships,
  autoLayoutPositions,
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

const { fitView, getViewport, zoomIn, zoomOut } = useVueFlow();

const search = ref("");
const sourceFilter = ref<"all" | "indexeddb" | "localforage" | "sqlite">("all");
const showHeuristicEdges = ref(true);
const canvasMode = ref<StorageGraphCanvasMode>("pan");
const nodes = shallowRef<Node<StorageGraphNodeData>[]>([]);
const edges = shallowRef<Edge<StorageGraphRelationship>[]>([]);
const selectedNodeId = ref("");
const selectedEdgeId = ref("");
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

function isGroupFrameNode(node: Node<StorageGraphNodeData>) {
  return node.type === "group-frame" || node.data.nodeKind === "group-frame";
}

function getInteractiveNodes(currentNodes: Node<StorageGraphNodeData>[]) {
  return currentNodes.filter((node) => !isGroupFrameNode(node));
}

function getNodeSize(node: Node<StorageGraphNodeData>) {
  if (node.data.nodeKind === "group-frame") {
    return {
      width: node.data.width,
      height: node.data.height,
    };
  }

  return {
    width: node.dimensions?.width ?? (node.data.nodeKind === "note" ? 260 : 280),
    height: node.dimensions?.height ?? (node.data.nodeKind === "note" ? 152 : 244),
  };
}

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
  relationships.value.filter((relationship) => {
    if (!showHeuristicEdges.value && relationship.kind === "field-match") {
      return false;
    }

    return visibleNodeIds.value.has(relationship.source) && visibleNodeIds.value.has(relationship.target);
  }),
);

const persistedGroups = computed(() => graphStore.getScope(scopeKey.value).groups);
const nodeGroupIndex = computed(() => {
  const index = new Map<string, StorageGraphGroupRecord>();

  for (const group of persistedGroups.value) {
    for (const nodeId of group.nodeIds) {
      index.set(nodeId, group);
    }
  }

  return index;
});
const selectedNodes = computed(() => getSelectedCanvasNodes(getInteractiveNodes(nodes.value)));
const canArrangeSelection = computed(() => selectedNodes.value.length > 1);
const selectedNode = computed(() => getInteractiveNodes(nodes.value).find((node) => node.id === selectedNodeId.value) ?? null);
const selectedEdge = computed(
  () => visibleRelationships.value.find((edge) => edge.id === selectedEdgeId.value) ?? null,
);
const entityCount = computed(() => filteredEntities.value.length);
const relationshipCount = computed(() => visibleRelationships.value.length);

function buildNodes() {
  const selectedIds = new Set(getSelectedCanvasNodes(getInteractiveNodes(nodes.value)).map((node) => node.id));

  const entityNodes: Node<StorageGraphNodeData>[] = filteredEntities.value.map((entity) => ({
    id: entity.id,
    type: "entity",
    position: persistedPositions.value[entity.id] ?? autoLayoutPositions.value[entity.id] ?? { x: 0, y: 0 },
    data: {
      nodeKind: "entity",
      entityKind: entity.entityKind,
      storageKind: entity.storageKind,
      title: entity.title,
      subtitle: entity.subtitle,
      containerLabel: entity.containerLabel,
      openPath: entity.openPath,
      statsLabel: entity.statsLabel,
      changeCount: entity.changeCount,
      fields: entity.fields,
      annotation: entity.annotation,
    },
    draggable: true,
    selectable: true,
    deletable: false,
    selected: selectedIds.has(entity.id),
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

  const noteNodes: Node<StorageGraphNodeData>[] = notes.value.map((note) => ({
    id: note.id,
    type: "note",
    position: persistedPositions.value[note.id] ?? note.position ?? autoLayoutPositions.value[note.id] ?? { x: 0, y: 0 },
    data: {
      nodeKind: "note",
      title: note.title,
      note: note.note,
      accent: note.accent,
    },
    draggable: true,
    selectable: true,
    deletable: true,
    selected: selectedIds.has(note.id),
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

  return [...entityNodes, ...noteNodes];
}

function buildGroupFrameNodes(baseNodes: Node<StorageGraphNodeData>[]) {
  const selectedIds = new Set(baseNodes.filter((node) => node.selected).map((node) => node.id));
  const nodeById = new Map(baseNodes.map((node) => [node.id, node]));

  return persistedGroups.value.flatMap<Node<StorageGraphNodeData>>((group) => {
    if (group.nodeIds.length < 2 || !group.nodeIds.every((nodeId) => selectedIds.has(nodeId))) {
      return [];
    }

    const members = group.nodeIds
      .map((nodeId) => nodeById.get(nodeId))
      .filter((node): node is Node<StorageGraphNodeData> => Boolean(node));

    if (members.length < 2) {
      return [];
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const member of members) {
      const size = getNodeSize(member);
      minX = Math.min(minX, member.position.x);
      minY = Math.min(minY, member.position.y);
      maxX = Math.max(maxX, member.position.x + size.width);
      maxY = Math.max(maxY, member.position.y + size.height);
    }

    return [
      {
        id: `group-frame:${group.id}`,
        type: "group-frame",
        position: {
          x: minX - GROUP_FRAME_PADDING,
          y: minY - GROUP_FRAME_PADDING,
        },
        data: {
          nodeKind: "group-frame",
          title: `Group · ${members.length}`,
          width: maxX - minX + GROUP_FRAME_PADDING * 2,
          height: maxY - minY + GROUP_FRAME_PADDING * 2,
        },
        draggable: false,
        selectable: false,
        deletable: false,
        zIndex: -1,
      },
    ];
  });
}

function syncCanvasNodes(baseNodes = getInteractiveNodes(nodes.value)) {
  nodes.value = [...baseNodes, ...buildGroupFrameNodes(baseNodes)];
}

function buildEdges() {
  return visibleRelationships.value.map<Edge<StorageGraphRelationship>>((relationship) => ({
    id: relationship.id,
    source: relationship.source,
    target: relationship.target,
    label: relationship.label,
    type: "smoothstep",
    animated: relationship.kind === "manual",
    selectable: true,
    selected: relationship.id === selectedEdgeId.value,
    deletable: relationship.kind === "manual",
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
    style:
      relationship.kind === "foreign-key"
        ? { stroke: "var(--color-success)", strokeWidth: 1.8 }
        : relationship.kind === "manual"
          ? { stroke: "var(--color-primary)", strokeWidth: 1.8 }
          : {
              stroke:
                relationship.confidence === "high"
                  ? "var(--color-info)"
                  : relationship.confidence === "medium"
                    ? "var(--color-warning)"
                    : "var(--color-border-active)",
              strokeDasharray: "6 4",
              strokeWidth: 1.4,
            },
    data: relationship,
  }));
}

function updateZoomPercent(zoom = getViewport().zoom) {
  zoomPercent.value = Math.max(20, Math.round(zoom * 100));
}

function persistNodePositions(currentNodes: Node<StorageGraphNodeData>[]) {
  for (const node of currentNodes) {
    graphStore.setNodePosition(scopeKey.value, node.id, {
      x: node.position.x,
      y: node.position.y,
    });
  }
}

function setSelectedNodeIds(nodeIds: string[]) {
  const selectedIds = new Set(nodeIds);
  const baseNodes = getInteractiveNodes(nodes.value).map((node) => ({
    ...node,
    selected: selectedIds.has(node.id),
  }));
  syncCanvasNodes(baseNodes);
}

function clearSelection() {
  selectedNodeId.value = "";
  selectedEdgeId.value = "";
  setSelectedNodeIds([]);
  edges.value = edges.value.map((edge) => (edge.selected ? { ...edge, selected: false } : edge));
}

async function fitCanvas(padding = 0.18, duration = 180) {
  await fitView({ padding, duration });
  updateZoomPercent();
}

function onNodesChange(changes: NodeChange[]) {
  const removedNoteIds = changes
    .filter((change) => change.type === "remove")
    .map((change) => change.id)
    .filter((id) => notes.value.some((note) => note.id === id));

  if (removedNoteIds.length > 0) {
    history.commit();
    for (const noteId of removedNoteIds) {
      graphStore.removeNote(scopeKey.value, noteId);
    }
    if (removedNoteIds.includes(selectedNodeId.value)) {
      selectedNodeId.value = "";
    }
  }

  const nextNodes = applyNodeChanges(changes, nodes.value);
  syncCanvasNodes(getInteractiveNodes(nextNodes));
}

function onEdgesChange(changes: EdgeChange[]) {
  const removedManualEdges = changes
    .filter((change) => change.type === "remove")
    .map((change) => change.id)
    .filter((id) => relationships.value.some((edge) => edge.id === id && edge.kind === "manual"));

  if (removedManualEdges.length > 0) {
    history.commit();
    for (const edgeId of removedManualEdges) {
      graphStore.removeManualEdge(scopeKey.value, edgeId);
    }
    if (removedManualEdges.includes(selectedEdgeId.value)) {
      selectedEdgeId.value = "";
    }
  }

  edges.value = applyEdgeChanges(changes, edges.value);
}

function onConnect(connection: Connection) {
  if (!connection.source || !connection.target) {
    return;
  }

  const existing = relationships.value.find(
    (edge) =>
      edge.kind === "manual" &&
      edge.source === connection.source &&
      edge.target === connection.target,
  );

  if (existing) {
    toast.info("Manual link already exists");
    return;
  }

  history.commit();
  const edge = graphStore.upsertManualEdge(scopeKey.value, {
    source: connection.source,
    target: connection.target,
    label: "manual link",
  });

  edges.value = addEdge(
    {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: "smoothstep",
    },
    edges.value,
  );
  selectedEdgeId.value = edge.id;
}

function handleNodeClick(event: NodeMouseEvent) {
  const group = nodeGroupIndex.value.get(event.node.id);
  selectedEdgeId.value = "";

  if (group) {
    setSelectedNodeIds(group.nodeIds);
    selectedNodeId.value = group.nodeIds[0] ?? event.node.id;
    return;
  }

  setSelectedNodeIds([event.node.id]);
  selectedNodeId.value = event.node.id;
}

function handleEdgeClick(event: EdgeMouseEvent) {
  selectedEdgeId.value = event.edge.id;
  selectedNodeId.value = "";
  setSelectedNodeIds([]);
}

function handleNodeDragStart(_event: NodeDragEvent) {
  history.commit();
}

function handleNodeDragStop(_event: NodeDragEvent) {
  const baseNodes = getInteractiveNodes(nodes.value);
  persistNodePositions(baseNodes);
  syncCanvasNodes(baseNodes);
}

function handleViewportChange(viewport: ViewportTransform) {
  updateZoomPercent(viewport.zoom);
}

function handleSelectionAction(action: StorageGraphSelectionAction) {
  if (action === "group") {
    const nodeIds = selectedNodes.value.map((node) => node.id);
    if (nodeIds.length < 2) {
      return;
    }

    history.commit();
    const group = graphStore.upsertGroup(scopeKey.value, { nodeIds });
    if (!group) {
      return;
    }

    setSelectedNodeIds(group.nodeIds);
    toast.success("Group saved");
    return;
  }

  if (action === "ungroup") {
    const selectedIds = new Set(selectedNodes.value.map((node) => node.id));
    const groupsToRemove = persistedGroups.value.filter((group) =>
      group.nodeIds.length > 1 && group.nodeIds.every((nodeId) => selectedIds.has(nodeId)),
    );

    if (groupsToRemove.length === 0) {
      return;
    }

    history.commit();
    for (const group of groupsToRemove) {
      graphStore.removeGroup(scopeKey.value, group.id);
    }
    syncCanvasNodes();
    toast.success("Group removed");
    return;
  }

  if (!canArrangeSelection.value) {
    return;
  }

  history.commit();
  const baseNodes = applySelectionAction(getInteractiveNodes(nodes.value), action);
  syncCanvasNodes(baseNodes);
  persistNodePositions(baseNodes);
}

function handleAutoLayout() {
  history.commit();
  const baseNodes = getInteractiveNodes(nodes.value).map((node) => ({
    ...node,
    position: autoLayoutPositions.value[node.id] ?? node.position,
  }));
  syncCanvasNodes(baseNodes);
  persistNodePositions(baseNodes);
  void fitCanvas(0.18, 220);
}

function handleAddNote() {
  history.commit();
  const note = graphStore.upsertNote(scopeKey.value, {
    note: "",
    title: "Note",
    position: autoLayoutPositions.value[`note-${notes.value.length}`] ?? {
      x: 1120,
      y: 40 + notes.value.length * 220,
    },
  });
  selectedNodeId.value = note.id;
  selectedEdgeId.value = "";
}

function handleToggleHeuristicEdges() {
  showHeuristicEdges.value = !showHeuristicEdges.value;
}

function handleSaveAnnotation(nodeId: string, annotation: StorageGraphNodeAnnotation) {
  history.commit();
  graphStore.setNodeAnnotation(scopeKey.value, nodeId, annotation);
  toast.success("Node annotation saved");
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

  clearSelection();
}

function handleRedo() {
  if (!history.redo()) {
    return;
  }

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
  [filteredEntities, notes, visibleRelationships, autoLayoutPositions, persistedPositions, persistedGroups, scopeKey],
  async () => {
    const baseNodes = buildNodes();
    nodes.value = [...baseNodes, ...buildGroupFrameNodes(baseNodes)];
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
          <SelectTrigger class="h-9 min-w-[14rem] rounded-xl border-border/30 bg-surface-2 text-xs font-mono">
            <SelectValue placeholder="Select origin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="originOption in availableOrigins" :key="originOption" :value="originOption">
              {{ originOption }}
            </SelectItem>
          </SelectContent>
        </Select>

        <div class="flex min-w-[16rem] flex-1 items-center gap-2 rounded-xl border border-border/30 bg-surface-2 px-3 py-2">
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
        <div class="relative h-full bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.04),_transparent_38%),linear-gradient(180deg,var(--color-surface-0),var(--color-surface-1))]">
          <div
            class="pointer-events-none absolute inset-0 z-0 opacity-70"
            style="background-image: radial-gradient(circle, rgba(255,255,255,0.11) 1px, transparent 1.5px); background-position: 0 0; background-size: 24px 24px;"
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
            :min-zoom="0.2"
            :max-zoom="2"
            :only-render-visible-elements="true"
            :pan-on-drag="canvasMode === 'pan' ? true : [1]"
            :selection-key-code="canvasMode === 'select'"
            multi-selection-key-code="Shift"
            :selection-mode="SelectionMode.Partial"
            :nodes-draggable="true"
            :elements-selectable="true"
            :nodes-connectable="true"
            :node-types="nodeTypes"
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

          <StorageGraphSelectionToolbar :visible="canArrangeSelection" @action="handleSelectionAction" />

          <StorageGraphCanvasDock
            v-model:mode="canvasMode"
            :show-heuristic-edges="showHeuristicEdges"
            @add-note="handleAddNote"
            @auto-layout="handleAutoLayout"
            @toggle-heuristic-edges="handleToggleHeuristicEdges"
          />

          <StorageGraphViewportToolbar
            :zoom-percent="zoomPercent"
            :can-undo="history.canUndo"
            :can-redo="history.canRedo"
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
          @save-annotation="handleSaveAnnotation"
          @save-note="handleSaveNote"
          @delete-note="handleDeleteNote"
          @open-node="handleOpenNode"
          @save-edge="handleSaveEdge"
          @delete-edge="handleDeleteEdge"
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
