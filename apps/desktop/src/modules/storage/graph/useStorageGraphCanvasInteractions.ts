import { computed } from "vue";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type EdgeMouseEvent,
  type EdgeRemoveChange,
  type NodeChange,
  type NodeDragEvent,
  type NodeMouseEvent,
  type NodePositionChange,
  type NodeRemoveChange,
  type ViewportTransform,
} from "@vue-flow/core";
import { toast } from "vue-sonner";
import {
  applySelectionAction,
  getSelectedCanvasNodes,
  type StorageGraphSelectionAction,
} from "@/modules/storage/graph/storageGraphCanvas.utils";
import type {
  StorageGraphMountedEdge,
  StorageGraphMountedNode,
} from "@/modules/storage/graph/useStorageGraphCanvasNodes";
import type { useStorageGraphHistory } from "@/modules/storage/graph/useStorageGraphHistory";
import type { useStorageGraphStore } from "@/modules/storage/stores/useStorageGraphStore";
import type {
  StorageGraphClusterSelection,
  StorageGraphEntityDescriptor,
  StorageGraphGroupRecord,
  StorageGraphNoteRecord,
  StorageGraphRelatedTable,
  StorageGraphRelationship,
} from "@/types/storageGraph.types";

function isPositionChange(change: NodeChange): change is NodePositionChange {
  return change.type === "position";
}

function isNodeRemoveChange(change: NodeChange): change is NodeRemoveChange {
  return change.type === "remove";
}

function isEdgeRemoveChange(change: EdgeChange): change is EdgeRemoveChange {
  return change.type === "remove";
}

interface UseStorageGraphCanvasInteractionsOptions {
  scopeKey: { value: string };
  graphStore: ReturnType<typeof useStorageGraphStore>;
  history: ReturnType<typeof useStorageGraphHistory>;
  entities: { value: StorageGraphEntityDescriptor[] };
  notes: { value: StorageGraphNoteRecord[] };
  relationships: { value: StorageGraphRelationship[] };
  visibleRelationships: { value: StorageGraphRelationship[] };
  persistedGroups: { value: StorageGraphGroupRecord[] };
  nodes: { value: StorageGraphMountedNode[] };
  edges: { value: StorageGraphMountedEdge[] };
  routedEdgePoints: { value: Record<string, Array<{ x: number; y: number }>> };
  clusterMembersByFrameId: Map<string, string[]>;
  isGroupFrameNode: (node: StorageGraphMountedNode) => boolean;
  getInteractiveNodes: (nodes: StorageGraphMountedNode[]) => StorageGraphMountedNode[];
  syncCanvasNodes: (baseNodes?: StorageGraphMountedNode[]) => void;
  buildEdges: () => StorageGraphMountedEdge[];
  selectedNodeId: { value: string };
  selectedEdgeId: { value: string };
  selectedClusterId: { value: string };
  zoomPercent: { value: number };
  getViewport: () => { zoom: number };
  fitView: (options?: { padding?: number; duration?: number }) => Promise<void>;
}

export function useStorageGraphCanvasInteractions(
  options: UseStorageGraphCanvasInteractionsOptions,
) {
  const {
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
  } = options;

  const selectedNodes = computed(() => getSelectedCanvasNodes(getInteractiveNodes(nodes.value)));
  const canArrangeSelection = computed(() => selectedNodes.value.length > 1);
  const selectedNode = computed(
    () => getInteractiveNodes(nodes.value).find((node) => node.id === selectedNodeId.value) ?? null,
  );
  const selectedEdge = computed(
    () => visibleRelationships.value.find((edge) => edge.id === selectedEdgeId.value) ?? null,
  );
  const selectedCluster = computed<StorageGraphClusterSelection | null>(() => {
    const frame = nodes.value.find((node) => node.id === selectedClusterId.value);
    if (!frame || frame.data.nodeKind !== "group-frame" || !frame.data.memberIds) {
      return null;
    }
    const nodeById = new Map(getInteractiveNodes(nodes.value).map((node) => [node.id, node]));
    const annotation = graphStore.getNodeAnnotation(scopeKey.value, frame.id);
    return {
      id: frame.id,
      name: annotation?.label || frame.data.title.replace(/\s·\s\d+$/, ""),
      note: annotation?.note,
      memberIds: frame.data.memberIds,
      memberNames: frame.data.memberIds.map((nodeId) => {
        const member = nodeById.get(nodeId);
        return member?.data.title ?? nodeId;
      }),
      source: frame.data.clusterSource ?? "manual",
    };
  });
  const entityTitleById = computed(() =>
    Object.fromEntries(entities.value.map((entity) => [entity.id, entity.title])),
  );
  const relatedTables = computed<StorageGraphRelatedTable[]>(() => {
    const nodeId = selectedNode.value?.id;
    if (!nodeId) {
      return [];
    }
    return visibleRelationships.value.flatMap((relationship) => {
      if (relationship.source !== nodeId && relationship.target !== nodeId) {
        return [];
      }
      const outgoing = relationship.source === nodeId;
      const relatedNodeId = outgoing ? relationship.target : relationship.source;
      return [
        {
          relationshipId: relationship.id,
          nodeId: relatedNodeId,
          title: entityTitleById.value[relatedNodeId] ?? relatedNodeId,
          direction: outgoing ? "outgoing" : "incoming",
          kind: relationship.kind,
          confidence: relationship.confidence,
          sourceFieldName: relationship.sourceFieldName,
          targetFieldName: relationship.targetFieldName,
        },
      ];
    });
  });

  function updateZoomPercent(zoom = getViewport().zoom) {
    zoomPercent.value = Math.max(1, Math.round(zoom * 100));
  }

  function persistNodePositions(currentNodes: StorageGraphMountedNode[]) {
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
    selectedClusterId.value = "";
    setSelectedNodeIds([]);
    edges.value = edges.value.map((edge) => (edge.selected ? { ...edge, selected: false } : edge));
  }

  async function fitCanvas(padding = 0.18, duration = 180) {
    await fitView({ padding, duration });
    updateZoomPercent();
  }

  function getMovedNodeIds(event: NodeDragEvent): string[] {
    const movedIds = new Set<string>();
    for (const node of event.nodes.length > 0 ? event.nodes : [event.node]) {
      const clusterMemberIds = clusterMembersByFrameId.get(node.id);
      if (clusterMemberIds) {
        clusterMemberIds.forEach((nodeId) => movedIds.add(nodeId));
      } else if (!isGroupFrameNode(node)) {
        movedIds.add(node.id);
      }
    }
    return [...movedIds];
  }

  function invalidateRoutesForNodeIds(nodeIds: string[]) {
    const movedIds = new Set(nodeIds);
    if (movedIds.size === 0) {
      return;
    }
    const nextRoutes = { ...routedEdgePoints.value };
    let changed = false;
    for (const relationship of visibleRelationships.value) {
      if (
        (movedIds.has(relationship.source) || movedIds.has(relationship.target)) &&
        nextRoutes[relationship.id]
      ) {
        delete nextRoutes[relationship.id];
        changed = true;
      }
    }
    if (!changed) {
      return;
    }
    routedEdgePoints.value = nextRoutes;
    edges.value = buildEdges();
  }

  function moveClusterMembersForFrameChanges(
    changes: NodeChange[],
    nextNodes: StorageGraphMountedNode[],
  ) {
    const directlyMovedNodeIds = new Set(
      changes
        .filter(isPositionChange)
        .filter((change) => !clusterMembersByFrameId.has(change.id))
        .map((change) => change.id),
    );
    const translatedNodeIds = new Set<string>();
    let baseNodes = getInteractiveNodes(nextNodes);

    for (const change of changes) {
      if (!isPositionChange(change)) {
        continue;
      }
      const memberIds = clusterMembersByFrameId.get(change.id);
      const currentFrame = nodes.value.find((node) => node.id === change.id);
      if (!memberIds || !currentFrame) {
        continue;
      }
      const deltaX = change.position.x - currentFrame.position.x;
      const deltaY = change.position.y - currentFrame.position.y;
      const memberSet = new Set(memberIds);
      baseNodes = baseNodes.map((node) => {
        if (
          !memberSet.has(node.id) ||
          directlyMovedNodeIds.has(node.id) ||
          translatedNodeIds.has(node.id)
        ) {
          return node;
        }
        translatedNodeIds.add(node.id);
        return {
          ...node,
          position: {
            x: node.position.x + deltaX,
            y: node.position.y + deltaY,
          },
        };
      });
    }

    return baseNodes;
  }

  function onNodesChange(changes: NodeChange[]) {
    const removedNoteIds = changes
      .filter(isNodeRemoveChange)
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

    const movedNodeIds = changes.flatMap((change) => {
      if (!isPositionChange(change)) {
        return [];
      }
      return clusterMembersByFrameId.get(change.id) ?? [change.id];
    });
    invalidateRoutesForNodeIds(movedNodeIds);
    const nextNodes = applyNodeChanges(changes, nodes.value);
    syncCanvasNodes(moveClusterMembersForFrameChanges(changes, nextNodes));
    edges.value = buildEdges();
  }

  function onEdgesChange(changes: EdgeChange[]) {
    const removedManualEdges = changes
      .filter(isEdgeRemoveChange)
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

    // addEdge is typed over the generic node+edge `Elements` union; this call
    // only ever adds to an edges-only array and returns an edges-only array.
    edges.value = addEdge(
      {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: "smoothstep",
      },
      edges.value,
    ) as StorageGraphMountedEdge[];
    selectedEdgeId.value = edge.id;
  }

  function handleNodeClick(event: NodeMouseEvent) {
    selectedEdgeId.value = "";
    if (isGroupFrameNode(event.node)) {
      selectedNodeId.value = "";
      selectedClusterId.value = event.node.id;
      setSelectedNodeIds([]);
      return;
    }

    selectedClusterId.value = "";
    setSelectedNodeIds([event.node.id]);
    selectedNodeId.value = event.node.id;
  }

  function handleEdgeClick(event: EdgeMouseEvent) {
    selectedEdgeId.value = event.edge.id;
    selectedNodeId.value = "";
    selectedClusterId.value = "";
    setSelectedNodeIds([]);
  }

  function handleNodeDragStart(event: NodeDragEvent) {
    history.commit();
    invalidateRoutesForNodeIds(getMovedNodeIds(event));
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
      const groupsToRemove = persistedGroups.value.filter(
        (group) =>
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
    invalidateRoutesForNodeIds(selectedNodes.value.map((node) => node.id));
    // applySelectionAction only repositions the mounted nodes it's given, so the
    // result is still the mounted shape even though its own return type is the
    // narrower authoring `Node` type.
    const baseNodes = applySelectionAction(
      getInteractiveNodes(nodes.value),
      action,
    ) as StorageGraphMountedNode[];
    syncCanvasNodes(baseNodes);
    persistNodePositions(baseNodes);
    edges.value = buildEdges();
  }

  return {
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
  };
}
