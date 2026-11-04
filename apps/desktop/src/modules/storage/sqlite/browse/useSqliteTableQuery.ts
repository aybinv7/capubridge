import { computed, ref, type Ref } from "vue";
import { toast } from "vue-sonner";
import { toCsv, toSqlInserts, type GridSort } from "@/shared/components/data/grid";
import { downloadText, fileStem } from "@/lib/download";
import type { SqliteQueryResult } from "@/types/sqlite.types";
import {
  andWhere,
  buildCountQuery,
  buildGroupCountQuery,
  buildGroupQuery,
  buildPageQuery,
  predicate,
  searchClause,
  type SqliteExportFormat,
} from "./sqliteQuery";

export interface SqliteTableQueryContext {
  /** Runs a read-only query against the open database. */
  run: (sql: string) => Promise<SqliteQueryResult>;
  table: Ref<string>;
  database: Ref<string>;
  orderBy: Ref<string | null>;
  orderDir: Ref<"ASC" | "DESC" | null>;
  page: Ref<number>;
  pageSize: Ref<number>;
  /** `COUNT(*)` of the whole table, from the database listing. */
  tableRowCount: () => number | null;
  /** Columns of the page on screen, for "copy as INSERT". */
  currentColumns: () => readonly string[] | null;
  /** Every column of the table, for "search all columns". */
  allColumns: () => readonly string[];
  refetch: () => Promise<void>;
}

/**
 * Server-side filtering, counting and export for one SQLite table. Every query runs
 * on the database (read-only), never over the page on screen, so totals and pages
 * stay true under a filter.
 */
export function useSqliteTableQuery(context: SqliteTableQueryContext) {
  const whereClause = ref("");
  const filterError = ref<string | null>(null);
  const filteredTotal = ref<number | null>(null);
  const search = ref("");
  /** Column whose distinct values are listed with counts, or `null` for plain rows. */
  const groupBy = ref<string | null>(null);

  /** The user's WHERE combined with "search all columns". */
  const effectiveWhere = computed(() => {
    const searched = searchClause(context.allColumns(), search.value);
    if (!searched) return whereClause.value;
    return whereClause.value.trim() ? andWhere(whereClause.value, searched) : searched;
  });

  /** Plain, unfiltered rows come from the table reader; anything else is a query. */
  const needsQuery = computed(() => effectiveWhere.value.trim() !== "" || groupBy.value !== null);

  const tableTotal = computed(() =>
    needsQuery.value ? filteredTotal.value : context.tableRowCount(),
  );

  function pageQuery(offset: number, limit: number) {
    return {
      table: context.table.value,
      where: effectiveWhere.value,
      orderBy: context.orderBy.value,
      direction: context.orderDir.value,
      offset,
      limit,
    };
  }

  /** One page under the WHERE clause (plus one row to detect more), with its true count. */
  async function fetchFilteredPage(): Promise<SqliteQueryResult> {
    const query = pageQuery(
      context.page.value * context.pageSize.value,
      context.pageSize.value + 1,
    );
    const group = groupBy.value;
    const [rows, count] = await Promise.all([
      context.run(
        group
          ? buildGroupQuery(query.table, query.where, group, query.offset, query.limit)
          : buildPageQuery(query),
      ),
      context.run(
        group
          ? buildGroupCountQuery(query.table, query.where, group)
          : buildCountQuery(query.table, query.where),
      ),
    ]);
    const total = count.rows[0]?.[0];
    filteredTotal.value = typeof total === "number" ? total : null;
    return rows;
  }

  const gridSort = computed<GridSort | null>(() =>
    context.orderBy.value && context.orderDir.value
      ? {
          columnId: context.orderBy.value,
          direction: context.orderDir.value === "ASC" ? "asc" : "desc",
        }
      : null,
  );

  /** Header sort runs on the database: every page is ordered, not just the visible one. */
  function setSort(sort: GridSort | null) {
    context.orderBy.value = sort?.columnId ?? null;
    context.orderDir.value = sort ? (sort.direction === "asc" ? "ASC" : "DESC") : null;
    context.page.value = 0;
    void context.refetch();
  }

  function setWhere(where: string) {
    if (where === whereClause.value && !filterError.value) return;
    whereClause.value = where;
    filteredTotal.value = null;
    context.page.value = 0;
    void context.refetch();
  }

  function addFilter(clause: string) {
    setWhere(andWhere(whereClause.value, clause));
  }

  function setSearch(query: string) {
    if (query === search.value) return;
    search.value = query;
    filteredTotal.value = null;
    context.page.value = 0;
    void context.refetch();
  }

  function setGroupBy(column: string | null) {
    groupBy.value = column;
    filteredTotal.value = null;
    context.page.value = 0;
    void context.refetch();
  }

  /** Leaves the grouped view for the rows of one group. */
  function openGroup(value: unknown) {
    const column = groupBy.value;
    if (!column) return;
    groupBy.value = null;
    addFilter(predicate(column, "=", value));
  }

  function reset() {
    whereClause.value = "";
    filterError.value = null;
    filteredTotal.value = null;
    search.value = "";
    groupBy.value = null;
  }

  async function exportTable(format: SqliteExportFormat) {
    if (!context.table.value) return;
    try {
      const result = await context.run(buildPageQuery(pageQuery(0, 2_147_483_647)));
      const stem = fileStem(
        context.database.value,
        context.table.value,
        effectiveWhere.value ? "filtered" : "",
      );
      if (format === "csv") {
        downloadText(toCsv(result.columns, result.rows), `${stem}.csv`, "text/csv");
      } else if (format === "sql") {
        downloadText(
          toSqlInserts(context.table.value, result.columns, result.rows),
          `${stem}.sql`,
          "application/sql",
        );
      } else {
        const objects = result.rows.map((row) =>
          Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
        );
        downloadText(JSON.stringify(objects, null, 2), `${stem}.json`, "application/json");
      }
      toast.success(`Exported ${result.rows.length} rows`, { description: `${stem}.${format}` });
    } catch (error) {
      toast.error("Export failed", { description: String(error) });
    }
  }

  async function copyAsInsert(records: Record<string, unknown>[]) {
    if (records.length === 0) return;
    const columns = context.currentColumns() ?? Object.keys(records[0] ?? {});
    const text = toSqlInserts(
      context.table.value,
      columns,
      records.map((record) => columns.map((column) => record[column])),
    );
    try {
      await navigator.clipboard.writeText(text);
      toast.success(
        records.length === 1 ? "Copied INSERT" : `Copied ${records.length} INSERT statements`,
      );
    } catch (error) {
      toast.error("Could not copy", { description: String(error) });
    }
  }

  return {
    whereClause,
    filterError,
    search,
    groupBy,
    needsQuery,
    setSearch,
    setGroupBy,
    openGroup,
    tableTotal,
    fetchFilteredPage,
    setWhere,
    addFilter,
    reset,
    exportTable,
    copyAsInsert,
    gridSort,
    setSort,
  };
}
