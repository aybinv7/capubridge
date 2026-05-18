import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { SqliteChangeOperation } from "@/types/sqliteChanges.types";

const MAX_TABLE_OPS = 200;
const MAX_TOTAL_OPS = 1000;
const MAX_ROWS_PER_TABLE = 20_000;

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) sqlJsPromise = initSqlJs({ locateFile: () => wasmUrl });
  return sqlJsPromise;
}

export interface SyntheticRowChange {
  tableName: string;
  operation: SqliteChangeOperation;
  rowKey: string;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
}

export interface DiffResult {
  changes: SyntheticRowChange[];
  truncated: boolean;
  skippedTablesWithoutPk: string[];
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function quoteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function listTables(db: Database): string[] {
  const res = db.exec(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  if (!res.length) return [];
  return res[0].values.map((row) => row[0] as string);
}

function listPkColumns(db: Database, table: string): string[] {
  const res = db.exec(`PRAGMA table_info(${quoteIdent(table)})`);
  if (!res.length) return [];
  return res[0].values
    .filter((row) => (row[5] as number) > 0)
    .sort((a, b) => (a[5] as number) - (b[5] as number))
    .map((row) => row[1] as string);
}

function hasTable(db: Database, table: string): boolean {
  const res = db.exec(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ${quoteString(table)}`,
  );
  return res.length > 0 && res[0].values.length > 0;
}

interface RowSnapshot {
  byKey: Map<string, Record<string, unknown>>;
  truncated: boolean;
}

function readRows(db: Database, table: string, pkCols: string[]): RowSnapshot {
  const res = db.exec(`SELECT * FROM ${quoteIdent(table)} LIMIT ${MAX_ROWS_PER_TABLE + 1}`);
  const byKey = new Map<string, Record<string, unknown>>();
  if (!res.length) return { byKey, truncated: false };
  const { columns, values } = res[0];
  const truncated = values.length > MAX_ROWS_PER_TABLE;
  const limit = Math.min(values.length, MAX_ROWS_PER_TABLE);
  for (let i = 0; i < limit; i++) {
    const row = values[i];
    const record: Record<string, unknown> = {};
    for (let c = 0; c < columns.length; c++) {
      record[columns[c]] = normaliseCell(row[c]);
    }
    const key = JSON.stringify(pkCols.map((c) => record[c] ?? null));
    byKey.set(key, record);
  }
  return { byKey, truncated };
}

function normaliseCell(value: unknown): unknown {
  if (value instanceof Uint8Array) return `[BLOB ${value.byteLength}B]`;
  return value;
}

function valuesEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  skip: Set<string>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    const setA = new Set(aKeys);
    for (const k of bKeys) if (!setA.has(k)) return false;
  }
  for (const key of aKeys) {
    if (skip.has(key)) continue;
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) return false;
  }
  return true;
}

export async function diffSqliteSnapshots(
  beforeBytes: Uint8Array,
  afterBytes: Uint8Array,
): Promise<DiffResult> {
  const SQL = await getSqlJs();
  const before = new SQL.Database(beforeBytes);
  const after = new SQL.Database(afterBytes);
  const out: SyntheticRowChange[] = [];
  const skipped: string[] = [];
  let truncated = false;

  try {
    for (const table of listTables(after)) {
      if (out.length >= MAX_TOTAL_OPS) {
        truncated = true;
        break;
      }
      const pkCols = listPkColumns(after, table);
      if (pkCols.length === 0) {
        skipped.push(table);
        continue;
      }

      const beforeRows = hasTable(before, table)
        ? readRows(before, table, pkCols)
        : { byKey: new Map<string, Record<string, unknown>>(), truncated: false };
      const afterRows = readRows(after, table, pkCols);
      if (beforeRows.truncated || afterRows.truncated) truncated = true;

      const skip = new Set(pkCols);
      const tableOps: SyntheticRowChange[] = [];

      for (const [key, row] of afterRows.byKey) {
        if (tableOps.length >= MAX_TABLE_OPS) break;
        const prev = beforeRows.byKey.get(key);
        if (!prev) {
          tableOps.push({
            tableName: table,
            operation: "add",
            rowKey: key,
            beforeValue: null,
            afterValue: row,
          });
        } else if (!valuesEqual(prev, row, skip)) {
          tableOps.push({
            tableName: table,
            operation: "update",
            rowKey: key,
            beforeValue: prev,
            afterValue: row,
          });
        }
      }
      for (const [key, row] of beforeRows.byKey) {
        if (tableOps.length >= MAX_TABLE_OPS) break;
        if (!afterRows.byKey.has(key)) {
          tableOps.push({
            tableName: table,
            operation: "delete",
            rowKey: key,
            beforeValue: row,
            afterValue: null,
          });
        }
      }

      for (const op of tableOps) {
        if (out.length >= MAX_TOTAL_OPS) {
          truncated = true;
          break;
        }
        out.push(op);
      }
    }
  } finally {
    before.close();
    after.close();
  }

  return { changes: out, truncated, skippedTablesWithoutPk: skipped };
}
