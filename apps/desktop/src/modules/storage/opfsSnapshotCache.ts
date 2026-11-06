import { defineStore } from "pinia";
import { ref } from "vue";

export interface OpfsSnapshotEntry {
  localPath: string;
  size: number;
  lastModified: number;
  sizeBytes: number;
}

function cacheKey(targetId: string, opfsPath: string): string {
  return `${targetId}::${opfsPath}`;
}

/**
 * Remembers which OPFS databases have already been streamed to disk for the
 * current target, so switching back to one is free. An entry is only reused
 * when the file's size and mtime still match what was pulled — a stat is a
 * single cheap CDP call, where a pull moves the whole database.
 */
export const useOpfsSnapshotCache = defineStore("opfs-snapshot-cache", () => {
  const entries = ref(new Map<string, OpfsSnapshotEntry>());

  function get(targetId: string, opfsPath: string): OpfsSnapshotEntry | undefined {
    return entries.value.get(cacheKey(targetId, opfsPath));
  }

  function isFresh(
    entry: OpfsSnapshotEntry | undefined,
    stat: { size: number; lastModified: number },
  ): entry is OpfsSnapshotEntry {
    return !!entry && entry.size === stat.size && entry.lastModified === stat.lastModified;
  }

  function remember(targetId: string, opfsPath: string, entry: OpfsSnapshotEntry) {
    entries.value.set(cacheKey(targetId, opfsPath), entry);
  }

  function forget(targetId: string, opfsPath: string) {
    entries.value.delete(cacheKey(targetId, opfsPath));
  }

  /** Forgets a path and everything under it (a deleted folder). */
  function forgetUnder(targetId: string, opfsPath: string) {
    const exact = cacheKey(targetId, opfsPath);
    const below = `${exact}/`;
    for (const key of entries.value.keys()) {
      if (key === exact || key.startsWith(below)) entries.value.delete(key);
    }
  }

  function clearTarget(targetId: string) {
    for (const key of entries.value.keys()) {
      if (key.startsWith(`${targetId}::`)) entries.value.delete(key);
    }
  }

  return { entries, get, isFresh, remember, forget, forgetUnder, clearTarget };
});
