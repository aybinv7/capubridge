import { rankByScore } from "@/lib/commands/fuzzy";
import type { SqliteTableInfo } from "@/types/sqlite.types";

export type QuickOpenItem =
  | { kind: "table"; id: string; table: string; view: boolean; rows: number }
  | { kind: "column"; id: string; table: string; column: string }
  | { kind: "database"; id: string; sourceId: string; name: string; detail: string }
  | { kind: "row"; id: string; table: string; key: string };

export interface QuickOpenGroup {
  label: string;
  items: QuickOpenItem[];
}

export interface QuickOpenInput {
  query: string;
  tables: readonly SqliteTableInfo[];
  /** Every column of every table, once read; `null` before. */
  columns: readonly { table: string; column: string }[] | null;
  recents: readonly string[];
  pinned: readonly string[];
  /** The other databases of the list (not the open one). */
  databases: readonly { sourceId: string; name: string; detail: string }[];
}

const RECENT_LIMIT = 8;
const TABLE_LIMIT = 50;
const COLUMN_LIMIT = 30;

function tableItem(table: SqliteTableInfo): QuickOpenItem {
  return {
    kind: "table",
    id: `t:${table.name}`,
    table: table.name,
    view: table.tableType === "view",
    rows: table.rowCount,
  };
}

/** `res_partner:4182` → the table (matched without case) and the key text; `null` otherwise. */
export function parseTableKey(
  query: string,
  tables: readonly SqliteTableInfo[],
): { table: string; key: string } | null {
  const match = /^([^:\s][^:]*?)\s*:\s*(.+)$/.exec(query.trim());
  if (!match) return null;
  const name = (match[1] ?? "").toLowerCase();
  const key = (match[2] ?? "").trim();
  if (!key) return null;
  const exact = tables.find((table) => table.name.toLowerCase() === name);
  const table = exact ?? rankByScore(tables, name, (entry) => entry.name)[0];
  return table ? { table: table.name, key } : null;
}

/**
 * What quick open lists. With nothing typed: this database's recent tables, its pinned ones,
 * then the other databases. Typing ranks tables and views by name, then columns
 * (`product_product · barcode`), then databases; `table:key` offers to go to that row first.
 */
export function quickOpenGroups(input: QuickOpenInput): QuickOpenGroup[] {
  const byName = new Map(input.tables.map((table) => [table.name, table]));
  const query = input.query.trim();
  const databases: QuickOpenItem[] = input.databases.map((db) => ({
    kind: "database",
    id: `d:${db.sourceId}`,
    sourceId: db.sourceId,
    name: db.name,
    detail: db.detail,
  }));
  const groups: QuickOpenGroup[] = [];
  const push = (label: string, items: QuickOpenItem[]) => {
    if (items.length) groups.push({ label, items });
  };

  if (!query) {
    const recent = input.recents
      .map((name) => byName.get(name))
      .filter((table): table is SqliteTableInfo => table !== undefined)
      .slice(0, RECENT_LIMIT);
    const shown = new Set(recent.map((table) => table.name));
    const pinned = input.pinned
      .map((name) => byName.get(name))
      .filter((table): table is SqliteTableInfo => table !== undefined && !shown.has(table.name));
    push("Recent", recent.map(tableItem));
    push("Pinned", pinned.map(tableItem));
    if (!recent.length && !pinned.length)
      push("Tables", input.tables.slice(0, TABLE_LIMIT).map(tableItem));
    push("Other databases", databases);
    return groups;
  }

  const target = parseTableKey(query, input.tables);
  if (target) {
    push("Go to row", [
      { kind: "row", id: `r:${target.table}:${target.key}`, table: target.table, key: target.key },
    ]);
  }
  const tableQuery = target ? (query.split(":")[0] ?? query) : query;
  push(
    "Tables",
    rankByScore(input.tables, tableQuery, (table) => table.name)
      .slice(0, TABLE_LIMIT)
      .map(tableItem),
  );
  if (!target && input.columns) {
    push(
      "Columns",
      rankByScore(input.columns, query, (entry) => entry.column)
        .slice(0, COLUMN_LIMIT)
        .map((entry) => ({
          kind: "column" as const,
          id: `c:${entry.table}.${entry.column}`,
          table: entry.table,
          column: entry.column,
        })),
    );
  }
  if (!target)
    push(
      "Databases",
      rankByScore(databases, query, (item) => (item.kind === "database" ? item.name : "")),
    );
  return groups;
}
