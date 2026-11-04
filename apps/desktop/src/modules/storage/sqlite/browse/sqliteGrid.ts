import type { GridColumn, GridColumnType, GridRow } from "@/shared/components/data/grid";
import type {
  SqliteColumnInfo,
  SqliteForeignKeyInfo,
  SqliteQueryResult,
} from "@/types/sqlite.types";
import { buildRowKeyFromNames, pickKeyColumnNames } from "@/modules/storage/changes/sqliteRowKey";

/** SQLite type affinity (§3.1 of the SQLite docs) plus common app conventions (BOOL, DATE, JSON). */
export function sqliteColumnType(declared: string): GridColumnType {
  const type = declared.toUpperCase();
  if (type === "") return "unknown";
  if (type.includes("BOOL")) return "boolean";
  if (type.includes("JSON")) return "json";
  if (type.includes("DATE") || type.includes("TIME")) return "date";
  if (type.includes("INT")) return "integer";
  if (type.includes("CHAR") || type.includes("CLOB") || type.includes("TEXT")) return "text";
  if (type.includes("BLOB")) return "blob";
  if (type.includes("REAL") || type.includes("FLOA") || type.includes("DOUB")) return "real";
  return "real";
}

export function toGridColumns(
  names: readonly string[],
  info: readonly SqliteColumnInfo[],
  foreignKeys: readonly SqliteForeignKeyInfo[] = [],
): GridColumn[] {
  const byName = new Map(info.map((column) => [column.name, column]));
  const fkByColumn = new Map(foreignKeys.map((fk) => [fk.fromColumn, fk]));
  return names.map((name) => {
    const meta = byName.get(name);
    const fk = fkByColumn.get(name);
    return {
      id: name,
      title: name,
      type: meta ? sqliteColumnType(meta.colType) : "unknown",
      typeLabel: meta?.colType || undefined,
      primaryKey: (meta?.pk ?? 0) > 0,
      notNull: meta?.notnull,
      foreignKey: fk ? `${fk.toTable}.${fk.toColumn ?? "rowid"}` : undefined,
    };
  });
}

export interface SqliteGridRows {
  rows: GridRow[];
  /** False when the table has no primary key: rows then have no stable identity. */
  identified: boolean;
}

/**
 * Rows keyed by primary key, in the same format the change tracker uses, so change
 * overlays and selections survive refetches. Tables without a key fall back to the
 * absolute row position and are reported as unidentified (read-only).
 */
export function toGridRows(
  result: Pick<SqliteQueryResult, "columns" | "rows">,
  info: readonly SqliteColumnInfo[],
  offset: number,
): SqliteGridRows {
  const keyNames = pickKeyColumnNames([...info]);
  const identified = keyNames.length > 0 && keyNames.every((name) => result.columns.includes(name));
  const rows = result.rows.map((values, index) => {
    const cells: Record<string, unknown> = {};
    result.columns.forEach((column, columnIndex) => {
      cells[column] = values[columnIndex];
    });
    const key = identified ? buildRowKeyFromNames(keyNames, cells) : "";
    return { id: key || `#${offset + index}`, cells };
  });
  return { rows, identified };
}
