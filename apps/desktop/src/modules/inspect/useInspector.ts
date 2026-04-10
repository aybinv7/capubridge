import { watch, onUnmounted } from "vue";
import { useInspectStore } from "@/stores/inspect.store";
import { useCDP } from "@/composables/useCDP";
import { DOMDomain, OverlayDomain } from "utils";

export function useInspector() {
  const store = useInspectStore();
  const { activeClient } = useCDP();

  let domDomain: DOMDomain | null = null;
  let overlayDomain: OverlayDomain | null = null;
  const cleanups: (() => void)[] = [];

  async function initialize(client = activeClient.value) {
    if (!client) return;

    domDomain = new DOMDomain(client);
    overlayDomain = new OverlayDomain(client);

    try {
      await domDomain.enable();
      await overlayDomain.enable();
      console.log("[inspector] DOM and Overlay enabled");
    } catch (e) {
      console.error("[inspector] Failed to enable domains:", e);
      return;
    }

    cleanups.push(
      domDomain.onSetChildNodes(({ parentId, nodes }) => {
        console.log("[inspector] SetChildNodes for", parentId, nodes.length, "nodes");
        store.updateChildNodes(parentId, nodes);
      }),
    );

    cleanups.push(
      domDomain.onChildNodeInserted(({ parentNodeId }) => {
        if (domDomain) {
          domDomain.requestChildNodes(parentNodeId, 1);
        }
      }),
    );

    cleanups.push(
      domDomain.onChildNodeRemoved(({ nodeId }) => {
        console.log("[inspector] ChildNodeRemoved", nodeId);
        store.nodeMap.delete(nodeId);
      }),
    );

    cleanups.push(
      overlayDomain.onInspectNodeRequested(async ({ backendNodeId }) => {
        if (!domDomain) return;
        console.log("[inspector] InspectNodeRequested, backendNodeId:", backendNodeId);
        const nodeIds = await domDomain.pushNodesByBackendIdsToFrontend([backendNodeId]);
        const nodeId = nodeIds[0];
        if (nodeId) {
          store.selectNode(nodeId);
          store.expandToNode(nodeId);
          store.inspectMode = false;
          await overlayDomain!.setInspectMode("none");
          await overlayDomain!.highlightNode(nodeId);
        }
      }),
    );

    console.log("[inspector] Fetching document tree...");
    const root = await domDomain.getDocument(3);
    console.log(
      "[inspector] Got root:",
      root.localName,
      "children:",
      root.children?.length ?? 0,
      "nodeMap size:",
      store.nodeMap.size,
    );
    store.setDocument(root);
  }

  async function toggleInspectMode() {
    if (!overlayDomain) return;
    store.inspectMode = !store.inspectMode;
    if (store.inspectMode) {
      await overlayDomain.setInspectMode("searchForNode");
    } else {
      await overlayDomain.setInspectMode("none");
      await overlayDomain.hideHighlight();
    }
  }

  async function expandNode(nodeId: number) {
    if (!domDomain) return;
    store.toggleExpanded(nodeId);
    if (store.expandedNodes.has(nodeId)) {
      const node = store.nodeMap.get(nodeId);
      if (node && node.childNodeCount && !node.children?.length) {
        await domDomain.requestChildNodes(nodeId, 1);
      }
    }
  }

  async function selectNode(nodeId: number) {
    store.selectNode(nodeId);
    if (overlayDomain) {
      await overlayDomain.highlightNode(nodeId);
    }
  }

  async function highlightNode(nodeId: number) {
    if (overlayDomain) {
      await overlayDomain.highlightNode(nodeId);
    }
  }

  async function clearHighlight() {
    if (overlayDomain) {
      await overlayDomain.hideHighlight();
    }
  }

  async function refreshDocument() {
    if (!domDomain) return;
    const root = await domDomain.getDocument(3);
    store.setDocument(root);
  }

  function cleanup() {
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
    domDomain?.disable().catch(() => {});
    overlayDomain?.disable().catch(() => {});
    store.reset();
  }

  watch(
    activeClient,
    async (client) => {
      console.log("[inspector] watch fired, client:", client ? "connected" : "null");
      cleanup();
      if (client) {
        await initialize(client);
      }
    },
    { immediate: true },
  );

  onUnmounted(cleanup);

  return {
    initialize,
    toggleInspectMode,
    expandNode,
    selectNode,
    highlightNode,
    clearHighlight,
    refreshDocument,
    cleanup,
  };
}
