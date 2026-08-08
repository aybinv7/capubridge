<script setup lang="ts">
import { computed, ref, h, watch, onUnmounted } from "vue";
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  FlexRender,
  createColumnHelper,
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
import type { CheckboxCheckedState } from "reka-ui";
import type { SqliteColumnInfo } from "@/types/sqlite.types";
import type { SqliteChangeOperation, SqliteRecordChange } from "@/types/sqliteChanges.types";
import { buildRowKey, orderKeyColumns } from "@/modules/storage/changes/sqliteRowKey";
import { toast } from "vue-sonner";
import { useModalGuard } from "@/composables/useModalGuard";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";

// UI components
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

// Module composables & components
import type { RowRecord, AdvancedFilter } from "./useSqliteAdvancedFilters";
import { useSqliteAdvancedFilters } from "./useSqliteAdvancedFilters";
import { useSqliteTableExport } from "./useSqliteTableExport";
import { useSqliteRowDetail } from "./useSqliteRowDetail";
import SqliteRowDetailDialog from "./SqliteRowDetailDialog.vue";
import SqliteTableActions from "./SqliteTableActions.vue";
import SqliteCellEditor from "./SqliteCellEditor.vue";
import { useSqliteColumnEditors } from "./useSqliteColumnEditors";
import {
  type SqliteEditorKind,
  EDITOR_KINDS,
  detectEditorKind,
  toEditorString,
} from "./cellEditorTypes";

// Icons
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  EyeOff,
  Pin,
  Layers,
  Download,
  ChevronRight,
  ChevronDown,
  Check,
  Plus,
  Pencil,
  Trash2,
} from "lucide-vue-next";

const props = defineProps<{
  columns: string[];
  rows: unknown[][];
  isLoading: boolean;
  tableName: string;
  dbName: string;
  columnInfo?: SqliteColumnInfo[];
  changesByRowKey?: Map<string, SqliteRecordChange>;
  showChangesOnly?: boolean;
  readOnly?: boolean;
  rowKeyResolver?: (record: Record<string, unknown>) => string;
}>();

const emit = defineEmits<{
  refresh: [];
  recordEdit: [original: Record<string, unknown>, updated: Record<string, unknown>];
  recordDelete: [record: Record<string, unknown>];
  recordDeleteBulk: [records: Record<string, unknown>[]];
  openRowDiff: [rowKey: string];
}>();

const canEditRows = computed(
  () => !props.readOnly && (props.columnInfo ?? []).some((c) => c.pk > 0),
);

const pkColumns = computed(() => orderKeyColumns(props.columnInfo ?? []));

function rowChangeFor(record: Record<string, unknown>): SqliteRecordChange | null {
  const map = props.changesByRowKey;
  if (!map) return null;
  const key = props.rowKeyResolver?.(record) ?? buildRowKey(pkColumns.value, record);
  if (!key) return null;
  return map.get(key) ?? null;
}

function rowChangeOperation(record: Record<string, unknown>): SqliteChangeOperation | null {
  return rowChangeFor(record)?.operation ?? null;
}

/** A row shown only because it was deleted — it has no counterpart in the table. */
function isDeletedGhost(record: Record<string, unknown>): boolean {
  return rowChangeOperation(record) === "delete";
}

/** Single mutually-exclusive row background, matching the IndexedDB table.
 *  Returned as one string rather than a class object so two bg-* utilities
 *  can't land on the same element and race on rule order. */
function rowChangeClass(record: Record<string, unknown>): string {
  const operation = rowChangeOperation(record);
  if (operation === "add") return "bg-emerald-500/4";
  if (operation === "update") return "bg-amber-500/4";
  if (operation === "delete") return "bg-red-500/4 opacity-75";
  return "";
}

/** Background for pinned cells, which sit above the row and need their own
 *  opaque fill or the columns behind them show through while scrolling. */
function stickyRowBg(record: Record<string, unknown>, isSelected: boolean): string {
  if (isSelected) return "bg-surface-3";
  const operation = rowChangeOperation(record);
  if (operation === "add") return "bg-emerald-500/[0.04]";
  if (operation === "update") return "bg-amber-500/[0.04]";
  if (operation === "delete") return "bg-red-500/[0.04]";
  return "bg-background";
}

function changeIndicatorClass(record: Record<string, unknown>): string {
  const operation = rowChangeOperation(record);
  if (operation === "add") return "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30";
  if (operation === "update") return "bg-amber-500/15 text-amber-400 ring-amber-500/30";
  if (operation === "delete") return "bg-red-500/15 text-red-400 ring-red-500/30";
  return "";
}

function changeIcon(record: Record<string, unknown>) {
  const operation = rowChangeOperation(record);
  if (operation === "add") return Plus;
  if (operation === "update") return Pencil;
  if (operation === "delete") return Trash2;
  return null;
}

// ─── Table State ─────────────────────────────────────────────────────────────
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
watch(
  () => props.tableName,
  () => {
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
    resetAdvancedFilters();
  },
);

// ─── Transform rows into objects ─────────────────────────────────────────────
const rawTableData = computed<RowRecord[]>(() => {
  return props.rows.map((row) => {
    const obj: RowRecord = {};
    props.columns.forEach((col, i) => {
      obj[col] = row[i] ?? null;
    });
    return obj;
  });
});

/**
 * Deleted rows are gone from the query result, so a delete would otherwise be
 * invisible here — the row simply stops existing. Re-insert them from the
 * change feed's `beforeValue` as read-only ghosts, the way the IndexedDB table
 * keeps deleted records on screen.
 */
const deletedGhostRows = computed<RowRecord[]>(() => {
  const map = props.changesByRowKey;
  if (!map || map.size === 0) return [];

  const present = new Set(
    rawTableData.value
      .map((record) => props.rowKeyResolver?.(record) ?? buildRowKey(pkColumns.value, record))
      .filter((key) => key !== ""),
  );

  const ghosts: RowRecord[] = [];
  for (const [key, change] of map) {
    if (change.operation !== "delete" || present.has(key)) continue;
    const before = change.beforeValue;
    if (!before) continue;
    const record: RowRecord = {};
    for (const col of props.columns) record[col] = before[col] ?? null;
    ghosts.push(record);
  }
  return ghosts;
});

const tableData = computed<RowRecord[]>(() => {
  const withGhosts = [...rawTableData.value, ...deletedGhostRows.value];
  if (!props.showChangesOnly) return withGhosts;
  const map = props.changesByRowKey;
  if (!map) return withGhosts;
  return withGhosts.filter((record) => {
    const key = props.rowKeyResolver?.(record) ?? buildRowKey(pkColumns.value, record);
    return key !== "" && map.has(key);
  });
});

// ─── Advanced Filters ────────────────────────────────────────────────────────
const {
  advancedFilters,
  filteredData,
  addFilter,
  reset: resetAdvancedFilters,
} = useSqliteAdvancedFilters(tableData);

function updateFilters(filters: AdvancedFilter[]) {
  advancedFilters.value = [...filters];
}

// ─── Column Helper & Dynamic Columns ────────────────────────────────────────
const columnHelper = createColumnHelper<RowRecord>();

const columns_def = computed<ColumnDef<RowRecord, unknown>[]>(() => {
  const selectCol = columnHelper.display({
    id: "__select",
    header: ({ table }) =>
      h(Checkbox, {
        modelValue: table.getIsAllRowsSelected()
          ? true
          : table.getIsSomeRowsSelected()
            ? "indeterminate"
            : false,
        "onUpdate:modelValue": (value: boolean | string) => {
          if (typeof value === "boolean") {
            table.toggleAllRowsSelected(value);
          } else {
            table.toggleAllRowsSelected();
          }
        },
        class: "h-3.5 w-3.5",
      }),
    size: 38,
    minSize: 34,
    maxSize: 42,
    enableHiding: false,
    enableResizing: false,
    enableGrouping: false,
    enableColumnFilter: true,
    cell: ({ row }) =>
      h("div", { class: "flex items-center justify-center gap-1" }, [
        (() => {
          const ChangeIcon = changeIcon(row.original);
          if (!ChangeIcon) return null;
          return h(
            "span",
            {
              class: [
                "flex size-4 items-center justify-center rounded-sm ring-1",
                changeIndicatorClass(row.original),
              ],
              title: rowChangeOperation(row.original) ?? undefined,
            },
            [h(ChangeIcon, { class: "size-2.5" })],
          );
        })(),
        h(
          Checkbox,
          {
            modelValue: row.getIsSelected(),
            disabled: isDeletedGhost(row.original),
            "onUpdate:modelValue": (value: CheckboxCheckedState) => {
              if (value !== row.getIsSelected()) {
                row.toggleSelected();
              }
            },
            class: "h-3.5 w-3.5",
          },
          {
            default: ({ checked }: { checked: CheckboxCheckedState }) =>
              checked
                ? h(Check, { class: "size-3" })
                : !checked
                  ? null
                  : h("div", { class: "size-2.5 bg-primary rounded-sm" }),
          },
        ),
      ]),
  });

  const dataCols = props.columns.map((col) =>
    columnHelper.accessor((row) => row[col], {
      id: col,
      header: col,
      size: 200,
      minSize: 80,
      enableHiding: true,
      enableResizing: true,
      enableSorting: true,
      enableGrouping: true,
      enableColumnFilter: true,
      enableGlobalFilter: true,
      cell: (info) => {
        const v = info.getValue();
        if (v === null || v === undefined) return "";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      },
      filterFn: "includesString",
    }),
  );

  return [selectCol, ...dataCols];
});

// ─── Table Instance ─────────────────────────────────────────────────────────
const table = useVueTable({
  get data() {
    return filteredData.value;
  },
  get columns() {
    return columns_def.value;
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
  enableRowSelection: (row) => !isDeletedGhost(row.original),
  enableExpanding: true,
  enableSortingRemoval: true,
  enableSubRowSelection: true,
  getRowId: (_row, index) => String(index),
});

// ─── Export ──────────────────────────────────────────────────────────────────
const { exportSelectedToJSON } = useSqliteTableExport(
  table,
  () => props.dbName,
  () => props.tableName,
);

// ─── Row Detail Dialog ───────────────────────────────────────────────────────
const jsonEditorValid = ref(true);
const {
  isDetailOpen,
  editJson,
  editKey,
  currentRowIndex,
  copiedRaw,
  badge,
  hasChange,
  dialogEntrySize,
  openRowDetail,
  navigateRow,
  copyToClipboard,
  saveEdit,
  deleteRow,
  viewDiff,
  jsonEditorValid: composableJsonValid,
} = useSqliteRowDetail({
  getFilteredRows: () => table.getFilteredRowModel().rows,
  columnNames: () => props.columns,
  canEdit: () => canEditRows.value,
  canMutate: (record) => !isDeletedGhost(record),
  hasChange: (record) => !!rowChangeFor(record),
  onEdit: (original, updated) => emit("recordEdit", original, updated),
  onDelete: (record) => emit("recordDelete", record),
  onViewDiff: (record) => {
    const key = props.rowKeyResolver?.(record) ?? buildRowKey(pkColumns.value, record);
    if (key) emit("openRowDiff", key);
  },
});

// ─── Row viewer / inline cell editing ────────────────────────────────────────
// One click opens the row viewer, a second click within the window edits the
// cell in place.
//
// The short window is load-bearing, not a stylistic choice: the viewer is a
// centered modal, so the moment it opens its overlay covers the table and the
// second click lands on the overlay instead of the cell. Waiting lets us tell
// the two gestures apart before anything covers the row. Anything under ~180ms
// starts losing genuine double clicks.
//
// The write side differs from IndexedDB. There a record is replaced wholesale;
// here the edit becomes `UPDATE <table> SET <col> = ? WHERE <pk> = ?`, which is
// why primary-key columns stay read-only (they're the WHERE clause) and why
// tables without a primary key can't be edited at all.
const CLICK_TO_EDIT_MS = 200;

const editingCell = ref<{
  rowId: string;
  columnId: string;
} | null>(null);
let clickTimer: ReturnType<typeof setTimeout> | null = null;

const { getOverride, setOverride, clearOverride } = useSqliteColumnEditors();

function columnInfoFor(columnId: string): SqliteColumnInfo | undefined {
  return (props.columnInfo ?? []).find((c) => c.name === columnId);
}

/**
 * Detection needs a real value to sniff, and the clicked row's cell may be
 * NULL. Fall back to the first non-null value in the column so a NULL date
 * still gets a date picker.
 */
function sampleValueFor(columnId: string, preferred: unknown): unknown {
  if (preferred !== null && preferred !== undefined) return preferred;
  for (const record of rawTableData.value) {
    const v = record[columnId];
    if (v !== null && v !== undefined) return v;
  }
  return preferred;
}

function editorKindFor(columnId: string, value: unknown): SqliteEditorKind {
  const override = getOverride(props.dbName, props.tableName, columnId);
  if (override) return override;
  return detectEditorKind(columnInfoFor(columnId), sampleValueFor(columnId, value));
}

/** What "Auto" would pick for this column, shown next to the Auto menu entry. */
function detectedKindLabel(columnId: string): SqliteEditorKind {
  return detectEditorKind(columnInfoFor(columnId), sampleValueFor(columnId, null));
}

const pkColumnNames = computed(() => new Set(pkColumns.value.map((c) => c.name)));

function isCellEditable(record: RowRecord, columnId: string): boolean {
  if (!canEditRows.value) return false;
  if (columnId === "__select") return false;
  // Primary-key columns identify the row in the WHERE clause; changing one
  // would rewrite a different row than the one on screen.
  if (pkColumnNames.value.has(columnId)) return false;
  return !isDeletedGhost(record);
}

function getCellEditValue(record: RowRecord, columnId: string): string {
  return toEditorString(record[columnId]);
}

function handleCellClick(row: Row<RowRecord>, columnId: string) {
  if (columnId === "__select") return;

  if (clickTimer !== null) {
    clearTimeout(clickTimer);
    clickTimer = null;
    startCellEdit(row, columnId);
    return;
  }

  clickTimer = setTimeout(() => {
    clickTimer = null;
    openRowViewer(row);
  }, CLICK_TO_EDIT_MS);
}

function startCellEdit(row: Row<RowRecord>, columnId: string) {
  if (columnId === "__select") return;
  if (!canEditRows.value) {
    // Say why rather than doing nothing — a dead double click reads as a bug.
    toast.error("Cannot edit", {
      description: props.readOnly
        ? "This view is read-only."
        : "No column info for this table, so rows can't be identified.",
    });
    return;
  }
  if (isDeletedGhost(row.original)) {
    toast.info("Row deleted", { description: "This row no longer exists in the table." });
    return;
  }
  if (pkColumnNames.value.has(columnId)) {
    toast.info("Primary key", {
      description: `"${columnId}" identifies the row and can't be edited.`,
    });
    return;
  }
  editingCell.value = { rowId: row.id, columnId };
}

function isEditing(rowId: string, columnId: string): boolean {
  return editingCell.value?.rowId === rowId && editingCell.value?.columnId === columnId;
}

function commitInlineEdit(next: unknown) {
  if (!editingCell.value) return;
  const { rowId, columnId } = editingCell.value;
  const found = table.getRowModel().rows.find((r) => r.id === rowId);
  editingCell.value = null;
  if (!found) return;

  const original = found.original;
  // Skip the UPDATE when nothing actually changed.
  if (JSON.stringify(original[columnId] ?? null) === JSON.stringify(next ?? null)) return;

  emit("recordEdit", original, { ...original, [columnId]: next });
}

function cancelInlineEdit() {
  editingCell.value = null;
}

onUnmounted(() => {
  if (clickTimer !== null) clearTimeout(clickTimer);
});

// ─── Row context menu ────────────────────────────────────────────────────────
// The menu is opened by reka-ui on the row, but the actions are cell-scoped, so
// remember which cell the right-click landed on.
const contextColumnId = ref<string | null>(null);

function onCellContextMenu(columnId: string) {
  // A pending single click would otherwise open the viewer behind the menu.
  if (clickTimer !== null) {
    clearTimeout(clickTimer);
    clickTimer = null;
  }
  contextColumnId.value = columnId === "__select" ? null : columnId;
}

function contextCellLabel(): string {
  return contextColumnId.value ? `Edit "${contextColumnId.value}"` : "Edit cell";
}

function canEditContextCell(record: RowRecord): boolean {
  return !!contextColumnId.value && isCellEditable(record, contextColumnId.value);
}

function editContextCell(row: Row<RowRecord>) {
  if (contextColumnId.value) startCellEdit(row, contextColumnId.value);
}

function copyContextCell(record: RowRecord) {
  if (!contextColumnId.value) return;
  void copyToClipboard(getCellEditValue(record, contextColumnId.value));
}

function copyRowAsJson(record: RowRecord) {
  void copyToClipboard(JSON.stringify(record, null, 2));
}

function rowKeyFor(record: RowRecord): string {
  return props.rowKeyResolver?.(record) ?? buildRowKey(pkColumns.value, record);
}

function openRowViewer(row: Row<RowRecord>) {
  const rows = table.getFilteredRowModel().rows;
  const idx = rows.findIndex((r) => r.id === row.id);
  openRowDetail(row.original, idx >= 0 ? idx : undefined);
}

watch(jsonEditorValid, (v) => {
  composableJsonValid.value = v;
});

useModalGuard(isDetailOpen);

// ─── Computed Stats ──────────────────────────────────────────────────────────
const filteredRowCount = computed(() => table.getFilteredRowModel().rows.length);
const selectedRowCount = computed(() => table.getSelectedRowModel().rows.length);
const visibleRows = computed(() => table.getRowModel().rows);
const {
  items: virtualRows,
  topSpacerHeight,
  bottomSpacerHeight,
} = useFixedVirtualList(visibleRows, tableScrollEl, { itemHeight: 36, overscan: 10 });

// ─── Grouping Helpers ────────────────────────────────────────────────────────
const isColumnGrouped = (columnId: string) => grouping.value.includes(columnId);

function toggleGrouping(columnId: string) {
  if (grouping.value.includes(columnId)) {
    grouping.value = grouping.value.filter((id) => id !== columnId);
  } else {
    grouping.value = [...grouping.value, columnId];
  }
}

// ─── Cell rendering helpers ─────────────────────────────────────────────────
function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function isNull(val: unknown): boolean {
  return val === null || val === undefined;
}

function isBlob(val: unknown): boolean {
  return typeof val === "string" && (val as string).startsWith("[BLOB");
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden" data-sqlite-table-container>
    <!-- ─── Table Actions Toolbar ───────────────────────────────────────────────── -->
    <SqliteTableActions
      :table="table"
      :grouping="grouping"
      :db-name="dbName"
      :table-name="tableName"
      :column-info="columnInfo"
      :advanced-filters="advancedFilters"
      :can-delete="canEditRows"
      @update:grouping="grouping = $event"
      @update:filters="updateFilters"
      @record-delete-bulk="emit('recordDeleteBulk', $event)"
    />

    <!-- ─── Table ────────────────────────────────────────────────────────── -->
    <div ref="tableScrollEl" class="flex-1 overflow-auto min-h-0 relative">
      <!-- Loading skeleton -->
      <div v-if="isLoading && rows.length === 0" class="flex flex-col gap-px p-1">
        <div
          v-for="i in 30"
          :key="i"
          class="h-9 animate-pulse bg-surface-3/50"
          :style="{ animationDelay: `${i * 40}ms` }"
        />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!isLoading && rows.length === 0"
        class="flex h-40 items-center justify-center text-sm text-muted-foreground/30"
      >
        No rows in this table
      </div>

      <!-- No results after filtering -->
      <div
        v-else-if="filteredRowCount === 0"
        class="flex h-40 items-center justify-center text-sm text-muted-foreground/30"
      >
        No matching rows
      </div>

      <!-- Table content -->
      <table v-else class="w-full border-collapse text-sm" style="table-layout: fixed">
        <thead class="bg-background">
          <!-- Grouping headers row -->
          <tr v-if="grouping.length > 0">
            <th
              v-for="header in (table.getHeaderGroups()[0]?.headers ?? []).filter((h) =>
                h.column.getIsVisible(),
              )"
              :key="header.id"
              :colspan="header.colSpan"
              :style="{ width: header.getSize() + 'px' }"
              class="h-7 border-b border-border/20 bg-surface-3/30 px-3 text-left text-xs font-medium text-muted-foreground/50 select-none"
              :class="{
                'sticky left-0 z-2': header.column.getIsPinned() === 'left',
                'sticky right-0 z-2': header.column.getIsPinned() === 'right',
              }"
            >
              <FlexRender
                v-if="header.isPlaceholder"
                :render="header.column.columnDef.header"
                :props="header.getContext()"
              />
            </th>
          </tr>

          <!-- Main header row -->
          <tr>
            <th
              v-for="header in table.getFlatHeaders().filter((h) => h.column.getIsVisible())"
              :key="header.id"
              :style="{ width: header.getSize() + 'px' }"
              class="group top-0 z-1 h-10 border-b border-border/30 bg-surface-2 px-3 text-left text-xs font-medium text-muted-foreground/50 select-none relative"
              :class="{
                'sticky left-0 z-2': header.column.getIsPinned() === 'left',
                'sticky right-0 z-2': header.column.getIsPinned() === 'right',
              }"
            >
              <!-- Column actions dropdown -->
              <DropdownMenu v-if="header.column.id !== '__select'">
                <DropdownMenuTrigger as-child>
                  <div
                    class="flex items-center gap-1 h-full w-full cursor-pointer hover:bg-surface-3/50"
                  >
                    <span class="truncate flex-1 min-w-0 font-mono">
                      <FlexRender
                        :render="header.column.columnDef.header"
                        :props="header.getContext()"
                      />
                    </span>
                    <span class="shrink-0">
                      <ArrowUpDown v-if="!header.column.getIsSorted()" class="h-3 w-3 opacity-40" />
                      <ArrowUp
                        v-else-if="header.column.getIsSorted() === 'asc'"
                        class="h-3 w-3 text-foreground/60"
                      />
                      <ArrowDown v-else class="h-3 w-3 text-foreground/60" />
                    </span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" class="w-48 max-h-72 overflow-y-auto">
                  <DropdownMenuLabel class="text-[10px] uppercase tracking-wider">
                    {{ header.column.columnDef.header ?? header.column.id }}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <!-- Sort -->
                  <DropdownMenuGroup v-if="header.column.getCanSort()">
                    <DropdownMenuItem
                      class="text-xs"
                      :class="{
                        'bg-accent': header.column.getIsSorted() === 'asc',
                      }"
                      @click="header.column.toggleSorting(false)"
                    >
                      <ArrowUp class="h-3 w-3 mr-2" />
                      Ascending
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="text-xs"
                      :class="{
                        'bg-accent': header.column.getIsSorted() === 'desc',
                      }"
                      @click="header.column.toggleSorting(true)"
                    >
                      <ArrowDown class="h-3 w-3 mr-2" />
                      Descending
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="header.column.getIsSorted()"
                      class="text-xs text-muted-foreground"
                      @click="header.column.clearSorting()"
                    >
                      <ArrowUpDown class="h-3 w-3 mr-2" />
                      Clear sort
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator v-if="header.column.getCanSort()" />

                  <!-- Filter -->
                  <DropdownMenuItem class="text-xs" @click="addFilter(header.column.id)">
                    <Filter class="h-3 w-3 mr-2" />
                    Filter...
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="header.column.getIsFiltered()"
                    class="text-xs text-muted-foreground"
                    @click="header.column.setFilterValue(undefined)"
                  >
                    <X class="h-3 w-3 mr-2" />
                    Clear filter
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <!-- Group by -->
                  <DropdownMenuItem class="text-xs" @click="toggleGrouping(header.column.id)">
                    <Layers class="h-3 w-3 mr-2" />
                    {{ isColumnGrouped(header.column.id) ? "Ungroup" : "Group by" }}
                  </DropdownMenuItem>

                  <!-- Editor override: SQLite has no date/bool type, so
                       detection guesses. This makes a wrong guess fixable. -->
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger class="text-xs">
                      <Pencil class="h-3 w-3 mr-2" />
                      Cell editor
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem
                        class="text-xs"
                        @click="clearOverride(dbName, tableName, header.column.id)"
                      >
                        Auto
                        <span class="ml-auto pl-2 text-[10px] text-muted-foreground/50">
                          {{ detectedKindLabel(header.column.id) }}
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        v-for="kind in EDITOR_KINDS"
                        :key="kind"
                        class="text-xs capitalize"
                        @click="setOverride(dbName, tableName, header.column.id, kind)"
                      >
                        {{ kind }}
                        <Check
                          v-if="getOverride(dbName, tableName, header.column.id) === kind"
                          class="ml-auto h-3 w-3"
                        />
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <!-- Pin -->
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger class="text-xs">
                      <Pin class="h-3 w-3 mr-2" />
                      Pin column
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem
                        class="text-xs"
                        :class="{
                          'bg-accent': header.column.getIsPinned() === 'left',
                        }"
                        @click="header.column.pin('left')"
                      >
                        Pin to left
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        class="text-xs"
                        :class="{
                          'bg-accent': header.column.getIsPinned() === 'right',
                        }"
                        @click="header.column.pin('right')"
                      >
                        Pin to right
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        v-if="header.column.getIsPinned()"
                        class="text-xs text-muted-foreground"
                        @click="header.column.pin(false)"
                      >
                        Unpin
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <!-- Hide -->
                  <DropdownMenuItem
                    class="text-xs text-muted-foreground"
                    @click="header.column.toggleVisibility(false)"
                  >
                    <EyeOff class="h-3 w-3 mr-2" />
                    Hide column
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <!-- Select column header (non-clickable) -->
              <div v-else class="flex items-center gap-1 h-full">
                <span class="truncate">
                  <FlexRender
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                </span>
              </div>

              <!-- Resize handle -->
              <div
                v-if="header.column.getCanResize()"
                class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-foreground/20 transition-colors z-20 select-none"
                @mousedown="(e) => header.getResizeHandler()(e)"
                @touchstart="(e) => header.getResizeHandler()(e)"
              />
            </th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="topSpacerHeight > 0" aria-hidden="true">
            <td
              :colspan="table.getVisibleLeafColumns().length"
              :style="{ height: `${topSpacerHeight}px` }"
            />
          </tr>
          <template v-for="{ data: row } in virtualRows" :key="row.id">
            <!-- Group header -->
            <tr v-if="row.getIsGrouped()" class="bg-surface-3/30 border-b border-border/20">
              <td :colspan="row.getVisibleCells().length" class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <Checkbox
                    :model-value="row.getIsSelected()"
                    @update:model-value="row.toggleSelected()"
                    class="h-3.5 w-3.5"
                  />
                  <button
                    class="flex items-center gap-2 text-xs font-medium text-foreground/70 hover:text-foreground"
                    @click="row.toggleExpanded()"
                  >
                    <component
                      :is="row.getIsExpanded() ? ChevronDown : ChevronRight"
                      class="h-3 w-3"
                    />
                    <span>
                      {{ row.groupingColumnId }}:
                      <code class="text-[10px] bg-surface-3 px-1 rounded">
                        {{ row.getValue(row.groupingColumnId ?? "") }}
                      </code>
                      <span class="text-muted-foreground/40 ml-1">
                        ({{ row.subRows.length }})
                      </span>
                    </span>
                  </button>
                </div>
              </td>
            </tr>

            <!-- Data row -->
            <ContextMenu v-else>
              <ContextMenuTrigger as-child>
                <tr
                  class="group select-none border-b border-border/20 hover:bg-surface-2/50 transition-colors duration-75"
                  :class="[
                    {
                      'bg-surface-3/30': row.getIsGrouped(),
                      'pl-6': row.depth > 0,
                      'bg-brand/10!': row.getIsSelected(),
                    },
                    rowChangeClass(row.original),
                  ]"
                >
                  <td
                    v-for="cell in row.getVisibleCells()"
                    :key="cell.id"
                    class="h-9 overflow-hidden text-ellipsis whitespace-nowrap px-3 font-mono text-foreground/80 text-xs"
                    :class="[
                      {
                        'sticky left-0 z-3': cell.column.getIsPinned() === 'left',
                        'sticky right-0 z-3': cell.column.getIsPinned() === 'right',
                      },
                      cell.column.getIsPinned()
                        ? stickyRowBg(row.original, row.getIsSelected())
                        : '',
                    ]"
                    @click="handleCellClick(row, cell.column.id)"
                    @contextmenu="onCellContextMenu(cell.column.id)"
                  >
                    <!-- Select column: render via FlexRender -->
                    <template v-if="cell.column.id === '__select'">
                      <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                    </template>
                    <!-- Inline cell editor -->
                    <SqliteCellEditor
                      v-else-if="isEditing(row.id, cell.column.id)"
                      :kind="editorKindFor(cell.column.id, row.original[cell.column.id])"
                      :value="row.original[cell.column.id]"
                      :column="columnInfoFor(cell.column.id)"
                      @commit="commitInlineEdit"
                      @cancel="cancelInlineEdit"
                    />
                    <!-- Null values -->
                    <span
                      v-else-if="isNull(cell.getValue())"
                      class="text-muted-foreground/30 italic text-[10px]"
                    >
                      NULL
                    </span>
                    <!-- Blob preview -->
                    <span
                      v-else-if="isBlob(cell.getValue())"
                      class="font-mono text-[11px] text-amber-500/70"
                    >
                      {{ cell.getValue() }}
                    </span>
                    <!-- Normal values -->
                    <span v-else :title="formatCellValue(cell.getValue())">
                      {{ formatCellValue(cell.getValue()) }}
                    </span>
                  </td>
                </tr>
              </ContextMenuTrigger>
              <ContextMenuContent class="w-52">
                <ContextMenuItem @select="openRowViewer(row)">View row</ContextMenuItem>
                <ContextMenuItem
                  :disabled="!canEditContextCell(row.original)"
                  @select="editContextCell(row)"
                >
                  {{ contextCellLabel() }}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  :disabled="!contextColumnId"
                  @select="copyContextCell(row.original)"
                >
                  Copy cell value
                </ContextMenuItem>
                <ContextMenuItem @select="copyRowAsJson(row.original)">
                  Copy row as JSON
                </ContextMenuItem>
                <template v-if="rowChangeFor(row.original)">
                  <ContextMenuSeparator />
                  <ContextMenuItem @select="emit('openRowDiff', rowKeyFor(row.original))">
                    View change diff
                  </ContextMenuItem>
                </template>
                <template v-if="canEditRows && !isDeletedGhost(row.original)">
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    variant="destructive"
                    @select="emit('recordDelete', row.original)"
                  >
                    Delete row
                  </ContextMenuItem>
                </template>
              </ContextMenuContent>
            </ContextMenu>
          </template>
          <tr v-if="bottomSpacerHeight > 0" aria-hidden="true">
            <td
              :colspan="table.getVisibleLeafColumns().length"
              :style="{ height: `${bottomSpacerHeight}px` }"
            />
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ─── Footer ───────────────────────────────────────────────────────── -->
    <div
      class="flex shrink-0 items-center justify-between border-t border-border/30 bg-surface-2 px-3 py-1.5"
    >
      <span class="text-[10px] text-muted-foreground/40 tabular-nums">
        {{ filteredRowCount.toLocaleString() }} / {{ rows.length.toLocaleString() }} rows
      </span>

      <div class="flex items-center gap-2">
        <template v-if="selectedRowCount > 0">
          <Button
            variant="ghost"
            size="icon-sm"
            class="h-5 w-5"
            title="Copy selected as JSON"
            @click="exportSelectedToJSON"
          >
            <Download class="h-3 w-3" />
          </Button>
        </template>

        <span class="text-[10px] text-muted-foreground/30">
          Drag column edges to resize · Double-click row to view details
        </span>
      </div>
    </div>

    <!-- ─── Row Detail Dialog ─────────────────────────────────────────────── -->
    <SqliteRowDetailDialog
      v-model:open="isDetailOpen"
      v-model:edit-json="editJson"
      :edit-key="editKey"
      :current-row-index="currentRowIndex"
      :total-count="filteredRowCount"
      :dialog-entry-size="dialogEntrySize"
      :copied-raw="copiedRaw"
      :badge="badge"
      :can-edit="canEditRows && !(selectedRow && isDeletedGhost(selectedRow))"
      :json-editor-valid="jsonEditorValid"
      :has-change="hasChange"
      @navigate="navigateRow"
      @copy="copyToClipboard(editJson)"
      @save="saveEdit"
      @delete="deleteRow"
      @view-diff="viewDiff"
      @validity-change="jsonEditorValid = $event"
    />
  </div>
</template>
