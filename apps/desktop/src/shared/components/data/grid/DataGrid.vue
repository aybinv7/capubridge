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
import { toast } from "vue-sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { bindingLabel } from "@/lib/commands/keymap";
import DataGridHeaderCell from "./DataGridHeaderCell.vue";
import DataGridNoteRow from "./DataGridNoteRow.vue";
import DataGridRow from "./DataGridRow.vue";
import DataGridSectionRow from "./DataGridSectionRow.vue";
import { gridIntent } from "./gridKeys";
import { gutterNumbers, isStructural, sectionIntent } from "./gridSections";
import { useGridColumns } from "./useGridColumns";
import { useGridSelection } from "./useGridSelection";
import {
  ROW_HEIGHT,
  type GridColumn,
  type GridColumnFeatures,
  type GridColumnMenuAction,
  type GridColumnType,
  type GridContextAction,
  type GridContextTarget,
  type GridDensity,
  type GridEditingCell,
  type GridRow,
  type GridRowState,
  type GridSort,
  type GridSummary,
} from "./types";

/** In a well, opaque sticky cells (`bg-cladd-bg`) take the well's cut fill instead. */
const WELL_FILL = { "--color-cladd-bg": "var(--color-cladd-surface-cut)" };

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
    /** Display-type overrides chosen with "Show values as". */
    showAs?: Readonly<Record<string, GridColumnType>>;
    /** Column the host is grouping by, if any. */
    groupedColumn?: string | null;
    columnFeatures?: GridColumnFeatures;
    /** Rows open something (a group, a record) on Enter / double-click instead of editing. */
    activateRows?: boolean;
    contextActions?: (target: GridContextTarget) => GridContextAction[];
    /** The cell an inline editor is open on; the host renders it through the `editor` slot. */
    editing?: GridEditingCell | null;
    /** Persists pinned columns and hand-set widths under this key (one per table). */
    layoutKey?: string | null;
    /**
     * `box` draws the grid's own level-1 box with a border; `none` leaves the depth to the
     * well it sits in (a Cladd `SurfaceCut`), and sticky cells take the well's fill.
     */
    frame?: "box" | "none";
  }>(),
  {
    frame: "box",
    loading: false,
    density: "default",
    readOnly: false,
    rowStates: undefined,
    sort: null,
    rowNumberOffset: 0,
    columnVisibility: undefined,
    showAs: undefined,
    groupedColumn: null,
    columnFeatures: () => ({ filter: false, group: false, showAs: true }),
    activateRows: false,
    contextActions: undefined,
    editing: null,
    layoutKey: null,
  },
);

const emit = defineEmits<{
  "update:sort": [sort: GridSort | null];
  /** Header-menu requests the host owns: filter, group, show as, hide. */
  columnAction: [columnId: string, action: GridColumnMenuAction];
  edit: [rowId: string, columnId: string];
  activate: [rowId: string];
  inspect: [rowId: string];
  delete: [rowIds: string[]];
  contextAction: [actionId: string, target: GridContextTarget];
  summary: [summary: GridSummary];
  /** The focused data row; `null` on a section header or a note. */
  activeRow: [rowId: string | null];
  /** A data row was clicked with the pointer: hosts open it in their record pane. */
  pick: [rowId: string];
  /** A section header asks to open (`true`) or close. */
  toggleSection: [rowId: string, open: boolean];
  /** A note row's action was chosen (a click, Enter or Space). */
  noteAction: [rowId: string];
}>();

defineSlots<{
  empty?: () => unknown;
  editor?: (scope: { rowId: string; column: GridColumn; value: unknown }) => unknown;
}>();

const gridId = `grid-${useId()}`;
const HEADER_HEIGHT = 30;
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
const dataRows = computed<GridRow[]>(() => {
  const rows = displayRows.value;
  return rows.some(isStructural) ? rows.filter((row) => !isStructural(row)) : rows;
});
const rowNumbers = computed(() => gutterNumbers(displayRows.value, props.rowNumberOffset));

const rowHeight = computed(() => ROW_HEIGHT[props.density]);
const lastRowNumber = computed(() => props.rowNumberOffset + Math.max(1, displayRows.value.length));
const gutterWidth = computed(() => Math.max(40, String(lastRowNumber.value).length * 7 + 20));

/** Room above every section header but the first, so each group starts as its own block. */
const SECTION_GAP = 8;

function rowSize(index: number): number {
  return index > 0 && displayRows.value[index]?.section
    ? rowHeight.value + SECTION_GAP
    : rowHeight.value;
}

/** Keys the virtualizer by row id, so a new row list with the same length is laid out again. */
function rowKeyOf(rows: readonly GridRow[]): (index: number) => string | number {
  return (index) => rows[index]?.id ?? index;
}

const groupedType = computed(() => {
  const id = props.groupedColumn;
  return id ? (props.showAs?.[id] ?? columnsById.value.get(id)?.type) : undefined;
});

const layout = useGridColumns({
  columns: visibleColumns,
  visibility: computed(() => undefined),
  showAs: computed(() => props.showAs),
  rows: dataRows,
  gutterWidth,
  scroller,
  layoutKey: computed(() => props.layoutKey),
});
const orderedColumns = layout.ordered;

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: displayRows.value.length,
    getScrollElement: () => scroller.value,
    estimateSize: rowSize,
    getItemKey: rowKeyOf(displayRows.value),
    paddingStart: HEADER_HEIGHT,
    scrollPaddingStart: HEADER_HEIGHT,
    overscan: 12,
    initialRect: INITIAL_RECT,
  })),
);
watch(rowHeight, () => rowVirtualizer.value.measure());

const totalHeight = computed(() => rowVirtualizer.value.getTotalSize());

const EMPTY_ROW: GridRow = { id: "", cells: {} };
const virtualRows = computed(() =>
  rowVirtualizer.value
    .getVirtualItems()
    .map((item) => ({ item, row: displayRows.value[item.index] ?? EMPTY_ROW })),
);

function rowStyle(item: { start: number; size: number }) {
  return {
    top: `${item.start}px`,
    height: `${item.size}px`,
    width: `${layout.totalWidth.value}px`,
  };
}

const grid = useGridSelection({
  rows: displayRows,
  columns: orderedColumns,
  onReveal: (row, col) => {
    rowVirtualizer.value.scrollToIndex(row, { align: "auto" });
    layout.reveal(col);
  },
});

watch(grid.summary, (summary) => emit("summary", summary), { immediate: true });
const focusedDataRowId = computed(() => {
  const focus = grid.selection.value.focus;
  const row = focus ? displayRows.value[focus.row] : undefined;
  return row && !isStructural(row) ? row.id : null;
});
watch(focusedDataRowId, (rowId) => emit("activeRow", rowId));

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

function fromEditor(event: Event): boolean {
  return event.target instanceof Element && event.target.closest("[data-grid-editor]") !== null;
}

/** Display index of the section header or note row under the event. */
function structuralFromEvent(event: Event): number | null {
  const target =
    event.target instanceof Element
      ? event.target.closest("[data-section-row],[data-note-row]")
      : null;
  if (!target) return null;
  const row = Number(
    target.getAttribute("data-section-row") ?? target.getAttribute("data-note-row"),
  );
  return Number.isInteger(row) ? row : null;
}

function focusedCol(): number {
  return grid.selection.value.focus?.col ?? 0;
}

/** Opens or closes a header, or runs a note's action. */
function actOnStructural(index: number) {
  const row = displayRows.value[index];
  if (!row) return;
  if (row.section) emit("toggleSection", row.id, !row.section.open);
  else if (row.note?.action && !row.note.busy) emit("noteAction", row.id);
}

function onClick(event: MouseEvent) {
  if (event.button !== 0 || event.detail > 1 || fromEditor(event)) return;
  const index = structuralFromEvent(event);
  if (index !== null) actOnStructural(index);
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || fromEditor(event)) return;
  if (event.target instanceof Element && event.target.closest('[role="columnheader"]')) return;
  scroller.value?.focus({ preventScroll: true });
  const structural = structuralFromEvent(event);
  if (structural !== null) {
    grid.focusAt(structural, focusedCol());
    return;
  }
  const gutter = gutterFromEvent(event);
  if (gutter !== null) {
    const mode = event.shiftKey ? "extend" : event.ctrlKey || event.metaKey ? "toggle" : "replace";
    grid.pickRow(gutter, mode);
    return;
  }
  const cell = cellFromEvent(event);
  if (!cell) return;
  grid.focusAt(cell.row, cell.col, event.shiftKey);
  startDrag(cell);
  const picked = displayRows.value[cell.row];
  if (picked && !picked.section && !picked.note && !event.shiftKey) emit("pick", picked.id);
}

let dragLast: { row: number; col: number } | null = null;

function cellAtPoint(x: number, y: number): { row: number; col: number } | null {
  const element = document.elementFromPoint(x, y);
  const target = element?.closest("[data-col]");
  if (!target || !scroller.value?.contains(target)) return null;
  const row = Number(target.getAttribute("data-row"));
  const col = Number(target.getAttribute("data-col"));
  return Number.isInteger(row) && Number.isInteger(col) ? { row, col } : null;
}

function onDragMove(event: PointerEvent) {
  const cell = cellAtPoint(event.clientX, event.clientY);
  if (!cell || (dragLast && dragLast.row === cell.row && dragLast.col === cell.col)) return;
  dragLast = cell;
  grid.focusAt(cell.row, cell.col, true);
}

function stopDrag() {
  dragLast = null;
  window.removeEventListener("pointermove", onDragMove);
  window.removeEventListener("pointerup", stopDrag);
  window.removeEventListener("pointercancel", stopDrag);
}

/** Dragging across cells extends the selection, so a block of rows and columns is one gesture. */
function startDrag(cell: { row: number; col: number }) {
  stopDrag();
  dragLast = cell;
  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", stopDrag);
  window.addEventListener("pointercancel", stopDrag);
}

onBeforeUnmount(stopDrag);

function selectColumn(columnId: string, extend: boolean) {
  const col = orderedColumns.value.findIndex((column) => column.id === columnId);
  if (col < 0) return;
  scroller.value?.focus({ preventScroll: true });
  grid.selectColumns(col, extend);
}

function requestEdit(row: number, col: number) {
  const rowId = displayRows.value[row]?.id;
  const column = orderedColumns.value[col];
  if (props.activateRows) {
    if (rowId) emit("activate", rowId);
    return;
  }
  if (props.readOnly || !rowId || !column || column.readOnly) return;
  emit("edit", rowId, column.id);
}

function onDoubleClick(event: MouseEvent) {
  if (fromEditor(event)) return;
  const cell = cellFromEvent(event);
  if (cell) requestEdit(cell.row, cell.col);
}

function visibleRowCount(): number {
  const height = scroller.value?.clientHeight ?? rowHeight.value * 10;
  return Math.max(1, Math.floor((height - HEADER_HEIGHT) / rowHeight.value));
}

function onKeydown(event: KeyboardEvent) {
  if (fromEditor(event)) return;
  const intent = gridIntent(event);
  if (!intent) return;
  const focus = grid.selection.value.focus;
  const structural = focus ? sectionIntent(displayRows.value[focus.row], intent) : null;
  if (structural && focus) {
    const rowId = displayRows.value[focus.row]?.id;
    if (structural.kind === "toggle" && rowId) emit("toggleSection", rowId, structural.open);
    else if (structural.kind === "action") actOnStructural(focus.row);
    else if (structural.kind === "down") grid.move("down", visibleRowCount(), false);
    event.preventDefault();
    event.stopPropagation();
    return;
  }
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

async function copyName(columnId: string) {
  try {
    await navigator.clipboard.writeText(columnId);
    toast.success("Copied column name");
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}

function onColumnAction(columnId: string, action: GridColumnMenuAction) {
  switch (action.kind) {
    case "sort":
      emit("update:sort", action.direction ? { columnId, direction: action.direction } : null);
      return;
    case "pin":
      layout.pin(columnId, action.side);
      return;
    case "autosizeAll":
      layout.autosizeAll();
      return;
    case "copyName":
      void copyName(columnId);
      return;
    default:
      emit("columnAction", columnId, action);
  }
}

const headerCells = computed(() => [
  ...layout.pinnedLeft.value,
  ...layout.scrolling.value,
  ...layout.pinnedRight.value,
]);

const editingColIndex = computed(() =>
  props.editing
    ? orderedColumns.value.findIndex((column) => column.id === props.editing?.columnId)
    : -1,
);
const editingColumn = computed(() =>
  editingColIndex.value >= 0 ? orderedColumns.value[editingColIndex.value] : undefined,
);

function editingColFor(rowId: string | undefined): number | null {
  return props.editing && rowId === props.editing.rowId && editingColIndex.value >= 0
    ? editingColIndex.value
    : null;
}

const menuTarget = shallowRef<GridContextTarget | null>(null);

function onContextMenu(event: MouseEvent) {
  if (fromEditor(event)) return;
  const focus = grid.selection.value.focus;
  const fromKeyboard = event.target === scroller.value;
  const structural = fromKeyboard
    ? focus && isStructural(displayRows.value[focus.row])
      ? focus.row
      : null
    : structuralFromEvent(event);
  if (structural !== null) {
    const row = displayRows.value[structural];
    if (!fromKeyboard) grid.focusAt(structural, focusedCol());
    menuTarget.value = row?.section
      ? { rowId: row.id, columnId: null, value: row.section.value, rowIds: [] }
      : null;
    return;
  }
  const cell = fromKeyboard && focus ? { row: focus.row, col: focus.col } : cellFromEvent(event);
  const gutter = gutterFromEvent(event);
  const rowIndex = cell?.row ?? gutter;
  if (rowIndex === null || rowIndex === undefined) {
    menuTarget.value = null;
    return;
  }
  const rowId = displayRows.value[rowIndex]?.id ?? null;
  if (!rowId || !grid.targetIds().includes(rowId)) {
    if (cell) grid.focusAt(cell.row, cell.col);
    else grid.pickRow(rowIndex, "replace");
  }
  const column = cell ? orderedColumns.value[cell.col] : undefined;
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
  autosizeAll: () => layout.autosizeAll(),
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
        :aria-colcount="orderedColumns.length + 1"
        aria-multiselectable="true"
        :aria-activedescendant="
          grid.selection.value.focus
            ? `${gridId}-r${grid.selection.value.focus.row}-c${grid.selection.value.focus.col}`
            : undefined
        "
        :aria-busy="loading || undefined"
        :class="[
          layout.fits.value ? 'overflow-x-hidden overflow-y-auto' : 'overflow-auto',
          frame === 'none'
            ? 'rounded-[inherit] focus-visible:ring-inset'
            : 'cladd-surface-level-1 rounded-cladd-md border border-cladd-outline bg-cladd-bg',
        ]"
        :style="frame === 'none' ? WELL_FILL : undefined"
        class="relative h-full min-h-0 text-cladd-fg outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
        @pointerdown="onPointerDown"
        @click="onClick"
        @dblclick="onDoubleClick"
        @keydown="onKeydown"
        @contextmenu="onContextMenu"
      >
        <div
          class="relative"
          :style="{
            width: `${layout.totalWidth.value}px`,
            height: `${Math.max(totalHeight, HEADER_HEIGHT)}px`,
          }"
        >
          <div
            role="row"
            aria-rowindex="1"
            class="sticky top-0 z-30 flex border-b border-cladd-outline bg-cladd-surface"
            :style="{ height: `${HEADER_HEIGHT}px`, width: `${layout.totalWidth.value}px` }"
          >
            <div
              class="sticky left-0 z-30 shrink-0 border-r border-cladd-outline bg-cladd-surface"
              :style="{ width: `${gutterWidth}px` }"
            />
            <template v-for="entry in headerCells" :key="entry.column.id">
              <div
                v-if="
                  !entry.stick &&
                  entry === layout.scrolling.value[0] &&
                  layout.leadingSpace.value > 0
                "
                class="shrink-0"
                :style="{ width: `${layout.leadingSpace.value}px` }"
              />
              <div
                v-if="entry.stick?.side === 'right' && entry === layout.pinnedRight.value[0]"
                class="min-w-0 flex-1"
              />
              <DataGridHeaderCell
                :column="entry.column"
                :width="entry.width"
                :stick="entry.stick"
                :sortable="!loading"
                :sort="sort?.columnId === entry.column.id ? sort.direction : null"
                :features="columnFeatures"
                :grouped="groupedColumn === entry.column.id"
                :pinned="layout.pins.value[entry.column.id] ?? null"
                :show-as="showAs?.[entry.column.id] ?? null"
                @sort="toggleSort(entry.column.id)"
                @select="selectColumn(entry.column.id, $event)"
                @action="onColumnAction(entry.column.id, $event)"
                @resize-start="layout.startResize(entry.column.id, $event)"
                @autosize="layout.autosize(entry.column.id)"
              />
            </template>
          </div>

          <template v-for="{ item, row } in virtualRows" :key="String(item.key)">
            <DataGridSectionRow
              v-if="row.section"
              class="absolute left-0"
              :style="rowStyle(item)"
              :cell-id="`${gridId}-r${item.index}-c${grid.selection.value.focus?.col ?? 0}`"
              :section="row.section"
              :index="item.index"
              :band-height="rowHeight"
              :focused="grid.selection.value.focus?.row === item.index"
              :value-type="groupedType"
            />
            <DataGridNoteRow
              v-else-if="row.note"
              class="absolute left-0"
              :style="rowStyle(item)"
              :cell-id="`${gridId}-r${item.index}-c${grid.selection.value.focus?.col ?? 0}`"
              :note="row.note"
              :index="item.index"
              :gutter-width="gutterWidth"
              :focused="grid.selection.value.focus?.row === item.index"
            />
            <DataGridRow
              v-else
              class="absolute left-0"
              :style="rowStyle(item)"
              :grid-id="gridId"
              :row="row"
              :index="item.index"
              :row-number="rowNumbers[item.index] ?? item.index + 1"
              :pinned-left="layout.pinnedLeft.value"
              :columns="layout.scrolling.value"
              :pinned-right="layout.pinnedRight.value"
              :leading-space="layout.leadingSpace.value"
              :gutter-width="gutterWidth"
              :state="rowStates?.get(row.id)"
              :row-selected="grid.selection.value.rows.has(row.id)"
              :focus-col="
                grid.selection.value.focus?.row === item.index
                  ? grid.selection.value.focus.col
                  : null
              "
              :range-cols="rowRangeCols(item.index)"
              :editing-col="editingColFor(row.id)"
            >
              <template v-if="editing && editingColumn" #editor>
                <slot
                  name="editor"
                  :rowId="editing.rowId"
                  :column="editingColumn"
                  :value="row.cells[editing.columnId]"
                />
              </template>
            </DataGridRow>
          </template>
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
              class="h-3 animate-pulse rounded-cladd-3xs bg-cladd-surface"
              :style="{ width: `${40 + ((n * 37) % 50)}%` }"
            />
          </template>
          <div v-else class="pointer-events-auto text-cladd-xs text-cladd-fg-soft">
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
      <ContextMenuItem :disabled="menuTarget.rowIds.length === 0" @select="grid.copy('tsv', true)"
        >Copy with header</ContextMenuItem
      >
      <ContextMenuItem :disabled="menuTarget.rowIds.length === 0" @select="grid.copy('json')"
        >Copy as JSON</ContextMenuItem
      >
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
