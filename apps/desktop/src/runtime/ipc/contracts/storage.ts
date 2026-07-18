import type {
  SqliteColumnInfo,
  SqliteDbFile,
  SqliteForeignKeyInfo,
  SqliteIndexInfo,
  SqliteQueryResult,
  SqliteTableInfo,
} from "@/types/sqlite.types";
import type { IpcCommand } from "@/runtime/ipc/contracts/common";

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
  sqlite_open_database: IpcCommand<SqliteDatabaseArgs, SqliteTableInfo[]>;
  sqlite_refresh_database: IpcCommand<SqliteDatabaseArgs, SqliteTableInfo[]>;
  sqlite_close_database: IpcCommand<SqliteDatabaseArgs, void>;
  sqlite_save_local_bytes: IpcCommand<{ name: string; base64Data: string }, string>;
  sqlite_overwrite_local_bytes: IpcCommand<{ path: string; base64Data: string }, void>;
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
  sqlite_execute_query: IpcCommand<SqliteDatabaseArgs & { sql: string }, SqliteQueryResult>;
  sqlite_execute_write: IpcCommand<SqliteDatabaseArgs & { sql: string }, SqliteQueryResult>;
  sqlite_export_bytes: IpcCommand<SqliteDatabaseArgs, string>;
}
