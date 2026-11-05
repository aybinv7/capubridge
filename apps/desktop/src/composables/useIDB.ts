import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { IDBDomain, type StoreInfo } from "@capubridge/cdp-protocol";
import { withTimeout } from "@/shared/async/withTimeout";
import { useCDP } from "./useCDP";
import { useTargetsStore } from "@/stores/targets.store";

/** How long an IndexedDB catalog read waits for the phone. */
const READ_TIMEOUT_MS = 10_000;
const NO_ANSWER = "The phone did not answer";

/**
 * IndexedDB catalog queries for the selected target. Each takes an optional `active` flag:
 * while it is false (the app is away from the screen) nothing is read, and the read runs
 * again once it is true.
 */
export function useIDB() {
  const { getClient } = useCDP();
  const targetsStore = useTargetsStore();

  const targetId = computed(() => targetsStore.cdpTargetId);

  function getDomain() {
    const client = getClient(targetId.value);
    if (!client) throw new Error("No active CDP connection");
    return new IDBDomain(client);
  }

  function useDatabases(active?: Ref<boolean>) {
    return useQuery({
      queryKey: computed(() => ["idb-databases", targetId.value]),
      queryFn: () => withTimeout(getDomain().discoverDatabases(), READ_TIMEOUT_MS, NO_ANSWER),
      enabled: computed(() => !!targetId.value && (active?.value ?? true)),
    });
  }

  function useStoreInfo(dbName: Ref<string>, origin: Ref<string>, active?: Ref<boolean>) {
    return useQuery<StoreInfo[]>({
      queryKey: computed(() => ["idb-store-info", targetId.value, origin.value, dbName.value]),
      queryFn: () =>
        withTimeout(
          getDomain().getStoreInfo(dbName.value, origin.value),
          READ_TIMEOUT_MS,
          NO_ANSWER,
        ),
      enabled: computed(
        () => !!targetId.value && !!dbName.value && !!origin.value && (active?.value ?? true),
      ),
      retry: (failureCount, error) => {
        const isConnectionError =
          error instanceof Error && error.message === "No active CDP connection";
        return isConnectionError && failureCount < 3;
      },
    });
  }

  function useStorageEstimate(origin: Ref<string>, active?: Ref<boolean>) {
    return useQuery({
      queryKey: computed(() => ["idb-storage-estimate", targetId.value, origin.value]),
      queryFn: () => withTimeout(getDomain().getStorageEstimate(), READ_TIMEOUT_MS, NO_ANSWER),
      enabled: computed(() => !!targetId.value && !!origin.value && (active?.value ?? true)),
      retry: false,
    });
  }

  return { targetId, useDatabases, useStoreInfo, useStorageEstimate };
}
