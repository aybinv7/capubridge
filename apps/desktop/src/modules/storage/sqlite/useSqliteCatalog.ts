import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import type { SqliteAddress } from "./sqliteAddress";
import { sqliteQueryRoot } from "./browse/useSqliteRows";
import { openTables, readColumns, readStructure } from "./sqliteReads";

function message(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "The database did not answer.";
}

/** The open database's tables and views with their row counts (a phone database is pulled first). */
export function useSqliteTables(address: Ref<SqliteAddress | null>) {
  const query = useQuery({
    queryKey: computed(() => [...sqliteQueryRoot(address.value), "tables"]),
    enabled: computed(() => address.value !== null),
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
    queryFn: () => {
      const current = address.value;
      if (!current) throw new Error("No database is open");
      return openTables(current);
    },
  });
  return {
    tables: computed(() => query.data.value ?? []),
    loaded: computed(() => query.data.value !== undefined),
    loading: computed(() => query.isPending.value && query.fetchStatus.value !== "idle"),
    fetching: query.isFetching,
    error: computed(() => message(query.error.value)),
    readAt: computed(() => query.dataUpdatedAt.value || null),
    refetch: () => query.refetch(),
  };
}

/** Columns of one table (types, primary key), read from the same copy as its rows. */
export function useSqliteColumns(address: Ref<SqliteAddress | null>, table: Ref<string>) {
  const query = useQuery({
    queryKey: computed(() => [...sqliteQueryRoot(address.value), "columns", table.value]),
    enabled: computed(() => address.value !== null && table.value !== ""),
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
    queryFn: () => {
      const current = address.value;
      if (!current) throw new Error("No database is open");
      return readColumns(current, table.value);
    },
  });
  return { columns: computed(() => query.data.value ?? []) };
}

/** How one table is built: columns, indexes with their SQL, foreign keys and triggers. */
export function useSqliteStructure(
  address: Ref<SqliteAddress | null>,
  table: Ref<string>,
  enabled: Ref<boolean>,
) {
  const query = useQuery({
    queryKey: computed(() => [...sqliteQueryRoot(address.value), "structure", table.value]),
    enabled: computed(() => enabled.value && address.value !== null && table.value !== ""),
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
    queryFn: () => {
      const current = address.value;
      if (!current) throw new Error("No database is open");
      return readStructure(current, table.value);
    },
  });
  return {
    structure: computed(() => query.data.value ?? null),
    loading: computed(() => query.isPending.value && query.fetchStatus.value !== "idle"),
    error: computed(() => message(query.error.value)),
    refetch: () => query.refetch(),
  };
}
