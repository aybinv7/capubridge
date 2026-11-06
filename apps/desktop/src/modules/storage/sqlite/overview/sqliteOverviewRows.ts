import type { GridColumn, GridRow, GridSort } from "@/shared/components/data/grid";
import { formatBytes } from "@/shared/format/numbers";
import type { DataChangeCounts } from "@/modules/storage/frame/dataFrame.types";
import type { SqliteDatabaseFacts, SqliteTableInfo } from "@/types/sqlite.types";

export type OverviewSegment = "all" | "changed" | "sync" | "no-key" | "empty";

/** One table of the overview grid, with the values it sorts by. */
export interface OverviewTableRow {
  name: string;
  view: boolean;
  rows: number;
  bytes: number | null;
  share: number | null;
  indexes: number | null;
  noKey: boolean;
  sync: readonly string[];
  changes: DataChangeCounts | undefined;
}

export const OVERVIEW_COLUMNS: GridColumn[] = [
  { id: "name", title: "Table", type: "text", width: 240 },
  { id: "rows", title: "Rows", type: "integer" },
  { id: "size", title: "Size", type: "text", align: "end" },
  { id: "share", title: "Share", type: "text", align: "end" },
  { id: "indexes", title: "Indexes", type: "integer" },
  { id: "key", title: "Key", type: "text" },
  { id: "sync", title: "Sync columns", type: "text" },
  { id: "changes", title: "Changed while watched", type: "text" },
];

/** Tables and views with their size, share of the file, keys, sync columns and changes. */
export function overviewRows(input: {
  tables: readonly SqliteTableInfo[];
  facts: SqliteDatabaseFacts | null;
  sync: ReadonlyMap<string, readonly string[]>;
  changes: (table: string) => DataChangeCounts | undefined;
}): OverviewTableRow[] {
  const facts = new Map(input.facts?.tables.map((table) => [table.name, table]) ?? []);
  const total = input.facts?.sizesKnown ? input.facts.pageSize * input.facts.pageCount : 0;
  return input.tables.map((table) => {
    const fact = facts.get(table.name);
    const bytes = fact?.bytes ?? null;
    return {
      name: table.name,
      view: table.tableType === "view",
      rows: table.rowCount,
      bytes,
      share: bytes !== null && total > 0 ? bytes / total : null,
      indexes: fact ? fact.indexCount : null,
      noKey: table.tableType === "table" && fact !== undefined && !fact.hasPrimaryKey,
      sync: input.sync.get(table.name) ?? [],
      changes: input.changes(table.name),
    };
  });
}

/** The rows a segment and a typed filter keep. */
export function filterRows(
  rows: readonly OverviewTableRow[],
  segment: OverviewSegment,
  needle: string,
  only: ReadonlySet<string> | null,
): OverviewTableRow[] {
  const text = needle.trim().toLowerCase();
  return rows.filter((row) => {
    if (only && !only.has(row.name)) return false;
    if (text && !row.name.toLowerCase().includes(text)) return false;
    if (segment === "changed") return (row.changes?.total ?? 0) > 0;
    if (segment === "sync") return row.sync.length > 0;
    if (segment === "no-key") return row.noKey;
    if (segment === "empty") return !row.view && row.rows === 0;
    return true;
  });
}

const SORT_VALUE: Record<string, (row: OverviewTableRow) => number | string> = {
  name: (row) => row.name.toLowerCase(),
  rows: (row) => row.rows,
  size: (row) => row.bytes ?? -1,
  share: (row) => row.share ?? -1,
  indexes: (row) => row.indexes ?? -1,
  key: (row) => (row.noKey ? 1 : 0),
  sync: (row) => row.sync.length,
  changes: (row) => row.changes?.total ?? 0,
};

/** Sorted by the column's value (bytes for size, not its text), largest first by default. */
export function sortRows(
  rows: readonly OverviewTableRow[],
  sort: GridSort | null,
): OverviewTableRow[] {
  const by = SORT_VALUE[sort?.columnId ?? "size"] ?? SORT_VALUE["size"];
  const direction = sort ? (sort.direction === "asc" ? 1 : -1) : -1;
  if (!by) return [...rows];
  return [...rows].sort((left, right) => {
    const a = by(left);
    const b = by(right);
    if (a === b) return left.name.localeCompare(right.name);
    return (a < b ? -1 : 1) * direction;
  });
}

function changesText(changes: DataChangeCounts | undefined): string {
  if (!changes?.total) return "";
  return [
    changes.add ? `+${changes.add}` : "",
    changes.update ? `~${changes.update}` : "",
    changes.delete ? `−${changes.delete}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The grid rows, keyed by table name. */
export function toOverviewGridRows(rows: readonly OverviewTableRow[]): GridRow[] {
  return rows.map((row) => ({
    id: row.name,
    cells: {
      name: row.view ? `${row.name} (view)` : row.name,
      rows: row.rows,
      size: row.bytes === null ? "" : formatBytes(row.bytes),
      share: row.share === null ? "" : `${(row.share * 100).toFixed(row.share < 0.1 ? 1 : 0)} %`,
      indexes: row.indexes,
      key: row.noKey ? "no key" : "",
      sync: row.sync.join(", "),
      changes: changesText(row.changes),
    },
  }));
}
