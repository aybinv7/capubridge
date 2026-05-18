import { ref, computed } from "vue";
import { defineStore } from "pinia";
import type { IdbExportedDatabase } from "./idbImportExport";

export interface IdbSnapshotEntry {
  id: string;
  importedAt: number;
  sourcePath: string;
  data: IdbExportedDatabase;
}

export const useIdbSnapshotStore = defineStore("idb-snapshot", () => {
  const snapshots = ref<IdbSnapshotEntry[]>([]);

  function addSnapshot(sourcePath: string, data: IdbExportedDatabase): IdbSnapshotEntry {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: IdbSnapshotEntry = {
      id,
      importedAt: Date.now(),
      sourcePath,
      data,
    };
    snapshots.value = [...snapshots.value, entry];
    return entry;
  }

  function removeSnapshot(id: string) {
    snapshots.value = snapshots.value.filter((s) => s.id !== id);
  }

  function clear() {
    snapshots.value = [];
  }

  function getById(id: string): IdbSnapshotEntry | undefined {
    return snapshots.value.find((s) => s.id === id);
  }

  const hasAny = computed(() => snapshots.value.length > 0);

  return { snapshots, hasAny, addSnapshot, removeSnapshot, clear, getById };
});
