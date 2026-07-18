<script setup lang="ts">
import { computed, ref, h, watch, onUnmounted, nextTick } from "vue";
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
import type { IDBRecord, StoreInfo } from "@capubridge/cdp-protocol";
import type { IndexedDBDecoratedRecord } from "@/modules/storage/changes/useIndexedDBChangeOverlay";

// UI components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { parseDate } from "@internationalized/date";
import type { CheckboxCheckedState, DateValue } from "reka-ui";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";

// Module composables & components
import { useAdvancedFilters, type AdvancedFilter } from "./useAdvancedFilters";
import { useIDBTableExport } from "./useIDBTableExport";
import { useIDBRowDetail } from "./useIDBRowDetail";
import IDBRowDetailDialog from "./IDBRowDetailDialog.vue";
import IDBTableActions from "./IDBTableActions.vue";

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
  Plus,
  CalendarDays,
  Check,
  Pencil,
  Trash2,
} from "lucide-vue-next";

const props = defineProps<{
  records: IDBRecord[];
  isLoading: boolean;
  storeName: string;
  dbName: string;
  totalRecords?: number;
  storeInfo?: StoreInfo[];
  fetchRecord?: (index: number) => Promise<IDBRecord | null>;
  showChangesOnly?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
  recordEdit: [record: IDBRecord];
  recordDelete: [key: IDBValidKey];
  recordDeleteBulk: [keys: IDBValidKey[]];
  "filter-update": [filter: AdvancedFilter];
}>();

// ─── Table State ─────────────────────────────────────────────────────────────
const sorting = ref<SortingState>([]);
const columnFilters = ref<ColumnFiltersState>([]);
const globalFilter = ref("");
const grouping = ref<GroupingState>([]);
const expanded = ref<ExpandedState>({});
const columnVisibility = ref<VisibilityState>({});
const columnOrder = ref<ColumnOrderState>([]);
const columnPinning = ref<ColumnPinningState>({
  left: ["__actions"],
  right: [],
});
const rowSelection = ref<Record<string, boolean>>({});
const columnSizing = ref<ColumnSizingState>({});
// key → original value before the edit (for diff view)
const locallyModifiedData = ref(new Map<string, unknown>());
const tableScrollEl = ref<HTMLElement | null>(null);

// Confirmation dialog state
const showDeleteConfirm = ref(false);
const pendingDeleteKeys = ref<IDBValidKey[]>([]);

// ─── Advanced Filters ────────────────────────────────────────────────────────
const recordsRef = computed(() => props.records);
const {
  advancedFilters,
  filteredData,
  addFilter,
  reset: resetAdvancedFilters,
} = useAdvancedFilters(recordsRef);

const tableData = computed(() =>
  props.showChangesOnly
    ? filteredData.value.filter((record) => getChangeOperation(record))
    : filteredData.value,
);

function updateFilters(filters: AdvancedFilter[]) {
  advancedFilters.value = [...filters];
}

// Reset all state when store/db changes
watch(
  () => [props.dbName, props.storeName],
  () => {
    sorting.value = [];
    columnFilters.value = [];
    globalFilter.value = "";
    grouping.value = [];
    expanded.value = {};
    columnVisibility.value = {};
    columnOrder.value = [];
    columnPinning.value = { left: ["__actions"], right: [] };
    rowSelection.value = {};
    columnSizing.value = {};
    locallyModifiedData.value = new Map();
    resetAdvancedFilters();
  },
);

watch(
  () => props.showChangesOnly,
  () => {
    rowSelection.value = {};
  },
);

// ─── Column Helper & Dynamic Columns ────────────────────────────────────────
const columnHelper = createColumnHelper<IDBRecord>();

function getChangeOperation(record: IDBRecord) {
  return (record as IndexedDBDecoratedRecord).__changeOperation ?? null;
}

function isDeletedChange(record: IDBRecord | null) {
  if (!record) return false;
  return (record as IndexedDBDecoratedRecord).__changeDeleted === true;
}

function getRecordChange(record: IDBRecord | null) {
  if (!record) return null;
  return (record as IndexedDBDecoratedRecord).__recordChange ?? null;
}

function getChangeIndicatorClass(record: IDBRecord) {
  const operation = getChangeOperation(record);

  if (operation === "add") return "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30";
  if (operation === "update") return "bg-amber-500/15 text-amber-400 ring-amber-500/30";
  if (operation === "delete") return "bg-red-500/15 text-red-400 ring-red-500/30";
  return "";
}

function getChangeIcon(record: IDBRecord) {
  const operation = getChangeOperation(record);

  if (operation === "add") return Plus;
  if (operation === "update") return Pencil;
  if (operation === "delete") return Trash2;
  return null;
}

function getStickyRowBg(row: Row<IDBRecord>): string {
  if (row.getIsSelected()) return "bg-surface-3";
  const op = getChangeOperation(row.original);
  if (op === "add") return "bg-emerald-500/[0.04]";
  if (op === "update") return "bg-amber-500/[0.04]";
  if (op === "delete") return "bg-red-500/[0.04]";
  return "bg-background";
}

// ─── Local modification tracking ─────────────────────────────────────────────
function recordKeyStr(key: IDBValidKey): string {
  return JSON.stringify(key);
}

function isRowLocallyModified(row: Row<IDBRecord>): boolean {
  // Don't show local-modify indicator when the change overlay already owns this row
  if (getChangeOperation(row.original)) return false;
  return locallyModifiedData.value.has(recordKeyStr(row.original.key));
}

/** Returns a single mutually-exclusive background class for the row.
 *  Using a function (not a CSS-class object) avoids UnoCSS rule-order races
 *  where two bg-* utilities end up on the same element and the wrong one wins. */
function getRowBgClass(row: Row<IDBRecord>): string {
  if (row.getIsSelected()) return "bg-accent/10!";
  const op = getChangeOperation(row.original);
  if (op === "add") return "bg-emerald-500/4";
  if (op === "update") return "bg-amber-500/4";
  if (op === "delete") return "bg-red-500/4 opacity-75";
  if (isRowLocallyModified(row)) return "bg-blue-500/5";
  return "";
}

// Preserve scroll position when grouping layout changes
watch(
  grouping,
  () => {
    const el = tableScrollEl.value;
    if (!el) return;
    const savedTop = el.scrollTop;
    void nextTick(() => {
      el.scrollTop = savedTop;
    });
  },
  { flush: "sync" },
);

// ─── Inline cell editing ─────────────────────────────────────────────────────
const editingCell = ref<{
  rowId: string;
  columnId: string;
  value: string;
} | null>(null);
let clickTimer: ReturnType<typeof setTimeout> | null = null;

const vFocus = { mounted: (el: HTMLElement) => el.focus() };

function getCellEditValue(row: Row<IDBRecord>, columnId: string): string {
  if (columnId === "value") {
    const v = row.original.value;
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return JSON.stringify(v, null, 2);
    return String(v);
  }
  const v = (row.original.value as Record<string, unknown>)?.[columnId];
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function handleCellClick(row: Row<IDBRecord>, columnId: string) {
  if (columnId === "__actions") return;

  if (clickTimer !== null) {
    clearTimeout(clickTimer);
    clickTimer = null;
    if (props.readOnly || columnId === "key") return;
    editingCell.value = {
      rowId: row.id,
      columnId,
      value: getCellEditValue(row, columnId),
    };
    return;
  }

  clickTimer = setTimeout(() => {
    clickTimer = null;
    const rows = table.getFilteredRowModel().rows;
    const idx = rows.findIndex((r) => r.id === row.id);
    openRowDetail(row.original, idx >= 0 ? idx : undefined);
  }, 220);
}

function commitInlineEdit() {
  if (!editingCell.value) return;
  const { rowId, columnId, value } = editingCell.value;
  const rows = table.getRowModel().rows;
  const found = rows.find((r) => r.id === rowId);
  if (!found) {
    editingCell.value = null;
    return;
  }

  const record: IDBRecord = { ...found.original };
  if (columnId === "value") {
    try {
      record.value = JSON.parse(value);
    } catch {
      record.value = value;
    }
  } else {
    let parsed: unknown = value;
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value;
    }
    record.value = {
      ...(record.value as Record<string, unknown>),
      [columnId]: parsed,
    };
  }

  const beforeValue = found.original.value;
  emit("recordEdit", record);
  const next = new Map(locallyModifiedData.value);
  next.set(recordKeyStr(record.key), beforeValue);
  locallyModifiedData.value = next;
  editingCell.value = null;
}

function cancelInlineEdit() {
  editingCell.value = null;
}

onUnmounted(() => {
  if (clickTimer !== null) clearTimeout(clickTimer);
});

const isKeyValueStore = computed(() => {
  if (props.records.length === 0) return true;
  const firstRecord = props.records[0];
  if (!firstRecord) return true;
  const firstValue = firstRecord.value;
  return (
    firstValue === null ||
    firstValue === undefined ||
    typeof firstValue !== "object" ||
    Array.isArray(firstValue)
  );
});

const objectKeys = computed(() => {
  if (isKeyValueStore.value) return [];
  const keys = new Set<string>();
  for (const record of props.records.slice(0, 200)) {
    if (record.value && typeof record.value === "object" && !Array.isArray(record.value)) {
      for (const key of Object.keys(record.value as Record<string, unknown>)) {
        keys.add(key);
      }
    }
  }
  return Array.from(keys);
});

const columns = computed<ColumnDef<IDBRecord, unknown>[]>(() => {
  const actionsCol = columnHelper.display({
    id: "__actions",
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
    cell: ({ row }) => {
      const ChangeIcon = getChangeIcon(row.original);

      return h("div", { class: "flex items-center justify-center gap-1" }, [
        ChangeIcon
          ? h(
              "span",
              {
                class: [
                  "flex size-4 items-center justify-center rounded-sm ring-1",
                  getChangeIndicatorClass(row.original),
                ],
                title: getChangeOperation(row.original) ?? undefined,
              },
              [h(ChangeIcon, { class: "size-2.5" })],
            )
          : null,
        h(
          Checkbox,
          {
            modelValue: row.getIsSelected(),
            disabled: isDeletedChange(row.original),
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
      ]);
    },
  });

  const keyCol = columnHelper.accessor("key", {
    header: "Key",
    size: 70,
    minSize: 30,
    enableHiding: true,
    enableResizing: true,
    enableGrouping: true,
    enableColumnFilter: true,
    enableGlobalFilter: true,
    cell: (info) => {
      const v = info.getValue();
      if (typeof v === "object") return JSON.stringify(v);
      return String(v ?? "");
    },
    filterFn: "includesString",
  });

  if (isKeyValueStore.value) {
    const valueCol = columnHelper.accessor("value", {
      header: "Value",
      size: 300,
      minSize: 100,
      enableHiding: true,
      enableResizing: true,
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
    });
    return [actionsCol, keyCol, valueCol];
  }

  const valueCols = objectKeys.value.map((key) =>
    columnHelper.accessor((row) => (row.value as Record<string, unknown>)?.[key], {
      id: key,
      header: key,
      size: 200,
      minSize: 80,
      enableHiding: true,
      enableResizing: true,
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

  return [actionsCol, keyCol, ...valueCols];
});

// ─── Table Instance ─────────────────────────────────────────────────────────
// NOTE: data uses filteredData (advanced filters applied) not props.records directly
const table = useVueTable({
  get data() {
    return tableData.value;
  },
  get columns() {
    return columns.value;
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
  enableRowSelection: (row) => !isDeletedChange(row.original),
  enableExpanding: true,
  enableSortingRemoval: true,
  enableSubRowSelection: true,
  getRowId: (row, index) => `${String(row.key)}-${index}`,
});

// ─── Export ──────────────────────────────────────────────────────────────────
const { exportSelectedToJSON } = useIDBTableExport(
  table,
  () => props.dbName,
  () => props.storeName,
);

// ─── Row Detail Dialog ───────────────────────────────────────────────────────
const {
  isDetailOpen,
  selectedRow,
  editJson,
  editKey,
  jsonEditorValid,
  currentRowIndex,
  copiedRaw,
  badge,
  dialogEntrySize,
  openRowDetail,
  navigateRow,
  saveEdit,
  deleteRow,
  copyToClipboard,
} = useIDBRowDetail({
  getFilteredRows: () => table.getFilteredRowModel().rows,
  totalRecords: () =>
    props.showChangesOnly ? table.getFilteredRowModel().rows.length : props.totalRecords,
  fetchRecord: () => (props.showChangesOnly ? undefined : props.fetchRecord),
  onEdit: (record) => {
    if (props.readOnly) return;
    const currentRow = table
      .getRowModel()
      .rows.find((r) => recordKeyStr(r.original.key) === recordKeyStr(record.key));
    const beforeValue = currentRow?.original.value;
    emit("recordEdit", record);
    const next = new Map(locallyModifiedData.value);
    next.set(recordKeyStr(record.key), beforeValue);
    locallyModifiedData.value = next;
  },
  onDelete: (key) => {
    if (!props.readOnly) emit("recordDelete", key);
  },
  canMutate: (record) => !props.readOnly && !isDeletedChange(record as IDBRecord),
});

const selectedRecordChange = computed(() => getRecordChange(selectedRow.value));
const isSelectedRowLocallyModified = computed(
  () => !!selectedRow.value && locallyModifiedData.value.has(recordKeyStr(selectedRow.value.key)),
);
const selectedRowLocalBeforeValue = computed(() =>
  selectedRow.value
    ? locallyModifiedData.value.get(recordKeyStr(selectedRow.value.key))
    : undefined,
);

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

// ─── Total record count (respects server-side total) ────────────────────────
const totalCount = computed(() => props.totalRecords ?? props.records.length);

// ─── Date detection helpers ──────────────────────────────────────────────────
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T|\s|$)/;

function isDateColumn(columnId: string): boolean {
  const sample = props.records.slice(0, 20);
  for (const record of sample) {
    let val: unknown;
    if (columnId === "key") val = record.key;
    else if (columnId === "value") val = record.value;
    else val = (record.value as Record<string, unknown>)?.[columnId];
    if (val == null) continue;
    if (ISO_DATE_RE.test(String(val))) return true;
  }
  return false;
}

function parseFilterDate(value: string): DateValue | undefined {
  try {
    return parseDate(value.slice(0, 10)); // keeps only "YYYY-MM-DD"
  } catch {
    return undefined;
  }
}

const DATE_OPERATORS = new Set(["gt", "gte", "lt", "lte", "equals"]);

function showCalendar(columnId: string, operator: string): boolean {
  return DATE_OPERATORS.has(operator) && isDateColumn(columnId);
}

function handleBulkDelete() {
  const selectedKeys = table.getSelectedRowModel().rows.map((row) => row.original.key);
  if (selectedKeys.length > 0) {
    pendingDeleteKeys.value = selectedKeys;
    showDeleteConfirm.value = true;
  }
}

function confirmBulkDelete() {
  if (pendingDeleteKeys.value.length > 0) {
    emit("recordDeleteBulk", pendingDeleteKeys.value);
    pendingDeleteKeys.value = [];
    table.resetRowSelection();
  }
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden" data-idb-table-container>
    <!-- ─── Table Actions Toolbar ───────────────────────────────────────────────── -->
    <IDBTableActions
      :records="records"
      :table="table"
      :grouping="grouping"
      :store-info="storeInfo"
      :store-name="storeName"
      :total-records="totalRecords"
      :advanced-filters="advancedFilters"
      :read-only="readOnly"
      @update:grouping="grouping = $event"
      @record-delete-bulk="handleBulkDelete"
      @update:filters="updateFilters"
    />

    <!-- ─── Table ────────────────────────────────────────────────────────── -->
    <div ref="tableScrollEl" class="flex-1 overflow-auto min-h-0 relative">
      <!-- Loading skeleton -->
      <div v-if="isLoading && records.length === 0" class="flex flex-col gap-px p-1">
        <div
          v-for="i in 30"
          :key="i"
          class="h-9 animate-pulse bg-surface-3/50"
          :style="{ animationDelay: `${i * 40}ms` }"
        />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!isLoading && records.length === 0"
        class="flex h-40 items-center justify-center text-sm text-muted-foreground/30"
      >
        No records in this store
      </div>

      <!-- No results after filtering -->
      <div
        v-else-if="filteredRowCount === 0"
        class="flex h-40 items-center justify-center text-sm text-muted-foreground/30"
      >
        No matching records
      </div>

      <!-- Table content -->
      <table v-else class="w-full border-collapse text-sm" style="table-layout: fixed">
        <thead class="bg-background">
          <!-- Grouping headers row (shown when grouping is active) -->
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
              class="group sticky top-0 z-10 h-10 border-b border-border/30 bg-surface-2 px-3 text-left text-xs font-medium text-muted-foreground/50 select-none relative"
              :class="{
                'left-0 z-20': header.column.getIsPinned() === 'left',
                'right-0 z-20': header.column.getIsPinned() === 'right',
              }"
            >
              <!-- Column actions dropdown -->
              <DropdownMenu v-if="header.column.id !== '__actions'">
                <DropdownMenuTrigger as-child>
                  <div
                    class="flex items-center gap-1 h-full w-full cursor-pointer hover:bg-surface-3/50"
                  >
                    <span class="truncate flex-1 min-w-0">
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

              <!-- Actions column header (non-clickable) -->
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
                  <!-- Checkbox for selecting all rows in group -->
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
            <tr
              v-else
              class="group select-none border-b border-border/20 hover:bg-surface-2/50 transition-colors duration-75"
              :class="[getRowBgClass(row), { 'pl-6': row.depth > 0 }]"
            >
              <td
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
                class="h-9 overflow-hidden text-ellipsis whitespace-nowrap px-3 font-mono text-foreground/80 text-xs"
                :class="[
                  cell.column.getIsPinned() === 'left' && 'sticky left-0 z-3',
                  cell.column.getIsPinned() === 'right' && 'sticky right-0 z-3',
                  cell.column.getIsPinned()
                    ? [
                        getStickyRowBg(row),
                        'group-hover:bg-surface-2',
                        'transition-colors',
                        'duration-75',
                      ]
                    : null,
                ]"
                @click="handleCellClick(row, cell.column.id)"
              >
                <input
                  v-if="editingCell?.rowId === row.id && editingCell?.columnId === cell.column.id"
                  v-focus
                  :value="editingCell.value"
                  class="w-full bg-transparent font-mono text-xs text-foreground outline-none border border-primary/50 rounded px-1 -mx-1"
                  @input="
                    editingCell && (editingCell.value = ($event.target as HTMLInputElement).value)
                  "
                  @keydown.enter.prevent="commitInlineEdit"
                  @keydown.escape.prevent="cancelInlineEdit"
                  @blur="cancelInlineEdit"
                  @click.stop
                />
                <FlexRender
                  v-else
                  :render="cell.column.columnDef.cell"
                  :props="cell.getContext()"
                />
              </td>
            </tr>
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
        {{ filteredRowCount.toLocaleString() }} / {{ totalCount.toLocaleString() }} rows
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
          Drag column edges to resize · Click row to view · Double-click cell to edit
        </span>
      </div>
    </div>

    <!-- ─── Row Detail Dialog ─────────────────────────────────────────────── -->
    <IDBRowDetailDialog
      v-model:open="isDetailOpen"
      v-model:edit-json="editJson"
      :edit-key="editKey"
      :current-row-index="currentRowIndex"
      :total-count="
        props.showChangesOnly ? filteredRowCount : (props.totalRecords ?? filteredRowCount)
      "
      :badge="badge"
      :dialog-entry-size="dialogEntrySize"
      :copied-raw="copiedRaw"
      :json-editor-valid="jsonEditorValid"
      :change="selectedRecordChange"
      :read-only="readOnly || isDeletedChange(selectedRow)"
      :locally-modified="isSelectedRowLocallyModified"
      :local-before-value="selectedRowLocalBeforeValue"
      @navigate="navigateRow"
      @save="saveEdit"
      @delete="deleteRow"
      @copy="copyToClipboard(editJson)"
      @validity-change="jsonEditorValid = $event"
    />

    <!-- Delete Confirmation Dialog -->
    <ConfirmDialog
      v-model:open="showDeleteConfirm"
      title="Delete Records"
      :description="`Are you sure you want to delete ${pendingDeleteKeys.length} record(s)? This action cannot be undone.`"
      confirm-text="Delete"
      cancel-text="Cancel"
      variant="destructive"
      @confirm="confirmBulkDelete"
    />
  </div>
</template>
