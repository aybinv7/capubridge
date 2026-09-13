import { ref, watch } from "vue";
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  type SortingState,
  type ColumnFiltersState,
  type GroupingState,
  type ExpandedState,
  type VisibilityState,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnDef,
  type ColumnSizingState,
  type Row,
} from "@tanstack/vue-table";
import type { RowRecord } from "./useSqliteAdvancedFilters";

interface UseSqliteTableStateOptions {
  tableName: () => string;
  data: () => RowRecord[];
  columns: () => ColumnDef<RowRecord, unknown>[];
  isDeletedGhost: (record: RowRecord) => boolean;
  resetAdvancedFilters: () => void;
}

export function useSqliteTableState(options: UseSqliteTableStateOptions) {
  const sorting = ref<SortingState>([]);
  const columnFilters = ref<ColumnFiltersState>([]);
  const globalFilter = ref("");
  const grouping = ref<GroupingState>([]);
  const expanded = ref<ExpandedState>({});
  const columnVisibility = ref<VisibilityState>({});
  const columnOrder = ref<ColumnOrderState>([]);
  const columnPinning = ref<ColumnPinningState>({
    left: ["__select"],
    right: [],
  });
  const rowSelection = ref<Record<string, boolean>>({});
  const columnSizing = ref<ColumnSizingState>({});
  const tableScrollEl = ref<HTMLElement | null>(null);

  // Reset all state when table changes
  watch(options.tableName, () => {
    sorting.value = [];
    columnFilters.value = [];
    globalFilter.value = "";
    grouping.value = [];
    expanded.value = {};
    columnVisibility.value = {};
    columnOrder.value = [];
    columnPinning.value = { left: ["__select"], right: [] };
    rowSelection.value = {};
    columnSizing.value = {};
    options.resetAdvancedFilters();
  });

  const table = useVueTable({
    get data() {
      return options.data();
    },
    get columns() {
      return options.columns();
    },
    state: {
      get sorting() {
        return sorting.value;
      },
      get columnFilters() {
        return columnFilters.value;
      },
      get globalFilter() {
        return globalFilter.value;
      },
      get grouping() {
        return grouping.value;
      },
      get expanded() {
        return expanded.value;
      },
      get columnVisibility() {
        return columnVisibility.value;
      },
      get columnOrder() {
        return columnOrder.value;
      },
      get columnPinning() {
        return columnPinning.value;
      },
      get rowSelection() {
        return rowSelection.value;
      },
      get columnSizing() {
        return columnSizing.value;
      },
    },
    onSortingChange: (updater) => {
      sorting.value = typeof updater === "function" ? updater(sorting.value) : updater;
    },
    onColumnFiltersChange: (updater) => {
      columnFilters.value = typeof updater === "function" ? updater(columnFilters.value) : updater;
    },
    onGlobalFilterChange: (updater) => {
      globalFilter.value = typeof updater === "function" ? updater(globalFilter.value) : updater;
    },
    onGroupingChange: (updater) => {
      grouping.value = typeof updater === "function" ? updater(grouping.value) : updater;
    },
    onExpandedChange: (updater) => {
      expanded.value = typeof updater === "function" ? updater(expanded.value) : updater;
    },
    onColumnVisibilityChange: (updater) => {
      columnVisibility.value =
        typeof updater === "function" ? updater(columnVisibility.value) : updater;
    },
    onColumnOrderChange: (updater) => {
      columnOrder.value = typeof updater === "function" ? updater(columnOrder.value) : updater;
    },
    onColumnPinningChange: (updater) => {
      columnPinning.value = typeof updater === "function" ? updater(columnPinning.value) : updater;
    },
    onRowSelectionChange: (updater) => {
      rowSelection.value = typeof updater === "function" ? updater(rowSelection.value) : updater;
    },
    onColumnSizingChange: (updater) => {
      columnSizing.value = typeof updater === "function" ? updater(columnSizing.value) : updater;
    },
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableHiding: true,
    enableMultiSort: true,
    enableColumnPinning: true,
    enableColumnResizing: true,
    enableColumnFilters: true,
    enableGlobalFilter: true,
    enableFilters: true,
    enableSorting: true,
    enableGrouping: true,
    enableRowPinning: true,
    enableMultiRowSelection: true,
    enableMultiRemove: true,
    enableRowSelection: (row: Row<RowRecord>) => !options.isDeletedGhost(row.original),
    enableExpanding: true,
    enableSortingRemoval: true,
    enableSubRowSelection: true,
    getRowId: (_row, index) => String(index),
  });

  return {
    table,
    grouping,
    tableScrollEl,
  };
}
