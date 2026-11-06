import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { sqliteQueryRoot } from "../browse/useSqliteRows";
import type { SqliteAddress } from "../sqliteAddress";
import { runQuery } from "../sqliteReads";

const ALL_COLUMNS = `SELECT m.name, p.name FROM sqlite_master AS m JOIN pragma_table_info(m.name) AS p WHERE m.type IN ('table', 'view') AND m.name NOT LIKE 'sqlite_%' ORDER BY m.name, p.cid`;
const MAX_COLUMNS = 50_000;

/**
 * Every column of every table and view of the open copy, in one read, for quick open's
 * "which table has `barcode`". Read only once someone asks (`wanted`), and again with the rest
 * of the database's queries on Read again.
 */
export function useSqliteAllColumns(address: Ref<SqliteAddress | null>, wanted: Ref<boolean>) {
  const query = useQuery({
    queryKey: computed(() => [...sqliteQueryRoot(address.value), "all-columns"]),
    enabled: computed(() => wanted.value && address.value !== null),
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const current = address.value;
      if (!current) return [];
      const result = await runQuery(current, ALL_COLUMNS, false, MAX_COLUMNS);
      return result.rows.flatMap(([table, column]) =>
        typeof table === "string" && typeof column === "string" ? [{ table, column }] : [],
      );
    },
  });
  return computed(() => query.data.value ?? null);
}
