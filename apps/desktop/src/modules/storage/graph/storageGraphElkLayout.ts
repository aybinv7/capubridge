import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode, ElkPoint, ElkPort } from "elkjs/lib/elk-api";
import type { StorageGraphPosition, StorageGraphRelationship } from "@/types/storageGraph.types";

interface StorageGraphElkNode {
  id: string;
  name: string;
  width: number;
  height: number;
}

export interface StorageGraphNamingFamily {
  key: string;
  anchorId: string;
  memberIds: string[];
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

function collectAbsoluteNodePositions(
  children: ElkNode[],
  positions: Record<string, StorageGraphPosition>,
  parentX = 0,
  parentY = 0,
): void {
  for (const child of children) {
    const x = parentX + (child.x ?? 0);
    const y = parentY + (child.y ?? 0);
    if (!child.id.startsWith("naming-family:")) {
      positions[child.id] = { x, y };
    }
    collectAbsoluteNodePositions(child.children ?? [], positions, x, y);
  }
}

export function buildStorageGraphNamingFamilies(
  nodes: StorageGraphElkNode[],
  relationships: StorageGraphRelationship[],
): StorageGraphNamingFamily[] {
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  for (const relationship of relationships) {
    degree.set(relationship.source, (degree.get(relationship.source) ?? 0) + 1);
    degree.set(relationship.target, (degree.get(relationship.target) ?? 0) + 1);
  }
  const tokenized = nodes.map((node) => ({
    node,
    tokens: node.name.toLowerCase().split("_").filter(Boolean),
  }));
  const firstTokenGroups = new Map<string, typeof tokenized>();
  for (const item of tokenized) {
    const prefix = item.tokens[0];
    if (!prefix) {
      continue;
    }
    const group = firstTokenGroups.get(prefix) ?? [];
    group.push(item);
    firstTokenGroups.set(prefix, group);
  }
  const candidateGroups: Array<{ key: string; items: typeof tokenized }> = [];
  for (const [prefix, items] of firstTokenGroups) {
    if (items.length >= 3) {
      candidateGroups.push({ key: prefix, items });
      continue;
    }
  }

  return candidateGroups.map(({ key, items }) => {
    const anchor = [...items].sort((left, right) => {
      const leftExact = left.node.name.toLowerCase() === key ? 1 : 0;
      const rightExact = right.node.name.toLowerCase() === key ? 1 : 0;
      return (
        rightExact - leftExact ||
        (degree.get(right.node.id) ?? 0) - (degree.get(left.node.id) ?? 0) ||
        left.tokens.length - right.tokens.length ||
        left.node.name.localeCompare(right.node.name)
      );
    })[0];
    return {
      key,
      anchorId: anchor?.node.id ?? items[0]?.node.id ?? "",
      memberIds: items.map((item) => item.node.id),
    };
  });
}

export async function layoutStorageGraphWithElk(
  nodes: StorageGraphElkNode[],
  relationships: StorageGraphRelationship[],
  useNamingFamilies = false,
): Promise<StorageGraphElkLayoutResult> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const layoutRelationships = relationships.filter(
    (relationship) =>
      nodeIds.has(relationship.source) &&
      nodeIds.has(relationship.target) &&
      relationship.source !== relationship.target,
  );
  const namingFamilies = useNamingFamilies
    ? buildStorageGraphNamingFamilies(nodes, layoutRelationships)
    : [];
  const familyByMemberId = new Map<string, StorageGraphNamingFamily>();
  for (const family of namingFamilies) {
    for (const memberId of family.memberIds) {
      familyByMemberId.set(memberId, family);
    }
  }
  const layoutEdges = layoutRelationships.map((relationship) => ({
    id: relationship.id,
    source: relationship.source,
    target: relationship.target,
  }));
  const portsByNodeId = new Map<string, ElkPort[]>();
  for (const edge of layoutEdges) {
    const sourcePorts = portsByNodeId.get(edge.source) ?? [];
    sourcePorts.push({
      id: sourcePortId(edge.id),
      width: 1,
      height: 1,
      layoutOptions: { "elk.port.side": "EAST" },
    });
    portsByNodeId.set(edge.source, sourcePorts);
    const targetPorts = portsByNodeId.get(edge.target) ?? [];
    targetPorts.push({
      id: targetPortId(edge.id),
      width: 1,
      height: 1,
      layoutOptions: { "elk.port.side": "WEST" },
    });
    portsByNodeId.set(edge.target, targetPorts);
  }

  const graph: ElkNode = {
    id: "storage-graph",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
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
    children: [
      ...namingFamilies.map((family) => ({
        id: `naming-family:${family.key}`,
        layoutOptions: {
          "elk.algorithm": "layered",
          "elk.direction": "DOWN",
          "elk.padding": "[top=48,left=48,bottom=48,right=48]",
          "elk.spacing.nodeNode": "80",
          "elk.layered.spacing.nodeNodeBetweenLayers": "100",
        },
        children: family.memberIds.flatMap((memberId) => {
          const node = nodes.find((candidate) => candidate.id === memberId);
          return node
            ? [
                {
                  id: node.id,
                  width: node.width,
                  height: node.height,
                  ports: portsByNodeId.get(node.id) ?? [],
                  layoutOptions: { "elk.portConstraints": "FIXED_SIDE" },
                },
              ]
            : [];
        }),
      })),
      ...nodes
        .filter((node) => !familyByMemberId.has(node.id))
        .map((node) => ({
          id: node.id,
          width: node.width,
          height: node.height,
          ports: portsByNodeId.get(node.id) ?? [],
          layoutOptions: { "elk.portConstraints": "FIXED_SIDE" },
        })),
    ],
    edges: layoutEdges.map((edge) => ({
      id: edge.id,
      sources: [sourcePortId(edge.id)],
      targets: [targetPortId(edge.id)],
    })),
  };
  const result = await elk.layout(graph);
  const positions: Record<string, StorageGraphPosition> = {};
  collectAbsoluteNodePositions(result.children ?? [], positions);
  const routes: Record<string, StorageGraphPosition[]> = {};
  for (const edge of result.edges ?? []) {
    const points = pointsFromEdge(edge);
    if (points.length >= 2) {
      routes[edge.id] = points.map((point) => ({ x: point.x, y: point.y }));
    }
  }
  return { positions, routes };
}
