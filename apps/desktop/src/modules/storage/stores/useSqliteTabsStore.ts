import { shallowRef } from "vue";
import { defineStore } from "pinia";
import { readPersisted, writePersisted } from "@/lib/persisted";
import {
  emptyWorkspace,
  pruneWorkspaces,
  pushRecent,
  readWorkspaces,
  type SqliteWorkspace,
  type SqliteWorkspaces,
} from "@/modules/storage/sqlite/workspace/sqliteWorkspace";

const STORAGE_KEY = "capubridge:sqlite-tabs:v1";
const SAVE_DELAY_MS = 400;

/**
 * Per-database workspace of the SQLite tab, kept across runs: the tables opened last. Keyed by
 * the database's identity (`sqliteWorkspaceKey`), saved shortly after a change, pruned to the 30
 * databases used most recently.
 */
export const useSqliteTabsStore = defineStore("sqlite-tabs", () => {
  const workspaces = shallowRef<SqliteWorkspaces>(
    readWorkspaces(readPersisted<unknown>(STORAGE_KEY, {}, () => true)),
  );
  let timer: ReturnType<typeof setTimeout> | null = null;

  function scheduleSave() {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      writePersisted(STORAGE_KEY, workspaces.value);
    }, SAVE_DELAY_MS);
  }

  function workspace(key: string): SqliteWorkspace | null {
    return workspaces.value[key] ?? null;
  }

  function update(key: string, change: (current: SqliteWorkspace) => SqliteWorkspace) {
    const now = Date.now();
    const current = workspaces.value[key] ?? emptyWorkspace(now);
    workspaces.value = pruneWorkspaces({
      ...workspaces.value,
      [key]: { ...change(current), touchedAt: now },
    });
    scheduleSave();
  }

  function recents(key: string): readonly string[] {
    return workspaces.value[key]?.recents ?? [];
  }

  function recordRecent(key: string, table: string) {
    if (!table || recents(key)[0] === table) return;
    update(key, (current) => ({ ...current, recents: pushRecent(current.recents, table) }));
  }

  return { workspaces, workspace, recents, recordRecent };
});
