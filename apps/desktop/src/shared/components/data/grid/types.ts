import type { SelectionAggregate } from "./aggregates";

/** Declared or inferred storage type of a column; drives the header glyph and alignment. */
export type GridColumnType =
  | "integer"
  | "real"
  | "text"
  | "boolean"
  | "json"
  | "date"
  | "blob"
  | "key"
  | "unknown";

export interface GridColumn {
  /** Stable id; also the accessor key into `GridRow.cells`. */
  id: string;
  title: string;
  type?: GridColumnType;
  /** Raw type string from the source (`VARCHAR(40)`, `keyPath`), shown in the header tooltip. */
  typeLabel?: string;
  primaryKey?: boolean;
  /** Referenced `table.column` when the column is a foreign key. */
  foreignKey?: string;
  notNull?: boolean;
  /** Explicit width in px; otherwise sized from content. */
  width?: number;
  /** Cells in this column cannot be edited (generated columns, key paths). */
  readOnly?: boolean;
  /**
   * The column takes the room the others leave (Name, Key, Value), and gives it back down to
   * `minWidth` when the grid is narrow. When any column grows, only growing columns stretch.
   */
  grow?: boolean;
  /** The narrowest a growing column becomes before the grid scrolls sideways. */
  minWidth?: number;
  /** Hides the column while the grid is narrower than this many pixels (a container query). */
  hideBelow?: number;
  /** Cell alignment, over the one the value's kind suggests (sizes and counts to the end). */
  align?: "start" | "end";
  /** `false` hides the type glyph in the header (a column of words, not stored values). */
  glyph?: boolean;
}

export interface GridRow {
  /** Stable identity (primary key, rowid or IDB key) — never a row index. */
  id: string;
  cells: Readonly<Record<string, unknown>>;
  /** A cell's hover text by column id, when the cell shows less than it knows (an exact time). */
  titles?: Readonly<Record<string, string>>;
  /** Makes the row a collapsible section header that spans the grid; it holds no data. */
  section?: GridSection;
  /** Makes the row a full-width note inside a section (loading, an error, "show more"). */
  note?: GridNote;
}

/** A section header: the rows after it, up to the next header, belong to it. */
export interface GridSection {
  /** Stable identity of the section, the same while it is open or closed. */
  key: string;
  /** What the section is named after, such as the grouped column. */
  label: string;
  value: unknown;
  /** Rows in the section, or `null` while unknown. */
  count: number | null;
  open: boolean;
  /** Nesting level; `0` for a top section. */
  depth?: number;
}

/** A note row in a section; `action` makes Enter and a click on it ask the host to act. */
export interface GridNote {
  text: string;
  action?: string;
  tone?: "quiet" | "error";
  /** The note waits on a read (shows a spinner and takes no action). */
  busy?: boolean;
  depth?: number;
}

/**
 * Changeset and freshness overlay for a row (R5c). `added`, `updated` and `deleted` are what
 * the device did while the source was watched; `staged-*` are edits not yet saved.
 */
export type GridRowState =
  | "staged-edit"
  | "staged-insert"
  | "staged-delete"
  | "conflict"
  | "recent"
  | "added"
  | "updated"
  | "deleted";

export type GridDensity = "compact" | "default" | "comfortable";

export const ROW_HEIGHT: Record<GridDensity, number> = {
  compact: 22,
  default: 26,
  comfortable: 30,
};

/** The cell an inline editor is open on. */
export interface GridEditingCell {
  rowId: string;
  columnId: string;
}

export interface GridCellAddress {
  row: number;
  col: number;
}

export interface GridSelection {
  /** The active cell (keyboard focus). */
  focus: GridCellAddress | null;
  /** Range anchor; equals `focus` when nothing is extended. */
  anchor: GridCellAddress | null;
  /** Whole rows chosen from the row gutter, by row id. */
  rows: ReadonlySet<string>;
}

export interface GridContextAction {
  id: string;
  label: string;
  /** Keymap binding (`mod+f`, `delete`) shown beside the item. */
  binding?: string;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export interface GridContextTarget {
  rowId: string | null;
  columnId: string | null;
  value: unknown;
  /** Rows the action applies to: the selected rows, or the clicked row. */
  rowIds: string[];
}

export interface GridSort {
  columnId: string;
  direction: "asc" | "desc";
}

export interface GridSummary {
  rowCount: number;
  /** Rows the current selection covers (gutter rows or the cell range's rows). */
  selectedRows: number;
  /** Ids of those rows, in display order. */
  selectedRowIds: readonly string[];
  /** Cells in the selection; 0 without a selection. */
  selectedCells: number;
  aggregate: SelectionAggregate | null;
}

/** What the column header menu asks for. Sort, pin and sizing are handled by the grid. */
export type GridColumnMenuAction =
  | { kind: "sort"; direction: "asc" | "desc" | null }
  | { kind: "filter" }
  | { kind: "group" }
  | { kind: "showAs"; type: GridColumnType | null }
  | { kind: "pin"; side: "left" | "right" | null }
  | { kind: "hide" }
  | { kind: "autosizeAll" }
  | { kind: "copyName" };

/** Header-menu features the host implements (the grid hides the rest). */
export interface GridColumnFeatures {
  filter: boolean;
  group: boolean;
  showAs: boolean;
}

/** A column as laid out for one frame of the grid. */
export interface VisibleColumn {
  column: GridColumn;
  /** Position in display order (pinned-left, scrolling, pinned-right). */
  index: number;
  width: number;
  /** Sticky offset in px for pinned columns. */
  stick?: { side: "left" | "right"; offset: number };
}
