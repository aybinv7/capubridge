import { computed, markRaw, shallowRef } from "vue";
import { defineStore } from "pinia";
import type { IdbExportedDatabase } from "./idbTransfer.types";

export interface IdbSnapshotEntry {
  id: string;
  importedAt: number;
  sourcePath: string;
  /** The file's content, kept raw: it is read-only and can hold a whole database. */
  data: IdbExportedDatabase;
  /** What the file cannot restore exactly (see `exportLoss`). */
  lossy: string[];
  /** Size of the file on disk. */
  bytes: number;
}

/** IndexedDB exports opened in this session ("Opened files"); kept in memory only. */
export const useIdbSnapshotStore = defineStore("idb-snapshot", () => {
  const snapshots = shallowRef<IdbSnapshotEntry[]>([]);

  function addSnapshot(
    sourcePath: string,
    data: IdbExportedDatabase,
    lossy: string[] = [],
    bytes = 0,
  ): IdbSnapshotEntry {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: IdbSnapshotEntry = {
      id,
      importedAt: Date.now(),
      sourcePath,
      data: markRaw(data),
      lossy,
      bytes,
    };
    snapshots.value = [...snapshots.value, entry];
    return entry;
  }

  function removeSnapshot(id: string) {
    snapshots.value = snapshots.value.filter((entry) => entry.id !== id);
  }

  function clear() {
    snapshots.value = [];
  }

  function getById(id: string): IdbSnapshotEntry | undefined {
    return snapshots.value.find((entry) => entry.id === id);
  }

  const hasAny = computed(() => snapshots.value.length > 0);

  return { snapshots, hasAny, addSnapshot, removeSnapshot, clear, getById };
});
