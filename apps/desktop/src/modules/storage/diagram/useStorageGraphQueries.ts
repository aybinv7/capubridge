import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { IDBDomain, KeyValueDomain } from "@capubridge/cdp-protocol";
import type { useCDP } from "@/composables/useCDP";
import type { useSQLite } from "@/composables/useSQLite";
import {
  buildIndexedDbDescriptor,
  buildLocalForageDescriptor,
} from "@/modules/storage/diagram/storageGraphEntityBuilders";
import { sqliteDiagramEntities } from "./sqliteDiagramEntities";
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
  targetId: Ref<string>;
  selectedOrigin: Ref<string>;
  serial: Ref<string>;
  selectedPackageName: Ref<string>;
  /** Off until the diagram asks for the app's other data. */
  enabled: Ref<boolean>;
  /** The database the diagram draws from its own open copy, never pulled again here. */
  skipSqlitePath: Ref<string>;
  /** The IndexedDB database the diagram draws itself. */
  skipIdbDatabase: Ref<string>;
}

export function useStorageGraphQueries({
  getClient,
  sqlite,
  targetId,
  selectedOrigin,
  serial,
  selectedPackageName,
  enabled,
  skipSqlitePath,
  skipIdbDatabase,
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
    queryKey: computed(() => [
      "storage-graph-indexeddb",
      targetId.value,
      selectedOrigin.value,
      skipIdbDatabase.value,
    ]),
    enabled: computed(() => enabled.value && Boolean(targetId.value && selectedOrigin.value)),
    staleTime: 60_000,
    queryFn: async () => {
      const client = getClient(targetId.value);
      if (!client) {
        return [] as StorageGraphEntityDescriptor[];
      }

      const domain = new IDBDomain(client);
      const databases = await domain.discoverDatabases();
      const scopedDatabases = databases.filter(
        (database) =>
          database.origin === selectedOrigin.value &&
          database.name !== "localforage" &&
          database.name !== skipIdbDatabase.value,
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
    enabled: computed(() => enabled.value && Boolean(targetId.value && selectedOrigin.value)),
    staleTime: 60_000,
    queryFn: async () => {
      const client = getClient(targetId.value);
      if (!client) {
        return [] as StorageGraphEntityDescriptor[];
      }

      const stores = await new KeyValueDomain(client).readAllForage(selectedOrigin.value);
      return stores.flatMap((store) =>
        store.page.entries.map((entry) =>
          buildLocalForageDescriptor(
            selectedOrigin.value,
            typeof entry.key === "string" ? entry.key : (JSON.stringify(entry.key) ?? ""),
            JSON.stringify(entry.value) ?? "null",
          ),
        ),
      );
    },
  });

  const sqliteQuery = useQuery({
    queryKey: computed(() => [
      "storage-graph-sqlite",
      serial.value,
      selectedPackageName.value,
      skipSqlitePath.value,
    ]),
    enabled: computed(() => enabled.value && Boolean(serial.value && selectedPackageName.value)),
    staleTime: 60_000,
    queryFn: async () => {
      const databases = (await listDatabases(serial.value, selectedPackageName.value)).filter(
        (database) => database.path !== skipSqlitePath.value,
      );

      const settled = await Promise.allSettled(
        databases.map(async (database) => {
          const tables = await openDatabase(serial.value, selectedPackageName.value, database.path);
          const schemas = await Promise.all(
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
              return { table, columns, indexes, foreignKeys };
            }),
          );
          return { name: database.name, path: database.path, tables: schemas };
        }),
      );
      const failed = settled.flatMap((outcome, index) =>
        outcome.status === "rejected"
          ? [{ database: databases[index]?.name, reason: outcome.reason }]
          : [],
      );
      if (failed.length > 0 && failed.length === settled.length) throw failed[0]?.reason;
      if (failed.length > 0) console.warn("[storage-graph][sqlite] databases left out", failed);
      const schemas = settled.flatMap((outcome) =>
        outcome.status === "fulfilled" ? [outcome.value] : [],
      );
      const descriptors = await sqliteDiagramEntities(
        selectedPackageName.value,
        schemas,
        (databasePath, sql) =>
          executeQuery(serial.value, selectedPackageName.value, databasePath, sql),
      );
      return descriptors;
    },
  });

  return { indexedDbQuery, localForageQuery, sqliteQuery };
}
