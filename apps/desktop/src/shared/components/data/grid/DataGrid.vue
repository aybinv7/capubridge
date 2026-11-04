<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, useId, watch } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import {
  getCoreRowModel,
  useVueTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/vue-table";
import { Copy } from "lucide-vue-next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import DataGridHeaderCell from "./DataGridHeaderCell.vue";
import DataGridRow, { type VisibleColumn } from "./DataGridRow.vue";
import { createCanvasMeasure, measureColumnWidths, type TextMeasure } from "./columnSizing";
import { gridIntent } from "./gridKeys";
import { useGridSelection } from "./useGridSelection";
import { bindingLabel } from "@/lib/commands/keymap";
import {
  ROW_HEIGHT,
  type GridColumn,
  type GridContextAction,
  type GridContextTarget,
  type GridDensity,
  type GridRow,
  type GridRowState,
  type GridSort,
  type GridSummary,
} from "./types";

const props = withDefaults(
  defineProps<{
    /** Accessible name, e.g. the table or store name. */
    label: string;
    columns: readonly GridColumn[];
    rows: readonly GridRow[];
    loading?: boolean;
    density?: GridDensity;
    readOnly?: boolean;
    rowStates?: ReadonlyMap<string, GridRowState>;
    sort?: GridSort | null;
    /** Number shown in the gutter for the first row (pages after the first). */
    rowNumberOffset?: number;
    columnVisibility?: Readonly<Record<string, boolean>>;
    contextActions?: (target: GridContextTarget) => GridContextAction[];
  }>(),
  {
    loading: false,
    density: "default",
    readOnly: false,
    rowStates: undefined,
    sort: null,
    rowNumberOffset: 0,
    columnVisibility: undefined,
    contextActions: undefined,
  },
);

const emit = defineEmits<{
  "update:sort": [sort: GridSort | null];
  edit: [rowId: string, columnId: string];
  inspect: [rowId: string];
  delete: [rowIds: string[]];
  contextAction: [actionId: string, target: GridContextTarget];
  summary: [summary: GridSummary];
  activeRow: [rowId: string | null];
}>();

defineSlots<{ empty?: () => unknown }>();

const gridId = `grid-${useId()}`;
const HEADER_HEIGHT = 28;
/** First-frame viewport before the scroller is measured, so the first paint is not empty. */
const INITIAL_RECT = { width: 1200, height: 720 };
const scroller = ref<HTMLElement | null>(null);

const columnDefs = computed<ColumnDef<GridRow>[]>(() =>
  props.columns.map((column) => ({ id: column.id, header: column.title })),
);
const visibility = computed<VisibilityState>(() => ({ ...props.columnVisibility }));

const table = useVueTable<GridRow>({
  get data() {
    return props.rows as GridRow[];
  },
  get columns() {
    return columnDefs.value;
  },
  state: {
    get columnVisibility() {
      return visibility.value;
    },
  },
  getRowId: (row) => row.id,
  getCoreRowModel: getCoreRowModel(),
  manualSorting: true,
  manualFiltering: true,
});

const columnsById = computed(() => new Map(props.columns.map((column) => [column.id, column])));
const visibleColumns = computed<GridColumn[]>(() =>
  table
    .getVisibleLeafColumns()
    .map((column) => columnsById.value.get(column.id))
    .filter((column): column is GridColumn => column !== undefined),
);
const displayRows = computed<GridRow[]>(() => table.getRowModel().rows.map((row) => row.original));

let measureText: TextMeasure | null = null;
function measurer(): TextMeasure {
  if (!measureText) {
    const family =
      getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() ||
      "monospace";
    measureText = createCanvasMeasure(`400 12px ${family}`);
  }
  return measureText;
}

const autoWidths = shallowRef<Record<string, number>>({});
const userWidths = ref<Record<string, number>>({});
const columnsKey = computed(() => props.columns.map((column) => column.id).join("\u0000"));
const hasRows = computed(() => props.rows.length > 0);
let measuredWithRows: string | null = null;

watch(
  [columnsKey, hasRows],
  ([key, rowsPresent]) => {
    if (!rowsPresent && measuredWithRows === key) return;
    autoWidths.value = measureColumnWidths(props.columns, props.rows, measurer());
    measuredWithRows = rowsPresent ? key : null;
  },
  { immediate: true },
);

function widthOf(id: string): number {
  return userWidths.value[id] ?? autoWidths.value[id] ?? 120;
}

const rowHeight = computed(() => ROW_HEIGHT[props.density]);
const lastRowNumber = computed(() => props.rowNumberOffset + Math.max(1, displayRows.value.length));
const gutterWidth = computed(() => Math.max(36, String(lastRowNumber.value).length * 7 + 18));

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: displayRows.value.length,
    getScrollElement: () => scroller.value,
    estimateSize: () => rowHeight.value,
    paddingStart: HEADER_HEIGHT,
    scrollPaddingStart: HEADER_HEIGHT,
    overscan: 12,
    initialRect: INITIAL_RECT,
  })),
);

const columnVirtualizer = useVirtualizer(
  computed(() => ({
    horizontal: true,
    count: visibleColumns.value.length,
    getScrollElement: () => scroller.value,
    estimateSize: (index: number) => widthOf(visibleColumns.value[index]?.id ?? ""),
    paddingStart: gutterWidth.value,
    scrollPaddingStart: gutterWidth.value,
    overscan: 3,
    initialRect: INITIAL_RECT,
  })),
);

watch(
  [autoWidths, userWidths, visibleColumns, gutterWidth],
  () => columnVirtualizer.value.measure(),
  {
    deep: true,
  },
);
watch(rowHeight, () => rowVirtualizer.value.measure());

const virtualColumns = computed<VisibleColumn[]>(() =>
  columnVirtualizer.value.getVirtualItems().flatMap((item) => {
    const column = visibleColumns.value[item.index];
    return column ? [{ column, index: item.index, width: item.size }] : [];
  }),
);
const leadingSpace = computed(() => {
  const first = columnVirtualizer.value.getVirtualItems()[0];
  return first ? first.start - gutterWidth.value : 0;
});
const totalWidth = computed(() => columnVirtualizer.value.getTotalSize());
const totalHeight = computed(() => rowVirtualizer.value.getTotalSize());

const grid = useGridSelection({
  rows: displayRows,
  columns: visibleColumns,
  onReveal: (row, col) => {
    rowVirtualizer.value.scrollToIndex(row, { align: "auto" });
    columnVirtualizer.value.scrollToIndex(col, { align: "auto" });
  },
});

watch(grid.summary, (summary) => emit("summary", summary), { immediate: true });
watch(grid.focusedRowId, (rowId) => emit("activeRow", rowId));

function rowRangeCols(index: number): readonly [number, number] | null {
  const area = grid.range.value;
  if (!area || index < area.top || index > area.bottom) return null;
  if (area.top === area.bottom && area.left === area.right) return null;
  return [area.left, area.right];
}

function cellFromEvent(event: Event): { row: number; col: number } | null {
  const target = event.target instanceof Element ? event.target.closest("[data-col]") : null;
  if (!target) return null;
  const row = Number(target.getAttribute("data-row"));
  const col = Number(target.getAttribute("data-col"));
  return Number.isInteger(row) && Number.isInteger(col) ? { row, col } : null;
}

function gutterFromEvent(event: Event): number | null {
  const target = event.target instanceof Element ? event.target.closest("[data-gutter]") : null;
  if (!target) return null;
  const row = Number(target.getAttribute("data-gutter"));
  return Number.isInteger(row) ? row : null;
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  scroller.value?.focus({ preventScroll: true });
  const gutter = gutterFromEvent(event);
  if (gutter !== null) {
    const mode = event.shiftKey ? "extend" : event.ctrlKey || event.metaKey ? "toggle" : "replace";
    grid.pickRow(gutter, mode);
    return;
  }
  const cell = cellFromEvent(event);
  if (cell) grid.focusAt(cell.row, cell.col, event.shiftKey);
}

function canEdit(columnIndex: number): boolean {
  const column = visibleColumns.value[columnIndex];
  return !props.readOnly && column !== undefined && column.readOnly !== true;
}

function requestEdit(row: number, col: number) {
  const rowId = displayRows.value[row]?.id;
  const column = visibleColumns.value[col];
  if (rowId && column && canEdit(col)) emit("edit", rowId, column.id);
}

function onDoubleClick(event: MouseEvent) {
  const cell = cellFromEvent(event);
  if (cell) requestEdit(cell.row, cell.col);
}

function visibleRowCount(): number {
  const height = scroller.value?.clientHeight ?? rowHeight.value * 10;
  return Math.max(1, Math.floor((height - HEADER_HEIGHT) / rowHeight.value));
}

function onKeydown(event: KeyboardEvent) {
  const intent = gridIntent(event);
  if (!intent) return;
  const focus = grid.selection.value.focus;
  switch (intent.kind) {
    case "move":
      grid.move(intent.move, visibleRowCount(), intent.extend);
      break;
    case "edit":
      if (!focus) return;
      requestEdit(focus.row, focus.col);
      break;
    case "inspect": {
      const rowId = grid.focusedRowId.value;
      if (!rowId) return;
      emit("inspect", rowId);
      break;
    }
    case "delete": {
      const ids = grid.targetIds();
      if (props.readOnly || ids.length === 0) return;
      emit("delete", ids);
      break;
    }
    case "copy":
      void grid.copy("tsv", intent.withHeader);
      break;
    case "selectAll":
      grid.selectAll();
      break;
    case "clear":
      if (!focus && grid.selection.value.rows.size === 0) return;
      grid.clear();
      break;
  }
  event.preventDefault();
  event.stopPropagation();
}

function toggleSort(columnId: string) {
  const current = props.sort?.columnId === columnId ? props.sort.direction : null;
  if (current === null) emit("update:sort", { columnId, direction: "asc" });
  else if (current === "asc") emit("update:sort", { columnId, direction: "desc" });
  else emit("update:sort", null);
}

let stopResize: (() => void) | null = null;

function startResize(columnId: string, event: PointerEvent) {
  const startX = event.clientX;
  const startWidth = widthOf(columnId);
  const onMove = (moveEvent: PointerEvent) => {
    const next = Math.min(1200, Math.max(48, startWidth + moveEvent.clientX - startX));
    userWidths.value = { ...userWidths.value, [columnId]: next };
  };
  const onUp = () => stopResize?.();
  stopResize = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    document.body.style.cursor = "";
    stopResize = null;
  };
  document.body.style.cursor = "col-resize";
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function autosize(columnId: string) {
  const column = columnsById.value.get(columnId);
  if (!column) return;
  const { [columnId]: _dropped, ...rest } = userWidths.value;
  const measured = measureColumnWidths([{ ...column, width: undefined }], props.rows, measurer());
  userWidths.value = { ...rest, [columnId]: measured[columnId] ?? widthOf(columnId) };
}

onBeforeUnmount(() => stopResize?.());

const menuTarget = shallowRef<GridContextTarget | null>(null);

function onContextMenu(event: MouseEvent) {
  const focus = grid.selection.value.focus;
  const fromKeyboard = event.target === scroller.value;
  const cell = fromKeyboard && focus ? { row: focus.row, col: focus.col } : cellFromEvent(event);
  const gutter = gutterFromEvent(event);
  const rowIndex = cell?.row ?? gutter;
  if (rowIndex === null || rowIndex === undefined) {
    menuTarget.value = null;
    return;
  }
  const rowId = displayRows.value[rowIndex]?.id ?? null;
  const covered = grid.targetIds();
  if (!rowId || !covered.includes(rowId)) {
    if (cell) grid.focusAt(cell.row, cell.col);
    else grid.pickRow(rowIndex, "replace");
  }
  const column = cell ? visibleColumns.value[cell.col] : undefined;
  const row = displayRows.value[rowIndex];
  menuTarget.value = {
    rowId,
    columnId: column?.id ?? null,
    value: column && row ? row.cells[column.id] : undefined,
    rowIds: grid.targetIds(),
  };
}

const extraActions = computed<GridContextAction[]>(() =>
  menuTarget.value && props.contextActions ? props.contextActions(menuTarget.value) : [],
);

function runAction(action: GridContextAction) {
  if (menuTarget.value && !action.disabled) emit("contextAction", action.id, menuTarget.value);
}

defineExpose({
  focus: () => scroller.value?.focus({ preventScroll: true }),
  focusRow: (rowId: string) => {
    const index = displayRows.value.findIndex((row) => row.id === rowId);
    if (index >= 0) grid.focusAt(index, grid.selection.value.focus?.col ?? 0);
  },
  clearSelection: () => grid.clear(),
});
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <div
        :id="gridId"
        ref="scroller"
        role="grid"
        tabindex="0"
        :aria-label="label"
        :aria-rowcount="displayRows.length + 1"
        :aria-colcount="visibleColumns.length + 1"
        aria-multiselectable="true"
        :aria-activedescendant="
          grid.selection.value.focus
            ? `${gridId}-r${grid.selection.value.focus.row}-c${grid.selection.value.focus.col}`
            : undefined
        "
        :aria-busy="loading || undefined"
        class="relative h-full min-h-0 overflow-auto bg-[var(--bg-surface)] outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--ring)]"
        @pointerdown="onPointerDown"
        @dblclick="onDoubleClick"
        @keydown="onKeydown"
        @contextmenu="onContextMenu"
      >
        <div
          class="relative"
          :style="{ width: `${totalWidth}px`, height: `${Math.max(totalHeight, HEADER_HEIGHT)}px` }"
        >
          <div
            role="row"
            aria-rowindex="1"
            class="sticky top-0 z-20 flex border-b border-[var(--border-default)] bg-[var(--bg-chrome)]"
            :style="{ height: `${HEADER_HEIGHT}px`, width: `${totalWidth}px` }"
          >
            <div
              class="sticky left-0 z-10 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-chrome)]"
              :style="{ width: `${gutterWidth}px` }"
            />
            <div v-if="leadingSpace > 0" class="shrink-0" :style="{ width: `${leadingSpace}px` }" />
            <DataGridHeaderCell
              v-for="entry in virtualColumns"
              :key="entry.column.id"
              :column="entry.column"
              :width="entry.width"
              :sortable="!loading"
              :sort="sort?.columnId === entry.column.id ? sort.direction : null"
              @sort="toggleSort(entry.column.id)"
              @resize-start="startResize(entry.column.id, $event)"
              @autosize="autosize(entry.column.id)"
            />
          </div>

          <DataGridRow
            v-for="item in rowVirtualizer.getVirtualItems()"
            :key="displayRows[item.index]?.id ?? item.index"
            class="absolute left-0"
            :style="{
              top: `${item.start}px`,
              height: `${item.size}px`,
              width: `${totalWidth}px`,
            }"
            :grid-id="gridId"
            :row="displayRows[item.index] ?? { id: '', cells: {} }"
            :index="item.index"
            :row-number="rowNumberOffset + item.index + 1"
            :columns="virtualColumns"
            :leading-space="leadingSpace"
            :gutter-width="gutterWidth"
            :state="rowStates?.get(displayRows[item.index]?.id ?? '')"
            :row-selected="grid.selection.value.rows.has(displayRows[item.index]?.id ?? '')"
            :focus-col="
              grid.selection.value.focus?.row === item.index ? grid.selection.value.focus.col : null
            "
            :range-cols="rowRangeCols(item.index)"
          />
        </div>

        <div
          v-if="displayRows.length === 0"
          class="pointer-events-none absolute inset-x-0 flex flex-col gap-2 px-4"
          :style="{ top: `${HEADER_HEIGHT + 16}px` }"
        >
          <template v-if="loading">
            <div
              v-for="n in 6"
              :key="n"
              class="h-3 animate-pulse rounded-sm bg-[var(--bg-surface-raised)]"
              :style="{ width: `${40 + ((n * 37) % 50)}%` }"
            />
          </template>
          <div v-else class="pointer-events-auto text-sm text-muted-foreground">
            <slot name="empty">No rows</slot>
          </div>
        </div>
      </div>
    </ContextMenuTrigger>

    <ContextMenuContent v-if="menuTarget" class="min-w-52">
      <ContextMenuItem :disabled="menuTarget.columnId === null" @select="grid.copy('tsv')">
        <Copy />
        Copy
        <ContextMenuShortcut>{{ bindingLabel("mod+c") }}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem @select="grid.copy('tsv', true)">Copy with header</ContextMenuItem>
      <ContextMenuItem @select="grid.copy('json')">Copy as JSON</ContextMenuItem>
      <template v-for="action in extraActions" :key="action.id">
        <ContextMenuSeparator v-if="action.separatorBefore" />
        <ContextMenuItem
          :disabled="action.disabled"
          :variant="action.danger ? 'destructive' : 'default'"
          @select="runAction(action)"
        >
          {{ action.label }}
          <ContextMenuShortcut v-if="action.binding">{{
            bindingLabel(action.binding)
          }}</ContextMenuShortcut>
        </ContextMenuItem>
      </template>
    </ContextMenuContent>
  </ContextMenu>
</template>
