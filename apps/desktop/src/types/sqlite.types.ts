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
  stripSahPoolHeader?: boolean;
  sourceTech?: SqliteSourceTech;
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
  badgeClass: string;
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
