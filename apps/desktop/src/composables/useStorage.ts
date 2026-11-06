import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { OPFSDomain, JeepSqliteDomain } from "@capubridge/cdp-protocol";
import { useCDP } from "./useCDP";
import { useTargetsStore } from "@/stores/targets.store";

export function useOPFS() {
  const { getClient } = useCDP();
  const targetsStore = useTargetsStore();
  const targetId = computed(() => targetsStore.cdpTargetId);

  function getDomain() {
    const client = getClient(targetId.value);
    if (!client) throw new Error("No active CDP connection");
    return new OPFSDomain(client);
  }

  return { targetId, getDomain };
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
