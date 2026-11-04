import type { GridCellAddress, GridSelection } from "./types";

export const EMPTY_SELECTION: GridSelection = { focus: null, anchor: null, rows: new Set() };

export interface GridBounds {
  rows: number;
  cols: number;
}

export interface CellRange {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampAddress(address: GridCellAddress, bounds: GridBounds): GridCellAddress | null {
  if (bounds.rows === 0 || bounds.cols === 0) return null;
  return {
    row: clamp(address.row, 0, bounds.rows - 1),
    col: clamp(address.col, 0, bounds.cols - 1),
  };
}

/** Sets the active cell. `extend` keeps the anchor (Shift+click, Shift+arrow). */
export function focusCell(
  selection: GridSelection,
  address: GridCellAddress,
  bounds: GridBounds,
  extend = false,
): GridSelection {
  const focus = clampAddress(address, bounds);
  if (!focus) return EMPTY_SELECTION;
  return {
    focus,
    anchor: extend && selection.anchor ? selection.anchor : focus,
    rows: extend ? selection.rows : new Set(),
  };
}

export type GridMove =
  | "up"
  | "down"
  | "left"
  | "right"
  | "home"
  | "end"
  | "pageUp"
  | "pageDown"
  | "first"
  | "last";

/** Keyboard movement from the active cell. `page` is the number of visible rows. */
export function moveFocus(
  selection: GridSelection,
  move: GridMove,
  bounds: GridBounds,
  page: number,
  extend = false,
): GridSelection {
  const from = selection.focus ?? { row: 0, col: 0 };
  const step = Math.max(1, page - 1);
  const next: Record<GridMove, GridCellAddress> = {
    up: { row: from.row - 1, col: from.col },
    down: { row: from.row + 1, col: from.col },
    left: { row: from.row, col: from.col - 1 },
    right: { row: from.row, col: from.col + 1 },
    home: { row: from.row, col: 0 },
    end: { row: from.row, col: bounds.cols - 1 },
    pageUp: { row: from.row - step, col: from.col },
    pageDown: { row: from.row + step, col: from.col },
    first: { row: 0, col: from.col },
    last: { row: bounds.rows - 1, col: from.col },
  };
  if (!selection.focus) return focusCell(selection, { row: 0, col: 0 }, bounds);
  return focusCell(selection, next[move], bounds, extend);
}

/** Rectangle between anchor and focus, or `null` without an active cell. */
export function selectedRange(selection: GridSelection): CellRange | null {
  const { focus, anchor } = selection;
  if (!focus) return null;
  const start = anchor ?? focus;
  return {
    top: Math.min(start.row, focus.row),
    bottom: Math.max(start.row, focus.row),
    left: Math.min(start.col, focus.col),
    right: Math.max(start.col, focus.col),
  };
}

export function isCellInRange(range: CellRange | null, row: number, col: number): boolean {
  return (
    range !== null &&
    row >= range.top &&
    row <= range.bottom &&
    col >= range.left &&
    col <= range.right
  );
}

/** Row-gutter selection: plain click selects one, Ctrl toggles, Shift extends from the anchor row. */
export function selectRows(
  selection: GridSelection,
  rowIds: readonly string[],
  index: number,
  mode: "replace" | "toggle" | "extend",
): GridSelection {
  const id = rowIds[index];
  if (id === undefined) return selection;
  const focus = { row: index, col: selection.focus?.col ?? 0 };
  if (mode === "toggle") {
    const rows = new Set(selection.rows);
    if (rows.has(id)) rows.delete(id);
    else rows.add(id);
    return { focus, anchor: focus, rows };
  }
  if (mode === "extend" && selection.anchor) {
    const start = Math.min(selection.anchor.row, index);
    const end = Math.max(selection.anchor.row, index);
    return { focus, anchor: selection.anchor, rows: new Set(rowIds.slice(start, end + 1)) };
  }
  return { focus, anchor: focus, rows: new Set([id]) };
}

/**
 * Rows an action applies to: gutter-selected rows, else every row the cell range
 * covers. Returned in display order.
 */
export function targetRowIds(selection: GridSelection, rowIds: readonly string[]): string[] {
  if (selection.rows.size > 0) return rowIds.filter((id) => selection.rows.has(id));
  const range = selectedRange(selection);
  if (!range) return [];
  return rowIds.slice(range.top, range.bottom + 1);
}

/** Drops ids that are no longer present (after a refetch) and clamps the cursor. */
export function reconcileSelection(
  selection: GridSelection,
  rowIds: readonly string[],
  bounds: GridBounds,
): GridSelection {
  const present = new Set(rowIds);
  const rows = new Set([...selection.rows].filter((id) => present.has(id)));
  const focus = selection.focus ? clampAddress(selection.focus, bounds) : null;
  const anchor = selection.anchor ? clampAddress(selection.anchor, bounds) : null;
  return { focus, anchor: anchor ?? focus, rows };
}
