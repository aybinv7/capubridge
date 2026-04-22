export interface SqliteDbFile {
  name: string;
  path: string;
  size: number;
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
  pk: boolean;
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
