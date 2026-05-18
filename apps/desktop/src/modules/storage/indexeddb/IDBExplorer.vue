<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Database,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
  Pin,
  PinOff,
  EyeOff,
  Eye,
  MoreVertical,
  Eraser,
  Trash2,
  Download,
  Upload,
} from "lucide-vue-next";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIDB } from "@/composables/useIDB";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";
import { useStorageSize } from "@/composables/useStorageSize";
import { useSidebarSettings } from "@/modules/storage/stores/useSidebarSettingsStore";
import { useStorageContextStore } from "@/modules/storage/stores/useStorageContextStore";
import { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
import {
  useIndexedDBChangeIndex,
  useIndexedDBTableChangeOverlay,
} from "@/modules/storage/changes/useIndexedDBChangeOverlay";
import type { IndexedDBChangeSummary } from "@/types/storageChanges.types";
import type { IDBDatabaseInfo, IDBRecord, StoreInfo } from "utils";
import { IDBDomain } from "utils";
import IDBTable from "./IDBTable.vue";
import IDBTableToolbar from "./IDBTableToolbar.vue";
import IDBDatabaseOverview from "./IDBDatabaseOverview.vue";
import {
  exportDatabaseToJson,
  saveIdbExportToFile,
  pickIdbExport,
  importDatabaseReplace,
} from "./idbImportExport";
import { useIdbSnapshotStore } from "./useIdbSnapshotStore";
import { toast } from "vue-sonner";

const route = useRoute();
const router = useRouter();
const snapshotStore = useIdbSnapshotStore();

// Same component serves two routes: the live CDP explorer and a read-only
// view over imported JSON snapshots. Mode is decided by the route name.
const isSnapshotMode = computed(() => route.name === "storage-indexeddb-snapshot");
const routePrefix = computed(() =>
  isSnapshotMode.value ? "/storage/indexeddb-snapshot" : "/storage/indexeddb",
);

function readonlyToast() {
  toast.info("Snapshot is read-only", {
    description: "Connect a CDP target to mutate this database.",
  });
}

const storeSearch = ref("");
const filter = ref("");
const page = ref(0);
const pageSize = ref(50);
const showChangesOnly = ref(false);

const dbName = computed(() => decodeURIComponent((route.params["db"] as string) ?? ""));
const storeName = computed(() => decodeURIComponent((route.params["store"] as string) ?? ""));
const targetsStore = useTargetsStore();
const storageContextStore = useStorageContextStore();
const changesStore = useIndexedDBChangesStore();
const targetId = computed(() => targetsStore.cdpTargetId);
const selectedOrigin = computed({
  get: () => storageContextStore.getSelectedOrigin(targetId.value),
  set: (value: string) => storageContextStore.setSelectedOrigin(targetId.value, value),
});
const { getDatabaseSummary, getStoreSummary } = useIndexedDBChangeIndex();

const {
  pinnedDbs,
  hiddenDbs,
  showHiddenDbs,
  pinnedStores,
  hiddenStores,
  showHidden,
  expandedDbs,
  togglePinDb,
  toggleHideDb,
  isDbPinned,
  isDbHidden,
  togglePin,
  toggleHide,
  toggleDb,
  isPinned,
  isHidden,
} = useSidebarSettings();

const { useDatabases, useRecords, useStoreInfo, useStorageEstimate } = useIDB();
const { useTotalStorageSize } = useStorageSize();
const { getClient } = useCDP();

// CDP-backed queries (gated by targetId — naturally idle in snapshot mode).
const {
  data: liveDatabases,
  isLoading: liveIsLoadingDbs,
  isFetching: liveIsFetchingDbs,
  refetch: refetchDbs,
} = useDatabases();

const {
  data: liveRecordsData,
  isLoading: liveIsLoadingRecords,
  isFetching: liveIsFetchingRecords,
  isError: liveIsError,
  refetch: refetchRecords,
} = useRecords(selectedOrigin, dbName, storeName, page, pageSize);

// Snapshot-derived counterparts. In snapshot mode the `dbName` route param
// IS the snapshot id (collision-free across imports with the same DB name).
const snapshotDatabases = computed<IDBDatabaseInfo[]>(() =>
  snapshotStore.snapshots.map((s) => ({
    name: s.data.database.name,
    version: s.data.database.version,
    origin: s.id,
    objectStoreNames: s.data.database.stores.map((store) => store.name),
  })),
);

function jsonByteSize(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

const snapshotStoreInfo = computed<StoreInfo[]>(() => {
  const snap = snapshotStore.getById(dbName.value);
  if (!snap) return [];
  return snap.data.database.stores.map((s) => ({
    name: s.name,
    keyPath: s.keyPath,
    autoIncrement: s.autoIncrement,
    recordCount: s.records.length,
    indexCount: s.indexes.length,
    indexes: s.indexes.map((i) => ({
      name: i.name,
      keyPath: i.keyPath,
      unique: i.unique,
      multiEntry: i.multiEntry,
    })),
    estimatedSize: s.records.reduce((sum, r) => sum + jsonByteSize(r.value), 0),
  }));
});

const snapshotAllRecords = computed<IDBRecord[]>(() => {
  const snap = snapshotStore.getById(dbName.value);
  if (!snap || !storeName.value) return [];
  const store = snap.data.database.stores.find((s) => s.name === storeName.value);
  return (store?.records ?? []).map((r) => ({
    key: r.key as IDBValidKey,
    value: r.value,
  }));
});

const snapshotRecordsData = computed(() => {
  const all = snapshotAllRecords.value;
  const start = page.value * pageSize.value;
  return {
    records: all.slice(start, start + pageSize.value),
    hasMore: start + pageSize.value < all.length,
  };
});

// Unified surface used by the rest of the script + template.
const databases = computed(() =>
  isSnapshotMode.value ? snapshotDatabases.value : liveDatabases.value,
);
const recordsData = computed(() =>
  isSnapshotMode.value ? snapshotRecordsData.value : liveRecordsData.value,
);
const isLoadingDbs = computed(() => !isSnapshotMode.value && liveIsLoadingDbs.value);
const isFetchingDbs = computed(() => !isSnapshotMode.value && liveIsFetchingDbs.value);
const isLoadingRecords = computed(() => !isSnapshotMode.value && liveIsLoadingRecords.value);
const isFetchingRecords = computed(() => !isSnapshotMode.value && liveIsFetchingRecords.value);
const isError = computed(() => !isSnapshotMode.value && liveIsError.value);

// Find the DB info for the currently selected DB. In snapshot mode the route
// `db` param is a snapshot id (matched via the synthesized `origin`).
const selectedDbInfo = computed<IDBDatabaseInfo | undefined>(() => {
  if (!dbName.value || !databases.value) return undefined;
  if (isSnapshotMode.value) {
    return databases.value.find((db) => db.origin === dbName.value);
  }
  return (
    databases.value.find((db) => db.name === dbName.value && db.origin === selectedOrigin.value) ??
    databases.value.find((db) => db.name === dbName.value)
  );
});

const activeDbOrigin = computed(() => selectedOrigin.value || selectedDbInfo.value?.origin || "");

const {
  data: liveStoreInfoData,
  isLoading: liveIsLoadingStoreInfo,
  isError: liveIsStoreInfoError,
  refetch: refetchStoreInfo,
} = useStoreInfo(dbName, selectedOrigin);

const { data: liveStorageSizeData } = useTotalStorageSize(selectedOrigin);

const storeInfoData = computed(() =>
  isSnapshotMode.value ? snapshotStoreInfo.value : liveStoreInfoData.value,
);
const isLoadingStoreInfo = computed(() => !isSnapshotMode.value && liveIsLoadingStoreInfo.value);
const isStoreInfoError = computed(() => !isSnapshotMode.value && liveIsStoreInfoError.value);
const storageSizeData = computed(() =>
  isSnapshotMode.value
    ? { idb: snapshotStoreInfo.value.reduce((a, s) => a + (s.estimatedSize ?? 0), 0) }
    : liveStorageSizeData.value,
);

const isLoading = computed(() => isLoadingRecords.value || isFetchingRecords.value);
const hasMore = computed(() => recordsData.value?.hasMore ?? false);
const recordCount = computed(() => recordsData.value?.records.length ?? 0);
const totalRecords = computed(() => {
  if (!storeName.value || !storeInfoData.value) return 0;
  const store = storeInfoData.value.find((s) => s.name === storeName.value);
  return store?.recordCount ?? 0;
});

const filteredRecords = computed<IDBRecord[]>(() => {
  if (!recordsData.value?.records) return [];
  if (!filter.value) return recordsData.value.records;
  const q = filter.value.toLowerCase();
  return recordsData.value.records.filter(
    (r) =>
      String(r.key).toLowerCase().includes(q) || JSON.stringify(r.value).toLowerCase().includes(q),
  );
});

const { recordsWithChanges, storeSummary } = useIndexedDBTableChangeOverlay(
  filteredRecords,
  activeDbOrigin,
  dbName,
  storeName,
);

// For each DB, compute the sorted + filtered store list
function getVisibleStores(db: IDBDatabaseInfo): string[] {
  const q = storeSearch.value.toLowerCase();
  return db.objectStoreNames
    .filter((s) => {
      if (q && !s.toLowerCase().includes(q)) return false;
      if (isHidden(db.name, s) && !showHidden.value) return false;
      return true;
    })
    .sort((a, b) => {
      const pa = isPinned(db.name, a) ? 0 : 1;
      const pb = isPinned(db.name, b) ? 0 : 1;
      return pa - pb || a.localeCompare(b);
    });
}

function getVisibleDatabases(): IDBDatabaseInfo[] {
  if (!databases.value) return [];
  const q = storeSearch.value.toLowerCase();
  return databases.value
    .filter((db) => {
      if (["localforage", "jeepSQLiteStore", "jeepSqliteStore"].includes(db.name)) return false;
      if (isDbHidden(db.origin, db.name) && !showHiddenDbs.value) return false;
      if (q) {
        const hasMatchingStore = db.objectStoreNames.some((s) => s.toLowerCase().includes(q));
        if (!hasMatchingStore && !db.name.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const pa = isDbPinned(a.origin, a.name) ? 0 : 1;
      const pb = isDbPinned(b.origin, b.name) ? 0 : 1;
      return pa - pb || a.name.localeCompare(b.name);
    });
}

function navigateToStore(db: IDBDatabaseInfo, store: string) {
  if (isSnapshotMode.value) {
    void router.push(
      `${routePrefix.value}/${encodeURIComponent(db.origin)}/${encodeURIComponent(store)}`,
    );
    return;
  }
  selectedOrigin.value = db.origin;
  void router.push(
    `${routePrefix.value}/${encodeURIComponent(db.name)}/${encodeURIComponent(store)}`,
  );
}

function navigateToDbOverview(db: IDBDatabaseInfo) {
  if (isSnapshotMode.value) {
    void router.push(`${routePrefix.value}/${encodeURIComponent(db.origin)}`);
    return;
  }
  selectedOrigin.value = db.origin;
  void router.push(`${routePrefix.value}/${encodeURIComponent(db.name)}`);
}

function handleSelectStore(storeName: string) {
  if (!selectedDbInfo.value) return;
  navigateToStore(selectedDbInfo.value, storeName);
}

function isStoreActive(db: string, store: string) {
  return dbName.value === db && storeName.value === store;
}

function getDbKey(db: IDBDatabaseInfo) {
  return `${db.origin}::${db.name}`;
}

function hasSummaryChanges(summary: IndexedDBChangeSummary) {
  return summary.total > 0;
}

function getSummarySegments(summary: IndexedDBChangeSummary) {
  return [
    { key: "add", count: summary.add, class: "bg-emerald-500" },
    { key: "update", count: summary.update, class: "bg-amber-500" },
    { key: "delete", count: summary.delete, class: "bg-red-500" },
  ].filter((entry) => entry.count > 0);
}

function getDatabaseSummaryStyle(summary: IndexedDBChangeSummary) {
  if (summary.total === 0) return {};

  const color = summary.delete > 0 ? "239,68,68" : summary.update > 0 ? "245,158,11" : "16,185,129";

  return {
    background: `linear-gradient(90deg, rgba(${color}, 0.12), rgba(${color}, 0.035) 42%, transparent 92%)`,
  };
}

function formatSummary(summary: IndexedDBChangeSummary) {
  const parts = [
    summary.add > 0 ? `${summary.add} added` : "",
    summary.update > 0 ? `${summary.update} updated` : "",
    summary.delete > 0 ? `${summary.delete} deleted` : "",
  ].filter(Boolean);

  return parts.join(", ");
}

function prevPage() {
  if (page.value > 0) page.value--;
}
function nextPage() {
  if (hasMore.value) page.value++;
}
function handlePageSizeChange(size: number) {
  pageSize.value = size;
  page.value = 0;
}

async function fetchSingleRecord(index: number): Promise<IDBRecord | null> {
  if (isSnapshotMode.value) {
    return snapshotAllRecords.value[index] ?? null;
  }
  const client = getClient(targetId.value);
  if (!client) return null;

  const domain = new IDBDomain(client);
  try {
    const result = await domain.getData({
      securityOrigin: activeDbOrigin.value,
      databaseName: dbName.value,
      objectStoreName: storeName.value,
      skipCount: index,
      pageSize: 1,
    });
    return result.records[0] ?? null;
  } catch {
    return null;
  }
}

function getDomain(): IDBDomain | null {
  const client = getClient(targetId.value);
  return client ? new IDBDomain(client) : null;
}

async function handleRecordEdit(record: IDBRecord) {
  if (isSnapshotMode.value) {
    readonlyToast();
    return;
  }
  const domain = getDomain();
  if (!domain || !storeName.value || !dbName.value || !selectedOrigin.value) return;
  try {
    await domain.putRecord(selectedOrigin.value, dbName.value, storeName.value, record.value);
    void refetchRecords();
  } catch (err) {
    console.error("[IDB] Failed to save record:", err);
  }
}

async function handleRecordDelete(key: IDBValidKey) {
  if (isSnapshotMode.value) {
    readonlyToast();
    return;
  }
  const domain = getDomain();
  if (!domain || !storeName.value || !dbName.value || !selectedOrigin.value) return;
  try {
    await domain.deleteRecord(selectedOrigin.value, dbName.value, storeName.value, key);
    void refetchRecords();
  } catch (err) {
    console.error("[IDB] Failed to delete record:", err);
  }
}

async function handleRecordDeleteBulk(keys: IDBValidKey[]) {
  if (isSnapshotMode.value) {
    readonlyToast();
    return;
  }
  const domain = getDomain();
  if (!domain || !storeName.value || !dbName.value || !selectedOrigin.value) return;
  try {
    for (const key of keys) {
      await domain.deleteRecord(selectedOrigin.value, dbName.value, storeName.value, key);
    }
    void refetchRecords();
  } catch (err) {
    console.error("[IDB] Failed to delete records:", err);
  }
}

// ─── Destructive actions ──────────────────────────────────────────────────────
const confirmDialog = ref<{
  open: boolean;
  title: string;
  description: string;
  action: () => Promise<void>;
}>({ open: false, title: "", description: "", action: async () => {} });

function openConfirm(title: string, description: string, action: () => Promise<void>) {
  confirmDialog.value = { open: true, title, description, action };
}

async function runConfirmedAction() {
  await confirmDialog.value.action();
  confirmDialog.value.open = false;
}

function handleClearStore(db: IDBDatabaseInfo, store: string) {
  if (isSnapshotMode.value) {
    readonlyToast();
    return;
  }
  openConfirm(
    "Clear all records",
    `Delete every record in "${store}"? This cannot be undone.`,
    async () => {
      const domain = getDomain();
      if (!domain) return;
      try {
        await domain.clearObjectStore(db.origin, db.name, store);
        void refetchRecords();
        void refetchStoreInfo();
      } catch (err) {
        console.error("[IDB] clearObjectStore failed:", err);
      }
    },
  );
}

function handleDeleteStore(db: IDBDatabaseInfo, store: string) {
  if (isSnapshotMode.value) {
    readonlyToast();
    return;
  }
  openConfirm(
    "Delete table",
    `Permanently delete the object store "${store}" and all its data? The database schema will be migrated.`,
    async () => {
      const domain = getDomain();
      if (!domain) return;
      try {
        await domain.deleteObjectStore(db.origin, db.name, store);
        void refetchDbs();
        // Navigate away if current store was deleted
        if (dbName.value === db.name && storeName.value === store) {
          void router.push(`/storage/indexeddb/${encodeURIComponent(db.name)}`);
        }
      } catch (err) {
        console.error("[IDB] deleteObjectStore failed:", err);
      }
    },
  );
}

async function handleExportDatabase(db: IDBDatabaseInfo) {
  // In snapshot mode the data is already in memory — just re-serialize it.
  if (isSnapshotMode.value) {
    const snap = snapshotStore.getById(db.origin);
    if (!snap) return;
    const promise = saveIdbExportToFile(snap.data, `${db.name}.idb`);
    toast.promise(promise, {
      loading: `Exporting "${db.name}"…`,
      success: (saved) => (saved ? `Exported to ${saved}` : "Export cancelled"),
      error: (err: unknown) => `Export failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }
  const client = getClient(targetId.value);
  if (!client) {
    toast.error("No active CDP target");
    return;
  }
  const promise = (async () => {
    const exported = await exportDatabaseToJson(client, db.origin, db.name);
    const saved = await saveIdbExportToFile(exported, `${db.name}.idb`);
    return saved;
  })();
  toast.promise(promise, {
    loading: `Exporting "${db.name}"…`,
    success: (saved) => (saved ? `Exported "${db.name}" to ${saved}` : "Export cancelled"),
    error: (err: unknown) => `Export failed: ${err instanceof Error ? err.message : String(err)}`,
  });
}

async function handleImportDatabase() {
  let picked;
  try {
    picked = await pickIdbExport();
  } catch (err) {
    toast.error("Could not read import file", { description: String(err) });
    return;
  }
  if (!picked) return;

  const client = getClient(targetId.value);
  // No live target, or already in snapshot mode → keep on the snapshot route.
  if (!client || isSnapshotMode.value) {
    const entry = snapshotStore.addSnapshot(picked.path, picked.data);
    toast.success(`Opened "${picked.data.database.name}" as a snapshot`);
    void router.push(`/storage/indexeddb-snapshot/${encodeURIComponent(entry.id)}`);
    return;
  }

  const dbName = picked.data.database.name;
  const storeCount = picked.data.database.stores.length;
  const recordCount = picked.data.database.stores.reduce((n, s) => n + s.records.length, 0);
  openConfirm(
    "Import database (replace)",
    `Replace database "${dbName}" with ${storeCount} store(s) and ${recordCount} record(s) from this file? Any existing data in "${dbName}" will be deleted.`,
    async () => {
      const promise = importDatabaseReplace(client, picked.data).then(() => {
        void refetchDbs();
        return dbName;
      });
      await toast.promise(promise, {
        loading: `Importing "${dbName}"…`,
        success: (name) => `Imported "${name}"`,
        error: (err: unknown) =>
          `Import failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    },
  );
}

function handleDeleteDatabase(db: IDBDatabaseInfo) {
  if (isSnapshotMode.value) {
    openConfirm(
      "Remove snapshot",
      `Remove "${db.name}" from imported snapshots? The source file on disk is not touched.`,
      async () => {
        snapshotStore.removeSnapshot(db.origin);
        if (dbName.value === db.origin) {
          await router.replace("/storage/indexeddb-snapshot");
        }
      },
    );
    return;
  }
  openConfirm(
    "Delete database",
    `Permanently delete the entire database "${db.name}" and all its stores? This cannot be undone.`,
    async () => {
      const domain = getDomain();
      if (!domain) return;
      try {
        await domain.deleteDatabase(db.origin, db.name);
        void refetchDbs();
        // Navigate away if current db was deleted
        if (dbName.value === db.name) {
          void router.push("/storage/indexeddb");
        }
      } catch (err) {
        console.error("[IDB] deleteDatabase failed:", err);
      }
    },
  );
}

function refetch() {
  void refetchDbs();
  void refetchRecords();
}

watch([dbName, storeName], async () => {
  page.value = 0;
  filter.value = "";
  showChangesOnly.value = false;
});

// Sync selectedOrigin when selectedDbInfo changes (live mode only — in
// snapshot mode `origin` is a synthetic snapshot id, not a security origin).
watch(
  selectedDbInfo,
  (db) => {
    if (isSnapshotMode.value) return;
    if (db?.origin && selectedOrigin.value !== db.origin) {
      selectedOrigin.value = db.origin;
    }
  },
  { immediate: true },
);

watch(
  databases,
  (dbs) => {
    if (dbs && dbs.length > 0 && expandedDbs.value.size === 0) {
      // Expand first DB only if nothing was previously expanded
      toggleDb(dbs[0].name);
      selectedOrigin.value = dbs[0].origin;
    }
    for (const db of dbs ?? []) {
      for (const store of db.objectStoreNames) {
        if (isStoreActive(db.name, store)) {
          if (!expandedDbs.value.has(db.name)) toggleDb(db.name);
          break;
        }
      }
    }
  },
  { immediate: true },
);

// Scroll active store into view after navigation
watch([dbName, storeName], async () => {
  await nextTick();
  document.querySelector("[data-active-store]")?.scrollIntoView({
    block: "nearest",
    behavior: "smooth",
  });
});

const hiddenDbCount = computed(() => hiddenDbs.value.size);
const hiddenStoreCount = computed(() => hiddenStores.value.size);
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <ResizablePanelGroup direction="horizontal" class="flex-1 min-h-0">
      <ResizablePanel :default-size="15" :min-size="10" :max-size="30" class="min-h-0">
        <!-- Sidebar: full height flex column, no overflow on outer -->
        <div class="flex h-full flex-col border-r border-border/30 min-h-0">
          <!-- Store search -->
          <div class="shrink-0 border-b border-border/20 flex items-center gap-1 px-1">
            <div
              class="flex flex-1 items-center gap-2 bg-surface-3 rounded-md px-2 py-2 border border-border/30 focus-within:border-border/60 transition-colors"
            >
              <Search class="w-3 h-3 text-muted-foreground/50 shrink-0" />
              <Input
                v-model="storeSearch"
                class="h-5 text-xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground/40"
                placeholder="Search databases or stores…"
              />
            </div>
            <button
              class="shrink-0 p-1.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-surface-3 transition-colors"
              title="Import database from JSON"
              @click="handleImportDatabase()"
            >
              <Upload :size="12" />
            </button>
          </div>

          <!-- Back to live IDB (snapshot mode only) -->
          <button
            v-if="isSnapshotMode"
            class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground/60 hover:text-foreground/80 border-b border-border/20 hover:bg-surface-3/50 transition-colors"
            @click="router.push('/storage/indexeddb')"
          >
            ← Back to live IndexedDB
          </button>

          <!-- Hidden databases toggle (only when some are hidden) -->
          <div
            v-if="hiddenDbCount > 0"
            class="shrink-0 flex items-center justify-between px-3 py-1 border-b border-border/20 bg-surface-2/50"
          >
            <span class="text-[10px] text-muted-foreground/50">
              {{ hiddenDbCount }} hidden database{{ hiddenDbCount > 1 ? "s" : "" }}
            </span>
            <button
              class="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground/70 transition-colors"
              @click="showHiddenDbs = !showHiddenDbs"
            >
              <component :is="showHiddenDbs ? Eye : EyeOff" :size="10" />
              {{ showHiddenDbs ? "Hide" : "Show" }}
            </button>
          </div>

          <!-- Hidden stores toggle (only when some are hidden) -->
          <div
            v-if="hiddenStoreCount > 0"
            class="shrink-0 flex items-center justify-between px-3 py-1 border-b border-border/20 bg-surface-2/50"
          >
            <span class="text-[10px] text-muted-foreground/50">
              {{ hiddenStoreCount }} hidden store{{ hiddenStoreCount > 1 ? "s" : "" }}
            </span>
            <button
              class="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground/70 transition-colors"
              @click="showHidden = !showHidden"
            >
              <component :is="showHidden ? Eye : EyeOff" :size="10" />
              {{ showHidden ? "Hide" : "Show" }}
            </button>
          </div>

          <!-- DB + store tree — this is the only scrolling region -->
          <ScrollArea class="flex-1 min-h-0">
            <div v-if="isLoadingDbs || isFetchingDbs" class="flex items-center justify-center py-8">
              <RefreshCw :size="14" class="animate-spin text-muted-foreground/40" />
            </div>

            <div
              v-else-if="!databases?.length"
              class="flex flex-col items-center justify-center py-8 px-3 text-center"
            >
              <Database :size="16" class="text-muted-foreground/30 mb-2" />
              <p class="text-[11px] text-muted-foreground/40">
                {{ isSnapshotMode ? "No snapshots imported" : "No IndexedDB databases found" }}
              </p>
              <button
                class="mt-3 flex items-center gap-1.5 rounded border border-border/30 bg-surface-3 px-2.5 py-1 text-[10px] text-foreground/70 hover:bg-surface-2 transition-colors"
                @click="handleImportDatabase()"
              >
                <Upload :size="10" />
                Import JSON snapshot
              </button>
            </div>

            <ul v-else class="py-1">
              <li v-for="db in getVisibleDatabases()" :key="getDbKey(db)" class="group/db relative">
                <!-- DB header -->
                <div
                  class="relative flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground/70 transition-colors hover:bg-surface-3/50"
                  :style="getDatabaseSummaryStyle(getDatabaseSummary(db.origin, db.name))"
                >
                  <div
                    v-if="hasSummaryChanges(getDatabaseSummary(db.origin, db.name))"
                    class="pointer-events-none absolute left-0 top-1.5 bottom-1.5 z-10 flex w-1 overflow-hidden rounded-r"
                    :title="formatSummary(getDatabaseSummary(db.origin, db.name))"
                  >
                    <span
                      v-for="segment in getSummarySegments(getDatabaseSummary(db.origin, db.name))"
                      :key="segment.key"
                      class="min-h-1 flex-1"
                      :class="segment.class"
                    />
                  </div>
                  <button class="flex items-center gap-2 flex-1 min-w-0" @click="toggleDb(db.name)">
                    <component
                      :is="expandedDbs.has(db.name) ? ChevronDown : ChevronRight"
                      :size="12"
                      class="shrink-0 opacity-50"
                    />
                    <Database :size="13" class="shrink-0 opacity-40" />
                    <span
                      class="flex-1 truncate text-left"
                      :class="{ 'opacity-40': isDbHidden(db.origin, db.name) }"
                    >
                      {{ db.name }}
                    </span>
                    <span
                      class="text-[10px] font-mono text-muted-foreground/40 shrink-0"
                      :class="{ 'opacity-40': isDbHidden(db.origin, db.name) }"
                    >
                      v{{ db.version }}
                    </span>
                  </button>
                  <!-- Click DB name to show overview -->
                  <button
                    class="text-[10px] text-muted-foreground/40 hover:text-foreground/60 transition-colors px-1 py-0.5 rounded hover:bg-surface-3"
                    title="View database overview"
                    @click.stop="navigateToDbOverview(db)"
                  >
                    <Database :size="11" />
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <button
                        class="flex p-0.5 rounded opacity-0 group-hover/db:opacity-100 focus:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 hover:bg-surface-3 text-muted-foreground/40 hover:text-foreground/70 transition-colors shrink-0"
                        title="Database actions"
                        @click.stop
                      >
                        <MoreVertical :size="12" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-44">
                      <DropdownMenuItem @click="togglePinDb(db.origin, db.name)">
                        <component
                          :is="isDbPinned(db.origin, db.name) ? PinOff : Pin"
                          class="h-3.5 w-3.5 mr-2"
                        />
                        {{ isDbPinned(db.origin, db.name) ? "Unpin database" : "Pin database" }}
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="toggleHideDb(db.origin, db.name)">
                        <component
                          :is="isDbHidden(db.origin, db.name) ? Eye : EyeOff"
                          class="h-3.5 w-3.5 mr-2"
                        />
                        {{ isDbHidden(db.origin, db.name) ? "Unhide database" : "Hide database" }}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem @click="handleExportDatabase(db)">
                        <Download class="h-3.5 w-3.5 mr-2" />
                        Export database (JSON)
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="handleImportDatabase()">
                        <Upload class="h-3.5 w-3.5 mr-2" />
                        Import database (replace)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator v-if="!isSnapshotMode" />
                      <DropdownMenuItem
                        v-if="!isSnapshotMode"
                        :disabled="!hasSummaryChanges(getDatabaseSummary(db.origin, db.name))"
                        @click="changesStore.clearDatabaseChanges(db.origin, db.name)"
                      >
                        <Eraser class="h-3.5 w-3.5 mr-2" />
                        Clear DB changes
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        class="text-error focus:text-error"
                        @click="handleDeleteDatabase(db)"
                      >
                        <Trash2 class="h-3.5 w-3.5 mr-2" />
                        {{ isSnapshotMode ? "Remove snapshot" : "Delete database" }}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <!-- Store list -->
                <ul v-if="expandedDbs.has(db.name)">
                  <li
                    v-for="storeItem in getVisibleStores(db)"
                    :key="storeItem"
                    class="group relative"
                    :data-active-store="isStoreActive(db.name, storeItem) ? '' : undefined"
                  >
                    <div
                      v-if="hasSummaryChanges(getStoreSummary(db.origin, db.name, storeItem))"
                      class="pointer-events-none absolute left-0 top-1 bottom-1 z-10 flex w-1 overflow-hidden rounded-r"
                      :title="formatSummary(getStoreSummary(db.origin, db.name, storeItem))"
                    >
                      <span
                        v-for="segment in getSummarySegments(
                          getStoreSummary(db.origin, db.name, storeItem),
                        )"
                        :key="segment.key"
                        class="min-h-1 flex-1"
                        :class="segment.class"
                      />
                    </div>
                    <button
                      class="flex w-full items-center gap-1.5 py-1.5 pl-[26px] pr-3 text-xs transition-colors"
                      :class="
                        isStoreActive(db.name, storeItem)
                          ? 'text-foreground font-medium bg-surface-3 border-l-2 border-foreground pl-[24px]'
                          : 'text-foreground/60 hover:bg-surface-3/50 hover:text-foreground/80'
                      "
                      @click="navigateToStore(db, storeItem)"
                    >
                      <!-- Pin indicator dot -->
                      <span
                        v-if="isPinned(db.name, storeItem)"
                        class="shrink-0 w-1.5 h-1.5 rounded-full bg-foreground/30 mr-0.5"
                      />
                      <span
                        class="flex-1 truncate text-left"
                        :class="{ 'opacity-40': isHidden(db.name, storeItem) }"
                      >
                        {{ storeItem }}
                      </span>
                    </button>

                    <div
                      class="absolute right-2 top-1/2 flex -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <button
                            class="p-0.5 rounded hover:bg-surface-3 text-muted-foreground/40 hover:text-foreground/70 focus:text-foreground/70 transition-colors"
                            title="Table actions"
                            @click.stop
                          >
                            <MoreVertical :size="12" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="w-40">
                          <DropdownMenuItem @click="togglePin(db.name, storeItem)">
                            <component
                              :is="isPinned(db.name, storeItem) ? PinOff : Pin"
                              class="h-3.5 w-3.5 mr-2"
                            />
                            {{ isPinned(db.name, storeItem) ? "Unpin table" : "Pin table" }}
                          </DropdownMenuItem>
                          <DropdownMenuItem @click="toggleHide(db.name, storeItem)">
                            <component
                              :is="isHidden(db.name, storeItem) ? Eye : EyeOff"
                              class="h-3.5 w-3.5 mr-2"
                            />
                            {{ isHidden(db.name, storeItem) ? "Unhide table" : "Hide table" }}
                          </DropdownMenuItem>
                          <template v-if="!isSnapshotMode">
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              :disabled="
                                !hasSummaryChanges(getStoreSummary(db.origin, db.name, storeItem))
                              "
                              @click="changesStore.clearStoreChanges(db.origin, db.name, storeItem)"
                            >
                              <Eraser class="h-3.5 w-3.5 mr-2" />
                              Clear changes
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              class="text-error focus:text-error"
                              @click="handleClearStore(db, storeItem)"
                            >
                              <Eraser class="h-3.5 w-3.5 mr-2" />
                              Clear all records
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              class="text-error focus:text-error"
                              @click="handleDeleteStore(db, storeItem)"
                            >
                              <Trash2 class="h-3.5 w-3.5 mr-2" />
                              Delete table
                            </DropdownMenuItem>
                          </template>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>

                  <!-- No match state -->
                  <li
                    v-if="storeSearch && getVisibleStores(db).length === 0"
                    class="px-7 py-1.5 text-[10px] text-muted-foreground/30 italic"
                  >
                    No stores match
                  </li>
                </ul>
              </li>
            </ul>
          </ScrollArea>
        </div>
      </ResizablePanel>

      <ResizableHandle with-handle />

      <ResizablePanel :default-size="85" class="min-h-0">
        <!-- No database selected -->
        <div
          v-if="!dbName"
          class="flex h-full items-center justify-center text-sm text-muted-foreground/30"
        >
          Select a database from the sidebar
        </div>

        <!-- Database selected but no store → show overview -->
        <template v-else-if="!storeName && selectedDbInfo">
          <IDBDatabaseOverview
            :db-name="selectedDbInfo.name"
            :db-version="selectedDbInfo.version"
            :db-origin="selectedDbInfo.origin"
            :store-count="selectedDbInfo.objectStoreNames.length"
            :stores="storeInfoData ?? []"
            :is-loading="isLoadingStoreInfo"
            :is-error="isStoreInfoError"
            :total-idb-size="storageSizeData?.idb"
            @select-store="handleSelectStore"
            @refresh="void refetchStoreInfo()"
          />
        </template>

        <!-- Store selected → show table -->
        <template v-else>
          <div class="flex flex-col h-full overflow-hidden">
            <IDBTableToolbar
              :store-name="storeName"
              :db-name="dbName"
              :is-loading="isLoading"
              :page="page"
              :page-size="pageSize"
              :has-more="hasMore"
              :record-count="totalRecords"
              :change-summary="storeSummary"
              :show-changes-only="showChangesOnly"
              @refresh="refetch"
              @prev="prevPage"
              @next="nextPage"
              @page-size-change="handlePageSizeChange"
              @toggle-changes-only="showChangesOnly = !showChangesOnly"
            />

            <div
              v-if="isError"
              class="shrink-0 border-b border-border/30 bg-error/[0.06] px-4 py-2 text-xs text-error"
            >
              Failed to load records. Make sure the target supports IndexedDB inspection.
            </div>

            <IDBTable
              :records="recordsWithChanges"
              :is-loading="isLoading"
              :store-name="storeName"
              :db-name="dbName"
              :total-records="totalRecords"
              :store-info="storeInfoData ?? []"
              :fetch-record="fetchSingleRecord"
              :show-changes-only="showChangesOnly"
              @refresh="refetch"
              @record-edit="handleRecordEdit"
              @record-delete="handleRecordDelete"
              @record-delete-bulk="handleRecordDeleteBulk"
            />
          </div>
        </template>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>

  <ConfirmDialog
    v-model:open="confirmDialog.open"
    :title="confirmDialog.title"
    :description="confirmDialog.description"
    confirm-text="Confirm"
    cancel-text="Cancel"
    variant="destructive"
    @confirm="runConfirmedAction"
  />
</template>
