import { computed, type ComputedRef } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { IDBDomain, LocalForageDomain } from "@capubridge/cdp-protocol";
import type { useCDP } from "@/composables/useCDP";
import type { useSQLite } from "@/composables/useSQLite";
import {
  buildIndexedDbDescriptor,
  buildLocalForageDescriptor,
  buildSqliteDescriptor,
  makeGraphId,
} from "@/modules/storage/graph/storageGraphEntityBuilders";
import {
  discoverLogicalSqliteReferences,
  logSqliteSchemaDiagnostics,
  type SqliteSchemaDiagnostic,
} from "@/modules/storage/graph/storageGraphSqliteDiagnostics";
import type { StorageGraphEntityDescriptor } from "@/types/storageGraph.types";

export interface UseStorageGraphQueriesParams {
  getClient: ReturnType<typeof useCDP>["getClient"];
  sqlite: Pick<
    ReturnType<typeof useSQLite>,
    | "listDatabases"
    | "openDatabase"
    | "tableColumns"
    | "tableIndexes"
    | "tableForeignKeys"
    | "executeQuery"
  >;
  targetId: ComputedRef<string>;
  selectedOrigin: ComputedRef<string>;
  serial: ComputedRef<string>;
  selectedPackageName: ComputedRef<string>;
}

export function useStorageGraphQueries({
  getClient,
  sqlite,
  targetId,
  selectedOrigin,
  serial,
  selectedPackageName,
}: UseStorageGraphQueriesParams) {
  const {
    listDatabases,
    openDatabase,
    tableColumns,
    tableIndexes,
    tableForeignKeys,
    executeQuery,
  } = sqlite;

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

      const databaseResults = await Promise.all(
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

              return {
                descriptor: buildSqliteDescriptor(
                  selectedPackageName.value,
                  database.name,
                  database.path,
                  table,
                  columns,
                  indexes,
                  foreignKeys,
                ),
                diagnostic: {
                  database: database.name,
                  databasePath: database.path,
                  table: table.name,
                  columns: columns.map((column) => ({
                    name: column.name,
                    type: column.colType,
                    primaryKey: column.pk > 0,
                  })),
                  indexes: indexes.map((index) => ({
                    name: index.name,
                    columns: index.columns,
                    unique: index.unique,
                  })),
                  foreignKeys: foreignKeys.map((foreignKey) => ({
                    fromColumn: foreignKey.fromColumn,
                    toTable: foreignKey.toTable,
                    toColumn: foreignKey.toColumn,
                    onUpdate: foreignKey.onUpdate,
                    onDelete: foreignKey.onDelete,
                  })),
                } satisfies SqliteSchemaDiagnostic,
              };
            }),
          );
        }),
      );
      const results = databaseResults.flat();
      const diagnostics = results.map((result) => result.diagnostic);
      const logicalReferences = await discoverLogicalSqliteReferences(
        diagnostics,
        (databasePath, sql) =>
          executeQuery(serial.value, selectedPackageName.value, databasePath, sql),
      );
      const descriptors = results.map((result) => {
        const references = logicalReferences.filter(
          (reference) =>
            reference.source.databasePath === result.diagnostic.databasePath &&
            reference.source.table === result.diagnostic.table,
        );
        return {
          ...result.descriptor,
          fields: result.descriptor.fields.map((field) => {
            const reference = references.find((candidate) => candidate.sourceColumn === field.name);
            if (!reference || field.references) {
              return field;
            }
            return {
              ...field,
              references: {
                targetNodeId: makeGraphId(
                  "sqlite",
                  selectedPackageName.value,
                  result.diagnostic.database,
                  reference.table,
                ),
                targetFieldName: reference.primaryKey,
                relationshipKind: "logical-reference" as const,
              },
            };
          }),
        };
      });

      logSqliteSchemaDiagnostics(selectedPackageName.value, descriptors, diagnostics);
      if (import.meta.env.DEV) {
        console.log("[storage-graph][sqlite] validated logical references", logicalReferences);
      }

      return descriptors;
    },
  });

  return { indexedDbQuery, localForageQuery, sqliteQuery };
}
