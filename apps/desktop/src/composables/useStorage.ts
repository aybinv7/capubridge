import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { LocalStorageDomain, CacheAPIDomain, OPFSDomain, JeepSqliteDomain } from "utils";
import { useCDP } from "./useCDP";
import { useTargetsStore } from "@/stores/targets.store";

export function useLocalStorage() {
  const { getClient } = useCDP();
  const targetsStore = useTargetsStore();
  const targetId = computed(() => targetsStore.cdpTargetId);

  function getDomain() {
    const client = getClient(targetId.value);
    if (!client) throw new Error("No active CDP connection");
    return new LocalStorageDomain(client);
  }

  function useOrigins() {
    return useQuery({
      queryKey: computed(() => ["ls-origins", targetId.value]),
      queryFn: async () => {
        const domain = getDomain();
        await domain.enable();
        return domain.getOrigins();
      },
      enabled: computed(() => !!targetId.value),
    });
  }

  function useEntries(origin: Ref<string>) {
    return useQuery({
      queryKey: computed(() => ["ls-entries", targetId.value, origin.value]),
      queryFn: async () => {
        const domain = getDomain();
        return domain.getEntries(origin.value);
      },
      enabled: computed(() => !!targetId.value && !!origin.value),
    });
  }

  return { targetId, useOrigins, useEntries, getDomain };
}

export function useCacheAPI() {
  const { getClient } = useCDP();
  const targetsStore = useTargetsStore();
  const targetId = computed(() => targetsStore.cdpTargetId);

  function getDomain() {
    const client = getClient(targetId.value);
    if (!client) throw new Error("No active CDP connection");
    return new CacheAPIDomain(client);
  }

  function useCacheNames() {
    return useQuery({
      queryKey: computed(() => ["cache-names", targetId.value]),
      queryFn: async () => {
        const domain = getDomain();
        return domain.getCacheNames();
      },
      enabled: computed(() => !!targetId.value),
    });
  }

  function useCacheEntries(cacheName: Ref<string>) {
    return useQuery({
      queryKey: computed(() => ["cache-entries", targetId.value, cacheName.value]),
      queryFn: async () => {
        const domain = getDomain();
        return domain.getEntries(cacheName.value);
      },
      enabled: computed(() => !!targetId.value && !!cacheName.value),
    });
  }

  return { targetId, useCacheNames, useCacheEntries, getDomain };
}

export function useOPFS() {
  const { getClient } = useCDP();
  const targetsStore = useTargetsStore();
  const targetId = computed(() => targetsStore.cdpTargetId);

  function getDomain() {
    const client = getClient(targetId.value);
    if (!client) throw new Error("No active CDP connection");
    return new OPFSDomain(client);
  }

  function useDirectory(path: Ref<string>) {
    return useQuery({
      queryKey: computed(() => ["opfs-dir", targetId.value, path.value]),
      queryFn: async () => {
        const domain = getDomain();
        return domain.listDirectory(path.value);
      },
      enabled: computed(() => !!targetId.value),
    });
  }

  function useSahPoolDatabases(path: Ref<string>, enabled: Ref<boolean>) {
    return useQuery({
      queryKey: computed(() => ["opfs-sah-pool", targetId.value, path.value]),
      queryFn: async () => {
        const domain = getDomain();
        return domain.listSahPoolDatabases(path.value);
      },
      enabled: computed(() => !!targetId.value && enabled.value),
    });
  }

  return { targetId, useDirectory, useSahPoolDatabases, getDomain };
}

export function useJeepSqlite() {
  const { getClient } = useCDP();
  const targetsStore = useTargetsStore();
  const targetId = computed(() => targetsStore.cdpTargetId);

  function getDomain() {
    const client = getClient(targetId.value);
    if (!client) throw new Error("No active CDP connection");
    return new JeepSqliteDomain(client);
  }

  function useDatabases() {
    return useQuery({
      queryKey: computed(() => ["jeep-sqlite-databases", targetId.value]),
      queryFn: async () => {
        const domain = getDomain();
        return domain.listDatabases();
      },
      enabled: computed(() => !!targetId.value),
    });
  }

  return { targetId, useDatabases, getDomain };
}
