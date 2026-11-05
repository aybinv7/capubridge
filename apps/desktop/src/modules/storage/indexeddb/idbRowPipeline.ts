import { cellToText } from "@/shared/components/data/grid";
import type {
  GridColumn,
  GridColumnType,
  GridRow,
  GridRowState,
  GridSort,
} from "@/shared/components/data/grid";
import {
  matchesAll,
  type DataPredicate,
  type PredicateJoin,
} from "@/shared/components/data/filter/predicates";
import { compareText } from "@/shared/format/collator";

export interface RowPipelineInput {
  rows: readonly GridRow[];
  columns: readonly GridColumn[];
  search: string;
  predicates: readonly DataPredicate[];
  join: PredicateJoin;
  sort: GridSort | null;
  changesOnly: boolean;
  states: ReadonlyMap<string, GridRowState>;
}

function sortValue(value: unknown): { rank: number; number?: number; text?: string } {
  if (value === null || value === undefined) return { rank: 2 };
  if (typeof value === "number") return { rank: 0, number: value };
  if (typeof value === "boolean") return { rank: 0, number: value ? 1 : 0 };
  if (typeof value === "object" && !Array.isArray(value)) {
    const marker = value as { __type?: unknown; value?: unknown };
    if (marker.__type === "Date" && typeof marker.value === "string") {
      const time = Date.parse(marker.value);
      if (!Number.isNaN(time)) return { rank: 0, number: time };
    }
  }
  return { rank: 1, text: cellToText(value) };
}

/** Orders two cells: numbers and dates by value, text the way people read it, empty last. */
export function compareCells(left: unknown, right: unknown): number {
  const a = sortValue(left);
  const b = sortValue(right);
  if (a.rank !== b.rank) return a.rank - b.rank;
  if (a.number !== undefined && b.number !== undefined) return a.number - b.number;
  return compareText(a.text ?? "", b.text ?? "");
}

/**
 * What the grid shows of one loaded page: changed rows only, the search over every column
 * (objects included), the filter conditions, then the sort. All of it covers this page only;
 * the screen says so.
 */
const searchText = new WeakMap<GridRow, string>();

/** The lowercase text find looks through, computed once per row object. */
function textOf(row: GridRow, columnIds: readonly string[]): string {
  let text = searchText.get(row);
  if (text === undefined) {
    text = columnIds.map((id) => cellToText(row.cells[id]).toLowerCase()).join("\u0000");
    searchText.set(row, text);
  }
  return text;
}

export function pipeRows(input: RowPipelineInput): GridRow[] {
  const needle = input.search.trim().toLowerCase();
  const types: Record<string, GridColumnType | undefined> = {};
  for (const column of input.columns) types[column.id] = column.type;
  const columnIds = input.columns.map((column) => column.id);

  const kept = input.rows.filter((row) => {
    if (input.changesOnly && !input.states.has(row.id)) return false;
    if (needle && !textOf(row, columnIds).includes(needle)) return false;
    return matchesAll(row.cells, input.predicates, input.join, types);
  });

  const sort = input.sort;
  if (!sort) return kept;
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...kept].sort(
    (left, right) =>
      direction * compareCells(left.cells[sort.columnId], right.cells[sort.columnId]),
  );
}

export const GROUP_COUNT_COLUMN = "__count";

/** Prefix of a group row id; the rest is the group's value as text. */
export const GROUP_ROW_PREFIX = "group:";

/**
 * One row per distinct value of `columnId` with how many rows share it, most common first.
 * Grouping, like find and filters, covers the rows given (one page).
 */
export function groupRows(rows: readonly GridRow[], columnId: string): GridRow[] {
  const groups = new Map<string, { value: unknown; count: number }>();
  for (const row of rows) {
    const value = row.cells[columnId];
    const key = cellToText(value);
    const entry = groups.get(key);
    if (entry) entry.count += 1;
    else groups.set(key, { value, count: 1 });
  }
  return [...groups.entries()]
    .sort(
      (left, right) =>
        right[1].count - left[1].count || compareCells(left[1].value, right[1].value),
    )
    .map(([key, entry]) => ({
      id: `${GROUP_ROW_PREFIX}${key}`,
      cells: { [columnId]: entry.value, [GROUP_COUNT_COLUMN]: entry.count },
    }));
}
