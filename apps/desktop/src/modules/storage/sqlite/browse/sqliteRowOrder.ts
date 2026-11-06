import type { SqliteColumnInfo, SqliteTableInfo } from "@/types/sqlite.types";
import { quoteIdent } from "../sqlText";

/**
 * What orders a relation's rows completely, so LIMIT/OFFSET pages never repeat or skip a row
 * when the sorted column holds equal values: the rowid of a rowid table, the primary key of a
 * WITHOUT ROWID table, or every result column of a view (by position, only under a sort).
 * Mirrors `page_order` in `src-tauri/src/commands/sqlite/paging.rs`.
 */
export type SqliteRowOrder =
  | { kind: "terms"; terms: readonly string[] }
  | { kind: "positions"; count: number }
  | { kind: "none" };

const ROWID_ALIASES = ["rowid", "_rowid_", "oid"] as const;
const WITHOUT_ROWID = /\)\s*(?:STRICT\s*,\s*)?WITHOUT\s+ROWID\b/i;

/** The row order of a table from its listing entry and its columns. */
export function rowOrderOf(
  info: Pick<SqliteTableInfo, "tableType" | "sql"> | undefined,
  columns: readonly Pick<SqliteColumnInfo, "name" | "pk">[],
): SqliteRowOrder {
  if (!info) return { kind: "none" };
  if (info.tableType === "view") return { kind: "positions", count: columns.length };
  if (WITHOUT_ROWID.test(info.sql)) {
    const key = columns
      .filter((column) => column.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((column) => quoteIdent(column.name));
    return key.length ? { kind: "terms", terms: key } : { kind: "none" };
  }
  const names = new Set(columns.map((column) => column.name.toLowerCase()));
  const alias = ROWID_ALIASES.find((candidate) => !names.has(candidate));
  return alias ? { kind: "terms", terms: [alias] } : { kind: "none" };
}

/**
 * The ORDER BY of one page: the person's sort, then the row order in the same direction (so an
 * index on the sorted column still serves it), or the row order alone when nothing is sorted.
 */
export function orderSql(
  orderBy: string | null,
  direction: "ASC" | "DESC" | null,
  rowOrder: SqliteRowOrder,
): string {
  const sorted = orderBy !== null && direction !== null;
  const dir = sorted ? direction : "ASC";
  const terms: string[] = sorted ? [`${quoteIdent(orderBy)} ${dir}`] : [];
  if (rowOrder.kind === "terms") terms.push(...rowOrder.terms.map((term) => `${term} ${dir}`));
  if (rowOrder.kind === "positions" && sorted) {
    for (let position = 1; position <= rowOrder.count; position += 1) {
      terms.push(`${position} ${dir}`);
    }
  }
  return terms.length ? ` ORDER BY ${terms.join(", ")}` : "";
}
