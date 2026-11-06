import { ref, type Ref } from "vue";
import { toast } from "vue-sonner";
import type { useStorageGraphStore } from "@/modules/storage/stores/useStorageGraphStore";
import type {
  StorageGraphNodeAnnotation,
  StorageGraphNoteRecord,
  StorageGraphPosition,
  StorageGraphRelationship,
} from "@/types/storageGraph.types";
import { DEFAULT_NOTE_ACCENT } from "./diagramAccents";
import { layoutStorageGraphWithElk } from "./storageGraphElkLayout";
import type {
  StorageGraphMountedNode,
  useStorageGraphCanvasNodes,
} from "./useStorageGraphCanvasNodes";
import type { useStorageGraphCanvasInteractions } from "./useStorageGraphCanvasInteractions";
import type { useStorageGraphHistory } from "./useStorageGraphHistory";

type CanvasNodes = ReturnType<typeof useStorageGraphCanvasNodes>;
type CanvasInteractions = ReturnType<typeof useStorageGraphCanvasInteractions>;

interface DiagramEditingInput {
  scopeKey: Ref<string>;
  graphStore: ReturnType<typeof useStorageGraphStore>;
  history: ReturnType<typeof useStorageGraphHistory>;
  canvas: CanvasNodes;
  interactions: CanvasInteractions;
  notes: Ref<readonly StorageGraphNoteRecord[]>;
  relationships: Ref<StorageGraphRelationship[]>;
  visibleRelationships: Ref<StorageGraphRelationship[]>;
  persistedPositions: Ref<Record<string, StorageGraphPosition>>;
  activeAutoLayoutPositions: Ref<Record<string, StorageGraphPosition>>;
  inferred: () => boolean;
  selectedNodeId: Ref<string>;
  selectedEdgeId: Ref<string>;
  selectedClusterId: Ref<string>;
  setCenter: (
    x: number,
    y: number,
    options: { zoom: number; duration: number },
  ) => Promise<boolean>;
  getViewport: () => { zoom: number };
}

/**
 * Changes made on the diagram: notes, links you draw, descriptions, groups, the ELK layout,
 * undo and redo. None of them touches the database; each is one undo step.
 */
export function useDiagramEditing(input: DiagramEditingInput) {
  const { graphStore, history, canvas, interactions } = input;
  const laying = ref(false);

  function findNode(nodeId: string): StorageGraphMountedNode | undefined {
    return canvas.getInteractiveNodes(canvas.nodes.value).find((node) => node.id === nodeId);
  }

  async function autoLayout() {
    if (laying.value) return;
    laying.value = true;
    const current = canvas.getInteractiveNodes(canvas.nodes.value);
    try {
      const layout = await layoutStorageGraphWithElk(
        current.map((node) => ({
          id: node.id,
          name: node.data.nodeKind === "group-frame" ? node.id : node.data.title,
          ...canvas.getNodeSize(node),
        })),
        input.visibleRelationships.value,
        input.inferred(),
      );
      history.commit();
      canvas.routedEdgePoints.value = layout.routes;
      const moved = current.map((node) => ({
        ...node,
        position: layout.positions[node.id] ?? node.position,
      }));
      canvas.syncCanvasNodes(moved);
      interactions.persistNodePositions(moved);
      canvas.edges.value = canvas.buildEdges();
      await interactions.fitCanvas(0.12, 260);
      toast.success("Laid out again", { description: "Undo brings the earlier positions back." });
    } catch (error) {
      toast.error("Could not lay out the diagram", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      laying.value = false;
    }
  }

  function addNote() {
    history.commit();
    const count = input.notes.value.length;
    const note = graphStore.upsertNote(input.scopeKey.value, {
      note: "",
      title: "Note",
      accent: DEFAULT_NOTE_ACCENT,
      position: input.activeAutoLayoutPositions.value[`note-${count}`] ?? {
        x: 1120,
        y: 40 + count * 220,
      },
    });
    input.selectedNodeId.value = note.id;
    input.selectedEdgeId.value = "";
    input.selectedClusterId.value = "";
  }

  function saveAnnotation(nodeId: string, annotation: StorageGraphNodeAnnotation) {
    history.commit();
    graphStore.setNodeAnnotation(input.scopeKey.value, nodeId, annotation);
  }

  function saveCluster(payload: { id: string; name: string; note?: string }) {
    history.commit();
    graphStore.setNodeAnnotation(input.scopeKey.value, payload.id, {
      label: payload.name.trim() || "Group",
      note: payload.note?.trim() || undefined,
    });
    canvas.syncCanvasNodes();
  }

  async function focusNode(nodeId: string) {
    const node = findNode(nodeId);
    if (!node) return;
    input.selectedClusterId.value = "";
    input.selectedEdgeId.value = "";
    input.selectedNodeId.value = nodeId;
    interactions.setSelectedNodeIds([nodeId]);
    const size = canvas.getNodeSize(node);
    await input.setCenter(node.position.x + size.width / 2, node.position.y + size.height / 2, {
      zoom: Math.max(input.getViewport().zoom, 0.65),
      duration: 260,
    });
  }

  function saveNote(payload: { id: string; title: string; note: string; accent: string }) {
    history.commit();
    const current = findNode(payload.id);
    graphStore.upsertNote(input.scopeKey.value, {
      ...payload,
      position: current
        ? { x: current.position.x, y: current.position.y }
        : input.persistedPositions.value[payload.id],
    });
  }

  function deleteNote(noteId: string) {
    history.commit();
    graphStore.removeNote(input.scopeKey.value, noteId);
    input.selectedNodeId.value = "";
    toast.success("Deleted the note", { description: "Undo brings it back." });
  }

  function saveEdge(payload: { id: string; label: string }) {
    const existing = input.relationships.value.find((edge) => edge.id === payload.id);
    if (!existing || existing.kind !== "manual") return;
    history.commit();
    graphStore.upsertManualEdge(input.scopeKey.value, {
      id: existing.id,
      source: existing.source,
      target: existing.target,
      label: payload.label,
    });
  }

  function deleteEdge(edgeId: string) {
    history.commit();
    graphStore.removeManualEdge(input.scopeKey.value, edgeId);
    input.selectedEdgeId.value = "";
    toast.success("Deleted the link", { description: "Undo brings it back." });
  }

  function step(move: () => boolean) {
    if (!move()) return;
    canvas.routedEdgePoints.value = {};
    canvas.edges.value = canvas.buildEdges();
    interactions.clearSelection();
  }

  return {
    laying,
    autoLayout,
    addNote,
    saveAnnotation,
    saveCluster,
    focusNode,
    saveNote,
    deleteNote,
    saveEdge,
    deleteEdge,
    undo: () => step(history.undo),
    redo: () => step(history.redo),
  };
}
