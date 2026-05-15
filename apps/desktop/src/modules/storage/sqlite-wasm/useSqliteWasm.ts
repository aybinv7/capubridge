import { ref, shallowRef } from "vue";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({ locateFile: () => wasmUrl });
  }
  return sqlJsPromise;
}

export interface SqlObject {
  name: string;
  type: "table" | "view";
  sql: string;
  rowCount: number;
}

export interface SqlColumn {
  cid: number;
  name: string;
  type: string;
  notnull: boolean;
  defaultValue: string | null;
  pk: number;
}

export interface SqlIndex {
  seq: number;
  name: string;
  unique: boolean;
  origin: string;
  partial: boolean;
}

export interface SqlForeignKey {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  onUpdate: string;
  onDelete: string;
  match: string;
}

export interface SqlExecResult {
  columns: string[];
  rows: Array<Array<unknown>>;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function useSqliteWasm() {
  const db = shallowRef<Database | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const dbSize = ref(0);

  async function open(bytes: Uint8Array) {
    loading.value = true;
    error.value = null;
    try {
      const SQL = await getSqlJs();
      if (db.value) db.value.close();
      db.value = new SQL.Database(bytes);
      dbSize.value = bytes.byteLength;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function close() {
    if (db.value) {
      db.value.close();
      db.value = null;
    }
    dbSize.value = 0;
  }

  function listObjects(): SqlObject[] {
    const d = db.value;
    if (!d) return [];
    const res = d.exec(
      "SELECT name, type, sql FROM sqlite_master " +
        "WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' " +
        "ORDER BY type, name",
    );
    if (!res.length) return [];
    return res[0].values.map((row) => {
      const name = row[0] as string;
      const type = (row[1] as string) === "view" ? "view" : "table";
      const sql = (row[2] as string) ?? "";
      let rowCount = 0;
      try {
        const c = d.exec(`SELECT COUNT(*) FROM ${quoteIdent(name)}`);
        rowCount = (c[0]?.values[0]?.[0] as number) ?? 0;
      } catch {
        rowCount = 0;
      }
      return { name, type, sql, rowCount };
    });
  }

  function listColumns(tableName: string): SqlColumn[] {
    const d = db.value;
    if (!d) return [];
    const res = d.exec(`PRAGMA table_info(${quoteIdent(tableName)})`);
    if (!res.length) return [];
    return res[0].values.map((row) => ({
      cid: row[0] as number,
      name: row[1] as string,
      type: (row[2] as string) ?? "",
      notnull: row[3] === 1,
      defaultValue: row[4] === null ? null : String(row[4]),
      pk: row[5] as number,
    }));
  }

  function listIndexes(tableName: string): SqlIndex[] {
    const d = db.value;
    if (!d) return [];
    const res = d.exec(`PRAGMA index_list(${quoteIdent(tableName)})`);
    if (!res.length) return [];
    return res[0].values.map((row) => ({
      seq: row[0] as number,
      name: row[1] as string,
      unique: row[2] === 1,
      origin: (row[3] as string) ?? "",
      partial: row[4] === 1,
    }));
  }

  function listForeignKeys(tableName: string): SqlForeignKey[] {
    const d = db.value;
    if (!d) return [];
    const res = d.exec(`PRAGMA foreign_key_list(${quoteIdent(tableName)})`);
    if (!res.length) return [];
    return res[0].values.map((row) => ({
      id: row[0] as number,
      seq: row[1] as number,
      table: (row[2] as string) ?? "",
      from: (row[3] as string) ?? "",
      to: (row[4] as string) ?? "",
      onUpdate: (row[5] as string) ?? "",
      onDelete: (row[6] as string) ?? "",
      match: (row[7] as string) ?? "",
    }));
  }

  function getRows(tableName: string, offset: number, limit: number): SqlExecResult {
    const d = db.value;
    if (!d) return { columns: [], rows: [] };
    const res = d.exec(`SELECT * FROM ${quoteIdent(tableName)} LIMIT ${limit} OFFSET ${offset}`);
    if (!res.length) return { columns: [], rows: [] };
    return { columns: res[0].columns, rows: res[0].values };
  }

  function exec(sql: string): SqlExecResult[] {
    const d = db.value;
    if (!d) throw new Error("Database not open");
    const res = d.exec(sql);
    return res.map((r) => ({ columns: r.columns, rows: r.values }));
  }

  function getSqliteVersion(): string {
    const d = db.value;
    if (!d) return "";
    const r = d.exec("SELECT sqlite_version()");
    return (r[0]?.values[0]?.[0] as string) ?? "";
  }

  function getPragma(name: string): unknown {
    const d = db.value;
    if (!d) return null;
    const r = d.exec(`PRAGMA ${name}`);
    return r[0]?.values[0]?.[0] ?? null;
  }

  return {
    db,
    loading,
    error,
    dbSize,
    open,
    close,
    listObjects,
    listColumns,
    listIndexes,
    listForeignKeys,
    getRows,
    exec,
    getSqliteVersion,
    getPragma,
  };
}
