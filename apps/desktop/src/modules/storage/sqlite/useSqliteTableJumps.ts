import { Eye, Table2 } from "lucide-vue-next";
import type { Command } from "@/lib/commands/types";
import { useCommandProvider } from "@/composables/useCommandProvider";
import type { SqliteTableInfo } from "@/types/sqlite.types";

interface SqliteJumpDeps {
  databaseName: () => string | null;
  tables: () => readonly SqliteTableInfo[];
  openTable: (table: string) => void;
}

/**
 * Lists the open database's tables and views for the palette's `#` mode (and for a plain search),
 * each opening that table. Offered only while the SQLite tab has a database open.
 */
export function useSqliteTableJumps(deps: SqliteJumpDeps) {
  useCommandProvider("jump.sqlite", (): Command[] => {
    const database = deps.databaseName();
    if (!database) return [];
    return deps.tables().map((table) => ({
      id: `table.sqlite.${database}.${table.name}`,
      title: table.name,
      group: "Data",
      section: "tables",
      dormant: true,
      icon: table.tableType === "view" ? Eye : Table2,
      detail: `${database} · ${table.rowCount.toLocaleString("en-US")} rows`,
      keywords: ["sqlite", "table", database],
      run: () => deps.openTable(table.name),
    }));
  });
}
