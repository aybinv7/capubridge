import type { SqliteColumnInfo } from "@/types/sqlite.types";

/**
 * Row identity for SQLite change tracking.
 *
 * Two very different places build these keys: the snapshot differ, which reads
 * a database with sql.js and sees raw `PRAGMA table_info` output, and the table
 * overlay, which sees `SqliteColumnInfo` coming back from the Rust commands.
 * They must agree exactly or every lookup misses, so both go through the
 * helpers here rather than sorting columns themselves.
 *
 * The ordering that matters is the primary key's own declared order (the `pk`
 * ordinal), not the column order in the table (`cid`) — for a composite key
 * declared `PRIMARY KEY (b, a)` those two disagree.
 */

/**
 * The columns that identify a row, in primary-key order.
 * Empty when the table has no primary key, which means rows there cannot be
 * tracked, edited, or deleted.
 */
export function orderKeyColumns(columns: SqliteColumnInfo[]): SqliteColumnInfo[] {
  return columns.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk);
}

/** Names of the identifying columns, in primary-key order. */
export function pickKeyColumnNames(columns: SqliteColumnInfo[]): string[] {
  return orderKeyColumns(columns).map((c) => c.name);
}

/**
 * Build a row key from already-ordered key column names.
 * Returns "" when there are no key columns, which callers treat as
 * "this row has no stable identity" and skip.
 * `pkCols` must already be in primary-key order — use `pickKeyColumnNames`.
 */
export function buildRowKeyFromNames(
  keyColumnNames: string[],
  record: Record<string, unknown>,
): string {
  if (keyColumnNames.length === 0) return "";
  return JSON.stringify(keyColumnNames.map((name) => record[name] ?? null));
}

/** Build a row key straight from column metadata. */
export function buildRowKey(columns: SqliteColumnInfo[], record: Record<string, unknown>): string {
  return buildRowKeyFromNames(pickKeyColumnNames(columns), record);
}
