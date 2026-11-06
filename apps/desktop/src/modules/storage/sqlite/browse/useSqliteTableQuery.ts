import { computed, ref, type Ref } from "vue";
import { toast } from "vue-sonner";
import { toCsv, type GridSort } from "@/shared/components/data/grid";
import { downloadText, fileStem } from "@/lib/download";
import type { SqliteQueryResult } from "@/types/sqlite.types";
import { toSqliteInserts } from "../sqlText";
import type { SqliteQueryState } from "../workspace/sqliteTabs";
import { combineWhere, makeChip, type SqliteFilterChip } from "./sqliteFilters";
import { buildPageQuery, type ColumnFilterOperator, type SqliteExportFormat } from "./sqliteQuery";
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
 * What the rows of one table are narrowed and ordered by: the filter chips, the free WHERE
 * clause, the search over every column, grouping, sort and the page. Every change starts again
 * from the first page; the rows themselves are read by `useSqliteRows`, on the database, never
 * over the page on screen. Filters are chips, never text appended to the WHERE, so an active
 * filter is always visible on its own.
 */
export function useSqliteTableQuery(context: SqliteTableQueryContext) {
  const whereClause = ref("");
  const filters = ref<SqliteFilterChip[]>([]);
  const filterError = ref<string | null>(null);
  const search = ref("");
  /** Column whose distinct values are listed with counts, or `null` for plain rows. */
  const groupBy = ref<string | null>(null);
  const orderBy = ref<string | null>(null);
  const orderDir = ref<"ASC" | "DESC" | null>(null);
  const page = ref(0);
  const pageSize = ref(50);
  /** Columns hidden from the grid (`false`), by id. */
  const columnVisibility = ref<Record<string, boolean>>({});

  /** The chips, the free WHERE and "search all columns", joined with AND. */
  const effectiveWhere = computed(() =>
    combineWhere(filters.value, whereClause.value, context.allColumns(), search.value),
  );

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

  /** Adds one condition as a chip; throws when the value cannot be written as SQL. */
  function addFilter(column: string, operator: ColumnFilterOperator, value?: unknown) {
    const chip = makeChip(column, operator, value);
    if (filters.value.some((existing) => existing.sql === chip.sql)) return;
    filters.value = [...filters.value, chip];
    filterError.value = null;
    page.value = 0;
  }

  function removeFilter(id: string) {
    filters.value = filters.value.filter((chip) => chip.id !== id);
    filterError.value = null;
    page.value = 0;
  }

  /** Drops every chip and the WHERE; the search stays. */
  function clearConditions() {
    filters.value = [];
    whereClause.value = "";
    filterError.value = null;
    page.value = 0;
  }

  /** Drops every chip, the WHERE and the search. */
  function clearFilters() {
    clearConditions();
    search.value = "";
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
    addFilter(column, "=", value);
  }

  function setPageSize(size: number) {
    pageSize.value = size;
    page.value = 0;
  }

  function reset() {
    whereClause.value = "";
    filters.value = [];
    filterError.value = null;
    search.value = "";
    groupBy.value = null;
    orderBy.value = null;
    orderDir.value = null;
    page.value = 0;
    columnVisibility.value = {};
  }

  /** Everything a tab keeps of the query, to bring it back as it was left. */
  const state = computed<SqliteQueryState>(() => ({
    search: search.value,
    where: whereClause.value,
    filters: filters.value.map((chip) => ({
      column: chip.column,
      operator: chip.operator,
      ...(chip.value !== undefined ? { value: chip.value } : {}),
    })),
    orderBy: orderBy.value,
    orderDir: orderDir.value,
    groupBy: groupBy.value,
    page: page.value,
    pageSize: pageSize.value,
    hidden: Object.entries(columnVisibility.value)
      .filter(([, shown]) => !shown)
      .map(([column]) => column),
  }));

  /** Brings back a kept query; a filter that can no longer be written as SQL is left out. */
  function restore(saved: SqliteQueryState) {
    search.value = saved.search;
    whereClause.value = saved.where;
    filters.value = saved.filters.flatMap((entry) => {
      try {
        return [makeChip(entry.column, entry.operator, entry.value)];
      } catch {
        return [];
      }
    });
    orderBy.value = saved.orderBy;
    orderDir.value = saved.orderBy ? saved.orderDir : null;
    groupBy.value = saved.groupBy;
    pageSize.value = saved.pageSize;
    page.value = Math.max(0, Math.floor(saved.page));
    columnVisibility.value = Object.fromEntries(saved.hidden.map((column) => [column, false]));
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
    filters,
    filterError,
    search,
    groupBy,
    orderBy,
    orderDir,
    page,
    pageSize,
    columnVisibility,
    state,
    restore,
    effectiveWhere,
    needsQuery,
    setSearch,
    setGroupBy,
    openGroup,
    setWhere,
    addFilter,
    removeFilter,
    clearConditions,
    clearFilters,
    setPageSize,
    reset,
    exportTable,
    copyAsInsert,
    gridSort,
    setSort,
  };
}

export type SqliteTableQuery = ReturnType<typeof useSqliteTableQuery>;
