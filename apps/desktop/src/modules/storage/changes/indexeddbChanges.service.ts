import { IDBDomain } from "utils";
import type { IDBRecord, StoreInfo } from "utils";
import type {
  IndexedDBChangeEntry,
  IndexedDBFieldDiff,
  IndexedDBStoreCatalogEntry,
  IndexedDBStoreSnapshot,
  IndexedDBTrackedRecordSnapshot,
} from "@/types/storageChanges.types";

export const IDB_CHANGE_SNAPSHOT_PAGE_SIZE = 250;
export const IDB_CHANGE_MAX_TRACKED_RECORDS_PER_STORE = 1500;
export const IDB_CHANGE_MAX_FEED_ENTRIES = 400;

const MAX_FIELD_DIFFS_PER_CHANGE = 64;

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function isTypedArray(value: unknown): value is ArrayBufferView {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return { __type: "Date", value: value.toISOString() };
  }

  if (value instanceof ArrayBuffer) {
    return { __type: "ArrayBuffer", byteLength: value.byteLength };
  }

  if (isTypedArray(value)) {
    return {
      __type: value.constructor.name,
      values: Array.from(value as unknown as ArrayLike<number>),
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (value instanceof Map) {
    return {
      __type: "Map",
      entries: Array.from(value.entries())
        .map(([key, entryValue]) => [normalizeValue(key), normalizeValue(entryValue)])
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    };
  }

  if (value instanceof Set) {
    return {
      __type: "Set",
      values: Array.from(value.values()).map((entry) => normalizeValue(entry)),
    };
  }

  if (isPlainObject(value)) {
    const normalized: Record<string, unknown> = {};

    for (const key of Object.keys(value).sort()) {
      normalized[key] = normalizeValue(value[key]);
    }

    return normalized;
  }

  if (typeof value === "bigint") {
    return { __type: "BigInt", value: value.toString() };
  }

  return value;
}

function stableSerialize(value: unknown): string {
  try {
    return JSON.stringify(normalizeValue(value));
  } catch {
    return JSON.stringify(String(value));
  }
}

function normalizeKey(key: IDBValidKey): unknown {
  if (key instanceof Date) {
    return { __type: "Date", value: key.toISOString() };
  }

  if (Array.isArray(key)) {
    return key.map((entry) => normalizeKey(entry as IDBValidKey));
  }

  return key;
}

export function buildStoreKey(
  origin: string,
  databaseName: string,
  objectStoreName: string,
): string {
  return `${origin}::${databaseName}::${objectStoreName}`;
}

export function serializeKey(key: IDBValidKey): string {
  return stableSerialize(normalizeKey(key));
}

export function formatKeyLabel(key: IDBValidKey): string {
  if (typeof key === "string") return key;
  if (typeof key === "number" || typeof key === "bigint") return String(key);
  if (key instanceof Date) return key.toISOString();
  return stableSerialize(normalizeKey(key));
}

function buildSnapshotRecord(record: IDBRecord): IndexedDBTrackedRecordSnapshot {
  return {
    key: record.key,
    keyLabel: formatKeyLabel(record.key),
    stableValue: stableSerialize(record.value),
    value: normalizeValue(record.value),
  };
}

function compareCatalog(
  left: IndexedDBStoreCatalogEntry,
  right: IndexedDBStoreCatalogEntry,
): number {
  const databaseComparison = left.databaseName.localeCompare(right.databaseName);
  if (databaseComparison !== 0) return databaseComparison;
  return left.objectStoreName.localeCompare(right.objectStoreName);
}

export async function fetchOriginCatalog(
  domain: IDBDomain,
  origin: string,
): Promise<IndexedDBStoreCatalogEntry[]> {
  const databases = (await domain.discoverDatabases()).filter((entry) => entry.origin === origin);
  const catalog: IndexedDBStoreCatalogEntry[] = [];

  for (const database of databases) {
    const storeInfoByName = new Map<string, StoreInfo>();

    try {
      const storeInfo = await domain.getStoreInfo(database.name, origin);

      for (const store of storeInfo) {
        storeInfoByName.set(store.name, store);
      }
    } catch {}

    for (const objectStoreName of database.objectStoreNames) {
      catalog.push({
        storeKey: buildStoreKey(origin, database.name, objectStoreName),
        origin,
        databaseName: database.name,
        objectStoreName,
        recordCount: storeInfoByName.get(objectStoreName)?.recordCount ?? 0,
      });
    }
  }

  return catalog.sort(compareCatalog);
}

export async function captureStoreSnapshot(
  domain: IDBDomain,
  descriptor: IndexedDBStoreCatalogEntry,
): Promise<IndexedDBStoreSnapshot> {
  const syncedAt = new Date().toISOString();

  if (descriptor.recordCount > IDB_CHANGE_MAX_TRACKED_RECORDS_PER_STORE) {
    return {
      storeKey: descriptor.storeKey,
      origin: descriptor.origin,
      databaseName: descriptor.databaseName,
      objectStoreName: descriptor.objectStoreName,
      tracked: false,
      truncated: true,
      reason: `Store exceeds ${IDB_CHANGE_MAX_TRACKED_RECORDS_PER_STORE} tracked records`,
      recordCount: descriptor.recordCount,
      lastSyncedAt: syncedAt,
      records: {},
    };
  }

  try {
    const records: Record<string, IndexedDBTrackedRecordSnapshot> = {};
    let skipCount = 0;

    for (;;) {
      const response = await domain.getData({
        securityOrigin: descriptor.origin,
        databaseName: descriptor.databaseName,
        objectStoreName: descriptor.objectStoreName,
        skipCount,
        pageSize: IDB_CHANGE_SNAPSHOT_PAGE_SIZE,
      });

      for (const record of response.records) {
        records[serializeKey(record.key)] = buildSnapshotRecord(record);
      }

      skipCount += response.records.length;

      if (skipCount > IDB_CHANGE_MAX_TRACKED_RECORDS_PER_STORE) {
        return {
          storeKey: descriptor.storeKey,
          origin: descriptor.origin,
          databaseName: descriptor.databaseName,
          objectStoreName: descriptor.objectStoreName,
          tracked: false,
          truncated: true,
          reason: `Store exceeds ${IDB_CHANGE_MAX_TRACKED_RECORDS_PER_STORE} tracked records`,
          recordCount: Math.max(descriptor.recordCount, skipCount),
          lastSyncedAt: syncedAt,
          records: {},
        };
      }

      if (!response.hasMore || response.records.length === 0) {
        return {
          storeKey: descriptor.storeKey,
          origin: descriptor.origin,
          databaseName: descriptor.databaseName,
          objectStoreName: descriptor.objectStoreName,
          tracked: true,
          truncated: false,
          recordCount: Math.max(descriptor.recordCount, skipCount),
          lastSyncedAt: syncedAt,
          records,
        };
      }
    }
  } catch (error) {
    return {
      storeKey: descriptor.storeKey,
      origin: descriptor.origin,
      databaseName: descriptor.databaseName,
      objectStoreName: descriptor.objectStoreName,
      tracked: false,
      truncated: false,
      reason: String(error),
      recordCount: descriptor.recordCount,
      lastSyncedAt: syncedAt,
      records: {},
    };
  }
}

function buildPath(parentPath: string, segment: string): string {
  if (!parentPath) return segment;
  if (segment.startsWith("[")) return `${parentPath}${segment}`;
  return `${parentPath}.${segment}`;
}

function pushFieldDiff(
  output: IndexedDBFieldDiff[],
  path: string,
  type: IndexedDBFieldDiff["type"],
  before?: unknown,
  after?: unknown,
) {
  if (output.length >= MAX_FIELD_DIFFS_PER_CHANGE) return;

  output.push({
    path: path || "$",
    type,
    before,
    after,
  });
}

function collectFieldDiffs(
  before: unknown,
  after: unknown,
  path: string,
  output: IndexedDBFieldDiff[],
) {
  if (output.length >= MAX_FIELD_DIFFS_PER_CHANGE) return;
  if (stableSerialize(before) === stableSerialize(after)) return;

  if (before === undefined) {
    pushFieldDiff(output, path, "added", before, after);
    return;
  }

  if (after === undefined) {
    pushFieldDiff(output, path, "removed", before, after);
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const maxLength = Math.max(before.length, after.length);

    for (let index = 0; index < maxLength; index += 1) {
      collectFieldDiffs(before[index], after[index], buildPath(path, `[${index}]`), output);
      if (output.length >= MAX_FIELD_DIFFS_PER_CHANGE) return;
    }

    return;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of Array.from(keys).sort()) {
      collectFieldDiffs(before[key], after[key], buildPath(path, key), output);
      if (output.length >= MAX_FIELD_DIFFS_PER_CHANGE) return;
    }

    return;
  }

  pushFieldDiff(output, path, "changed", before, after);
}

function createRecordChangeEntry(
  observedAt: string,
  origin: string,
  databaseName: string,
  objectStoreName: string,
  operation: "add" | "update" | "delete",
  beforeRecord?: IndexedDBTrackedRecordSnapshot,
  afterRecord?: IndexedDBTrackedRecordSnapshot,
): IndexedDBChangeEntry {
  const key = afterRecord?.key ?? beforeRecord?.key;

  if (key === undefined) {
    return {
      id: makeId(),
      kind: "system",
      source: "external",
      observedAt,
      origin,
      databaseName,
      objectStoreName,
      message: "Change detected but record key could not be resolved",
    };
  }

  const fieldDiffs: IndexedDBFieldDiff[] = [];

  if (operation === "update") {
    collectFieldDiffs(beforeRecord?.value, afterRecord?.value, "", fieldDiffs);
  }

  return {
    id: makeId(),
    kind: "record",
    source: "external",
    observedAt,
    origin,
    databaseName,
    objectStoreName,
    operation,
    key,
    keyLabel: afterRecord?.keyLabel ?? beforeRecord?.keyLabel ?? formatKeyLabel(key),
    beforeValue: beforeRecord?.value,
    afterValue: afterRecord?.value,
    fieldDiffs,
  };
}

export function diffStoreSnapshots(
  before: IndexedDBStoreSnapshot,
  after: IndexedDBStoreSnapshot,
  observedAt: string,
): IndexedDBChangeEntry[] {
  const snapshotKeys = Array.from(
    new Set([...Object.keys(before.records), ...Object.keys(after.records)]),
  ).sort((left, right) => {
    const leftLabel = before.records[left]?.keyLabel ?? after.records[left]?.keyLabel ?? left;
    const rightLabel = before.records[right]?.keyLabel ?? after.records[right]?.keyLabel ?? right;
    return leftLabel.localeCompare(rightLabel);
  });

  const changes: IndexedDBChangeEntry[] = [];

  for (const snapshotKey of snapshotKeys) {
    const previousRecord = before.records[snapshotKey];
    const nextRecord = after.records[snapshotKey];

    if (!previousRecord && nextRecord) {
      changes.push(
        createRecordChangeEntry(
          observedAt,
          after.origin,
          after.databaseName,
          after.objectStoreName,
          "add",
          undefined,
          nextRecord,
        ),
      );
      continue;
    }

    if (previousRecord && !nextRecord) {
      changes.push(
        createRecordChangeEntry(
          observedAt,
          before.origin,
          before.databaseName,
          before.objectStoreName,
          "delete",
          previousRecord,
          undefined,
        ),
      );
      continue;
    }

    if (previousRecord && nextRecord && previousRecord.stableValue !== nextRecord.stableValue) {
      changes.push(
        createRecordChangeEntry(
          observedAt,
          after.origin,
          after.databaseName,
          after.objectStoreName,
          "update",
          previousRecord,
          nextRecord,
        ),
      );
    }
  }

  return changes;
}
