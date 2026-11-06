import type { SqliteTableFacts } from "@/types/sqlite.types";

/** Names that mark offline-sync bookkeeping on their own (Odoo-style and common app schemas). */
const STRONG: readonly RegExp[] = [
  /^write_date$/i,
  /^create_date$/i,
  /^(updated|created|modified)_at$/i,
  /^modified/i,
  /^_?ruid$/i,
  /sync/i,
  /^(is_)?dirty$/i,
];

/** Names that mean sync only beside a strong one (`active` alone is a lookup table's flag). */
const WEAK: readonly RegExp[] = [/^active$/i, /^(is_)?deleted$/i, /^last_/i];

export interface SyncColumns {
  /** Detected sync columns per table, in the table's column order. */
  byTable: ReadonlyMap<string, readonly string[]>;
  /** How many tables carry each detected column, most common first. */
  counts: readonly { column: string; tables: number }[];
}

/**
 * Detects the columns an offline-sync schema keeps rows' sync state in, by name. A weak name
 * (`active`, `deleted`, `last_*`) only counts in a table that also has a strong one, so a lookup
 * table's `active` flag is not taken for sync. These are guesses: shown as "detected", never used
 * to hide rows.
 */
export function detectSyncColumns(tables: readonly SqliteTableFacts[]): SyncColumns {
  const byTable = new Map<string, string[]>();
  const counts = new Map<string, number>();
  for (const table of tables) {
    if (table.kind !== "table") continue;
    const strong = table.columns.filter((column) => STRONG.some((rule) => rule.test(column)));
    if (strong.length === 0) continue;
    const found = table.columns.filter(
      (column) => strong.includes(column) || WEAK.some((rule) => rule.test(column)),
    );
    byTable.set(table.name, found);
    for (const column of found) counts.set(column, (counts.get(column) ?? 0) + 1);
  }
  return {
    byTable,
    counts: [...counts]
      .map(([column, count]) => ({ column, tables: count }))
      .sort((a, b) => b.tables - a.tables || a.column.localeCompare(b.column)),
  };
}
