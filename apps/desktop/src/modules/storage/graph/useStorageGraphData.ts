import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  IDBDomain,
  LocalForageDomain,
  type IDBDatabaseInfo,
  type IDBRecord,
  type StoreInfo,
} from "utils";
import { useCDP } from "@/composables/useCDP";
import { useSQLite } from "@/composables/useSQLite";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useStorageContextStore } from "@/modules/storage/stores/useStorageContextStore";
import { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
import { useStorageGraphStore } from "@/modules/storage/stores/useStorageGraphStore";
import {
  buildAutoLayoutPositions,
  buildFieldMatchRelationships,
  dedupeGraphFields,
  normalizeGraphFieldName,
} from "@/modules/storage/graph/storageGraph.utils";
import type {
  StorageGraphEntityDescriptor,
  StorageGraphField,
  StorageGraphNodeAnnotation,
  StorageGraphPosition,
  StorageGraphRelationship,
} from "@/types/storageGraph.types";

function makeGraphId(...parts: string[]): string {
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

function buildIndexedDbDescriptor(
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

function buildLocalForageDescriptor(
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

function buildSqliteDescriptor(
  packageName: string,
  databaseName: string,
  databasePath: string,
  table: { name: string; rowCount: number },
  columns: Array<{ name: string; pk: boolean; colType?: string }>,
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
        isPrimary: column.pk,
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

function emptyScopeState() {
  return {
    positions: {} as Record<string, StorageGraphPosition>,
    notes: [],
    manualEdges: [],
    annotations: {} as Record<string, StorageGraphNodeAnnotation>,
  };
}

function makeUndirectedPairKey(leftId: string, rightId: string): string {
  return leftId.localeCompare(rightId) <= 0 ? `${leftId}::${rightId}` : `${rightId}::${leftId}`;
}

export function useStorageGraphData() {
  const { getClient } = useCDP();
  const { listDatabases, openDatabase, tableColumns, tableIndexes, tableForeignKeys } = useSQLite();
  const devicesStore = useDevicesStore();
  const targetsStore = useTargetsStore();
  const storageContextStore = useStorageContextStore();
  const changesStore = useIndexedDBChangesStore();
  const graphStore = useStorageGraphStore();

  const serial = computed(() => devicesStore.selectedDevice?.serial ?? "");
  const targetId = computed(() => targetsStore.selectedTarget?.id ?? "");
  const selectedTarget = computed(() => targetsStore.selectedTarget);
  const selectedOrigin = computed(() => storageContextStore.getSelectedOrigin(targetId.value));
  const availableOriginsQuery = useQuery({
    queryKey: computed(() => ["storage-graph-origins", targetId.value]),
    enabled: computed(() => Boolean(targetId.value)),
    queryFn: async () => {
      const client = getClient(targetId.value);
      if (!client) {
        return [] as string[];
      }

      const domain = new IDBDomain(client);
      const databases = await domain.discoverDatabases();
      return Array.from(new Set(databases.map((database) => database.origin))).sort((left, right) =>
        left.localeCompare(right),
      );
    },
  });
  const selectedPackageName = computed(() => {
    const target = selectedTarget.value;
    if (!target || target.source !== "adb") {
      return "";
    }
    if (target.deviceSerial !== serial.value) {
      return "";
    }
    return target.packageName?.trim() ?? "";
  });

  const scopeKey = computed(() =>
    [
      "storage-graph",
      serial.value || "no-serial",
      targetId.value || "no-target",
      selectedOrigin.value || "no-origin",
      selectedPackageName.value || "no-package",
    ].join(":"),
  );

  const indexedDbQuery = useQuery({
    queryKey: computed(() => ["storage-graph-indexeddb", targetId.value, selectedOrigin.value]),
    enabled: computed(() => Boolean(targetId.value && selectedOrigin.value)),
    queryFn: async () => {
      const client = getClient(targetId.value);
      if (!client) {
        return [] as StorageGraphEntityDescriptor[];
      }

      const domain = new IDBDomain(client);
      const databases = await domain.discoverDatabases();
      const scopedDatabases = databases.filter(
        (database) => database.origin === selectedOrigin.value && database.name !== "localforage",
      );

      const descriptors = await Promise.all(
        scopedDatabases.flatMap(async (database) => {
          const stores = await domain.getStoreInfo(database.name, database.origin);
          return Promise.all(
            stores.map(async (store) => {
              const result = await domain.getData({
                securityOrigin: database.origin,
                databaseName: database.name,
                objectStoreName: store.name,
                skipCount: 0,
                pageSize: 12,
              });

              return buildIndexedDbDescriptor(database, store, result.records);
            }),
          );
        }),
      );

      return descriptors.flat();
    },
  });

  const localForageQuery = useQuery({
    queryKey: computed(() => ["storage-graph-localforage", targetId.value, selectedOrigin.value]),
    enabled: computed(() => Boolean(targetId.value && selectedOrigin.value)),
    queryFn: async () => {
      const client = getClient(targetId.value);
      if (!client) {
        return [] as StorageGraphEntityDescriptor[];
      }

      const domain = new LocalForageDomain(client);
      const origins = await domain.getOrigins();
      if (!origins.includes(selectedOrigin.value)) {
        return [] as StorageGraphEntityDescriptor[];
      }

      const entries = await domain.getEntries(selectedOrigin.value);
      return entries.map((entry) =>
        buildLocalForageDescriptor(selectedOrigin.value, entry.key, entry.value),
      );
    },
  });

  const sqliteQuery = useQuery({
    queryKey: computed(() => ["storage-graph-sqlite", serial.value, selectedPackageName.value]),
    enabled: computed(() => Boolean(serial.value && selectedPackageName.value)),
    queryFn: async () => {
      const databases = await listDatabases(serial.value, selectedPackageName.value);

      const descriptors = await Promise.all(
        databases.map(async (database) => {
          const tables = await openDatabase(serial.value, selectedPackageName.value, database.path);

          return Promise.all(
            tables.map(async (table) => {
              const [columns, indexes, foreignKeys] = await Promise.all([
                tableColumns(serial.value, selectedPackageName.value, database.path, table.name),
                tableIndexes(serial.value, selectedPackageName.value, database.path, table.name),
                tableForeignKeys(
                  serial.value,
                  selectedPackageName.value,
                  database.path,
                  table.name,
                ),
              ]);

              return buildSqliteDescriptor(
                selectedPackageName.value,
                database.name,
                database.path,
                table,
                columns,
                indexes,
                foreignKeys,
              );
            }),
          );
        }),
      );

      return descriptors.flat();
    },
  });

  const indexedDbChangeCounts = computed(() => {
    const counts: Record<string, number> = {};

    for (const change of changesStore.changes) {
      if (change.kind !== "record" || !change.databaseName || !change.objectStoreName) {
        continue;
      }

      const nodeId = makeGraphId("idb", change.origin, change.databaseName, change.objectStoreName);
      counts[nodeId] = (counts[nodeId] ?? 0) + 1;
    }

    return counts;
  });

  const baseEntities = computed(() => [
    ...(indexedDbQuery.data.value ?? []),
    ...(localForageQuery.data.value ?? []),
    ...(sqliteQuery.data.value ?? []),
  ]);

  const entities = computed<StorageGraphEntityDescriptor[]>(() =>
    baseEntities.value.map((entity) => ({
      ...entity,
      changeCount:
        entity.storageKind === "indexeddb" ? (indexedDbChangeCounts.value[entity.id] ?? 0) : 0,
      annotation: graphStore.getNodeAnnotation(scopeKey.value, entity.id),
    })),
  );

  const persistedScope = computed(() => graphStore.scopes[scopeKey.value] ?? emptyScopeState());

  const explicitRelationships = computed<StorageGraphRelationship[]>(() => {
    const edges: StorageGraphRelationship[] = [];

    for (const entity of entities.value) {
      for (const field of entity.fields) {
        if (!field.references?.targetNodeId) {
          continue;
        }

        edges.push({
          id: `foreign-key:${entity.id}:${field.name}:${field.references.targetNodeId}`,
          kind: "foreign-key",
          source: entity.id,
          target: field.references.targetNodeId,
          label: field.references.targetFieldName
            ? `${field.name} -> ${field.references.targetFieldName}`
            : field.name,
          confidence: "high",
          sourceFieldName: field.name,
          targetFieldName: field.references.targetFieldName,
        });
      }
    }

    return edges;
  });

  const inferredRelationships = computed(() => {
    const explicitPairs = new Set(
      explicitRelationships.value.map((edge) => makeUndirectedPairKey(edge.source, edge.target)),
    );

    return buildFieldMatchRelationships(entities.value).filter(
      (edge) => !explicitPairs.has(makeUndirectedPairKey(edge.source, edge.target)),
    );
  });

  const manualRelationships = computed<StorageGraphRelationship[]>(() =>
    persistedScope.value.manualEdges
      .filter((edge) => {
        const knownNodeIds = new Set([
          ...entities.value.map((entity) => entity.id),
          ...persistedScope.value.notes.map((note) => note.id),
        ]);
        return knownNodeIds.has(edge.source) && knownNodeIds.has(edge.target);
      })
      .map((edge) => ({
        id: edge.id,
        kind: "manual",
        source: edge.source,
        target: edge.target,
        label: edge.label,
        confidence: "high",
        userDefined: true,
      })),
  );

  const relationships = computed<StorageGraphRelationship[]>(() => {
    const merged = new Map<string, StorageGraphRelationship>();

    for (const edge of [
      ...explicitRelationships.value,
      ...inferredRelationships.value,
      ...manualRelationships.value,
    ]) {
      const key = `${edge.kind}:${edge.source}:${edge.target}:${edge.label}`;
      if (!merged.has(key)) {
        merged.set(key, edge);
      }
    }

    return Array.from(merged.values());
  });

  const autoLayoutPositions = computed(() =>
    buildAutoLayoutPositions([
      ...entities.value.map((entity) => ({
        id: entity.id,
        groupKey: entity.groupKey,
        layoutKey: entity.title,
        storageKind: entity.storageKind,
      })),
      ...persistedScope.value.notes.map((note) => ({
        id: note.id,
        groupKey: "notes",
        layoutKey: note.title,
        storageKind: "note" as const,
      })),
    ]),
  );

  const isLoading = computed(
    () =>
      indexedDbQuery.isLoading.value ||
      indexedDbQuery.isFetching.value ||
      localForageQuery.isLoading.value ||
      localForageQuery.isFetching.value ||
      sqliteQuery.isLoading.value ||
      sqliteQuery.isFetching.value,
  );

  const error = computed(() => {
    const firstError =
      indexedDbQuery.error.value || localForageQuery.error.value || sqliteQuery.error.value;
    return firstError ? String(firstError) : null;
  });

  return {
    serial,
    targetId,
    selectedOrigin,
    availableOrigins: computed(() => availableOriginsQuery.data.value ?? []),
    setSelectedOrigin: (origin: string) =>
      storageContextStore.setSelectedOrigin(targetId.value, origin),
    selectedPackageName,
    scopeKey,
    entities,
    notes: computed(() => persistedScope.value.notes),
    persistedPositions: computed(() => persistedScope.value.positions),
    relationships,
    autoLayoutPositions,
    isLoading,
    error,
  };
}
