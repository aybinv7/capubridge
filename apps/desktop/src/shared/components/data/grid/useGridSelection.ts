import { computed, shallowRef, watch, type Ref } from "vue";
import { toast } from "@/lib/toast";
import { aggregateValues } from "./aggregates";
import { toJsonRows, toTsv } from "./clipboard";
import { isStructural } from "./gridSections";
import { cellToText } from "./valueFormat";
import {
  EMPTY_SELECTION,
  focusCell,
  moveFocus,
  reconcileSelection,
  selectRows,
  selectedRange,
  targetRowIds,
  type GridBounds,
  type GridMove,
} from "./selection";
import type { GridColumn, GridRow, GridSelection, GridSummary } from "./types";

/** Cells beyond this are counted but not aggregated, so a Ctrl+A on 10k rows stays instant. */
const AGGREGATE_CELL_LIMIT = 100_000;

export interface GridSelectionOptions {
  rows: Ref<readonly GridRow[]>;
  columns: Ref<readonly GridColumn[]>;
  onReveal: (row: number, col: number) => void;
}

/** Selection state, movement and clipboard for one grid. Pure state; no DOM access. */
export function useGridSelection(options: GridSelectionOptions) {
  const selection = shallowRef<GridSelection>(EMPTY_SELECTION);
  const rowIds = computed(() => options.rows.value.map((row) => row.id));
  /** Rows that hold data: section headers and notes are passed over by every action. */
  const dataRows = computed(() => options.rows.value.filter((row) => !isStructural(row)));
  const dataIds = computed(() =>
    dataRows.value.length === options.rows.value.length
      ? null
      : new Set(dataRows.value.map((row) => row.id)),
  );
  const bounds = computed<GridBounds>(() => ({
    rows: options.rows.value.length,
    cols: options.columns.value.length,
  }));

  watch([rowIds, bounds], () => {
    selection.value = reconcileSelection(selection.value, rowIds.value, bounds.value);
  });

  const range = computed(() => selectedRange(selection.value));
  const focusedRowId = computed(() => {
    const focus = selection.value.focus;
    return focus ? (rowIds.value[focus.row] ?? null) : null;
  });

  function set(next: GridSelection) {
    selection.value = next;
    if (next.focus) options.onReveal(next.focus.row, next.focus.col);
  }

  function focusAt(row: number, col: number, extend = false) {
    set(focusCell(selection.value, { row, col }, bounds.value, extend));
  }

  function move(direction: GridMove, page: number, extend: boolean) {
    set(moveFocus(selection.value, direction, bounds.value, page, extend));
  }

  function pickRow(index: number, mode: "replace" | "toggle" | "extend") {
    set(selectRows(selection.value, rowIds.value, index, mode));
  }

  /**
   * Whole columns as the range: `col` alone, or from the anchor's column to `col` when
   * `extend` (Shift+click on headers). The view does not jump to the last row.
   */
  function selectColumns(col: number, extend: boolean) {
    const last = bounds.value.rows - 1;
    if (last < 0) return;
    const from = extend && selection.value.anchor ? selection.value.anchor.col : col;
    selection.value = {
      focus: { row: last, col },
      anchor: { row: 0, col: from },
      rows: new Set(),
    };
  }

  function selectAll() {
    if (bounds.value.rows === 0) return;
    selection.value = {
      focus: selection.value.focus ?? { row: 0, col: 0 },
      anchor: selection.value.anchor ?? { row: 0, col: 0 },
      rows: new Set(dataRows.value.map((row) => row.id)),
    };
  }

  function clear() {
    selection.value = EMPTY_SELECTION;
  }

  /** Rows an action targets, in display order. */
  function targetIds(): string[] {
    const ids = targetRowIds(selection.value, rowIds.value);
    const data = dataIds.value;
    return data ? ids.filter((id) => data.has(id)) : ids;
  }

  /** The selection as a value matrix (rows × columns) plus the column ids it spans. */
  function matrix(): { columns: GridColumn[]; values: unknown[][] } {
    const columns = options.columns.value;
    const rows = options.rows.value;
    if (selection.value.rows.size > 0) {
      const chosen = rows.filter((row) => selection.value.rows.has(row.id) && !isStructural(row));
      return {
        columns: [...columns],
        values: chosen.map((row) => columns.map((column) => row.cells[column.id])),
      };
    }
    const area = range.value;
    if (!area) return { columns: [], values: [] };
    const spanned = columns.slice(area.left, area.right + 1);
    return {
      columns: spanned,
      values: rows
        .slice(area.top, area.bottom + 1)
        .filter((row) => !isStructural(row))
        .map((row) => spanned.map((column) => row.cells[column.id])),
    };
  }

  async function copy(format: "tsv" | "json", withHeader = false) {
    const { columns, values } = matrix();
    if (values.length === 0) return;
    const ids = columns.map((column) => column.id);
    const text =
      format === "json"
        ? toJsonRows(values, ids)
        : values.length === 1 && values[0]?.length === 1
          ? cellToText(values[0][0])
          : toTsv(values, withHeader ? ids : undefined);
    try {
      await navigator.clipboard.writeText(text);
      const cells = values.length * columns.length;
      toast.success(cells === 1 ? "Copied value" : `Copied ${values.length} × ${columns.length}`);
    } catch (error) {
      toast.error("Could not copy", { description: String(error) });
    }
  }

  const summary = computed<GridSummary>(() => {
    const rowCount = dataRows.value.length;
    const ids = targetIds();
    if (ids.length === 0) {
      return { rowCount, selectedRows: 0, selectedRowIds: [], selectedCells: 0, aggregate: null };
    }
    const { columns, values } = matrix();
    const selectedCells = values.length * columns.length;
    const aggregate =
      selectedCells > 1 && selectedCells <= AGGREGATE_CELL_LIMIT
        ? aggregateValues(values.flat())
        : null;
    return { rowCount, selectedRows: ids.length, selectedRowIds: ids, selectedCells, aggregate };
  });

  return {
    selection,
    range,
    focusedRowId,
    focusAt,
    selectColumns,
    move,
    pickRow,
    selectAll,
    clear,
    targetIds,
    copy,
    summary,
  };
}
