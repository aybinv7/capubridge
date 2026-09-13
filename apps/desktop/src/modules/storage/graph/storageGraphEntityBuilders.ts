import { type IDBDatabaseInfo, type IDBRecord, type StoreInfo } from "@capubridge/cdp-protocol";
import {
  dedupeGraphFields,
  normalizeGraphFieldName,
} from "@/modules/storage/graph/storageGraph.utils";
import type { StorageGraphEntityDescriptor, StorageGraphField } from "@/types/storageGraph.types";

export function makeGraphId(...parts: string[]): string {
  return parts.map((part) => encodeURIComponent(part)).join("::");
}

function parseJsonValue(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

function inferValueType(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (value instanceof Date) {
    return "date";
  }

  switch (typeof value) {
    case "string":
      return /^\d{4}-\d{2}-\d{2}(T|\s|$)/.test(value) ? "date" : "string";
    case "number":
      return Number.isInteger(value) ? "int" : "float";
    case "boolean":
      return "bool";
    case "object":
      return "object";
    default:
      return "unknown";
  }
}

function extractObjectFieldNames(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    const names = new Set<string>();
    for (const item of value.slice(0, 5)) {
      for (const key of extractObjectFieldNames(item)) {
        names.add(key);
      }
    }
    return Array.from(names);
  }

  return Object.keys(value as Record<string, unknown>);
}

function extractObjectEntries(value: unknown): Array<[string, unknown]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as Record<string, unknown>);
}

function makeField(
  name: string,
  kind: StorageGraphField["kind"],
  extras?: Partial<StorageGraphField>,
): StorageGraphField {
  return {
    id: `${kind}:${name}`,
    name,
    normalizedName: normalizeGraphFieldName(name),
    kind,
    ...extras,
  };
}

function buildIdbFieldTypeMap(records: IDBRecord[]): Map<string, string> {
  const fieldTypes = new Map<string, string>();

  for (const record of records) {
    for (const [fieldName, value] of extractObjectEntries(record.value)) {
      if (!fieldTypes.has(fieldName)) {
        fieldTypes.set(fieldName, inferValueType(value));
      }
    }
  }

  return fieldTypes;
}

function keyPathFields(store: StoreInfo, fieldTypes: Map<string, string>): StorageGraphField[] {
  if (!store.keyPath) {
    return [];
  }

  const keys = Array.isArray(store.keyPath) ? store.keyPath : [store.keyPath];
  return keys.map((keyPath) =>
    makeField(String(keyPath), "key-path", {
      isPrimary: true,
      valueType: fieldTypes.get(String(keyPath)) ?? "key",
    }),
  );
}

function indexFields(store: StoreInfo, fieldTypes: Map<string, string>): StorageGraphField[] {
  return store.indexes.flatMap((index) => {
    const keyPaths = Array.isArray(index.keyPath) ? index.keyPath : [index.keyPath];
    return keyPaths.map((keyPath) =>
      makeField(String(keyPath), "index", {
        isIndexed: true,
        valueType: fieldTypes.get(String(keyPath)),
      }),
    );
  });
}

function sampleFields(records: IDBRecord[]): StorageGraphField[] {
  const fieldTypes = buildIdbFieldTypeMap(records);
  const names = new Set<string>();
  for (const record of records) {
    for (const key of extractObjectFieldNames(record.value)) {
      names.add(key);
    }
  }

  return Array.from(names).map((name) =>
    makeField(name, "sample-field", {
      valueType: fieldTypes.get(name),
    }),
  );
}

export function buildIndexedDbDescriptor(
  database: IDBDatabaseInfo,
  store: StoreInfo,
  records: IDBRecord[],
): StorageGraphEntityDescriptor {
  const fieldTypes = buildIdbFieldTypeMap(records);
  const fields = dedupeGraphFields([
    ...keyPathFields(store, fieldTypes),
    ...indexFields(store, fieldTypes),
    ...sampleFields(records),
  ]);

  return {
    id: makeGraphId("idb", database.origin, database.name, store.name),
    storageKind: "indexeddb",
    entityKind: "indexeddb-store",
    title: store.name,
    subtitle: database.name,
    containerLabel: database.origin,
    openPath: `/storage/indexeddb/${encodeURIComponent(database.name)}/${encodeURIComponent(store.name)}`,
    statsLabel: `${store.recordCount.toLocaleString()} rows`,
    groupKey: `indexeddb:${database.name}`,
    changeCount: 0,
    fields,
  };
}

export function buildLocalForageDescriptor(
  origin: string,
  key: string,
  rawValue: string,
): StorageGraphEntityDescriptor {
  const parsedValue = parseJsonValue(rawValue);
  const valueFields = extractObjectEntries(parsedValue).map(([field, value]) =>
    makeField(field, "sample-field", {
      valueType: inferValueType(value),
    }),
  );

  const fields = dedupeGraphFields([
    makeField(key, "entry-key", { isPrimary: true, valueType: "key" }),
    ...valueFields,
  ]);

  return {
    id: makeGraphId("localforage", origin, key),
    storageKind: "localforage",
    entityKind: "localforage-entry",
    title: key,
    subtitle: "localforage",
    containerLabel: origin,
    openPath: "/storage/localforage",
    statsLabel: `${fields.length} fields`,
    groupKey: `localforage:${origin}`,
    changeCount: 0,
    fields,
  };
}

export function buildSqliteDescriptor(
  packageName: string,
  databaseName: string,
  databasePath: string,
  table: { name: string; rowCount: number },
  columns: Array<{ name: string; pk: number; colType?: string }>,
  indexes: Array<{ columns: string[] }>,
  foreignKeys: Array<{ fromColumn: string; toTable: string; toColumn: string | null }>,
): StorageGraphEntityDescriptor {
  const indexFieldNames = new Set(indexes.flatMap((index) => index.columns));
  const columnTypes = new Map(
    columns.map((column) => [column.name, column.colType?.trim().toLowerCase() || "column"]),
  );

  const fields = dedupeGraphFields([
    ...columns.map((column) =>
      makeField(column.name, "column", {
        isPrimary: column.pk > 0,
        isIndexed: indexFieldNames.has(column.name),
        valueType: column.colType?.trim().toLowerCase() || "column",
      }),
    ),
    ...foreignKeys.map((foreignKey) =>
      makeField(foreignKey.fromColumn, "foreign-key", {
        isForeignKey: true,
        valueType: columnTypes.get(foreignKey.fromColumn),
        references: {
          targetNodeId: makeGraphId("sqlite", packageName, databaseName, foreignKey.toTable),
          targetFieldName: foreignKey.toColumn ?? undefined,
        },
      }),
    ),
  ]);

  return {
    id: makeGraphId("sqlite", packageName, databaseName, table.name),
    storageKind: "sqlite",
    entityKind: "sqlite-table",
    title: table.name,
    subtitle: databaseName,
    containerLabel: packageName,
    openPath: `/storage/sqlite/${encodeURIComponent(databaseName)}/${encodeURIComponent(table.name)}`,
    statsLabel: `${table.rowCount.toLocaleString()} rows`,
    groupKey: `sqlite:${databasePath}`,
    changeCount: 0,
    fields,
  };
}
