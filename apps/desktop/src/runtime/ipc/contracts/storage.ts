import type {
  SqliteColumnInfo,
  SqliteDbFile,
  SqliteForeignKeyInfo,
  SqliteIndexInfo,
  SqliteQueryResult,
  SqliteTableInfo,
} from "@/types/sqlite.types";
import type { IpcCommand } from "@/runtime/ipc/contracts/common";

export interface SqliteFileStat {
  size: number;
  modifiedAt: number;
}

export interface OpfsFileStat {
  size: number;
  lastModified: number;
}

export interface OpfsPullResult {
  path: string;
  size: number;
  lastModified: number;
}

export interface OpfsSaveResult {
  size: number;
  lastModified: number;
  /** The app wrote to the file while it was being copied. */
  changed: boolean;
}

/** One staged change of an opened file: an UPDATE or an INSERT of exactly one row. */
export interface SqliteChangeStatement {
  sql: string;
}

export interface SqliteChangesetResult {
  /** The rowid each INSERT was given, `null` for an UPDATE. */
  insertedRowIds: (number | null)[];
  durationMs: number;
}

interface SqliteDatabaseArgs {
  serial: string;
  package: string;
  dbPath: string;
}

interface SqliteTableArgs extends SqliteDatabaseArgs {
  tableName: string;
}

export interface StorageCommandMap {
  sqlite_list_databases: IpcCommand<{ serial: string; package: string }, SqliteDbFile[]>;
  sqlite_scan_all_databases: IpcCommand<{ serial: string }, SqliteDbFile[]>;
  sqlite_stat_database: IpcCommand<
    { serial: string; package: string; dbPath: string },
    SqliteFileStat
  >;
  sqlite_open_database: IpcCommand<SqliteDatabaseArgs, SqliteTableInfo[]>;
  sqlite_refresh_database: IpcCommand<SqliteDatabaseArgs, SqliteTableInfo[]>;
  sqlite_close_database: IpcCommand<SqliteDatabaseArgs, void>;
  sqlite_save_local_bytes: IpcCommand<{ name: string; base64Data: string }, string>;
  sqlite_overwrite_local_bytes: IpcCommand<{ path: string; base64Data: string }, void>;
  opfs_stat_file: IpcCommand<{ wsUrl: string; path: string }, OpfsFileStat>;
  opfs_pull_sqlite: IpcCommand<
    {
      wsUrl: string;
      path: string;
      label: string;
      stripSahPoolHeader: boolean;
    },
    OpfsPullResult
  >;
  opfs_save_file: IpcCommand<
    { wsUrl: string; path: string; destination: string; saveId?: string },
    OpfsSaveResult
  >;
  opfs_cancel_save: IpcCommand<{ saveId: string }, void>;
  sqlite_table_columns: IpcCommand<SqliteTableArgs, SqliteColumnInfo[]>;
  sqlite_table_indexes: IpcCommand<SqliteTableArgs, SqliteIndexInfo[]>;
  sqlite_table_foreign_keys: IpcCommand<SqliteTableArgs, SqliteForeignKeyInfo[]>;
  sqlite_table_rows: IpcCommand<
    SqliteTableArgs & {
      offset: number;
      limit: number;
      orderBy?: string;
      orderDir?: string;
    },
    SqliteQueryResult
  >;
  sqlite_execute_query: IpcCommand<
    SqliteDatabaseArgs & { sql: string; fullValues?: boolean },
    SqliteQueryResult
  >;
  sqlite_execute_write: IpcCommand<SqliteDatabaseArgs & { sql: string }, SqliteQueryResult>;
  sqlite_export_bytes: IpcCommand<SqliteDatabaseArgs, string>;
  sqlite_export_dump: IpcCommand<SqliteDatabaseArgs & { dest: string }, number>;
  sqlite_import_dump: IpcCommand<SqliteDatabaseArgs & { sql: string }, void>;
  sqlite_apply_changeset: IpcCommand<
    SqliteDatabaseArgs & { statements: SqliteChangeStatement[] },
    SqliteChangesetResult
  >;
}
