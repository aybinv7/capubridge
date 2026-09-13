<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { FlexRender } from "@tanstack/vue-table";
import type { SqliteColumnInfo } from "@/types/sqlite.types";
import type { SqliteRecordChange } from "@/types/sqliteChanges.types";
import { buildRowKey, orderKeyColumns } from "@/modules/storage/changes/sqliteRowKey";
import { useModalGuard } from "@/composables/useModalGuard";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";

// UI components
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import SqliteColumnHeaderMenu from "./SqliteColumnHeaderMenu.vue";
import { useSqliteRowChangeStyles } from "./useSqliteRowChangeStyles";
import { useSqliteColumns } from "./useSqliteColumns";
import { useSqliteTableState } from "./useSqliteTableState";
import { useSqliteCellInteractions } from "./useSqliteCellInteractions";

// Icons
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  ChevronRight,
  ChevronDown,
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
const pkColumnNames = computed(() => new Set(pkColumns.value.map((c) => c.name)));

const {
  rowChangeFor,
  rowChangeOperation,
  isDeletedGhost,
  rowChangeClass,
  stickyRowBg,
  changeIndicatorClass,
  changeIcon,
} = useSqliteRowChangeStyles({
  changesByRowKey: () => props.changesByRowKey,
  rowKeyResolver: () => props.rowKeyResolver,
  pkColumns: () => pkColumns.value,
});

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

// ─── Column Definitions ──────────────────────────────────────────────────────
const { columnsDef } = useSqliteColumns({
  columns: () => props.columns,
  changeIcon,
  changeIndicatorClass,
  rowChangeOperation,
  isDeletedGhost,
});

// ─── Table State & Instance ─────────────────────────────────────────────────
const { table, grouping, tableScrollEl } = useSqliteTableState({
  tableName: () => props.tableName,
  data: () => filteredData.value,
  columns: () => columnsDef.value,
  isDeletedGhost,
  resetAdvancedFilters,
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

// ─── Row viewer / inline cell editing / row context menu ────────────────────
const {
  isEditing,
  editorKindFor,
  detectedKindLabel,
  columnInfoFor,
  handleCellClick,
  commitInlineEdit,
  cancelInlineEdit,
  openRowViewer,
  contextColumnId,
  onCellContextMenu,
  contextCellLabel,
  canEditContextCell,
  editContextCell,
  copyContextCell,
  copyRowAsJson,
  getOverride,
  setOverride,
  clearOverride,
} = useSqliteCellInteractions({
  table,
  dbName: () => props.dbName,
  tableName: () => props.tableName,
  columnInfo: () => props.columnInfo,
  pkColumnNames: () => pkColumnNames.value,
  rawTableData: () => rawTableData.value,
  canEditRows: () => canEditRows.value,
  readOnly: () => props.readOnly,
  isDeletedGhost,
  copyToClipboard,
  openRowDetail,
  onEdit: (original, updated) => emit("recordEdit", original, updated),
});

function rowKeyFor(record: RowRecord): string {
  return props.rowKeyResolver?.(record) ?? buildRowKey(pkColumns.value, record);
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
                <SqliteColumnHeaderMenu
                  :header="header"
                  :is-grouped="isColumnGrouped(header.column.id)"
                  :db-name="dbName"
                  :table-name="tableName"
                  :detected-kind="detectedKindLabel(header.column.id)"
                  :current-override="getOverride(dbName, tableName, header.column.id)"
                  @add-filter="addFilter"
                  @toggle-grouping="toggleGrouping"
                  @clear-override="clearOverride"
                  @set-override="setOverride"
                />
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
