import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode, ElkPoint, ElkPort } from "elkjs/lib/elk-api";
import type { StorageGraphPosition, StorageGraphRelationship } from "@/types/storageGraph.types";

interface StorageGraphElkNode {
  id: string;
  width: number;
  height: number;
}

export interface StorageGraphElkLayoutResult {
  positions: Record<string, StorageGraphPosition>;
  routes: Record<string, StorageGraphPosition[]>;
}

const elk = new ELK();

function sourcePortId(edgeId: string): string {
  return `${edgeId}:source`;
}

function targetPortId(edgeId: string): string {
  return `${edgeId}:target`;
}

function pointsFromEdge(edge: ElkExtendedEdge): ElkPoint[] {
  const section = edge.sections?.[0];
  return section ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint] : [];
}

export async function layoutStorageGraphWithElk(
  nodes: StorageGraphElkNode[],
  relationships: StorageGraphRelationship[],
): Promise<StorageGraphElkLayoutResult> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const layoutRelationships = relationships.filter(
    (relationship) =>
      nodeIds.has(relationship.source) &&
      nodeIds.has(relationship.target) &&
      relationship.source !== relationship.target,
  );
  const portsByNodeId = new Map<string, ElkPort[]>();
  for (const relationship of layoutRelationships) {
    const sourcePorts = portsByNodeId.get(relationship.source) ?? [];
    sourcePorts.push({
      id: sourcePortId(relationship.id),
      width: 1,
      height: 1,
      layoutOptions: { "elk.port.side": "EAST" },
    });
    portsByNodeId.set(relationship.source, sourcePorts);
    const targetPorts = portsByNodeId.get(relationship.target) ?? [];
    targetPorts.push({
      id: targetPortId(relationship.id),
      width: 1,
      height: 1,
      layoutOptions: { "elk.port.side": "WEST" },
    });
    portsByNodeId.set(relationship.target, targetPorts);
  }

  const graph: ElkNode = {
    id: "storage-graph",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.portConstraints": "FIXED_SIDE",
      "elk.spacing.nodeNode": "100",
      "elk.spacing.edgeEdge": "24",
      "elk.spacing.componentComponent": "180",
      "elk.layered.spacing.nodeNodeBetweenLayers": "180",
      "elk.layered.spacing.edgeNodeBetweenLayers": "80",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.unnecessaryBendpoints": "true",
      "elk.layered.highDegreeNodes.treatment": "true",
      "elk.layered.highDegreeNodes.threshold": "6",
      "elk.separateConnectedComponents": "true",
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.width,
      height: node.height,
      ports: portsByNodeId.get(node.id) ?? [],
      layoutOptions: { "elk.portConstraints": "FIXED_SIDE" },
    })),
    edges: layoutRelationships.map((relationship) => ({
      id: relationship.id,
      sources: [sourcePortId(relationship.id)],
      targets: [targetPortId(relationship.id)],
    })),
  };
  const result = await elk.layout(graph);
  const positions: Record<string, StorageGraphPosition> = {};
  for (const child of result.children ?? []) {
    positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
  }
  const routes: Record<string, StorageGraphPosition[]> = {};
  for (const edge of result.edges ?? []) {
    const points = pointsFromEdge(edge);
    if (points.length >= 2) {
      routes[edge.id] = points.map((point) => ({ x: point.x, y: point.y }));
    }
  }
  return { positions, routes };
}
