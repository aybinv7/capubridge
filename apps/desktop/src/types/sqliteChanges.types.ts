export type SqliteChangeOperation = "add" | "update" | "delete";

export interface SqliteChangeSummary {
  add: number;
  update: number;
  delete: number;
  total: number;
  latestAt: string | null;
}

export interface SqliteRecordChange {
  id: string;
  kind: "record";
  operation: SqliteChangeOperation;
  serial: string;
  packageName: string;
  dbPath: string;
  tableName: string;
  rowKey: string;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
  observedAt: string;
}

export interface SqliteSystemChange {
  id: string;
  kind: "system";
  serial: string;
  packageName: string;
  dbPath: string;
  tableName?: string;
  message: string;
  observedAt: string;
}

export type SqliteChangeEntry = SqliteRecordChange | SqliteSystemChange;
