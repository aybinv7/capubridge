import { shallowRef } from "vue";
import { defineStore } from "pinia";
import { readPersisted, writePersisted } from "@/lib/persisted";
import {
  activateTab,
  closeTabs,
  dropMissing,
  EMPTY_TABS,
  keepTab,
  openTab,
  reopenClosed,
  updateTab,
  type SqliteTab,
  type SqliteTabSpec,
  type SqliteTabsState,
} from "@/modules/storage/sqlite/workspace/sqliteTabs";
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
 * Per-database workspace of the SQLite tab, kept across runs: its tabs (kind, table, view,
 * query, preview or kept, the active one, the closed ones) and the tables opened last. Keyed by
 * the database's identity (`sqliteWorkspaceKey`), saved shortly after a change, pruned to the 30
 * databases used most recently. The tab rules themselves are pure (`workspace/sqliteTabs.ts`).
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

  function tabs(key: string): SqliteTabsState {
    return workspaces.value[key]?.tabs ?? EMPTY_TABS;
  }

  function changeTabs(key: string, change: (current: SqliteTabsState) => SqliteTabsState) {
    const before = tabs(key);
    const after = change(before);
    if (after !== before) update(key, (current) => ({ ...current, tabs: after }));
  }

  function open(
    key: string,
    spec: SqliteTabSpec,
    options: { preview: boolean; protect?: ReadonlySet<string> },
  ) {
    changeTabs(key, (current) => openTab(current, spec, { ...options, now: Date.now() }));
  }

  function keep(key: string, id: string) {
    changeTabs(key, (current) => keepTab(current, id));
  }

  function activate(key: string, id: string) {
    changeTabs(key, (current) => activateTab(current, id, Date.now()));
  }

  function close(key: string, ids: ReadonlySet<string>) {
    changeTabs(key, (current) => closeTabs(current, ids));
  }

  function reopen(key: string): SqliteTab | null {
    const last = tabs(key).closed[0] ?? null;
    changeTabs(key, (current) => reopenClosed(current, Date.now()));
    return last;
  }

  /** Drops tabs whose tables are gone; returns how many. */
  function prune(key: string, tables: ReadonlySet<string>): number {
    const result = dropMissing(tabs(key), tables);
    if (result.dropped > 0) changeTabs(key, () => result.state);
    return result.dropped;
  }

  function patch(key: string, id: string, change: Parameters<typeof updateTab>[2]) {
    changeTabs(key, (current) => updateTab(current, id, change));
  }

  return {
    workspaces,
    workspace,
    recents,
    recordRecent,
    tabs,
    open,
    keep,
    activate,
    close,
    reopen,
    prune,
    patch,
  };
});
