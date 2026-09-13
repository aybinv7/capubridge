import type {
  ReplayDatabaseChange,
  ReplayDatabaseChangeSummary,
  ReplayDatabaseSource,
} from "@/types/replay.types";
import type {
  IndexedDBChangeSummary,
  IndexedDBRecordChangeEntry,
} from "@/types/storageChanges.types";
import type { SqliteChangeSummary, SqliteRecordChange } from "@/types/sqliteChanges.types";
import type { SqliteColumnInfo } from "@/types/sqlite.types";
import type { IDBRecord } from "@capubridge/cdp-protocol";

export type ReplayDecoratedRecord = IDBRecord & {
  __changeId?: string;
  __changeOperation?: IndexedDBRecordChangeEntry["operation"];
  __changeObservedAt?: string;
  __changeDeleted?: boolean;
  __recordChange?: IndexedDBRecordChangeEntry;
};

export function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function isColumnInfoArray(value: unknown): value is SqliteColumnInfo[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Partial<SqliteColumnInfo>;
      return typeof item.name === "string" && typeof item.cid === "number";
    })
  );
}

export function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function parseRecord(raw: string | null): Record<string, unknown> | null {
  const parsed = parseJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

export function formatKeyLabel(key: unknown): string {
  if (typeof key === "string") return key;
  if (typeof key === "number" || typeof key === "bigint") return String(key);
  try {
    return JSON.stringify(key);
  } catch {
    return String(key);
  }
}

export function toIdbChangeSummary(summary: ReplayDatabaseChangeSummary): IndexedDBChangeSummary {
  return {
    add: summary.add,
    update: summary.update,
    delete: summary.delete,
    total: summary.total,
    latestAt: summary.latestMs === null ? null : `${summary.latestMs} ms`,
  };
}

export function toSqliteChangeSummary(summary: ReplayDatabaseChangeSummary): SqliteChangeSummary {
  return {
    add: summary.add,
    update: summary.update,
    delete: summary.delete,
    total: summary.total,
    latestAt: summary.latestMs === null ? null : `${summary.latestMs} ms`,
  };
}

export function makeIdbChangeEntry(
  source: ReplayDatabaseSource,
  change: ReplayDatabaseChange,
): IndexedDBRecordChangeEntry {
  const key = parseJson(change.keyJson) as IDBValidKey;
  return {
    id: String(change.id),
    kind: "record",
    source: "external",
    observedAt: `${change.tMs} ms`,
    origin: source.origin,
    databaseName: source.databaseName,
    objectStoreName: source.storeName,
    operation: change.operation,
    key,
    keyLabel: formatKeyLabel(key),
    beforeValue: parseJson(change.beforeJson),
    afterValue: parseJson(change.afterJson),
    fieldDiffs: [],
  };
}

export function decorateIdbRecord(
  record: IDBRecord,
  source: ReplayDatabaseSource,
  change: ReplayDatabaseChange | undefined,
): ReplayDecoratedRecord {
  if (!change) return record;
  const entry = makeIdbChangeEntry(source, change);
  return {
    ...record,
    __changeId: entry.id,
    __changeOperation: entry.operation,
    __changeObservedAt: entry.observedAt,
    __changeDeleted: entry.operation === "delete",
    __recordChange: entry,
  };
}

export function idbChangeToRecord(
  source: ReplayDatabaseSource,
  change: ReplayDatabaseChange,
): IDBRecord {
  const key = parseJson(change.keyJson) as IDBValidKey;
  const value =
    change.operation === "delete"
      ? parseJson(change.beforeJson)
      : parseJson(change.afterJson ?? change.beforeJson);
  return decorateIdbRecord({ key, value }, source, change);
}

export function sqliteMetadata(source: ReplayDatabaseSource) {
  return parseMetadata(source.metadataJson);
}

export function sqliteColumnsFromSource(
  source: ReplayDatabaseSource,
  records: Record<string, unknown>[],
) {
  const metadata = sqliteMetadata(source);
  if (isStringArray(metadata.columns) && metadata.columns.length > 0) return metadata.columns;
  if (isColumnInfoArray(metadata.columnInfo) && metadata.columnInfo.length > 0) {
    return metadata.columnInfo.map((column) => column.name);
  }
  return Object.keys(records[0] ?? {});
}

export function sqliteColumnInfoFromSource(source: ReplayDatabaseSource): SqliteColumnInfo[] {
  const metadata = sqliteMetadata(source);
  return isColumnInfoArray(metadata.columnInfo) ? metadata.columnInfo : [];
}

export function sqliteRecordToRow(columns: string[], record: Record<string, unknown>): unknown[] {
  return columns.map((column) => record[column] ?? null);
}

export function sqliteRecordChange(
  source: ReplayDatabaseSource,
  change: ReplayDatabaseChange,
): SqliteRecordChange {
  const metadata = sqliteMetadata(source);
  return {
    id: String(change.id),
    kind: "record",
    operation: change.operation,
    serial: typeof metadata.serial === "string" ? metadata.serial : "replay",
    packageName: typeof metadata.packageName === "string" ? metadata.packageName : source.origin,
    dbPath: typeof metadata.dbPath === "string" ? metadata.dbPath : source.databaseName,
    tableName: source.storeName,
    rowKey: change.keyJson,
    beforeValue: parseRecord(change.beforeJson),
    afterValue: parseRecord(change.afterJson),
    observedAt: `${change.tMs} ms`,
  };
}

export function orderKeyColumns(columns: SqliteColumnInfo[]): SqliteColumnInfo[] {
  return columns.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk);
}
