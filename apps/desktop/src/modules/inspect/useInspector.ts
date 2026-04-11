import { watch, onUnmounted } from "vue";
import { useInspectStore } from "@/stores/inspect.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { useCDP } from "@/composables/useCDP";
import { DOMDomain, OverlayDomain } from "utils";
import type { CDPClient } from "utils";

interface InspectViewportMetrics {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export function useInspector() {
  const store = useInspectStore();
  const mirrorStore = useMirrorStore();
  const { activeClient, connectToTarget, targetsStore, connectionStore, refreshTargets } = useCDP();

  let domDomain: DOMDomain | null = null;
  let overlayDomain: OverlayDomain | null = null;
  let pendingInspectMode: boolean | null = null;
  let scheduledHoverPoint: { x: number; y: number } | null = null;
  let hoverAnimationFrame: number | null = null;
  let lastHoveredNodeId: number | null = null;
  let currentClient: CDPClient | null = null;
  let viewportMetrics: InspectViewportMetrics | null = null;
  const cleanups: (() => void)[] = [];

  function resolveSelectedTarget() {
    const selected = targetsStore.selectedTarget;
    if (!selected) return null;
    return (
      targetsStore.targets.find((target) => target.id === selected.id) ??
      targetsStore.targets.find((target) => {
        if (target.source !== selected.source) return false;
        if ((target.deviceSerial ?? null) !== (selected.deviceSerial ?? null)) return false;
        if (selected.url && target.url) return selected.url === target.url;
        return (
          target.title === selected.title &&
          (target.packageName ?? "") === (selected.packageName ?? "")
        );
      }) ??
      selected
    );
  }

  async function ensureConnectedClient(forceTargetRefresh = false) {
    const selectedTarget = resolveSelectedTarget();
    if (!selectedTarget) return null;
    if (forceTargetRefresh) {
      await refreshTargets();
    }
    const freshTarget = resolveSelectedTarget() ?? selectedTarget;
    try {
      const client = await connectToTarget(freshTarget);
      if (!domDomain || currentClient !== client) {
        await initialize(client);
      }
      return client;
    } catch (e) {
      console.error("[inspector] Failed to ensure connected client:", e);
      return null;
    }
  }

  async function refreshViewportMetrics() {
    if (!currentClient) return null;
    try {
      const result = await currentClient.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
        expression: `(() => JSON.stringify({
          width: window.visualViewport?.width ?? window.innerWidth,
          height: window.visualViewport?.height ?? window.innerHeight,
          offsetX: window.visualViewport?.offsetLeft ?? 0,
          offsetY: window.visualViewport?.offsetTop ?? 0
        }))()`,
        returnByValue: true,
      });
      const value = (result.result as Record<string, unknown>).value;
      if (typeof value !== "string") return null;
      const parsed = JSON.parse(value) as Record<string, unknown>;
      viewportMetrics = {
        width: Number(parsed["width"]) || 0,
        height: Number(parsed["height"]) || 0,
        offsetX: Number(parsed["offsetX"]) || 0,
        offsetY: Number(parsed["offsetY"]) || 0,
      };
      if (viewportMetrics.width <= 0 || viewportMetrics.height <= 0) {
        viewportMetrics = null;
      }
    } catch (e) {
      console.error("[inspector] Failed to read viewport metrics:", e);
      viewportMetrics = null;
    }
    return viewportMetrics;
  }

  async function toViewportPoint(x: number, y: number) {
    const metrics = viewportMetrics ?? (await refreshViewportMetrics());
    if (!metrics) return { x, y };
    const sourceWidth = mirrorStore.deviceWidth || metrics.width;
    const sourceHeight = mirrorStore.deviceHeight || metrics.height;
    const normalizedX = Math.max(0, Math.min(1, x / sourceWidth));
    const normalizedY = Math.max(0, Math.min(1, y / sourceHeight));
    return {
      x: Math.round(metrics.offsetX + normalizedX * (metrics.width - 1)),
      y: Math.round(metrics.offsetY + normalizedY * (metrics.height - 1)),
    };
  }

  async function getNodeIdAtPoint(x: number, y: number): Promise<number | null> {
    if (!domDomain) return null;
    const viewportPoint = await toViewportPoint(x, y);
    const node = await domDomain.getNodeForLocation(viewportPoint.x, viewportPoint.y, true, true);
    if (!node?.nodeId) return null;
    return node.nodeId;
  }

  async function highlightNodeAtPoint(x: number, y: number) {
    if (!overlayDomain || !store.inspectMode) return;
    const nodeId = await getNodeIdAtPoint(x, y);
    if (!nodeId) {
      await overlayDomain.hideHighlight();
      lastHoveredNodeId = null;
      return;
    }
    if (lastHoveredNodeId === nodeId) return;
    lastHoveredNodeId = nodeId;
    await overlayDomain.highlightNode(nodeId);
  }

  async function selectNodeAtPoint(x: number, y: number) {
    if (!overlayDomain || !store.inspectMode) return;
    const nodeId = await getNodeIdAtPoint(x, y);
    if (!nodeId) return;
    if (!store.nodeMap.has(nodeId)) {
      await refreshDocument();
    }
    store.selectNode(nodeId);
    store.expandToNode(nodeId);
    store.inspectMode = false;
    await overlayDomain.highlightNode(nodeId);
  }

  function scheduleHoverHighlight(x: number, y: number) {
    scheduledHoverPoint = { x, y };
    if (hoverAnimationFrame !== null) return;
    if (typeof window === "undefined") {
      void highlightNodeAtPoint(x, y);
      return;
    }
    hoverAnimationFrame = window.requestAnimationFrame(() => {
      hoverAnimationFrame = null;
      const point = scheduledHoverPoint;
      scheduledHoverPoint = null;
      if (!point || !store.inspectMode) return;
      void highlightNodeAtPoint(point.x, point.y);
    });
  }

  async function syncInspectMode(enabled: boolean) {
    if (!overlayDomain) {
      pendingInspectMode = enabled;
      return;
    }
    await overlayDomain.setInspectMode(enabled ? "searchForNode" : "none");
    if (!enabled) {
      await overlayDomain.hideHighlight();
      lastHoveredNodeId = null;
    }
    pendingInspectMode = null;
  }

  async function initialize(client = activeClient.value) {
    if (!client) return;
    if (currentClient === client && domDomain && overlayDomain) return;

    domDomain = new DOMDomain(client);
    overlayDomain = new OverlayDomain(client);

    try {
      await domDomain.enable();
      await overlayDomain.enable();
      currentClient = client;
      console.log("[inspector] DOM and Overlay enabled");
    } catch (e) {
      currentClient = null;
      domDomain = null;
      overlayDomain = null;
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
          void domDomain.requestChildNodes(parentNodeId, 1);
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
    await refreshViewportMetrics();

    if (pendingInspectMode !== null || store.inspectMode) {
      try {
        await syncInspectMode(pendingInspectMode ?? store.inspectMode);
      } catch (e) {
        console.error("[inspector] Failed to apply inspect mode:", e);
      }
    }
  }

  async function toggleInspectMode() {
    store.inspectMode = !store.inspectMode;
    if (overlayDomain && !store.inspectMode) {
      await overlayDomain.hideHighlight();
      lastHoveredNodeId = null;
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
    if (!domDomain) {
      const client = await ensureConnectedClient(true);
      if (!client || !domDomain) return;
    }
    const root = await domDomain.getDocument(3);
    store.setDocument(root);
    await refreshViewportMetrics();
  }

  function cleanup() {
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
    if (hoverAnimationFrame !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(hoverAnimationFrame);
      hoverAnimationFrame = null;
    }
    scheduledHoverPoint = null;
    lastHoveredNodeId = null;
    currentClient = null;
    viewportMetrics = null;
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
      } else if (targetsStore.selectedTarget) {
        void ensureConnectedClient().catch((e) => {
          console.error("[inspector] Failed to recover connection:", e);
        });
      }
    },
    { immediate: true },
  );

  watch(
    () => targetsStore.selectedTarget,
    (target) => {
      if (!target) return;
      const activeTargetId = connectionStore.activeConnection?.targetId ?? null;
      if (activeTargetId === target.id && activeClient.value) return;
      void connectToTarget(target).catch((e) => {
        console.error("[inspector] Failed to connect selected target:", e);
      });
    },
    { immediate: true },
  );

  watch(
    () => store.inspectMode,
    (enabled, previousEnabled) => {
      if (enabled === previousEnabled) return;
      void syncInspectMode(enabled).catch((e) => {
        console.error("[inspector] Failed to sync inspect mode:", e);
      });
    },
  );

  watch(
    () => store.mirrorHoverPoint,
    (point) => {
      if (!store.inspectMode) return;
      if (!point) {
        void clearHighlight();
        lastHoveredNodeId = null;
        return;
      }
      scheduleHoverHighlight(point.x, point.y);
    },
  );

  watch(
    () => store.mirrorSelectPoint,
    (point) => {
      if (!store.inspectMode || !point) return;
      void selectNodeAtPoint(point.x, point.y).catch((e) => {
        console.error("[inspector] Failed to select node at point:", e);
      });
    },
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
