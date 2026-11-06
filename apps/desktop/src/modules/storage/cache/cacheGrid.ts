import type { GridColumn, GridRow, GridSort } from "@/shared/components/data/grid";
import { formatDateWords } from "@/shared/format/dates";
import { formatBytes } from "@/shared/format/numbers";
import { compareText } from "@/shared/format/collator";
import type { CacheRow } from "./cacheModel";

export const CACHE_COLUMNS: readonly GridColumn[] = [
  { id: "name", title: "Name", type: "key", primaryKey: true, readOnly: true, width: 240 },
  { id: "method", title: "Method", type: "text", readOnly: true, width: 76 },
  { id: "status", title: "Status", type: "text", readOnly: true, width: 76 },
  { id: "kind", title: "Type", type: "text", readOnly: true, width: 100 },
  { id: "size", title: "Size", type: "text", readOnly: true, width: 84 },
  { id: "served", title: "Served", type: "text", readOnly: true, width: 140 },
  { id: "address", title: "Address", type: "text", readOnly: true, width: 360 },
];

const rowCache = new WeakMap<CacheRow, GridRow>();

/** The grid row of an entry, built once per read. */
export function gridRowOf(row: CacheRow, now = Date.now()): GridRow {
  const cached = rowCache.get(row);
  if (cached) return cached;
  const grid: GridRow = {
    id: row.id,
    cells: {
      name: row.name,
      method: row.method,
      status: row.statusLabel,
      kind: row.kind,
      size: row.opaque ? "—" : formatBytes(row.size),
      served: row.servedAt === null ? "—" : formatDateWords(row.servedAt, now),
      address: row.address,
    },
  };
  rowCache.set(row, grid);
  return grid;
}

function nullsLast(left: number | null, right: number | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function compareRows(left: CacheRow, right: CacheRow, columnId: string): number {
  switch (columnId) {
    case "size":
      return nullsLast(left.size, right.size);
    case "served":
      return nullsLast(left.servedAt, right.servedAt);
    case "status":
      return nullsLast(left.status, right.status);
    case "method":
      return compareText(left.method, right.method);
    case "kind":
      return compareText(left.kind, right.kind);
    case "address":
      return compareText(left.address, right.address);
    default:
      return compareText(left.name, right.name);
  }
}

/**
 * The entries the grid shows: those whose address, method, status or type holds `find` (any
 * case), in the chosen order (the phone's order when none is chosen).
 */
export function shownRows(
  rows: readonly CacheRow[],
  find: string,
  sort: GridSort | null,
): CacheRow[] {
  const needle = find.trim().toLowerCase();
  const kept = needle ? rows.filter((row) => row.search.includes(needle)) : [...rows];
  if (!sort) return kept;
  const direction = sort.direction === "asc" ? 1 : -1;
  return kept.sort((left, right) => direction * compareRows(left, right, sort.columnId));
}
