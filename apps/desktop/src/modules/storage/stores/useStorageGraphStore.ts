import { ref, watch } from "vue";
import { defineStore } from "pinia";
import type {
  StorageGraphGroupRecord,
  StorageGraphManualEdgeRecord,
  StorageGraphNodeAnnotation,
  StorageGraphNoteRecord,
  StorageGraphPersistedScope,
  StorageGraphPosition,
} from "@/types/storageGraph.types";

const STORAGE_KEY = "capubridge:storage-graph:v1";
const SCOPE_PREFIX = "storage-graph:v2:";
const MAX_SCOPES = 60;
const PERSIST_DELAY_MS = 400;

type StorageGraphScopes = Record<string, StorageGraphPersistedScope>;

/**
 * Where a graph's layout is kept: the phone, the page's origin and the app. The DevTools page id
 * is left out on purpose: it changes on every reload, and with it the layout was lost (C4).
 */
export function graphScopeKey(serial: string, origin: string, packageName: string): string {
  return `${SCOPE_PREFIX}${serial || "no-serial"}:${origin || "no-origin"}:${packageName || "no-package"}`;
}

/**
 * The v2 key of a scope saved under the old `storage-graph:serial:pageId:origin:package` key.
 * The origin holds colons, so the page id is the second field and the package the last.
 */
export function migrateScopeKey(key: string): string {
  if (key.startsWith(SCOPE_PREFIX) || !key.startsWith("storage-graph:")) return key;
  const rest = key.slice("storage-graph:".length);
  const serialEnd = rest.indexOf(":");
  const targetEnd = rest.indexOf(":", serialEnd + 1);
  const packageStart = rest.lastIndexOf(":");
  if (serialEnd < 0 || targetEnd < 0 || packageStart <= targetEnd) return key;
  return graphScopeKey(
    rest.slice(0, serialEnd),
    rest.slice(targetEnd + 1, packageStart),
    rest.slice(packageStart + 1),
  );
}

function scopeWeight(scope: StorageGraphPersistedScope): number {
  return (
    Object.keys(scope.positions).length +
    scope.notes.length +
    scope.manualEdges.length +
    Object.keys(scope.annotations).length +
    scope.groups.length
  );
}

/** Keeps the most recently written scopes, so the saved layouts never grow without bound. */
function pruneScopes(scopes: StorageGraphScopes): StorageGraphScopes {
  const keys = Object.keys(scopes);
  if (keys.length <= MAX_SCOPES) return scopes;
  const kept: StorageGraphScopes = {};
  for (const key of keys.slice(-MAX_SCOPES)) {
    const scope = scopes[key];
    if (scope) kept[key] = scope;
  }
  return kept;
}

function createEmptyScope(): StorageGraphPersistedScope {
  return {
    positions: {},
    notes: [],
    manualEdges: [],
    annotations: {},
    groups: [],
  };
}

function normalizeScope(
  scope: Partial<StorageGraphPersistedScope> | undefined,
): StorageGraphPersistedScope {
  return {
    positions: scope?.positions ?? {},
    notes: scope?.notes ?? [],
    manualEdges: scope?.manualEdges ?? [],
    annotations: scope?.annotations ?? {},
    groups: scope?.groups ?? [],
  };
}

function loadScopes(): StorageGraphScopes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as StorageGraphScopes;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const migrated: StorageGraphScopes = {};
    for (const [key, scope] of Object.entries(parsed)) {
      const next = migrateScopeKey(key);
      const normalized = normalizeScope(scope);
      const existing = migrated[next];
      if (!existing || scopeWeight(normalized) >= scopeWeight(existing)) {
        delete migrated[next];
        migrated[next] = normalized;
      }
    }
    return pruneScopes(migrated);
  } catch {
    return {};
  }
}

const EMPTY_SCOPE: StorageGraphPersistedScope = Object.freeze({
  positions: Object.freeze({}),
  notes: Object.freeze([]),
  manualEdges: Object.freeze([]),
  annotations: Object.freeze({}),
  groups: Object.freeze([]),
}) as unknown as StorageGraphPersistedScope;

function cloneScope(scope: StorageGraphPersistedScope): StorageGraphPersistedScope {
  return JSON.parse(JSON.stringify(scope)) as StorageGraphPersistedScope;
}

function pruneGroups(groups: StorageGraphGroupRecord[], removedNodeIds: string[]) {
  const removedIds = new Set(removedNodeIds);
  return groups
    .map((group) => ({
      ...group,
      nodeIds: group.nodeIds.filter((nodeId) => !removedIds.has(nodeId)),
    }))
    .filter((group) => group.nodeIds.length > 1);
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useStorageGraphStore = defineStore("storage-graph", () => {
  const scopes = ref<StorageGraphScopes>(loadScopes());
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  watch(scopes, () => {
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scopes.value));
      } catch (error) {
        console.warn("Could not save the graph layout", error);
      }
    }, PERSIST_DELAY_MS);
  });

  function ensureScope(scopeKey: string): StorageGraphPersistedScope {
    const existing = scopes.value[scopeKey];
    if (existing) {
      return existing;
    }

    const scope = createEmptyScope();
    scopes.value = pruneScopes({
      ...scopes.value,
      [scopeKey]: scope,
    });
    return scope;
  }

  /** Reads a scope; one never written reads as empty and is not created by reading (C3). */
  function getScope(scopeKey: string): StorageGraphPersistedScope {
    return scopes.value[scopeKey] ?? EMPTY_SCOPE;
  }

  /** Saves many node positions in one write (a drag of a frame moves all its members). */
  function setNodePositions(
    scopeKey: string,
    entries: ReadonlyArray<readonly [string, StorageGraphPosition]>,
  ) {
    if (entries.length === 0) return;
    const scope = ensureScope(scopeKey);
    scopes.value = {
      ...scopes.value,
      [scopeKey]: { ...scope, positions: { ...scope.positions, ...Object.fromEntries(entries) } },
    };
  }

  function setNodePosition(scopeKey: string, nodeId: string, position: StorageGraphPosition) {
    const scope = ensureScope(scopeKey);
    scopes.value = {
      ...scopes.value,
      [scopeKey]: {
        ...scope,
        positions: {
          ...scope.positions,
          [nodeId]: position,
        },
      },
    };
  }

  function getNodePosition(scopeKey: string, nodeId: string): StorageGraphPosition | undefined {
    return scopes.value[scopeKey]?.positions[nodeId];
  }

  function upsertNote(
    scopeKey: string,
    payload: Partial<StorageGraphNoteRecord> & Pick<StorageGraphNoteRecord, "note">,
  ): StorageGraphNoteRecord {
    const scope = ensureScope(scopeKey);
    const note: StorageGraphNoteRecord = {
      id: payload.id ?? makeId("note"),
      title: payload.title?.trim() || "Note",
      note: payload.note,
      accent: payload.accent ?? "#e8765a",
      position: payload.position ?? { x: 0, y: 0 },
    };

    const nextNotes = scope.notes.some((entry) => entry.id === note.id)
      ? scope.notes.map((entry) => (entry.id === note.id ? note : entry))
      : [...scope.notes, note];

    scopes.value = {
      ...scopes.value,
      [scopeKey]: {
        ...scope,
        notes: nextNotes,
        positions: {
          ...scope.positions,
          [note.id]: note.position,
        },
      },
    };

    return note;
  }

  function removeNote(scopeKey: string, noteId: string) {
    const scope = ensureScope(scopeKey);
    const nextPositions = { ...scope.positions };
    delete nextPositions[noteId];

    scopes.value = {
      ...scopes.value,
      [scopeKey]: {
        ...scope,
        notes: scope.notes.filter((note) => note.id !== noteId),
        manualEdges: scope.manualEdges.filter(
          (edge) => edge.source !== noteId && edge.target !== noteId,
        ),
        groups: pruneGroups(scope.groups, [noteId]),
        positions: nextPositions,
      },
    };
  }

  function upsertManualEdge(
    scopeKey: string,
    payload: Partial<StorageGraphManualEdgeRecord> &
      Pick<StorageGraphManualEdgeRecord, "source" | "target">,
  ): StorageGraphManualEdgeRecord {
    const scope = ensureScope(scopeKey);
    const edge: StorageGraphManualEdgeRecord = {
      id: payload.id ?? makeId("edge"),
      source: payload.source,
      target: payload.target,
      label: payload.label?.trim() || "manual link",
    };

    const nextEdges = scope.manualEdges.some((entry) => entry.id === edge.id)
      ? scope.manualEdges.map((entry) => (entry.id === edge.id ? edge : entry))
      : [...scope.manualEdges, edge];

    scopes.value = {
      ...scopes.value,
      [scopeKey]: {
        ...scope,
        manualEdges: nextEdges,
      },
    };

    return edge;
  }

  function removeManualEdge(scopeKey: string, edgeId: string) {
    const scope = ensureScope(scopeKey);
    scopes.value = {
      ...scopes.value,
      [scopeKey]: {
        ...scope,
        manualEdges: scope.manualEdges.filter((edge) => edge.id !== edgeId),
      },
    };
  }

  function setNodeAnnotation(
    scopeKey: string,
    nodeId: string,
    annotation: StorageGraphNodeAnnotation,
  ) {
    const scope = ensureScope(scopeKey);
    scopes.value = {
      ...scopes.value,
      [scopeKey]: {
        ...scope,
        annotations: {
          ...scope.annotations,
          [nodeId]: annotation,
        },
      },
    };
  }

  function upsertGroup(
    scopeKey: string,
    payload: Partial<StorageGraphGroupRecord> & Pick<StorageGraphGroupRecord, "nodeIds">,
  ): StorageGraphGroupRecord | null {
    const normalizedNodeIds = Array.from(new Set(payload.nodeIds)).sort();
    if (normalizedNodeIds.length < 2) {
      return null;
    }

    const scope = ensureScope(scopeKey);
    const nextGroup: StorageGraphGroupRecord = {
      id: payload.id ?? makeId("group"),
      nodeIds: normalizedNodeIds,
    };
    const exactKey = normalizedNodeIds.join("::");
    const filteredGroups = scope.groups.filter((group) => {
      if (group.id === nextGroup.id) {
        return false;
      }

      return group.nodeIds.slice().sort().join("::") !== exactKey;
    });

    scopes.value = {
      ...scopes.value,
      [scopeKey]: {
        ...scope,
        groups: [...filteredGroups, nextGroup],
      },
    };

    return nextGroup;
  }

  function removeGroup(scopeKey: string, groupId: string) {
    const scope = ensureScope(scopeKey);
    scopes.value = {
      ...scopes.value,
      [scopeKey]: {
        ...scope,
        groups: scope.groups.filter((group) => group.id !== groupId),
      },
    };
  }

  function getNodeAnnotation(
    scopeKey: string,
    nodeId: string,
  ): StorageGraphNodeAnnotation | undefined {
    return scopes.value[scopeKey]?.annotations[nodeId];
  }

  function clearScope(scopeKey: string) {
    const nextScopes = { ...scopes.value };
    delete nextScopes[scopeKey];
    scopes.value = nextScopes;
  }

  function replaceScope(scopeKey: string, scope: StorageGraphPersistedScope) {
    scopes.value = {
      ...scopes.value,
      [scopeKey]: cloneScope(scope),
    };
  }

  return {
    scopes,
    getScope,
    setNodePositions,
    getNodePosition,
    setNodePosition,
    upsertNote,
    removeNote,
    upsertManualEdge,
    removeManualEdge,
    upsertGroup,
    removeGroup,
    setNodeAnnotation,
    getNodeAnnotation,
    clearScope,
    replaceScope,
  };
});
