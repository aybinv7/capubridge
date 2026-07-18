import { invokeCommand } from "@/runtime/ipc/client";
import type {
  SqliteDbFile,
  SqliteTableInfo,
  SqliteColumnInfo,
  SqliteForeignKeyInfo,
  SqliteIndexInfo,
  SqliteQueryResult,
} from "@/types/sqlite.types";

export function useSQLite() {
  async function scanAllDatabases(serial: string): Promise<SqliteDbFile[]> {
    return invokeCommand("sqlite_scan_all_databases", { serial });
  }

  async function listDatabases(serial: string, pkg: string): Promise<SqliteDbFile[]> {
    return invokeCommand("sqlite_list_databases", {
      serial,
      package: pkg,
    });
  }

  async function openDatabase(
    serial: string,
    pkg: string,
    dbPath: string,
  ): Promise<SqliteTableInfo[]> {
    return invokeCommand("sqlite_open_database", {
      serial,
      package: pkg,
      dbPath,
    });
  }

  async function tableColumns(
    serial: string,
    pkg: string,
    dbPath: string,
    tableName: string,
  ): Promise<SqliteColumnInfo[]> {
    return invokeCommand("sqlite_table_columns", {
      serial,
      package: pkg,
      dbPath,
      tableName,
    });
  }

  async function tableIndexes(
    serial: string,
    pkg: string,
    dbPath: string,
    tableName: string,
  ): Promise<SqliteIndexInfo[]> {
    return invokeCommand("sqlite_table_indexes", {
      serial,
      package: pkg,
      dbPath,
      tableName,
    });
  }

  async function tableForeignKeys(
    serial: string,
    pkg: string,
    dbPath: string,
    tableName: string,
  ): Promise<SqliteForeignKeyInfo[]> {
    return invokeCommand("sqlite_table_foreign_keys", {
      serial,
      package: pkg,
      dbPath,
      tableName,
    });
  }

  async function tableRows(
    serial: string,
    pkg: string,
    dbPath: string,
    tableName: string,
    offset: number,
    limit: number,
    orderBy?: string,
    orderDir?: "ASC" | "DESC",
  ): Promise<SqliteQueryResult> {
    return invokeCommand("sqlite_table_rows", {
      serial,
      package: pkg,
      dbPath,
      tableName,
      offset,
      limit,
      orderBy: orderBy ?? undefined,
      orderDir: orderDir ?? undefined,
    });
  }

  async function executeQuery(
    serial: string,
    pkg: string,
    dbPath: string,
    sql: string,
  ): Promise<SqliteQueryResult> {
    return invokeCommand("sqlite_execute_query", {
      serial,
      package: pkg,
      dbPath,
      sql,
    });
  }

  async function executeWrite(
    serial: string,
    pkg: string,
    dbPath: string,
    sql: string,
  ): Promise<SqliteQueryResult> {
    return invokeCommand("sqlite_execute_write", {
      serial,
      package: pkg,
      dbPath,
      sql,
    });
  }

  async function exportBytes(serial: string, pkg: string, dbPath: string): Promise<Uint8Array> {
    const base64 = await invokeCommand("sqlite_export_bytes", {
      serial,
      package: pkg,
      dbPath,
    });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function refreshDatabase(
    serial: string,
    pkg: string,
    dbPath: string,
  ): Promise<SqliteTableInfo[]> {
    return invokeCommand("sqlite_refresh_database", {
      serial,
      package: pkg,
      dbPath,
    }) as unknown as Promise<SqliteTableInfo[]>;
  }

  function closeDatabase(serial: string, pkg: string, dbPath: string): void {
    void invokeCommand("sqlite_close_database", {
      serial,
      package: pkg,
      dbPath,
    });
  }

  return {
    scanAllDatabases,
    listDatabases,
    openDatabase,
    tableColumns,
    tableIndexes,
    tableForeignKeys,
    tableRows,
    executeQuery,
    executeWrite,
    exportBytes,
    refreshDatabase,
    closeDatabase,
  };
}
