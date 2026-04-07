<script setup lang="ts">
import { computed, ref, h, watch } from "vue";
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
} from "@tanstack/vue-table";
import type { IDBRecord } from "utils";

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
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { parseDate } from "@internationalized/date";
import type { DateValue } from "reka-ui";

// Module composables & components
import { useAdvancedFilters, OPERATORS } from "./useAdvancedFilters";
import { useIDBTableExport } from "./useIDBTableExport";
import { useIDBRowDetail } from "./useIDBRowDetail";
import IDBRowDetailDialog from "./IDBRowDetailDialog.vue";

// Icons
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  Eye,
  EyeOff,
  Pin,
  Columns,
  Download,
  Search,
  ChevronRight,
  ChevronDown,
  Copy,
  Trash2,
  Table2,
  Maximize2,
  Minimize2,
  Code,
  Plus,
  CalendarDays,
} from "lucide-vue-next";

const props = defineProps<{
  records: IDBRecord[];
  isLoading: boolean;
  storeName: string;
  dbName: string;
  totalRecords?: number;
  fetchRecord?: (index: number) => Promise<IDBRecord | null>;
}>();

const emit = defineEmits<{
  refresh: [];
  recordEdit: [record: IDBRecord];
  recordDelete: [key: IDBValidKey];
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
  left: ["__actions", "key"],
  right: [],
});
const rowSelection = ref<Record<string, boolean>>({});
const columnSizing = ref<ColumnSizingState>({});

// ─── Advanced Filters ────────────────────────────────────────────────────────
const recordsRef = computed(() => props.records);
const {
  advancedFilters,
  filteredData,
  getOperator,
  addFilter,
  removeFilter,
  clearAdvancedFilters,
  reset: resetAdvancedFilters,
} = useAdvancedFilters(recordsRef);

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
    columnPinning.value = { left: ["__actions", "key"], right: [] };
    rowSelection.value = {};
    columnSizing.value = {};
    resetAdvancedFilters();
  },
);

function clearAllFilters() {
  columnFilters.value = [];
  globalFilter.value = "";
  clearAdvancedFilters();
}

// ─── Column Helper & Dynamic Columns ────────────────────────────────────────
const columnHelper = createColumnHelper<IDBRecord>();

const isKeyValueStore = computed(() => {
  if (props.records.length === 0) return true;
  const firstValue = props.records[0]!.value;
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
    header: "",
    size: 48,
    minSize: 48,
    maxSize: 48,
    enableHiding: false,
    enableResizing: false,
    enableGrouping: false,
    cell: ({ row }) =>
      h("div", { class: "flex items-center justify-center" }, [
        h(
          "button",
          {
            class:
              "p-1 rounded hover:bg-surface-3 text-muted-foreground/50 hover:text-foreground transition-colors",
            onClick: () => row.toggleExpanded(),
          },
          [
            h(row.getIsExpanded() ? ChevronDown : ChevronRight, {
              size: 14,
              class: "transition-transform",
            }),
          ],
        ),
      ]),
  });

  const keyCol = columnHelper.accessor("key", {
    header: "Key",
    size: 180,
    minSize: 80,
    enableHiding: true,
    enableResizing: true,
    enableGrouping: true,
    enableFiltering: true,
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
      enableFiltering: true,
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
      enableFiltering: true,
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
    return filteredData.value;
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
  enableResizing: true,
  enableColumnOrdering: true,
  enableMultiSort: true,
  enableColumnPinning: true,
  enableFiltering: true,
  getRowId: (row, index) => `${String(row.key)}-${index}`,
});

// ─── Export ──────────────────────────────────────────────────────────────────
const { exportToCSV, exportToJSON, exportSelectedToJSON } = useIDBTableExport(
  table,
  () => props.dbName,
  () => props.storeName,
);

// ─── Row Detail Dialog ───────────────────────────────────────────────────────
const {
  isDetailOpen,
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
  totalRecords: () => props.totalRecords,
  fetchRecord: () => props.fetchRecord,
  onEdit: (record) => emit("recordEdit", record),
  onDelete: (key) => emit("recordDelete", key),
});

// ─── Computed Stats ──────────────────────────────────────────────────────────
const filteredRowCount = computed(() => table.getFilteredRowModel().rows.length);
const selectedRowCount = computed(() => table.getSelectedRowModel().rows.length);
const hasActiveFilters = computed(
  () =>
    advancedFilters.value.length > 0 || columnFilters.value.length > 0 || globalFilter.value !== "",
);

// ─── Column Layout Utils ─────────────────────────────────────────────────────
function resetColumnLayout() {
  columnVisibility.value = {};
  columnOrder.value = [];
  columnPinning.value = { left: ["__actions", "key"], right: [] };
  columnSizing.value = {};
}

function autoSizeColumns() {
  const sizing: ColumnSizingState = {};
  for (const col of table.getAllLeafColumns()) {
    if (col.id === "__actions") continue;
    sizing[col.id] = col.columnDef.size ?? 200;
  }
  columnSizing.value = sizing;
}

function fitColumnsToGrid() {
  const visibleColumns = table.getVisibleFlatColumns().filter((c) => c.id !== "__actions");
  if (visibleColumns.length === 0) return;
  const containerWidth =
    (document.querySelector("[data-idb-table-container]") as HTMLElement)?.offsetWidth ?? 1200;
  const availableWidth = containerWidth - 48; // 48 = actions col
  const perColumn = Math.floor(availableWidth / visibleColumns.length);
  const sizing: ColumnSizingState = {};
  for (const col of visibleColumns) {
    sizing[col.id] = Math.max(perColumn, col.columnDef.minSize ?? 80);
  }
  columnSizing.value = sizing;
}

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
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden" data-idb-table-container>
    <!-- ─── Toolbar ──────────────────────────────────────────────────────── -->
    <div
      class="flex shrink-0 items-center gap-2 border-b border-border/30 bg-surface-2 px-3 py-2 flex-wrap"
    >
      <!-- Global Search -->
      <div class="relative flex-1 min-w-[200px] max-w-md">
        <Search
          class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40"
        />
        <Input
          v-model="globalFilter"
          placeholder="Search all columns…"
          class="h-7 pl-8 text-xs bg-surface-3 border-border/30 focus:border-border/60"
        />
        <button
          v-if="globalFilter"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground"
          @click="globalFilter = ''"
        >
          <X class="h-3 w-3" />
        </button>
      </div>

      <!-- Add Filter button -->
      <Button
        variant="ghost"
        size="icon-sm"
        class="h-7 w-7 shrink-0"
        title="Add advanced filter"
        @click="addFilter()"
      >
        <Plus class="h-3.5 w-3.5" />
      </Button>

      <!-- Filter indicators -->
      <div v-if="hasActiveFilters" class="flex items-center gap-1">
        <span class="text-[10px] text-muted-foreground/50">
          {{ filteredRowCount }} of {{ totalCount }} rows
        </span>
        <Button variant="ghost" size="icon-sm" class="h-5 w-5" @click="clearAllFilters">
          <X class="h-3 w-3" />
        </Button>
      </div>

      <div class="flex-1" />

      <!-- Selection count -->
      <span v-if="selectedRowCount > 0" class="text-[10px] text-muted-foreground/60 tabular-nums">
        {{ selectedRowCount }} selected
      </span>

      <!-- Column Visibility & Grouping -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon-sm" class="h-7 w-7" title="Columns">
            <Eye class="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-72 max-h-80 overflow-y-auto">
          <DropdownMenuLabel>Columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              v-for="col in table
                .getAllLeafColumns()
                .filter((c) => c.id !== '__actions' && c.columnDef.enableHiding !== false)"
              :key="col.id"
              class="flex items-center justify-between gap-2 py-1.5"
            >
              <span class="truncate flex items-center gap-2 flex-1 min-w-0">
                <button
                  class="shrink-0 p-0.5 rounded hover:bg-surface-3"
                  :class="col.getIsVisible() ? 'text-foreground/70' : 'text-muted-foreground/40'"
                  :title="col.getIsVisible() ? 'Hide column' : 'Show column'"
                  @click.stop="col.toggleVisibility()"
                >
                  <Eye v-if="col.getIsVisible()" class="h-3.5 w-3.5" />
                  <EyeOff v-else class="h-3.5 w-3.5" />
                </button>
                <span class="truncate">{{ col.columnDef.header ?? col.id }}</span>
              </span>
              <button
                class="shrink-0 p-0.5 rounded hover:bg-surface-3"
                :class="
                  isColumnGrouped(col.id)
                    ? 'text-foreground/70 bg-surface-3'
                    : 'text-muted-foreground/40'
                "
                title="Group by this column"
                @click.stop="toggleGrouping(col.id)"
              >
                <Columns class="h-3.5 w-3.5" />
              </button>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator v-if="grouping.length > 0" />
          <DropdownMenuItem
            v-if="grouping.length > 0"
            class="text-xs text-muted-foreground"
            @click="grouping = []"
          >
            Clear grouping
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Column Layout -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon-sm" class="h-7 w-7" title="Layout options">
            <Table2 class="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuLabel>Layout</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="autoSizeColumns">
            <Maximize2 class="h-3.5 w-3.5 mr-2" />
            Auto-size columns
          </DropdownMenuItem>
          <DropdownMenuItem @click="fitColumnsToGrid">
            <Minimize2 class="h-3.5 w-3.5 mr-2" />
            Fit to grid
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="resetColumnLayout"> Reset layout </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Export -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon-sm" class="h-7 w-7" title="Export data">
            <Download class="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuLabel>Export</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="exportToCSV"> CSV (filtered) </DropdownMenuItem>
          <DropdownMenuItem @click="exportToJSON"> JSON (filtered) </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem :disabled="selectedRowCount === 0" @click="exportSelectedToJSON">
            Selected ({{ selectedRowCount }})
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- ─── Advanced Filters Bar ─────────────────────────────────────────── -->
    <div
      v-if="advancedFilters.length > 0"
      class="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/30 bg-surface-2 px-3 py-2"
    >
      <span class="text-[10px] font-medium text-muted-foreground shrink-0 uppercase tracking-wider">
        Where
      </span>

      <template v-for="(filter, idx) in advancedFilters" :key="filter.id">
        <!-- AND / OR toggle between filters -->
        <div
          v-if="idx > 0"
          class="flex shrink-0 rounded-md border border-border/50 overflow-hidden text-[10px] font-semibold"
        >
          <button
            class="px-2 py-1 transition-colors"
            :class="
              filter.logic === 'and'
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-3 text-muted-foreground hover:text-foreground'
            "
            @click="filter.logic = 'and'"
          >
            AND
          </button>
          <button
            class="px-2 py-1 transition-colors border-l border-border/50"
            :class="
              filter.logic === 'or'
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-3 text-muted-foreground hover:text-foreground'
            "
            @click="filter.logic = 'or'"
          >
            OR
          </button>
        </div>

        <!-- Filter pill -->
        <div
          class="flex items-center shrink-0 rounded-md border border-border/50 bg-surface-3 overflow-hidden text-xs"
        >
          <!-- Column selector -->
          <Select v-model="filter.columnId">
            <SelectTrigger
              class="h-7 border-0 rounded-none border-r border-border/50 bg-transparent text-[11px] font-medium px-2 min-w-[80px] max-w-[130px] focus:ring-0 shadow-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="col in table
                  .getAllLeafColumns()
                  .filter((c) => c.id !== '__actions' && c.columnDef.enableHiding !== false)"
                :key="col.id"
                :value="col.id"
                class="text-xs"
              >
                {{ col.columnDef.header ?? col.id }}
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- Operator selector -->
          <Select v-model="filter.operator">
            <SelectTrigger
              class="h-7 border-0 rounded-none border-r border-border/50 bg-transparent text-[11px] text-muted-foreground px-2 min-w-[90px] max-w-[130px] focus:ring-0 shadow-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="op in OPERATORS" :key="op.value" :value="op.value" class="text-xs">
                {{ op.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- Value: calendar picker for date columns + comparison ops -->
          <template v-if="getOperator(filter.operator).needsValue">
            <Popover v-if="showCalendar(filter.columnId, filter.operator)">
              <PopoverTrigger as-child>
                <button
                  class="h-7 px-2 flex items-center gap-1.5 text-[11px] border-r border-border/50 min-w-[110px] hover:bg-surface-2 transition-colors"
                  :class="filter.value ? 'text-foreground' : 'text-muted-foreground'"
                >
                  <CalendarDays class="h-3 w-3 shrink-0" />
                  {{ filter.value || "Pick date…" }}
                </button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0" align="start">
                <Calendar
                  layout="month-and-year"
                  :model-value="parseFilterDate(filter.value)"
                  @update:model-value="filter.value = ($event?.toString() ?? '').slice(0, 10)"
                />
              </PopoverContent>
            </Popover>

            <!-- Plain text input for non-date columns -->
            <Input
              v-else
              v-model="filter.value"
              placeholder="value…"
              class="h-7 border-0 rounded-none border-r border-border/50 bg-transparent text-[11px] w-28 focus-visible:ring-0 shadow-none px-2"
            />
          </template>

          <!-- Remove filter -->
          <button
            class="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors shrink-0"
            @click="removeFilter(filter.id)"
          >
            <X class="h-3 w-3" />
          </button>
        </div>
      </template>

      <!-- Add another filter -->
      <Button
        variant="ghost"
        size="sm"
        class="h-7 text-[11px] text-muted-foreground hover:text-foreground px-2 gap-1"
        @click="addFilter()"
      >
        <Plus class="h-3 w-3" />
        Add filter
      </Button>
    </div>

    <!-- ─── Table ────────────────────────────────────────────────────────── -->
    <div class="flex-1 overflow-auto min-h-0 relative">
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
                'sticky left-0 z-[2]': header.column.getIsPinned() === 'left',
                'sticky right-0 z-[2]': header.column.getIsPinned() === 'right',
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
              class="group sticky top-0 z-[1] h-10 border-b border-border/30 bg-surface-2 px-3 text-left text-xs font-medium text-muted-foreground/50 select-none relative"
              :class="{
                'sticky left-0 z-[2]': header.column.getIsPinned() === 'left',
                'sticky right-0 z-[2]': header.column.getIsPinned() === 'right',
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
                      :class="{ 'bg-accent': header.column.getIsSorted() === 'asc' }"
                      @click="header.column.toggleSorting(false)"
                    >
                      <ArrowUp class="h-3 w-3 mr-2" />
                      Ascending
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="text-xs"
                      :class="{ 'bg-accent': header.column.getIsSorted() === 'desc' }"
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
                    <Columns class="h-3 w-3 mr-2" />
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
                        :class="{ 'bg-accent': header.column.getIsPinned() === 'left' }"
                        @click="header.column.pin('left')"
                      >
                        Pin to left
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        class="text-xs"
                        :class="{ 'bg-accent': header.column.getIsPinned() === 'right' }"
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
          <template v-for="row in table.getRowModel().rows" :key="row.id">
            <!-- Group header -->
            <tr v-if="row.getIsGrouped()" class="bg-surface-3/30 border-b border-border/20">
              <td :colspan="row.getVisibleCells().length" class="px-3 py-2">
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
                      {{ row.getValue(row.groupingColumnId) }}
                    </code>
                    <span class="text-muted-foreground/40 ml-1"> ({{ row.subRows.length }}) </span>
                  </span>
                </button>
              </td>
            </tr>

            <!-- Data row -->
            <tr
              v-else
              class="group border-b border-border/20 hover:bg-surface-2/50 transition-colors duration-75"
              :class="{
                'bg-surface-3/30': row.getIsGrouped(),
                'bg-accent/10': row.getIsSelected(),
              }"
              @click="row.toggleSelected()"
            >
              <td
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
                class="h-9 overflow-hidden text-ellipsis whitespace-nowrap px-3 font-mono text-foreground/80 text-xs"
                :class="{
                  'sticky left-0 z-[3] bg-surface-2 group-hover:bg-surface-2/50':
                    cell.column.getIsPinned() === 'left',
                  'sticky right-0 z-[3] bg-surface-2 group-hover:bg-surface-2/50':
                    cell.column.getIsPinned() === 'right',
                }"
                @dblclick="openRowDetail(row.original)"
              >
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </td>
            </tr>

            <!-- Expanded row detail -->
            <tr v-if="row.getIsExpanded()" class="bg-surface-3/20">
              <td :colspan="row.getVisibleCells().length" class="p-0">
                <div class="border-t border-border/20 p-4">
                  <div class="flex items-start justify-between mb-3">
                    <div>
                      <h4 class="text-xs font-medium text-foreground/80">Row Detail</h4>
                      <p class="text-[10px] text-muted-foreground/50 mt-0.5">
                        Key:
                        <code class="bg-surface-3 px-1 rounded">{{ row.original.key }}</code>
                      </p>
                    </div>
                    <div class="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="h-6 w-6"
                        title="Copy as JSON"
                        @click="copyToClipboard(JSON.stringify(row.original.value, null, 2))"
                      >
                        <Copy class="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="h-6 w-6"
                        title="View / Edit"
                        @click="openRowDetail(row.original)"
                      >
                        <Code class="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="h-6 w-6 text-error hover:text-error"
                        title="Delete"
                        @click="emit('recordDelete', row.original.key)"
                      >
                        <Trash2 class="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <!-- Value preview (key-value mode) -->
                  <div
                    v-if="isKeyValueStore"
                    class="bg-surface-3/50 rounded p-3 font-mono text-xs text-foreground/70 overflow-x-auto"
                  >
                    <pre class="whitespace-pre-wrap">{{
                      JSON.stringify(row.original.value, null, 2)
                    }}</pre>
                  </div>

                  <!-- Value as key-value pairs (object mode) -->
                  <div
                    v-else
                    class="grid grid-cols-[120px_1fr] gap-px bg-border/30 rounded overflow-hidden"
                  >
                    <template
                      v-for="(val, key) in row.original.value as Record<string, unknown>"
                      :key="key"
                    >
                      <div
                        class="bg-surface-2 px-3 py-1.5 text-[10px] font-medium text-muted-foreground/60 truncate"
                      >
                        {{ key }}
                      </div>
                      <div
                        class="bg-surface-2 px-3 py-1.5 text-xs font-mono text-foreground/70 truncate"
                      >
                        {{
                          val === null || val === undefined
                            ? ""
                            : typeof val === "object"
                              ? JSON.stringify(val)
                              : String(val)
                        }}
                      </div>
                    </template>
                  </div>
                </div>
              </td>
            </tr>
          </template>
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
          Drag column edges to resize · Double-click row to view details
        </span>
      </div>
    </div>

    <!-- ─── Row Detail Dialog ─────────────────────────────────────────────── -->
    <IDBRowDetailDialog
      v-model:open="isDetailOpen"
      v-model:edit-json="editJson"
      :edit-key="editKey"
      :current-row-index="currentRowIndex"
      :total-count="props.totalRecords ?? filteredRowCount"
      :badge="badge"
      :dialog-entry-size="dialogEntrySize"
      :copied-raw="copiedRaw"
      :json-editor-valid="jsonEditorValid"
      @navigate="navigateRow"
      @save="saveEdit"
      @delete="deleteRow"
      @copy="copyToClipboard(editJson)"
      @validity-change="jsonEditorValid = $event"
    />
  </div>
</template>
