import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { sqliteQueryRoot } from "../browse/useSqliteRows";
import type { SqliteAddress } from "../sqliteAddress";
import { readFacts } from "../sqliteReads";

/**
 * The overview's facts in one read (`sqlite_database_facts`), under the database's query root so
 * Read again and a change seen by the watcher read them again with everything else.
 */
export function useSqliteFacts(address: Ref<SqliteAddress | null>) {
  const query = useQuery({
    queryKey: computed(() => [...sqliteQueryRoot(address.value), "facts"]),
    enabled: computed(() => address.value !== null),
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: false,
    queryFn: () => {
      const current = address.value;
      if (!current) throw new Error("No database is open");
      return readFacts(current);
    },
  });
  return {
    facts: computed(() => query.data.value ?? null),
    loading: computed(() => query.isPending.value && query.fetchStatus.value !== "idle"),
    error: computed(() => {
      const failure = query.error.value;
      return failure ? (failure instanceof Error ? failure.message : String(failure)) : null;
    }),
    refetch: () => query.refetch(),
  };
}
