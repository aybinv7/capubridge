import { ref, shallowRef } from "vue";
import { MarkerType, Position, type GraphEdge, type GraphNode } from "@vue-flow/core";
import {
  getSelectedCanvasNodes,
  getStorageGraphClusterTitle,
  isStorageGraphRouteAttached,
  type StorageGraphCanvasMode,
} from "@/modules/storage/graph/storageGraphCanvas.utils";
import { buildStorageGraphNamingFamilies } from "@/modules/storage/graph/storageGraphElkLayout";
import type { useStorageGraphStore } from "@/modules/storage/stores/useStorageGraphStore";
import type {
  StorageGraphEntityDescriptor,
  StorageGraphGroupRecord,
  StorageGraphNodeData,
  StorageGraphNoteRecord,
  StorageGraphPosition,
  StorageGraphRelationship,
} from "@/types/storageGraph.types";

const GROUP_FRAME_SIDE_PADDING = 26;
const GROUP_FRAME_TOP_PADDING = 58;
const CONTAINER_FRAME_PADDING = 38;

// VueFlow's `GraphNode`/`GraphEdge` are the runtime-enriched shapes (dimensions,
// computedPosition, selected, ...); we only ever author the `Node`/`Edge` input
// subset here and VueFlow fills in the rest once the elements mount, so the
// construction helpers below cast their return value to the mounted shape.
export type StorageGraphMountedNode = GraphNode<StorageGraphNodeData>;
export type StorageGraphMountedEdge = GraphEdge<StorageGraphRelationship>;

interface UseStorageGraphCanvasNodesOptions {
  scopeKey: { value: string };
  graphStore: ReturnType<typeof useStorageGraphStore>;
  canvasMode: { value: StorageGraphCanvasMode };
  graphStrategy: { value: "inferred" | "schema" };
  filteredEntities: { value: StorageGraphEntityDescriptor[] };
  notes: { value: StorageGraphNoteRecord[] };
  persistedPositions: { value: Record<string, StorageGraphPosition> };
  activeAutoLayoutPositions: { value: Record<string, StorageGraphPosition> };
  persistedGroups: { value: StorageGraphGroupRecord[] };
  visibleRelationships: { value: StorageGraphRelationship[] };
  selectedEdgeId: { value: string };
}

export function useStorageGraphCanvasNodes(options: UseStorageGraphCanvasNodesOptions) {
  const {
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
  } = options;

  const nodes = shallowRef<StorageGraphMountedNode[]>([]);
  const edges = shallowRef<StorageGraphMountedEdge[]>([]);
  const routedEdgePoints = ref<Record<string, Array<{ x: number; y: number }>>>({});
  const clusterMembersByFrameId = new Map<string, string[]>();

  function isGroupFrameNode(node: StorageGraphMountedNode) {
    return node.type === "group-frame" || node.data.nodeKind === "group-frame";
  }

  function getInteractiveNodes(currentNodes: StorageGraphMountedNode[]) {
    return currentNodes.filter((node) => !isGroupFrameNode(node));
  }

  function getNodeSize(node: StorageGraphMountedNode) {
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

  function buildNodes(): StorageGraphMountedNode[] {
    const selectedIds = new Set(
      getSelectedCanvasNodes(getInteractiveNodes(nodes.value)).map((node) => node.id),
    );

    const entityNodes = filteredEntities.value.map((entity) => ({
      id: entity.id,
      type: "entity",
      position: persistedPositions.value[entity.id] ??
        activeAutoLayoutPositions.value[entity.id] ?? { x: 0, y: 0 },
      data: {
        nodeKind: "entity",
        entityKind: entity.entityKind,
        storageKind: entity.storageKind,
        groupKey: entity.groupKey,
        title: entity.title,
        subtitle: entity.subtitle,
        containerLabel: entity.containerLabel,
        openPath: entity.openPath,
        statsLabel: entity.statsLabel,
        changeCount: entity.changeCount,
        fields: entity.fields,
        annotation: entity.annotation,
      },
      draggable: canvasMode.value === "select",
      selectable: true,
      deletable: false,
      selected: selectedIds.has(entity.id),
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    })) as StorageGraphMountedNode[];

    const noteNodes = notes.value.map((note) => ({
      id: note.id,
      type: "note",
      position: persistedPositions.value[note.id] ??
        note.position ??
        activeAutoLayoutPositions.value[note.id] ?? { x: 0, y: 0 },
      data: {
        nodeKind: "note",
        title: note.title,
        note: note.note,
        accent: note.accent,
      },
      draggable: canvasMode.value === "select",
      selectable: true,
      deletable: true,
      selected: selectedIds.has(note.id),
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    })) as StorageGraphMountedNode[];

    return [...entityNodes, ...noteNodes];
  }

  function buildGroupFrameNodes(baseNodes: StorageGraphMountedNode[]): StorageGraphMountedNode[] {
    const nodeById = new Map(baseNodes.map((node) => [node.id, node]));

    return persistedGroups.value.flatMap((group) => {
      if (group.nodeIds.length < 2) {
        return [];
      }

      const members = group.nodeIds
        .map((nodeId) => nodeById.get(nodeId))
        .filter((node): node is StorageGraphMountedNode => Boolean(node));

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

      const frameId = `group-frame:${group.id}`;
      clusterMembersByFrameId.set(
        frameId,
        members.map((member) => member.id),
      );
      const annotation = graphStore.getNodeAnnotation(scopeKey.value, frameId);
      const title =
        annotation?.label ||
        getStorageGraphClusterTitle(members.map((member) => member.data.title));

      return [
        {
          id: frameId,
          type: "group-frame",
          position: {
            x: minX - GROUP_FRAME_SIDE_PADDING,
            y: minY - GROUP_FRAME_TOP_PADDING,
          },
          data: {
            nodeKind: "group-frame",
            title: `${title} · ${members.length}`,
            width: maxX - minX + GROUP_FRAME_SIDE_PADDING * 2,
            height: maxY - minY + GROUP_FRAME_TOP_PADDING + GROUP_FRAME_SIDE_PADDING,
            variant: "manual",
            memberIds: members.map((member) => member.id),
            clusterSource: "manual",
          },
          draggable: canvasMode.value === "select",
          selectable: true,
          deletable: false,
          zIndex: -1,
        },
      ];
    }) as StorageGraphMountedNode[];
  }

  function buildNamingFamilyFrameNodes(
    baseNodes: StorageGraphMountedNode[],
  ): StorageGraphMountedNode[] {
    const entityNodes = baseNodes.filter((node) => node.data.nodeKind === "entity");
    const nodeById = new Map(entityNodes.map((node) => [node.id, node]));
    const families = buildStorageGraphNamingFamilies(
      entityNodes.map((node) => ({
        id: node.id,
        name: node.data.nodeKind === "entity" ? node.data.title : node.id,
        ...getNodeSize(node),
      })),
      visibleRelationships.value,
    );

    return families.flatMap((family) => {
      const members = family.memberIds
        .map((nodeId) => nodeById.get(nodeId))
        .filter((node): node is StorageGraphMountedNode => Boolean(node));
      if (members.length < 3) {
        return [];
      }
      const minX = Math.min(...members.map((member) => member.position.x));
      const minY = Math.min(...members.map((member) => member.position.y));
      const maxX = Math.max(
        ...members.map((member) => member.position.x + getNodeSize(member).width),
      );
      const maxY = Math.max(
        ...members.map((member) => member.position.y + getNodeSize(member).height),
      );
      const frameId = `naming-frame:${family.key}`;
      clusterMembersByFrameId.set(frameId, family.memberIds);
      const annotation = graphStore.getNodeAnnotation(scopeKey.value, frameId);
      const title =
        annotation?.label ||
        getStorageGraphClusterTitle(
          members.flatMap((member) =>
            member.data.nodeKind === "entity" ? [member.data.title] : [],
          ),
        );

      return [
        {
          id: frameId,
          type: "group-frame",
          position: {
            x: minX - GROUP_FRAME_SIDE_PADDING,
            y: minY - GROUP_FRAME_TOP_PADDING,
          },
          data: {
            nodeKind: "group-frame",
            title: `${title} · ${members.length}`,
            width: maxX - minX + GROUP_FRAME_SIDE_PADDING * 2,
            height: maxY - minY + GROUP_FRAME_TOP_PADDING + GROUP_FRAME_SIDE_PADDING,
            variant: "inferred",
            memberIds: family.memberIds,
            clusterSource: "inferred",
          },
          draggable: canvasMode.value === "select",
          selectable: true,
          deletable: false,
          zIndex: -1,
        },
      ];
    }) as StorageGraphMountedNode[];
  }

  function buildContainerFrameNodes(
    baseNodes: StorageGraphMountedNode[],
  ): StorageGraphMountedNode[] {
    const containers = new Map<string, StorageGraphMountedNode[]>();

    for (const node of baseNodes) {
      if (node.data.nodeKind !== "entity") {
        continue;
      }
      const members = containers.get(node.data.groupKey) ?? [];
      members.push(node);
      containers.set(node.data.groupKey, members);
    }

    return Array.from(containers.entries()).map(([groupKey, members]) => {
      const firstMember = members[0];
      const minX = Math.min(...members.map((node) => node.position.x));
      const minY = Math.min(...members.map((node) => node.position.y));
      const maxX = Math.max(...members.map((node) => node.position.x + getNodeSize(node).width));
      const maxY = Math.max(...members.map((node) => node.position.y + getNodeSize(node).height));
      const title =
        firstMember?.data.nodeKind === "entity"
          ? firstMember.data.storageKind === "sqlite"
            ? `SQLite database · ${firstMember.data.subtitle}`
            : firstMember.data.storageKind === "indexeddb"
              ? `IndexedDB · ${firstMember.data.subtitle}`
              : `LocalForage · ${firstMember.data.containerLabel}`
          : "Storage container";

      return {
        id: `container-frame:${groupKey}`,
        type: "group-frame",
        position: {
          x: minX - CONTAINER_FRAME_PADDING,
          y: minY - CONTAINER_FRAME_PADDING,
        },
        data: {
          nodeKind: "group-frame",
          title,
          width: maxX - minX + CONTAINER_FRAME_PADDING * 2,
          height: maxY - minY + CONTAINER_FRAME_PADDING * 2,
          variant: "container",
        },
        draggable: false,
        selectable: false,
        deletable: false,
        zIndex: -2,
      };
    }) as StorageGraphMountedNode[];
  }

  function buildRelationshipFrameNodes(
    baseNodes: StorageGraphMountedNode[],
  ): StorageGraphMountedNode[] {
    const sqliteNodes = baseNodes.filter(
      (node) => node.data.nodeKind === "entity" && node.data.storageKind === "sqlite",
    );
    const nodeById = new Map(sqliteNodes.map((node) => [node.id, node]));
    const adjacency = new Map(sqliteNodes.map((node) => [node.id, new Set<string>()]));

    for (const relationship of visibleRelationships.value) {
      if (
        (relationship.kind !== "foreign-key" && relationship.kind !== "logical-reference") ||
        !nodeById.has(relationship.source) ||
        !nodeById.has(relationship.target)
      ) {
        continue;
      }
      adjacency.get(relationship.source)?.add(relationship.target);
      adjacency.get(relationship.target)?.add(relationship.source);
    }

    const visited = new Set<string>();
    const frames: StorageGraphMountedNode[] = [];

    for (const node of sqliteNodes) {
      if (visited.has(node.id) || (adjacency.get(node.id)?.size ?? 0) === 0) {
        continue;
      }

      const memberIds: string[] = [];
      const pending = [node.id];
      visited.add(node.id);

      while (pending.length > 0) {
        const currentId = pending.shift();
        if (!currentId) {
          continue;
        }
        memberIds.push(currentId);
        for (const neighborId of adjacency.get(currentId) ?? []) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            pending.push(neighborId);
          }
        }
      }

      const members = memberIds
        .map((memberId) => nodeById.get(memberId))
        .filter((member): member is StorageGraphMountedNode => Boolean(member));
      if (members.length < 2) {
        continue;
      }

      const anchor = [...members].sort(
        (left, right) => (adjacency.get(right.id)?.size ?? 0) - (adjacency.get(left.id)?.size ?? 0),
      )[0];
      const anchorTitle = anchor?.data.nodeKind === "entity" ? anchor.data.title : "related tables";
      const minX = Math.min(...members.map((member) => member.position.x));
      const minY = Math.min(...members.map((member) => member.position.y));
      const maxX = Math.max(
        ...members.map((member) => member.position.x + getNodeSize(member).width),
      );
      const maxY = Math.max(
        ...members.map((member) => member.position.y + getNodeSize(member).height),
      );

      frames.push({
        id: `relationship-frame:${memberIds.sort().join(":")}`,
        type: "group-frame",
        position: {
          x: minX - GROUP_FRAME_SIDE_PADDING,
          y: minY - GROUP_FRAME_TOP_PADDING,
        },
        data: {
          nodeKind: "group-frame",
          title: `${anchorTitle} relations · ${members.length} tables`,
          width: maxX - minX + GROUP_FRAME_SIDE_PADDING * 2,
          height: maxY - minY + GROUP_FRAME_TOP_PADDING + GROUP_FRAME_SIDE_PADDING,
          variant: "relationship",
        },
        draggable: false,
        selectable: false,
        deletable: false,
        zIndex: -1,
      } as StorageGraphMountedNode);
    }

    return frames;
  }

  function syncCanvasNodes(baseNodes = getInteractiveNodes(nodes.value)) {
    clusterMembersByFrameId.clear();
    nodes.value = [
      ...baseNodes,
      ...(graphStrategy.value === "inferred" ? buildNamingFamilyFrameNodes(baseNodes) : []),
      ...(graphStrategy.value === "schema" ? buildContainerFrameNodes(baseNodes) : []),
      ...(graphStrategy.value === "schema" ? buildRelationshipFrameNodes(baseNodes) : []),
      ...buildGroupFrameNodes(baseNodes),
    ];
  }

  function buildEdges(): StorageGraphMountedEdge[] {
    const mountedNodes = getInteractiveNodes(nodes.value);
    const mountedNodeIds = new Set(mountedNodes.map((node) => node.id));
    const mountedNodeById = new Map(mountedNodes.map((node) => [node.id, node]));
    return visibleRelationships.value
      .filter(
        (relationship) =>
          relationship.source !== relationship.target &&
          mountedNodeIds.has(relationship.source) &&
          mountedNodeIds.has(relationship.target),
      )
      .map((relationship) => {
        const sourceNode = mountedNodeById.get(relationship.source);
        const targetNode = mountedNodeById.get(relationship.target);
        const candidateRoute = routedEdgePoints.value[relationship.id];
        const routePoints =
          sourceNode &&
          targetNode &&
          candidateRoute &&
          isStorageGraphRouteAttached(
            candidateRoute,
            { position: sourceNode.position, ...getNodeSize(sourceNode) },
            { position: targetNode.position, ...getNodeSize(targetNode) },
          )
            ? candidateRoute
            : undefined;
        return {
          id: relationship.id,
          source: relationship.source,
          target: relationship.target,
          label: relationship.label,
          type: "routed",
          animated: relationship.kind === "manual",
          selectable: true,
          selected: relationship.id === selectedEdgeId.value,
          deletable: relationship.kind === "manual",
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
          style:
            relationship.kind === "foreign-key" || relationship.kind === "logical-reference"
              ? {
                  stroke:
                    relationship.kind === "foreign-key"
                      ? "var(--color-success)"
                      : "var(--color-info)",
                  strokeWidth: 2.2,
                  vectorEffect: "non-scaling-stroke",
                  strokeDasharray: relationship.kind === "logical-reference" ? "8 5" : undefined,
                }
              : relationship.kind === "manual"
                ? {
                    stroke: "var(--color-primary)",
                    strokeWidth: 2.2,
                    vectorEffect: "non-scaling-stroke",
                  }
                : {
                    stroke:
                      relationship.confidence === "high"
                        ? "var(--color-info)"
                        : relationship.confidence === "medium"
                          ? "var(--color-warning)"
                          : "var(--color-border-active)",
                    strokeDasharray: "6 4",
                    strokeWidth: 1.8,
                    vectorEffect: "non-scaling-stroke",
                  },
          data: {
            ...relationship,
            routePoints,
          },
        };
      }) as StorageGraphMountedEdge[];
  }

  return {
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
  };
}
