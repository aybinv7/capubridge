import { computed, shallowRef } from "vue";
import { defineStore } from "pinia";

/** A table whose grid holds staged edits that are not saved yet. */
export interface SqliteStagedTable {
  /** The sidebar id of its database (a phone path, or `file:<id>` for an opened file). */
  sourceId: string;
  table: string;
  count: number;
  /** Drops the staged edits on screen. */
  discard: () => void;
}

function keyOf(sourceId: string, table: string): string {
  return `${sourceId}\u0000${table}`;
}

/**
 * Tables with staged edits, so whatever would drop them (closing the file, a sidebar write,
 * closing the window) can ask first, and drop them when the person agrees.
 */
export const useSqliteUnsavedStore = defineStore("sqlite-unsaved", () => {
  const tables = shallowRef<ReadonlyMap<string, SqliteStagedTable>>(new Map());

  const total = computed(() => {
    let count = 0;
    for (const entry of tables.value.values()) count += entry.count;
    return count;
  });

  /** Records the staged edits of a table; `null` or a count of 0 forgets it. */
  function track(
    sourceId: string,
    table: string,
    entry: Omit<SqliteStagedTable, "sourceId" | "table"> | null,
  ) {
    const key = keyOf(sourceId, table);
    const next = new Map(tables.value);
    if (entry && entry.count > 0) next.set(key, { sourceId, table, ...entry });
    else if (next.has(key)) next.delete(key);
    else return;
    tables.value = next;
  }

  /** Staged tables of one database, or of one of its tables. */
  function stagedIn(sourceId: string, table?: string): SqliteStagedTable[] {
    return [...tables.value.values()].filter(
      (entry) => entry.sourceId === sourceId && (table === undefined || entry.table === table),
    );
  }

  /** Drops the staged edits of one database (or one table of it). */
  function discardIn(sourceId: string, table?: string) {
    for (const entry of stagedIn(sourceId, table)) {
      entry.discard();
      track(entry.sourceId, entry.table, null);
    }
  }

  function discardAll() {
    for (const entry of tables.value.values()) {
      entry.discard();
      track(entry.sourceId, entry.table, null);
    }
  }

  return { tables, total, track, stagedIn, discardIn, discardAll };
});
