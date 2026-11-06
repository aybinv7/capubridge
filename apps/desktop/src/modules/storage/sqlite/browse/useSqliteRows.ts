import { computed, type Ref } from "vue";
import { useQuery, type QueryKey } from "@tanstack/vue-query";
import type { SqliteQueryResult } from "@/types/sqlite.types";
import { addressKey, type SqliteAddress } from "../sqliteAddress";
import { readTablePage, runQuery } from "../sqliteReads";
import {
  buildCountQuery,
  buildGroupCountQuery,
  buildGroupQuery,
  buildPageQuery,
} from "./sqliteQuery";
import type { SqliteRowOrder } from "./sqliteRowOrder";
import type { SqliteTableQuery } from "./useSqliteTableQuery";

export interface SqlitePage {
  result: SqliteQueryResult;
  hasMore: boolean;
}

/** Every SQLite query of one readable copy starts with this, so a read again refetches them all. */
export function sqliteQueryRoot(address: SqliteAddress | null): QueryKey {
  return ["sqlite", addressKey(address)];
}

function samePlace(left: QueryKey | undefined, right: readonly unknown[]): boolean {
  if (!left) return false;
  return left[1] === right[1] && left[3] === right[3];
}

/**
 * One page of a table under its WHERE, search, grouping and sort, and the count that goes with
 * them. Each is a query keyed by everything it depends on, so a slow answer for an older page
 * or filter can never replace the newer one on screen (C17), and the count runs once per
 * filter instead of once per page (F8). A page change keeps the previous page on screen.
 */
export function useSqliteRows(options: {
  address: Ref<SqliteAddress | null>;
  table: Ref<string>;
  query: SqliteTableQuery;
  /** Rows of the whole table, from the database listing. */
  tableRowCount: Ref<number | null>;
  /** Breaks ties of the sort, so pages never repeat or skip a row. */
  rowOrder: Ref<SqliteRowOrder>;
  /** `false` while the table's tab is kept alive but not shown: nothing is read for it. */
  active?: Ref<boolean>;
}) {
  const { address, table, query } = options;

  const rowsKey = computed(() => [
    ...sqliteQueryRoot(address.value),
    "rows",
    table.value,
    query.page.value,
    query.pageSize.value,
    query.orderBy.value,
    query.orderDir.value,
    query.effectiveWhere.value,
    query.groupBy.value,
    options.rowOrder.value,
  ]);

  const rows = useQuery({
    queryKey: rowsKey,
    enabled: computed(
      () => address.value !== null && table.value !== "" && options.active?.value !== false,
    ),
    staleTime: Infinity,
    gcTime: 15_000,
    retry: false,
    placeholderData: (previous, previousQuery) =>
      samePlace(previousQuery?.queryKey, rowsKey.value) ? previous : undefined,
    queryFn: async (): Promise<SqlitePage> => {
      const current = address.value;
      if (!current) throw new Error("No database is open");
      const size = query.pageSize.value;
      const offset = query.page.value * size;
      const group = query.groupBy.value;
      const where = query.effectiveWhere.value;
      const result = !query.needsQuery.value
        ? await readTablePage(
            current,
            table.value,
            offset,
            size + 1,
            query.orderBy.value,
            query.orderDir.value,
          )
        : await runQuery(
            current,
            group
              ? buildGroupQuery(table.value, where, group, offset, size + 1)
              : buildPageQuery({
                  table: table.value,
                  where,
                  orderBy: query.orderBy.value,
                  direction: query.orderDir.value,
                  offset,
                  limit: size + 1,
                  rowOrder: options.rowOrder.value,
                }),
          );
      const hasMore = result.rows.length > size;
      const kept = hasMore ? result.rows.slice(0, size) : result.rows;
      return { result: { ...result, rows: kept, rowCount: kept.length }, hasMore };
    },
  });

  const count = useQuery({
    queryKey: computed(() => [
      ...sqliteQueryRoot(address.value),
      "count",
      table.value,
      query.effectiveWhere.value,
      query.groupBy.value,
    ]),
    enabled: computed(
      () =>
        address.value !== null &&
        table.value !== "" &&
        query.needsQuery.value &&
        options.active?.value !== false,
    ),
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
    queryFn: async (): Promise<number | null> => {
      const current = address.value;
      if (!current) return null;
      const group = query.groupBy.value;
      const where = query.effectiveWhere.value;
      const result = await runQuery(
        current,
        group
          ? buildGroupCountQuery(table.value, where, group)
          : buildCountQuery(table.value, where),
      );
      const total = result.rows[0]?.[0];
      return typeof total === "number" ? total : null;
    },
  });

  const total = computed(() =>
    query.needsQuery.value ? (count.data.value ?? null) : options.tableRowCount.value,
  );
  const error = computed(() => {
    const failure = rows.error.value;
    return failure ? (failure instanceof Error ? failure.message : String(failure)) : null;
  });
  /** A failed filtered read is the person's WHERE clause; it shows under the filter bar. */
  const filterError = computed(() => (query.needsQuery.value ? error.value : null));

  return {
    page: computed(() => rows.data.value ?? null),
    loading: computed(() => rows.isPending.value && rows.fetchStatus.value !== "idle"),
    fetching: rows.isFetching,
    placeholder: rows.isPlaceholderData,
    readAt: computed(() => rows.dataUpdatedAt.value || null),
    error,
    filterError,
    total,
    refetch: () => rows.refetch(),
  };
}
