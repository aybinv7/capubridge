import { computed, shallowRef } from "vue";
import { defineStore } from "pinia";
import {
  EMPTY_STAGED,
  stagedCount,
  type SqliteStaged,
} from "@/modules/storage/sqlite/browse/sqliteChangeset";

/** A table whose grid holds staged edits that are not saved yet. */
export interface SqliteStagedTable {
  /** The sidebar id of its database (a phone path, or `file:<id>` for an opened file). */
  sourceId: string;
  table: string;
  count: number;
}

interface Entry {
  sourceId: string;
  table: string;
  staged: SqliteStaged;
}

function keyOf(sourceId: string, table: string): string {
  return `${sourceId}\u0000${table}`;
}

/**
 * The staged edits of every table, outside any component: a table's grid reads and writes
 * them here, so switching tables or tabs (which may unmount the grid) never drops them and
 * never asks. Whatever would drop them (closing a tab, leaving the database, closing the file,
 * a sidebar write, closing the window) asks first through `stagedIn`, and drops them with
 * `discardIn`.
 */
export const useSqliteUnsavedStore = defineStore("sqlite-unsaved", () => {
  const entries = shallowRef<ReadonlyMap<string, Entry>>(new Map());

  const tables = computed<ReadonlyMap<string, SqliteStagedTable>>(() => {
    const map = new Map<string, SqliteStagedTable>();
    for (const [key, entry] of entries.value) {
      const count = stagedCount(entry.staged);
      if (count > 0) map.set(key, { sourceId: entry.sourceId, table: entry.table, count });
    }
    return map;
  });

  const total = computed(() => {
    let count = 0;
    for (const entry of tables.value.values()) count += entry.count;
    return count;
  });

  /** The staged edits of a table (empty when there are none). */
  function staged(sourceId: string, table: string): SqliteStaged {
    return entries.value.get(keyOf(sourceId, table))?.staged ?? EMPTY_STAGED;
  }

  /** Replaces the staged edits of a table; empty ones are forgotten. */
  function setStaged(sourceId: string, table: string, next: SqliteStaged) {
    const key = keyOf(sourceId, table);
    const map = new Map(entries.value);
    if (stagedCount(next) > 0) map.set(key, { sourceId, table, staged: next });
    else if (map.has(key)) map.delete(key);
    else return;
    entries.value = map;
  }

  /** Staged tables of one database, or of one of its tables. */
  function stagedIn(sourceId: string, table?: string): SqliteStagedTable[] {
    return [...tables.value.values()].filter(
      (entry) => entry.sourceId === sourceId && (table === undefined || entry.table === table),
    );
  }

  /** Drops the staged edits of one database (or one table of it). */
  function discardIn(sourceId: string, table?: string) {
    for (const entry of stagedIn(sourceId, table))
      setStaged(entry.sourceId, entry.table, EMPTY_STAGED);
  }

  function discardAll() {
    entries.value = new Map();
  }

  return { tables, total, staged, setStaged, stagedIn, discardIn, discardAll };
});
