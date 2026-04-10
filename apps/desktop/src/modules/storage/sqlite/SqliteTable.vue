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
import type { CheckboxCheckedState } from "reka-ui";
import type { SqliteColumnInfo } from "@/types/sqlite.types";

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

// Module composables & components
import type { RowRecord, AdvancedFilter } from "./useSqliteAdvancedFilters";
import { useSqliteAdvancedFilters } from "./useSqliteAdvancedFilters";
import { useSqliteTableExport } from "./useSqliteTableExport";
import { useSqliteRowDetail } from "./useSqliteRowDetail";
import SqliteRowDetailDialog from "./SqliteRowDetailDialog.vue";
import SqliteTableActions from "./SqliteTableActions.vue";

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
} from "lucide-vue-next";

const props = defineProps<{
  columns: string[];
  rows: unknown[][];
  isLoading: boolean;
  tableName: string;
  dbName: string;
  columnInfo?: SqliteColumnInfo[];
}>();

const emit = defineEmits<{
  refresh: [];
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
  left: ["__select"],
  right: [],
});
const rowSelection = ref<Record<string, boolean>>({});
const columnSizing = ref<ColumnSizingState>({});

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
const tableData = computed<RowRecord[]>(() => {
  return props.rows.map((row) => {
    const obj: RowRecord = {};
    props.columns.forEach((col, i) => {
      obj[col] = row[i] ?? null;
    });
    return obj;
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
    size: 20,
    minSize: 20,
    maxSize: 20,
    enableHiding: false,
    enableResizing: false,
    enableGrouping: false,
    enableColumnFilter: true,
    cell: ({ row }) =>
      h("div", { class: "flex items-center justify-center" }, [
        h(
          Checkbox,
          {
            modelValue: row.getIsSelected(),
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
  enableRowSelection: true,
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
const {
  isDetailOpen,
  editJson,
  editKey,
  currentRowIndex,
  copiedRaw,
  dialogEntrySize,
  openRowDetail,
  navigateRow,
  copyToClipboard,
} = useSqliteRowDetail({
  getFilteredRows: () => table.getFilteredRowModel().rows,
  columnNames: () => props.columns,
});

// ─── Computed Stats ──────────────────────────────────────────────────────────
const filteredRowCount = computed(() => table.getFilteredRowModel().rows.length);
const selectedRowCount = computed(() => table.getSelectedRowModel().rows.length);

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
      @update:grouping="grouping = $event"
      @update:filters="updateFilters"
    />

    <!-- ─── Table ────────────────────────────────────────────────────────── -->
    <div class="flex-1 overflow-auto min-h-0 relative">
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
          <template v-for="row in table.getRowModel().rows" :key="row.id">
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
            <tr
              v-else
              class="group select-none border-b border-border/20 hover:bg-surface-2/50 transition-colors duration-75"
              :class="{
                'bg-surface-3/30': row.getIsGrouped(),
                'pl-6': row.depth > 0,
                'bg-accent/10!': row.getIsSelected(),
              }"
            >
              <td
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
                class="h-9 overflow-hidden text-ellipsis whitespace-nowrap px-3 font-mono text-foreground/80 text-xs"
                :class="{
                  'sticky left-0 z-3': cell.column.getIsPinned() === 'left',
                  'sticky right-0 z-3': cell.column.getIsPinned() === 'right',
                }"
                @dblclick="cell.column.id !== '__select' && openRowDetail(row.original, row.index)"
              >
                <!-- Select column: render via FlexRender -->
                <template v-if="cell.column.id === '__select'">
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </template>
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
          </template>
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
      @navigate="navigateRow"
      @copy="copyToClipboard(editJson)"
    />
  </div>
</template>
