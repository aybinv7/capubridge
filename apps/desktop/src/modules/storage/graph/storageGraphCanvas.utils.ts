import type { Node } from "@vue-flow/core";
import type { StorageGraphNodeData } from "@/types/storageGraph.types";

export type StorageGraphCanvasMode = "pan" | "select";

export type StorageGraphSelectionAction =
  | "group"
  | "ungroup"
  | "align-left"
  | "align-center"
  | "align-right"
  | "align-top"
  | "align-middle"
  | "align-bottom"
  | "distribute-horizontal"
  | "distribute-vertical"
  | "pack";

const PACK_GAP_X = 320;
const PACK_GAP_Y = 220;

function sortByX(nodes: Node<StorageGraphNodeData>[]) {
  return [...nodes].sort(
    (left, right) =>
      left.position.x - right.position.x || left.position.y - right.position.y || left.id.localeCompare(right.id),
  );
}

function sortByY(nodes: Node<StorageGraphNodeData>[]) {
  return [...nodes].sort(
    (left, right) =>
      left.position.y - right.position.y || left.position.x - right.position.x || left.id.localeCompare(right.id),
  );
}

function updateSelectedNodePositions(
  nodes: Node<StorageGraphNodeData>[],
  positions: Map<string, { x: number; y: number }>,
) {
  return nodes.map((node) => {
    const nextPosition = positions.get(node.id);
    if (!nextPosition) {
      return node;
    }

    return {
      ...node,
      position: nextPosition,
    };
  });
}

export function getSelectedCanvasNodes(nodes: Node<StorageGraphNodeData>[]) {
  return nodes.filter((node) => node.selected);
}

export function applySelectionAction(
  nodes: Node<StorageGraphNodeData>[],
  action: StorageGraphSelectionAction,
) {
  const selectedNodes = getSelectedCanvasNodes(nodes);
  if (selectedNodes.length < 2) {
    return nodes;
  }

  if (action === "group" || action === "ungroup") {
    return nodes;
  }

  const positions = new Map<string, { x: number; y: number }>();
  const minX = Math.min(...selectedNodes.map((node) => node.position.x));
  const maxX = Math.max(...selectedNodes.map((node) => node.position.x));
  const minY = Math.min(...selectedNodes.map((node) => node.position.y));
  const maxY = Math.max(...selectedNodes.map((node) => node.position.y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  if (action === "align-left") {
    selectedNodes.forEach((node) => positions.set(node.id, { x: minX, y: node.position.y }));
    return updateSelectedNodePositions(nodes, positions);
  }

  if (action === "align-center") {
    selectedNodes.forEach((node) => positions.set(node.id, { x: centerX, y: node.position.y }));
    return updateSelectedNodePositions(nodes, positions);
  }

  if (action === "align-right") {
    selectedNodes.forEach((node) => positions.set(node.id, { x: maxX, y: node.position.y }));
    return updateSelectedNodePositions(nodes, positions);
  }

  if (action === "align-top") {
    selectedNodes.forEach((node) => positions.set(node.id, { x: node.position.x, y: minY }));
    return updateSelectedNodePositions(nodes, positions);
  }

  if (action === "align-middle") {
    selectedNodes.forEach((node) => positions.set(node.id, { x: node.position.x, y: centerY }));
    return updateSelectedNodePositions(nodes, positions);
  }

  if (action === "align-bottom") {
    selectedNodes.forEach((node) => positions.set(node.id, { x: node.position.x, y: maxY }));
    return updateSelectedNodePositions(nodes, positions);
  }

  if (action === "distribute-horizontal") {
    const orderedNodes = sortByX(selectedNodes);
    const first = orderedNodes[0];
    const last = orderedNodes[orderedNodes.length - 1];
    if (!first || !last) {
      return nodes;
    }

    const step = (last.position.x - first.position.x) / (orderedNodes.length - 1);
    orderedNodes.forEach((node, index) =>
      positions.set(node.id, {
        x: first.position.x + step * index,
        y: node.position.y,
      }),
    );
    return updateSelectedNodePositions(nodes, positions);
  }

  if (action === "distribute-vertical") {
    const orderedNodes = sortByY(selectedNodes);
    const first = orderedNodes[0];
    const last = orderedNodes[orderedNodes.length - 1];
    if (!first || !last) {
      return nodes;
    }

    const step = (last.position.y - first.position.y) / (orderedNodes.length - 1);
    orderedNodes.forEach((node, index) =>
      positions.set(node.id, {
        x: node.position.x,
        y: first.position.y + step * index,
      }),
    );
    return updateSelectedNodePositions(nodes, positions);
  }

  const orderedNodes = sortByY(sortByX(selectedNodes));
  const columns = Math.max(1, Math.ceil(Math.sqrt(orderedNodes.length)));
  orderedNodes.forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    positions.set(node.id, {
      x: minX + column * PACK_GAP_X,
      y: minY + row * PACK_GAP_Y,
    });
  });

  return updateSelectedNodePositions(nodes, positions);
}
