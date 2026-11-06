import { computed, ref, type Ref } from "vue";
import { toast } from "vue-sonner";
import { toCsv, type GridSort } from "@/shared/components/data/grid";
import { downloadText, fileStem } from "@/lib/download";
import type { SqliteQueryResult } from "@/types/sqlite.types";
import { toSqliteInserts } from "../sqlText";
import {
  andWhere,
  buildPageQuery,
  predicate,
  searchClause,
  type SqliteExportFormat,
} from "./sqliteQuery";
import type { SqliteRowOrder } from "./sqliteRowOrder";

export interface SqliteTableQueryContext {
  /** Runs a read-only query on the open copy; `fullValues` sends every byte of BLOBs. */
  run: (sql: string, fullValues?: boolean) => Promise<SqliteQueryResult>;
  table: Ref<string>;
  database: Ref<string>;
  /** Columns of the page on screen, for "copy as INSERT". */
  currentColumns: () => readonly string[] | null;
  /** Every column of the table, for "search all columns". */
  allColumns: () => readonly string[];
  /** Breaks ties of the sort, so exported rows follow the order on screen. */
  rowOrder?: () => SqliteRowOrder;
}

/**
 * What the rows of one table are narrowed and ordered by: the WHERE clause, the search over every
 * column, grouping, sort and the page. Every change starts again from the first page; the rows
 * themselves are read by `useSqliteRows`, on the database, never over the page on screen.
 */
export function useSqliteTableQuery(context: SqliteTableQueryContext) {
  const whereClause = ref("");
  const filterError = ref<string | null>(null);
  const search = ref("");
  /** Column whose distinct values are listed with counts, or `null` for plain rows. */
  const groupBy = ref<string | null>(null);
  const orderBy = ref<string | null>(null);
  const orderDir = ref<"ASC" | "DESC" | null>(null);
  const page = ref(0);
  const pageSize = ref(50);

  /** The user's WHERE combined with "search all columns". */
  const effectiveWhere = computed(() => {
    const searched = searchClause(context.allColumns(), search.value);
    if (!searched) return whereClause.value;
    return whereClause.value.trim() ? andWhere(whereClause.value, searched) : searched;
  });

  /** Plain, unfiltered rows come from the table reader; anything else is a query. */
  const needsQuery = computed(() => effectiveWhere.value.trim() !== "" || groupBy.value !== null);

  const gridSort = computed<GridSort | null>(() =>
    orderBy.value && orderDir.value
      ? { columnId: orderBy.value, direction: orderDir.value === "ASC" ? "asc" : "desc" }
      : null,
  );

  /** Header sort runs on the database: every page is ordered, not just the visible one. */
  function setSort(sort: GridSort | null) {
    orderBy.value = sort?.columnId ?? null;
    orderDir.value = sort ? (sort.direction === "asc" ? "ASC" : "DESC") : null;
    page.value = 0;
  }

  function setWhere(where: string) {
    if (where === whereClause.value) return;
    whereClause.value = where;
    filterError.value = null;
    page.value = 0;
  }

  function addFilter(clause: string) {
    setWhere(andWhere(whereClause.value, clause));
  }

  function setSearch(query: string) {
    if (query === search.value) return;
    search.value = query;
    page.value = 0;
  }

  function setGroupBy(column: string | null) {
    groupBy.value = column;
    page.value = 0;
  }

  /** Leaves the grouped view for the rows of one group. */
  function openGroup(value: unknown) {
    const column = groupBy.value;
    if (!column) return;
    groupBy.value = null;
    addFilter(predicate(column, "=", value));
  }

  function setPageSize(size: number) {
    pageSize.value = size;
    page.value = 0;
  }

  function reset() {
    whereClause.value = "";
    filterError.value = null;
    search.value = "";
    groupBy.value = null;
    orderBy.value = null;
    orderDir.value = null;
    page.value = 0;
  }

  async function exportTable(format: SqliteExportFormat) {
    if (!context.table.value) return;
    try {
      const result = await context.run(
        buildPageQuery({
          table: context.table.value,
          where: effectiveWhere.value,
          orderBy: orderBy.value,
          direction: orderDir.value,
          offset: 0,
          limit: 2_147_483_647,
          rowOrder: context.rowOrder?.(),
        }),
        true,
      );
      const stem = fileStem(
        context.database.value,
        context.table.value,
        effectiveWhere.value ? "filtered" : "",
      );
      if (format === "csv") {
        downloadText(toCsv(result.columns, result.rows), `${stem}.csv`, "text/csv");
      } else if (format === "sql") {
        downloadText(
          toSqliteInserts(context.table.value, result.columns, result.rows),
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
      toast.error("Could not export the rows", { description: String(error) });
    }
  }

  async function copyAsInsert(records: Record<string, unknown>[]) {
    if (records.length === 0) return;
    const columns = context.currentColumns() ?? Object.keys(records[0] ?? {});
    try {
      const text = toSqliteInserts(
        context.table.value,
        columns,
        records.map((record) => columns.map((column) => record[column])),
      );
      await navigator.clipboard.writeText(text);
      toast.success(
        records.length === 1 ? "Copied INSERT" : `Copied ${records.length} INSERT statements`,
      );
    } catch (error) {
      toast.error("Could not copy", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    whereClause,
    filterError,
    search,
    groupBy,
    orderBy,
    orderDir,
    page,
    pageSize,
    effectiveWhere,
    needsQuery,
    setSearch,
    setGroupBy,
    openGroup,
    setWhere,
    addFilter,
    setPageSize,
    reset,
    exportTable,
    copyAsInsert,
    gridSort,
    setSort,
  };
}

export type SqliteTableQuery = ReturnType<typeof useSqliteTableQuery>;
