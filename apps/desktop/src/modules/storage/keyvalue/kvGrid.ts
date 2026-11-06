import type { GridColumn, GridRow, GridSort } from "@/shared/components/data/grid";
import { formatBytes } from "@/shared/format/numbers";
import { compareText } from "@/shared/format/collator";
import type { KvEntry } from "./kvModel";

export const KEY_COLUMN = "key";
export const VALUE_COLUMN = "value";

export const KV_COLUMNS: readonly GridColumn[] = [
  {
    id: KEY_COLUMN,
    title: "Key",
    type: "key",
    primaryKey: true,
    width: 220,
    grow: true,
    minWidth: 120,
  },
  { id: VALUE_COLUMN, title: "Value", type: "unknown", width: 380, grow: true, minWidth: 160 },
  {
    id: "type",
    title: "Type",
    type: "text",
    readOnly: true,
    width: 110,
    hideBelow: 540,
    glyph: false,
  },
  {
    id: "size",
    title: "Size",
    type: "text",
    readOnly: true,
    width: 76,
    align: "end",
    glyph: false,
  },
];

const rowCache = new WeakMap<KvEntry, GridRow>();

/** The grid row of an entry, built once per read. */
export function rowOf(entry: KvEntry): GridRow {
  const cached = rowCache.get(entry);
  if (cached) return cached;
  const row: GridRow = {
    id: entry.id,
    cells: {
      [KEY_COLUMN]: entry.key,
      [VALUE_COLUMN]: entry.cell,
      type: entry.typeLabel,
      size: formatBytes(entry.size),
    },
  };
  rowCache.set(entry, row);
  return row;
}

function valueText(entry: KvEntry): string {
  return entry.search.slice(entry.search.indexOf("\u0000") + 1);
}

function compareEntries(left: KvEntry, right: KvEntry, columnId: string): number {
  if (columnId === "size") return left.size - right.size;
  if (columnId === "type") return compareText(left.typeLabel, right.typeLabel);
  if (columnId === VALUE_COLUMN) return compareText(valueText(left), valueText(right));
  return compareText(left.key, right.key);
}

/**
 * The entries the grid shows: those whose key or value holds `find` (any case), in the
 * chosen order (the phone's order when none is chosen).
 */
export function shownEntries(
  entries: readonly KvEntry[],
  find: string,
  sort: GridSort | null,
): KvEntry[] {
  const needle = find.trim().toLowerCase();
  const kept = needle ? entries.filter((entry) => entry.search.includes(needle)) : [...entries];
  if (!sort) return kept;
  const direction = sort.direction === "asc" ? 1 : -1;
  return kept.sort((left, right) => direction * compareEntries(left, right, sort.columnId));
}
