import { invokeCommand } from "@/runtime/ipc/client";
import type {
  SqliteColumnInfo,
  SqliteForeignKeyInfo,
  SqliteIndexInfo,
  SqliteQueryResult,
  SqliteTableInfo,
} from "@/types/sqlite.types";
import { addressArgs, type SqliteAddress } from "./sqliteAddress";
import { sqlLiteral } from "./sqlText";

/** Opens (pulls, for a phone database) and lists its tables and views with their row counts. */
export function openTables(address: SqliteAddress): Promise<SqliteTableInfo[]> {
  return invokeCommand("sqlite_open_database", addressArgs(address));
}

/** One read-only statement; `fullValues` sends every byte of every BLOB (exports). */
export function runQuery(
  address: SqliteAddress,
  sql: string,
  fullValues = false,
): Promise<SqliteQueryResult> {
  return invokeCommand("sqlite_execute_query", {
    ...addressArgs(address),
    sql,
    ...(fullValues ? { fullValues } : {}),
  });
}

export function readColumns(address: SqliteAddress, table: string): Promise<SqliteColumnInfo[]> {
  return invokeCommand("sqlite_table_columns", { ...addressArgs(address), tableName: table });
}

export interface SqliteTrigger {
  name: string;
  sql: string;
}

export interface SqliteStructure {
  columns: SqliteColumnInfo[];
  indexes: SqliteIndexInfo[];
  foreignKeys: SqliteForeignKeyInfo[];
  triggers: SqliteTrigger[];
}

/** How a table is built, read from the same copy as its rows. */
export async function readStructure(
  address: SqliteAddress,
  table: string,
): Promise<SqliteStructure> {
  const args = { ...addressArgs(address), tableName: table };
  const [columns, indexes, foreignKeys, triggers] = await Promise.all([
    invokeCommand("sqlite_table_columns", args),
    invokeCommand("sqlite_table_indexes", args),
    invokeCommand("sqlite_table_foreign_keys", args),
    runQuery(
      address,
      `SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ${sqlLiteral(table)} ORDER BY name`,
    ),
  ]);
  return {
    columns,
    indexes,
    foreignKeys,
    triggers: triggers.rows.map(([name, sql]) => ({
      name: typeof name === "string" ? name : "",
      sql: typeof sql === "string" ? sql : "",
    })),
  };
}

/** Plain rows of a table, one page (with one extra row to learn whether another page exists). */
export function readTablePage(
  address: SqliteAddress,
  table: string,
  offset: number,
  limit: number,
  orderBy: string | null,
  orderDir: "ASC" | "DESC" | null,
): Promise<SqliteQueryResult> {
  return invokeCommand("sqlite_table_rows", {
    ...addressArgs(address),
    tableName: table,
    offset,
    limit,
    ...(orderBy && orderDir ? { orderBy, orderDir } : {}),
  });
}

/** Writes on the copy at `address`. Only ever called for a file opened on this computer. */
export function runWrite(address: SqliteAddress, sql: string): Promise<SqliteQueryResult> {
  return invokeCommand("sqlite_execute_write", { ...addressArgs(address), sql });
}
