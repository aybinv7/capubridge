import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { IDBDomain, type StoreInfo } from "utils";
import { useCDP } from "./useCDP";
import { useTargetsStore } from "@/stores/targets.store";

export function useIDB() {
  const { getClient } = useCDP();
  const targetsStore = useTargetsStore();

  const targetId = computed(() => targetsStore.selectedTarget?.id ?? "");

  function getDomain() {
    const client = getClient(targetId.value);
    if (!client) throw new Error("No active CDP connection");
    return new IDBDomain(client);
  }

  function useDatabases() {
    return useQuery({
      queryKey: computed(() => ["idb-databases", targetId.value]),
      queryFn: async () => {
        console.log("[IDB] useDatabases queryFn running, targetId:", targetId.value);
        const domain = getDomain();
        const dbs = await domain.discoverDatabases();
        console.log("[IDB] discovered databases:", dbs);
        return dbs;
      },
      enabled: computed(() => !!targetId.value),
    });
  }

  function useRecords(
    origin: Ref<string>,
    dbName: Ref<string>,
    storeName: Ref<string>,
    page: Ref<number>,
    pageSize: Ref<number>,
  ) {
    return useQuery({
      queryKey: computed(() => [
        "idb-records",
        targetId.value,
        origin.value,
        dbName.value,
        storeName.value,
        page.value,
        pageSize.value,
      ]),
      queryFn: async () => {
        console.log("[IDB] useRecords queryFn running:", {
          origin: origin.value,
          db: dbName.value,
          store: storeName.value,
        });
        try {
          const domain = getDomain();
          const result = await domain.getData({
            securityOrigin: origin.value,
            databaseName: dbName.value,
            objectStoreName: storeName.value,
            skipCount: page.value * pageSize.value,
            pageSize: pageSize.value,
          });
          console.log("[IDB] useRecords result:", result);
          return result;
        } catch (err) {
          console.error("[IDB] useRecords error:", err);
          throw err;
        }
      },
      enabled: computed(
        () => !!targetId.value && !!origin.value && !!dbName.value && !!storeName.value,
      ),
      retry: false,
    });
  }

  function useStoreInfo(dbName: Ref<string>, origin: Ref<string>) {
    return useQuery<StoreInfo[]>({
      queryKey: computed(() => ["idb-store-info", targetId.value, origin.value, dbName.value]),
      queryFn: async () => {
        console.log("[IDB] getStoreInfo running, db:", dbName.value, "origin:", origin.value);
        const domain = getDomain();
        const result = await domain.getStoreInfo(dbName.value, origin.value);
        console.log("[IDB] getStoreInfo result count:", result.length);
        return result;
      },
      enabled: computed(() => !!targetId.value && !!dbName.value && !!origin.value),
      retry: (failureCount, error) => {
        const isConnectionError =
          error instanceof Error && error.message === "No active CDP connection";
        return isConnectionError && failureCount < 3;
      },
    });
  }

  function useStorageEstimate(origin: Ref<string>) {
    return useQuery({
      queryKey: computed(() => ["idb-storage-estimate", targetId.value, origin.value]),
      queryFn: async () => {
        const domain = getDomain();
        return domain.getStorageEstimate();
      },
      enabled: computed(() => !!targetId.value && !!origin.value),
      retry: false,
    });
  }

  return { targetId, useDatabases, useRecords, useStoreInfo, useStorageEstimate };
}
