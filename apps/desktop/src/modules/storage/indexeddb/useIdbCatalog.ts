import { computed, watch, type Ref } from "vue";
import type { IDBDatabaseInfo, StoreInfo } from "@capubridge/cdp-protocol";
import { useIDB } from "@/composables/useIDB";
import { useTargetsStore } from "@/stores/targets.store";
import { useStorageContextStore } from "@/modules/storage/stores/useStorageContextStore";
import { useIdbSnapshotStore, type IdbSnapshotEntry } from "./useIdbSnapshotStore";
import type { IdbMode } from "./useIdbLocation";

/** The database open in the tab, live on the phone or from an opened export. */
export interface IdbOpenDatabase {
  mode: IdbMode;
  /** Route id: the database name when live, the file id when opened from a file. */
  id: string;
  name: string;
  version: number;
  origin: string;
  storeNames: readonly string[];
  file: IdbSnapshotEntry | null;
}

const fileInfoCache = new WeakMap<IdbSnapshotEntry, StoreInfo[]>();

function textBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value) ?? "").length;
  } catch {
    return 0;
  }
}

/** Store details of an opened file, measured once per file. */
export function fileStoreInfo(entry: IdbSnapshotEntry): StoreInfo[] {
  const cached = fileInfoCache.get(entry);
  if (cached) return cached;
  const info = entry.data.database.stores.map((store) => ({
    name: store.name,
    keyPath: store.keyPath,
    autoIncrement: store.autoIncrement,
    recordCount: store.records.length,
    indexCount: store.indexes.length,
    indexes: store.indexes.map((index) => ({
      name: index.name,
      keyPath: index.keyPath ?? "",
      unique: index.unique,
      multiEntry: index.multiEntry,
    })),
    estimatedSize: store.records.reduce((sum, record) => sum + textBytes(record.value), 0),
  }));
  fileInfoCache.set(entry, info);
  return info;
}

function errorText(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}

/**
 * Databases of the page (live) and opened files, the open database, its store details and
 * the origin's IndexedDB usage. Live queries only run for live databases, never for file ids.
 */
export function useIdbCatalog(
  location: {
    mode: Ref<IdbMode>;
    database: Ref<string>;
    store: Ref<string>;
  },
  active?: Ref<boolean>,
) {
  const targetsStore = useTargetsStore();
  const storageContext = useStorageContextStore();
  const snapshots = useIdbSnapshotStore();
  const { useDatabases, useStoreInfo, useStorageEstimate } = useIDB();

  const targetId = computed(() => targetsStore.cdpTargetId);
  const origin = computed({
    get: () => storageContext.getSelectedOrigin(targetId.value),
    set: (value: string) => storageContext.setSelectedOrigin(targetId.value, value),
  });

  const live = useDatabases(active);
  const liveDatabases = computed<IDBDatabaseInfo[]>(() => live.data.value ?? []);

  const liveDatabase = computed(() => {
    if (location.mode.value !== "live" || !location.database.value) return undefined;
    const name = location.database.value;
    return (
      liveDatabases.value.find((db) => db.name === name && db.origin === origin.value) ??
      liveDatabases.value.find((db) => db.name === name)
    );
  });

  const fileEntry = computed(() =>
    location.mode.value === "file" ? snapshots.getById(location.database.value) : undefined,
  );

  const openDatabase = computed<IdbOpenDatabase | null>(() => {
    const file = fileEntry.value;
    if (file) {
      return {
        mode: "file",
        id: file.id,
        name: file.data.database.name,
        version: file.data.database.version,
        origin: file.data.origin,
        storeNames: file.data.database.stores.map((store) => store.name),
        file,
      };
    }
    const db = liveDatabase.value;
    if (!db) return null;
    return {
      mode: "live",
      id: db.name,
      name: db.name,
      version: db.version,
      origin: db.origin,
      storeNames: db.objectStoreNames,
      file: null,
    };
  });

  watch(
    [liveDatabase, liveDatabases],
    ([db, all]) => {
      const next = db?.origin ?? (origin.value ? undefined : all[0]?.origin);
      if (next && next !== origin.value) origin.value = next;
    },
    { immediate: true },
  );

  const liveName = computed(() => liveDatabase.value?.name ?? "");
  const storeInfoQuery = useStoreInfo(liveName, origin, active);
  const overviewOrigin = computed(() =>
    liveDatabase.value && !location.store.value ? origin.value : "",
  );
  const estimate = useStorageEstimate(overviewOrigin, active);

  const storeInfo = computed<StoreInfo[] | undefined>(() =>
    fileEntry.value ? fileStoreInfo(fileEntry.value) : storeInfoQuery.data.value,
  );
  const openStoreInfo = computed(() =>
    storeInfo.value?.find((store) => store.name === location.store.value),
  );
  const idbUsage = computed<number | null>(() => {
    if (fileEntry.value) {
      return fileStoreInfo(fileEntry.value).reduce((sum, store) => sum + store.estimatedSize, 0);
    }
    return estimate.data.value?.idbUsage ?? null;
  });

  return {
    targetId,
    origin,
    liveDatabases,
    liveLoading: computed(() => live.isLoading.value),
    liveFetching: computed(() => live.isFetching.value),
    liveError: computed(() => errorText(live.error.value)),
    refetchDatabases: () => live.refetch(),
    files: computed(() => snapshots.snapshots),
    openDatabase,
    storeInfo,
    openStoreInfo,
    storeInfoLoading: computed(() => !fileEntry.value && storeInfoQuery.isLoading.value),
    storeInfoError: computed(() =>
      fileEntry.value ? null : errorText(storeInfoQuery.error.value),
    ),
    refetchStoreInfo: () => storeInfoQuery.refetch(),
    storeInfoReadAt: computed(() =>
      fileEntry.value ? null : storeInfoQuery.dataUpdatedAt.value || null,
    ),
    idbUsage,
  };
}
