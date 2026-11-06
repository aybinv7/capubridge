import type ELK from "elkjs/lib/elk-api";
import type { ElkExtendedEdge, ElkNode, ElkPoint, ElkPort } from "elkjs/lib/elk-api";
import type { StorageGraphPosition, StorageGraphRelationship } from "@/types/storageGraph.types";
import {
  buildStorageGraphNamingFamilies,
  type StorageGraphElkNode,
  type StorageGraphNamingFamily,
} from "./storageGraphNamingFamilies";

export interface StorageGraphElkLayoutResult {
  positions: Record<string, StorageGraphPosition>;
  routes: Record<string, StorageGraphPosition[]>;
}

/** A memoised async load whose failure is not kept, and which can be let go. */
export interface CachedLoad<T> {
  (): Promise<T>;
  /** The loaded value, if a load finished. */
  loaded: () => T | null;
  /** Drops what was loaded; the next call loads again. */
  forget: () => void;
}

/**
 * Memoises an async load, but not its failure: a rejected load is dropped, so the next call
 * tries again instead of failing until the app reloads (B9).
 */
export function cachedUntilFailure<T>(load: () => Promise<T>): CachedLoad<T> {
  let pending: Promise<T> | null = null;
  let value: T | null = null;
  const get = () => {
    pending ??= load().then(
      (loaded) => (value = loaded),
      (error: unknown) => {
        pending = null;
        throw error;
      },
    );
    return pending;
  };
  return Object.assign(get, {
    loaded: () => value,
    forget: () => {
      pending = null;
      value = null;
    },
  });
}

/**
 * ELK (about 1.6 MB) loads the first time a layout is asked for, never with the screen. In the
 * app it runs in a worker, so a big layout never freezes the window; without workers (tests) it
 * runs in place.
 */
const elkEngine = cachedUntilFailure(async (): Promise<InstanceType<typeof ELK>> => {
  if (typeof Worker === "undefined") {
    const { default: Bundled } = await import("elkjs/lib/elk.bundled.js");
    return new Bundled();
  }
  const [{ default: Api }, { default: workerUrl }] = await Promise.all([
    import("elkjs/lib/elk-api.js"),
    import("elkjs/lib/elk-worker.min.js?url"),
  ]);
  return new Api({ workerFactory: () => new Worker(workerUrl) });
});

let holders = 0;

/**
 * Keeps the ELK worker while a Diagram is on screen; when the last one goes, the worker is
 * stopped and loads again with the next layout (P10). Returns the release.
 */
export function holdElk(): () => void {
  holders += 1;
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    holders -= 1;
    if (holders > 0) return;
    if (typeof Worker !== "undefined") elkEngine.loaded()?.terminateWorker();
    elkEngine.forget();
  };
}

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
  const elk = await elkEngine();
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
