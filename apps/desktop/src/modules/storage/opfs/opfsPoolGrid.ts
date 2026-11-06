import type { SahPoolDatabase } from "@capubridge/cdp-protocol";
import type { GridColumn, GridRow } from "@/shared/components/data/grid";
import { formatDateWords } from "@/shared/format/dates";
import { formatBytes } from "@/shared/format/numbers";

export const POOL_COLUMNS: readonly GridColumn[] = [
  { id: "database", title: "Database", type: "key", primaryKey: true, readOnly: true, width: 260 },
  { id: "slot", title: "Slot file", type: "text", readOnly: true, width: 160 },
  { id: "size", title: "Size", type: "text", readOnly: true, width: 90 },
  { id: "flags", title: "Flags", type: "text", readOnly: true, width: 100 },
  { id: "modified", title: "Modified", type: "text", readOnly: true, width: 150 },
];

/** The grid row of a decoded pool database; its id is the slot's path. */
export function poolGridRow(database: SahPoolDatabase, now = Date.now()): GridRow {
  return {
    id: database.opaquePath,
    cells: {
      database: database.logicalPath,
      slot: database.opaqueName,
      size: formatBytes(database.dataSize),
      flags: `0x${database.flags.toString(16).padStart(8, "0")}`,
      modified: database.lastModified ? formatDateWords(database.lastModified, now) : "—",
    },
  };
}

/** Databases whose name or slot holds `find` (any case). */
export function shownPool(databases: readonly SahPoolDatabase[], find: string): SahPoolDatabase[] {
  const needle = find.trim().toLowerCase();
  if (!needle) return [...databases];
  return databases.filter(
    (database) =>
      database.logicalPath.toLowerCase().includes(needle) ||
      database.opaqueName.toLowerCase().includes(needle),
  );
}
