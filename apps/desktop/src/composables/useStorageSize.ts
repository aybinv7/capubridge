import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { IDBDomain, LocalStorageDomain, CacheAPIDomain, OPFSDomain } from "utils";
import { useCDP } from "./useCDP";
import { useTargetsStore } from "@/stores/targets.store";

export interface StorageSizeBreakdown {
  idb: number;
  localStorage: number;
  cache: number;
  opfs: number;
  total: number;
}

export function useStorageSize() {
  const { getClient } = useCDP();
  const targetsStore = useTargetsStore();

  const targetId = computed(() => targetsStore.selectedTarget?.id ?? "");

  function getIDBDomain() {
    const client = getClient(targetId.value);
    if (!client) throw new Error("No active CDP connection");
    return new IDBDomain(client);
  }

  function getLocalStorageDomain() {
    const client = getClient(targetId.value);
    if (!client) throw new Error("No active CDP connection");
    return new LocalStorageDomain(client);
  }

  function getCacheAPIDomain() {
    const client = getClient(targetId.value);
    if (!client) throw new Error("No active CDP connection");
    return new CacheAPIDomain(client);
  }

  function getOPFSDomain() {
    const client = getClient(targetId.value);
    if (!client) throw new Error("No active CDP connection");
    return new OPFSDomain(client);
  }

  function useTotalStorageSize(origin: Ref<string>) {
    return useQuery({
      queryKey: computed(() => ["storage-size", targetId.value, origin.value]),
      queryFn: async () => {
        const [idbSize, lsSize, cacheSize, opfsSize] = await Promise.all([
          getIDBDomain()
            .getStorageEstimate()
            .then((e) => e.idbUsage),
          getLocalStorageDomain()
            .getStorageSize(origin.value)
            .catch(() => 0),
          getCacheAPIDomain()
            .getStorageSize()
            .catch(() => 0),
          getOPFSDomain()
            .getStorageSize()
            .catch(() => 0),
        ]);

        return {
          idb: idbSize,
          localStorage: lsSize,
          cache: cacheSize,
          opfs: opfsSize,
          total: idbSize + lsSize + cacheSize + opfsSize,
        } satisfies StorageSizeBreakdown;
      },
      enabled: computed(() => !!targetId.value && !!origin.value),
      staleTime: 30_000,
    });
  }

  return { useTotalStorageSize };
}
