export interface SqliteDbFile {
  name: string;
  path: string;
  size: number;
  packageName?: string;
  sourceKind?: "native-android" | "opfs" | "jeep-sqlite" | "imported";
  sourceLabel?: string;
  sourceTargetId?: string;
  sourceIdbName?: string;
  sourceStoreName?: string;
  sourceKey?: string;
  sourceOpfsPath?: string;
  sourceOpfsDirectory?: string;
  /** For a file opened on this computer: the file that was picked, which saving writes to. */
  sourceFilePath?: string;
  /** The working copy of an opened file holds changes not written to its file yet. */
  unsavedToSource?: boolean;
  stripSahPoolHeader?: boolean;
  sourceTech?: SqliteSourceTech;
  /** Listed from an earlier discovery; its WebView cannot be reached right now. */
  unreachable?: boolean;
}

export type SqliteSourceTech =
  | "native-android"
  | "sqlite-wasm-opfsdb"
  | "sqlite-wasm-sah-pool"
  | "wa-sqlite-opfs"
  | "jeep-sqlite"
  | "imported";

export interface SqliteSourceDescriptor {
  label: string;
  title: string;
  description: string;
  packageName?: string;
}

export interface SqliteTableInfo {
  name: string;
  tableType: string;
  rowCount: number;
  sql: string;
}

export interface SqliteColumnInfo {
  cid: number;
  name: string;
  colType: string;
  notnull: boolean;
  defaultValue: string | null;
  /**
   * 1-based position of this column within the primary key, or 0 when the
   * column is not part of it. Composite keys rely on this ordinal, so compare
   * with `> 0` rather than treating it as a flag.
   */
  pk: number;
}

export interface SqliteIndexInfo {
  name: string;
  unique: boolean;
  columns: string[];
  sql: string | null;
}

export interface SqliteForeignKeyInfo {
  id: number;
  seq: number;
  fromColumn: string;
  toTable: string;
  toColumn: string | null;
  onUpdate: string | null;
  onDelete: string | null;
  matchClause: string | null;
}

/** A foreign-key column of a table and whether an index starts with it. */
export interface SqliteForeignKeyFact {
  column: string;
  targetTable: string;
  indexed: boolean;
}

/** What the overview needs of one table or view (`sqlite_database_facts`). */
export interface SqliteTableFacts {
  name: string;
  kind: string;
  withoutRowid: boolean;
  columns: string[];
  hasPrimaryKey: boolean;
  indexCount: number;
  /** Bytes on disk of the table and its indexes; `null` when `dbstat` cannot be read. */
  bytes: number | null;
  foreignKeys: SqliteForeignKeyFact[];
}

/** The database at a glance: the file, how SQLite keeps it, and every table's facts. */
export interface SqliteDatabaseFacts {
  fileBytes: number;
  walBytes: number | null;
  pageSize: number;
  pageCount: number;
  freelistCount: number;
  journalMode: string;
  userVersion: number;
  encoding: string;
  sizesKnown: boolean;
  tables: SqliteTableFacts[];
}

export interface SqliteQueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  changes: number;
  durationMs: number;
}

export interface SqliteSession {
  serial: string;
  package: string;
  dbPath: string;
  dbName: string;
  tables: SqliteTableInfo[];
}
