import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { DOMNode, DetailTab } from "@/types/inspect.types";

export const useInspectStore = defineStore("inspect", () => {
  const inspectMode = ref(false);
  const documentRoot = ref<DOMNode | null>(null);
  const selectedNodeId = ref<number | null>(null);
  const expandedNodes = ref(new Set<number>());
  const activeDetailTab = ref<DetailTab>("styles");
  const searchQuery = ref("");
  const nodeMap = ref(new Map<number, DOMNode>());
  const mirrorHoverPoint = ref<{ x: number; y: number; nonce: number } | null>(null);
  const mirrorSelectPoint = ref<{ x: number; y: number; nonce: number } | null>(null);
  let pointNonce = 0;

  const hasSelection = computed(() => selectedNodeId.value !== null);

  function selectNode(nodeId: number) {
    selectedNodeId.value = nodeId;
  }

  function clearSelection() {
    selectedNodeId.value = null;
  }

  function toggleExpanded(nodeId: number) {
    if (expandedNodes.value.has(nodeId)) {
      expandedNodes.value.delete(nodeId);
    } else {
      expandedNodes.value.add(nodeId);
    }
  }

  function expandToNode(nodeId: number) {
    let current = nodeMap.value.get(nodeId);
    while (current) {
      expandedNodes.value.add(current.nodeId);
      let parent: DOMNode | undefined;
      for (const node of nodeMap.value.values()) {
        if (node.children?.some((c) => c.nodeId === current!.nodeId)) {
          parent = node;
          break;
        }
      }
      current = parent;
    }
  }

  function buildNodeMap(node: DOMNode) {
    nodeMap.value.set(node.nodeId, node);
    if (node.children) {
      for (const child of node.children) {
        buildNodeMap(child);
      }
    }
  }

  function setDocument(root: DOMNode) {
    documentRoot.value = root;
    nodeMap.value.clear();
    buildNodeMap(root);
  }

  function updateChildNodes(parentId: number, nodes: DOMNode[]) {
    const parent = nodeMap.value.get(parentId);
    if (parent) {
      parent.children = nodes;
      for (const child of nodes) {
        buildNodeMap(child);
      }
    }
  }

  function removeChildNode(parentId: number, nodeId: number) {
    const parent = nodeMap.value.get(parentId);
    if (parent?.children) {
      parent.children = parent.children.filter((c) => c.nodeId !== nodeId);
    }
    nodeMap.value.delete(nodeId);
    if (selectedNodeId.value === nodeId) selectedNodeId.value = null;
  }

  function updateNodeAttribute(nodeId: number, name: string, value: string) {
    const node = nodeMap.value.get(nodeId);
    if (!node) return;
    const attrs = node.attributes ? node.attributes.slice() : [];
    let found = -1;
    for (let i = 0; i < attrs.length; i += 2) {
      if (attrs[i] === name) {
        found = i;
        break;
      }
    }
    if (found >= 0) {
      attrs[found + 1] = value;
    } else {
      attrs.push(name, value);
    }
    node.attributes = attrs;
  }

  function removeNodeAttribute(nodeId: number, name: string) {
    const node = nodeMap.value.get(nodeId);
    if (!node?.attributes) return;
    const next: string[] = [];
    for (let i = 0; i < node.attributes.length; i += 2) {
      if (node.attributes[i] !== name) next.push(node.attributes[i], node.attributes[i + 1]);
    }
    node.attributes = next;
  }

  function updateNodeValue(nodeId: number, value: string) {
    const node = nodeMap.value.get(nodeId);
    if (!node) return;
    node.nodeValue = value;
  }

  function setMirrorHoverPoint(x: number, y: number) {
    pointNonce += 1;
    mirrorHoverPoint.value = { x, y, nonce: pointNonce };
  }

  function clearMirrorHoverPoint() {
    mirrorHoverPoint.value = null;
  }

  function setMirrorSelectPoint(x: number, y: number) {
    pointNonce += 1;
    mirrorSelectPoint.value = { x, y, nonce: pointNonce };
  }

  function reset() {
    inspectMode.value = false;
    documentRoot.value = null;
    selectedNodeId.value = null;
    expandedNodes.value.clear();
    nodeMap.value.clear();
    searchQuery.value = "";
    mirrorHoverPoint.value = null;
    mirrorSelectPoint.value = null;
  }

  return {
    inspectMode,
    documentRoot,
    selectedNodeId,
    expandedNodes,
    activeDetailTab,
    searchQuery,
    nodeMap,
    mirrorHoverPoint,
    mirrorSelectPoint,
    hasSelection,
    selectNode,
    clearSelection,
    toggleExpanded,
    expandToNode,
    setDocument,
    updateChildNodes,
    removeChildNode,
    updateNodeAttribute,
    removeNodeAttribute,
    updateNodeValue,
    setMirrorHoverPoint,
    clearMirrorHoverPoint,
    setMirrorSelectPoint,
    buildNodeMap,
    reset,
  };
});
