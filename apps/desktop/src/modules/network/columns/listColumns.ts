/** A column of a Network list: requests, mock rules, the mock log. */
export interface ListColumn<Id extends string = string> {
  id: Id;
  label: string;
  /** Width in pixels until someone drags it; the `flex` column takes what the others leave. */
  width: number;
  minWidth: number;
  /** The one column that grows and shrinks with the list. Never hidden, never dragged. */
  flex?: boolean;
  align: "start" | "end";
  /** When the list is too narrow, lower numbers step aside first; columns without one stay. */
  dropOrder?: number;
  /** Hidden until someone shows it from the Columns menu. */
  defaultHidden?: boolean;
  /** `false` keeps the column out of the Columns menu: it is always there (the switch, actions). */
  hideable?: boolean;
  /** An action column has no header text and no resize handle. */
  action?: boolean;
}

/** What people chose for a list's columns, persisted per list. */
export interface ColumnLayoutState {
  widths: Record<string, number>;
  /** `true` hides, `false` shows a column that starts hidden; absent keeps the default. */
  hidden: Record<string, boolean>;
}

export const MAX_COLUMN_WIDTH = 800;

/** Whether a stored value is a column layout, so a corrupted one falls back to the defaults. */
export function isColumnLayout(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const layout = value as Partial<ColumnLayoutState>;
  return (
    typeof layout.widths === "object" &&
    layout.widths !== null &&
    typeof layout.hidden === "object" &&
    layout.hidden !== null
  );
}

/** A fixed column's width: the dragged one, or its default, within its bounds. */
export function columnWidth(column: ListColumn, state: ColumnLayoutState): number {
  const width = state.widths[column.id] ?? column.width;
  return Math.min(MAX_COLUMN_WIDTH, Math.max(column.minWidth, width));
}

/** Whether people hid the column (or never showed one that starts hidden). */
export function isHiddenByChoice(column: ListColumn, state: ColumnLayoutState): boolean {
  if (column.flex || column.hideable === false) return false;
  return state.hidden[column.id] ?? column.defaultHidden === true;
}

/** The room a column needs: a fixed one its width, the flex one its minimum. */
function needOf(column: ListColumn, state: ColumnLayoutState): number {
  return column.flex ? column.minWidth : columnWidth(column, state);
}

export interface FittedColumns<Id extends string> {
  shown: ListColumn<Id>[];
  /** Columns people asked for that stepped aside because the list is too narrow. */
  dropped: ReadonlySet<Id>;
}

/**
 * The columns that fit `available` pixels, in their order. Columns hidden by choice or by the
 * context (`blocked`) are left out; then, while the rest need more room than there is, the one
 * with the lowest `dropOrder` steps aside. An unmeasured list (`available` 0) drops nothing.
 */
export function fitColumns<Id extends string>(
  columns: readonly ListColumn<Id>[],
  state: ColumnLayoutState,
  available: number,
  blocked: ReadonlySet<Id> = new Set(),
): FittedColumns<Id> {
  const wanted = columns.filter(
    (column) => !blocked.has(column.id) && !isHiddenByChoice(column, state),
  );
  const dropped = new Set<Id>();
  if (available > 0) {
    let need = wanted.reduce((total, column) => total + needOf(column, state), 0);
    const droppable = wanted
      .filter((column) => column.dropOrder !== undefined)
      .sort((a, b) => (a.dropOrder ?? 0) - (b.dropOrder ?? 0));
    for (const column of droppable) {
      if (need <= available) break;
      dropped.add(column.id);
      need -= needOf(column, state);
    }
  }
  return { shown: wanted.filter((column) => !dropped.has(column.id)), dropped };
}

/** The `grid-template-columns` the header and every row share. */
export function gridTemplate(shown: readonly ListColumn[], state: ColumnLayoutState): string {
  return shown
    .map((column) =>
      column.flex ? `minmax(${column.minWidth}px, 1fr)` : `${columnWidth(column, state)}px`,
    )
    .join(" ");
}

/**
 * Which edge of a column its resize handle sits on. Before the flex column the right edge moves
 * with the pointer; after it, the left edge does, so the border always follows the drag while
 * the flex column gives or takes the room. Null for columns that do not resize.
 */
export function resizeEdge(shown: readonly ListColumn[], id: string): "start" | "end" | null {
  const index = shown.findIndex((column) => column.id === id);
  const column = shown[index];
  if (!column || column.flex || column.action) return null;
  const flexIndex = shown.findIndex((candidate) => candidate.flex);
  if (flexIndex === -1) return index === shown.length - 1 ? null : "end";
  return index < flexIndex ? "end" : "start";
}

/**
 * How wide a column may grow while dragging: as far as the flex column can still shrink, so
 * nothing is pushed out of view. Never below its current width.
 */
export function resizeLimit(
  shown: readonly ListColumn[],
  state: ColumnLayoutState,
  id: string,
  available: number,
): number {
  const column = shown.find((candidate) => candidate.id === id);
  if (!column) return MAX_COLUMN_WIDTH;
  const current = columnWidth(column, state);
  if (available <= 0) return MAX_COLUMN_WIDTH;
  const need = shown.reduce((total, candidate) => total + needOf(candidate, state), 0);
  return Math.min(MAX_COLUMN_WIDTH, current + Math.max(0, available - need));
}
