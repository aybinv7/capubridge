import type { GridColumn, GridRow, GridSort } from "@/shared/components/data/grid";
import { compareText } from "@/shared/format/collator";
import { formatExactTime, formatStampWords } from "@/shared/format/dates";
import { formatBytes } from "@/shared/format/numbers";
import type { OpfsRow } from "./opfsModel";

export const OPFS_COLUMNS: readonly GridColumn[] = [
  { id: "name", title: "Name", type: "key", primaryKey: true, readOnly: true, width: 280 },
  { id: "kind", title: "Kind", type: "text", readOnly: true, width: 150 },
  { id: "size", title: "Size", type: "text", readOnly: true, width: 90 },
  { id: "modified", title: "Modified", type: "text", readOnly: true, width: 150 },
];

const rowCache = new WeakMap<OpfsRow, { now: number; grid: GridRow }>();

function sizeText(row: OpfsRow): string {
  if (row.kind === "directory") return "—";
  if (row.locked) return "In use";
  return formatBytes(row.size);
}

/**
 * The grid row of an entry, built once per read and per minute of `now` (so "Today at" turns
 * into "Yesterday at" without a new read); the exact time shows on hover.
 */
export function gridRowOf(row: OpfsRow, now = Date.now()): GridRow {
  const cached = rowCache.get(row);
  if (cached && (row.lastModified === null || cached.now === now)) return cached.grid;
  const modified = row.lastModified;
  const grid: GridRow = {
    id: row.id,
    cells: {
      name: row.name,
      kind: row.kindLabel,
      size: sizeText(row),
      modified: modified === null ? "—" : formatStampWords(modified, now),
    },
    ...(modified === null ? {} : { titles: { modified: formatExactTime(modified) } }),
  };
  rowCache.set(row, { now, grid });
  return grid;
}

function nullsLast(left: number | null, right: number | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function foldersFirst(left: OpfsRow, right: OpfsRow): number {
  const folder = Number(right.kind === "directory") - Number(left.kind === "directory");
  return folder !== 0 ? folder : compareText(left.name, right.name);
}

function compareRows(left: OpfsRow, right: OpfsRow, columnId: string): number {
  switch (columnId) {
    case "size":
      return nullsLast(left.size, right.size);
    case "modified":
      return nullsLast(left.lastModified, right.lastModified);
    case "kind":
      return compareText(left.kindLabel, right.kindLabel);
    default:
      return compareText(left.name, right.name);
  }
}

/**
 * The entries the grid shows: those whose name or kind holds `find` (any case), folders first
 * by name until a column order is chosen.
 */
export function shownRows(
  rows: readonly OpfsRow[],
  find: string,
  sort: GridSort | null,
): OpfsRow[] {
  const needle = find.trim().toLowerCase();
  const kept = needle ? rows.filter((row) => row.search.includes(needle)) : [...rows];
  if (!sort) return kept.sort(foldersFirst);
  const direction = sort.direction === "asc" ? 1 : -1;
  return kept.sort((left, right) => direction * compareRows(left, right, sort.columnId));
}
