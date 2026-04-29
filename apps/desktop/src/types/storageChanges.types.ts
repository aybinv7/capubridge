export type IndexedDBChangeOperation = "add" | "update" | "delete";

export type IndexedDBChangeKind = "record" | "system";

export type IndexedDBFieldDiffType = "added" | "removed" | "changed";

export interface IndexedDBFieldDiff {
  path: string;
  type: IndexedDBFieldDiffType;
  before?: unknown;
  after?: unknown;
}

export interface IndexedDBChangeSummary {
  add: number;
  update: number;
  delete: number;
  total: number;
  latestAt: string | null;
}

export interface IndexedDBStoreCatalogEntry {
  storeKey: string;
  origin: string;
  databaseName: string;
  objectStoreName: string;
  recordCount: number;
}

export interface IndexedDBTrackedRecordSnapshot {
  key: IDBValidKey;
  keyLabel: string;
  stableValue: string;
  value: unknown;
}

export interface IndexedDBStoreSnapshot {
  storeKey: string;
  origin: string;
  databaseName: string;
  objectStoreName: string;
  tracked: boolean;
  truncated: boolean;
  reason?: string;
  recordCount: number;
  lastSyncedAt: string;
  records: Record<string, IndexedDBTrackedRecordSnapshot>;
}

export interface IndexedDBTrackingSession {
  targetId: string;
  origin: string;
  startedAt: string;
}

export interface IndexedDBRecordChangeEntry {
  id: string;
  kind: "record";
  source: "external";
  observedAt: string;
  origin: string;
  databaseName: string;
  objectStoreName: string;
  operation: IndexedDBChangeOperation;
  key: IDBValidKey;
  keyLabel: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  fieldDiffs: IndexedDBFieldDiff[];
}

export interface IndexedDBSystemChangeEntry {
  id: string;
  kind: "system";
  source: "external";
  observedAt: string;
  origin: string;
  databaseName?: string;
  objectStoreName?: string;
  message: string;
}

export type IndexedDBChangeEntry = IndexedDBRecordChangeEntry | IndexedDBSystemChangeEntry;
