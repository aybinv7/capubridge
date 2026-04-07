import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";
import { LocalForageDomain } from "utils";

export function useLocalForage() {
  const { getClient } = useCDP();
  const targetsStore = useTargetsStore();
  const targetId = computed(() => targetsStore.selectedTarget?.id ?? "");

  function getDomain() {
    const client = getClient(targetId.value);
    if (!client) throw new Error("No active CDP connection");
    return new LocalForageDomain(client);
  }

  function useOrigins() {
    return useQuery({
      queryKey: computed(() => ["lf-origins", targetId.value]),
      queryFn: async () => {
        const domain = getDomain();
        return domain.getOrigins();
      },
      enabled: computed(() => !!targetId.value),
    });
  }

  function useEntries(origin: Ref<string>) {
    return useQuery({
      queryKey: computed(() => ["lf-entries", targetId.value, origin.value]),
      queryFn: async () => {
        const domain = getDomain();
        return domain.getEntries(origin.value);
      },
      enabled: computed(() => !!targetId.value && !!origin.value),
    });
  }

  return { targetId, useOrigins, useEntries, getDomain };
}
