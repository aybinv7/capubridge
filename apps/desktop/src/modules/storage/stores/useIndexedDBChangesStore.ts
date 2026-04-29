import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import type {
  IndexedDBChangeEntry,
  IndexedDBStoreCatalogEntry,
  IndexedDBStoreSnapshot,
  IndexedDBSystemChangeEntry,
  IndexedDBTrackingSession,
} from "@/types/storageChanges.types";
import { IDB_CHANGE_MAX_FEED_ENTRIES } from "@/modules/storage/changes/indexeddbChanges.service";

type TrackingStatus = "idle" | "priming" | "tracking" | "error";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useIndexedDBChangesStore = defineStore("indexeddb-changes", () => {
  const session = ref<IndexedDBTrackingSession | null>(null);
  const status = ref<TrackingStatus>("idle");
  const error = ref<string | null>(null);
  const lastEventAt = ref<string | null>(null);
  const selectedChangeId = ref("");
  const changes = shallowRef<IndexedDBChangeEntry[]>([]);
  const catalog = shallowRef<Record<string, IndexedDBStoreCatalogEntry>>({});
  const snapshots = shallowRef<Record<string, IndexedDBStoreSnapshot>>({});
  const pendingStoreKeys = ref<Set<string>>(new Set());

  const catalogEntries = computed(() => Object.values(catalog.value));
  const snapshotEntries = computed(() => Object.values(snapshots.value));
  const trackedSnapshots = computed(() => snapshotEntries.value.filter((entry) => entry.tracked));
  const untrackedSnapshots = computed(() =>
    snapshotEntries.value.filter((entry) => !entry.tracked),
  );
  const trackedStoreCount = computed(() => trackedSnapshots.value.length);
  const untrackedStoreCount = computed(() => untrackedSnapshots.value.length);
  const totalTrackedRecords = computed(() =>
    trackedSnapshots.value.reduce((sum, entry) => sum + entry.recordCount, 0),
  );
  const recordChangeCount = computed(
    () => changes.value.filter((entry) => entry.kind === "record").length,
  );
  const selectedChange = computed(
    () =>
      changes.value.find((entry) => entry.id === selectedChangeId.value) ??
      changes.value[0] ??
      null,
  );

  function startSession(targetId: string, origin: string) {
    session.value = {
      targetId,
      origin,
      startedAt: new Date().toISOString(),
    };
    status.value = "priming";
    error.value = null;
    lastEventAt.value = null;
    changes.value = [];
    catalog.value = {};
    snapshots.value = {};
    pendingStoreKeys.value = new Set();
    selectedChangeId.value = "";
  }

  function finishSession() {
    session.value = null;
    status.value = "idle";
    error.value = null;
    lastEventAt.value = null;
    changes.value = [];
    catalog.value = {};
    snapshots.value = {};
    pendingStoreKeys.value = new Set();
    selectedChangeId.value = "";
  }

  function setStatus(nextStatus: TrackingStatus) {
    status.value = nextStatus;
  }

  function setErrorMessage(message: string | null) {
    error.value = message;
    status.value = message ? "error" : status.value;
  }

  function setCatalog(entries: IndexedDBStoreCatalogEntry[]) {
    const nextCatalog: Record<string, IndexedDBStoreCatalogEntry> = {};

    for (const entry of entries) {
      nextCatalog[entry.storeKey] = entry;
    }

    catalog.value = nextCatalog;

    const nextSnapshots: Record<string, IndexedDBStoreSnapshot> = {};

    for (const [storeKey, snapshot] of Object.entries(snapshots.value)) {
      if (nextCatalog[storeKey]) {
        nextSnapshots[storeKey] = snapshot;
      }
    }

    snapshots.value = nextSnapshots;
  }

  function getCatalogEntry(storeKey: string): IndexedDBStoreCatalogEntry | undefined {
    return catalog.value[storeKey];
  }

  function upsertSnapshot(snapshot: IndexedDBStoreSnapshot) {
    snapshots.value = {
      ...snapshots.value,
      [snapshot.storeKey]: snapshot,
    };
  }

  function removeSnapshots(storeKeys: string[]) {
    if (storeKeys.length === 0) return;

    const next = { ...snapshots.value };

    for (const storeKey of storeKeys) {
      delete next[storeKey];
    }

    snapshots.value = next;
  }

  function getSnapshot(storeKey: string): IndexedDBStoreSnapshot | undefined {
    return snapshots.value[storeKey];
  }

  function addChanges(entries: IndexedDBChangeEntry[]) {
    if (entries.length === 0) return;

    const next = [...entries, ...changes.value].slice(0, IDB_CHANGE_MAX_FEED_ENTRIES);
    changes.value = next;

    if (!selectedChangeId.value || !next.some((entry) => entry.id === selectedChangeId.value)) {
      selectedChangeId.value = next[0]?.id ?? "";
    }
  }

  function addSystemChange(input: Omit<IndexedDBSystemChangeEntry, "id" | "kind" | "source">) {
    addChanges([
      {
        id: makeId(),
        kind: "system",
        source: "external",
        ...input,
      },
    ]);
  }

  function clearChanges() {
    changes.value = [];
    selectedChangeId.value = "";
  }

  function clearChangesWhere(predicate: (entry: IndexedDBChangeEntry) => boolean) {
    const next = changes.value.filter((entry) => !predicate(entry));
    changes.value = next;

    if (!next.some((entry) => entry.id === selectedChangeId.value)) {
      selectedChangeId.value = next[0]?.id ?? "";
    }
  }

  function clearDatabaseChanges(origin: string, databaseName: string) {
    clearChangesWhere((entry) => entry.origin === origin && entry.databaseName === databaseName);
  }

  function clearStoreChanges(origin: string, databaseName: string, objectStoreName: string) {
    clearChangesWhere(
      (entry) =>
        entry.origin === origin &&
        entry.databaseName === databaseName &&
        entry.objectStoreName === objectStoreName,
    );
  }

  function selectChange(changeId: string) {
    selectedChangeId.value = changeId;
  }

  function queueStore(storeKey: string) {
    const next = new Set(pendingStoreKeys.value);
    next.add(storeKey);
    pendingStoreKeys.value = next;
  }

  function drainPendingStoreKeys(): string[] {
    const queued = Array.from(pendingStoreKeys.value);
    pendingStoreKeys.value = new Set();
    return queued;
  }

  function clearPendingStoreKeys() {
    pendingStoreKeys.value = new Set();
  }

  function markEventObserved(observedAt: string) {
    lastEventAt.value = observedAt;
  }

  return {
    session,
    status,
    error,
    lastEventAt,
    selectedChangeId,
    changes,
    catalog,
    snapshots,
    pendingStoreKeys,
    catalogEntries,
    snapshotEntries,
    trackedSnapshots,
    untrackedSnapshots,
    trackedStoreCount,
    untrackedStoreCount,
    totalTrackedRecords,
    recordChangeCount,
    selectedChange,
    startSession,
    finishSession,
    setStatus,
    setErrorMessage,
    setCatalog,
    getCatalogEntry,
    upsertSnapshot,
    removeSnapshots,
    getSnapshot,
    addChanges,
    addSystemChange,
    clearChanges,
    clearDatabaseChanges,
    clearStoreChanges,
    selectChange,
    queueStore,
    drainPendingStoreKeys,
    clearPendingStoreKeys,
    markEventObserved,
  };
});
