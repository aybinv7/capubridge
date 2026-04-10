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

  function reset() {
    inspectMode.value = false;
    documentRoot.value = null;
    selectedNodeId.value = null;
    expandedNodes.value.clear();
    nodeMap.value.clear();
    searchQuery.value = "";
  }

  return {
    inspectMode,
    documentRoot,
    selectedNodeId,
    expandedNodes,
    activeDetailTab,
    searchQuery,
    nodeMap,
    hasSelection,
    selectNode,
    clearSelection,
    toggleExpanded,
    expandToNode,
    setDocument,
    updateChildNodes,
    buildNodeMap,
    reset,
  };
});
