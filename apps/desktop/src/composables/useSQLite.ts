import { invoke } from "@tauri-apps/api/core";
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
    return invoke<SqliteDbFile[]>("sqlite_scan_all_databases", { serial });
  }

  async function listDatabases(serial: string, pkg: string): Promise<SqliteDbFile[]> {
    return invoke<SqliteDbFile[]>("sqlite_list_databases", {
      serial,
      package: pkg,
    });
  }

  async function openDatabase(
    serial: string,
    pkg: string,
    dbPath: string,
  ): Promise<SqliteTableInfo[]> {
    return invoke<SqliteTableInfo[]>("sqlite_open_database", {
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
    return invoke<SqliteColumnInfo[]>("sqlite_table_columns", {
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
    return invoke<SqliteIndexInfo[]>("sqlite_table_indexes", {
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
    return invoke<SqliteForeignKeyInfo[]>("sqlite_table_foreign_keys", {
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
    return invoke<SqliteQueryResult>("sqlite_table_rows", {
      serial,
      package: pkg,
      dbPath,
      tableName,
      offset,
      limit,
      orderBy: orderBy ?? null,
      orderDir: orderDir ?? null,
    });
  }

  async function executeQuery(
    serial: string,
    pkg: string,
    dbPath: string,
    sql: string,
  ): Promise<SqliteQueryResult> {
    return invoke<SqliteQueryResult>("sqlite_execute_query", {
      serial,
      package: pkg,
      dbPath,
      sql,
    });
  }

  async function refreshDatabase(
    serial: string,
    pkg: string,
    dbPath: string,
  ): Promise<SqliteTableInfo[]> {
    return invoke<SqliteQueryResult>("sqlite_refresh_database", {
      serial,
      package: pkg,
      dbPath,
    }) as unknown as Promise<SqliteTableInfo[]>;
  }

  function closeDatabase(serial: string, pkg: string, dbPath: string): void {
    void invoke("sqlite_close_database", {
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
    refreshDatabase,
    closeDatabase,
  };
}
