import type { Component } from "vue";
import { Code2, Eye, LayoutDashboard, Network, Table2 } from "lucide-vue-next";
import type { SqliteTableInfo } from "@/types/sqlite.types";
import { OVERVIEW_ID, type SqliteTab } from "../workspace/sqliteTabs";

/** A tab as the strip draws it. */
export interface SqliteStripTab {
  id: string;
  label: string;
  icon: Component;
  active: boolean;
  preview: boolean;
  closable: boolean;
  staged: number;
}

const DATABASE_TABS: Record<"sql" | "diagram", { label: string; icon: Component }> = {
  sql: { label: "SQL", icon: Code2 },
  diagram: { label: "Diagram", icon: Network },
};

/** The Overview first (fixed), then the open tabs in order, named, with their icons and dots. */
export function stripTabs(input: {
  tabs: readonly SqliteTab[];
  activeId: string;
  tables: ReadonlyMap<string, SqliteTableInfo>;
  staged: ReadonlyMap<string, number>;
}): SqliteStripTab[] {
  const overview: SqliteStripTab = {
    id: OVERVIEW_ID,
    label: "Overview",
    icon: LayoutDashboard,
    active: input.activeId === OVERVIEW_ID,
    preview: false,
    closable: false,
    staged: 0,
  };
  return [
    overview,
    ...input.tabs.map((tab) => {
      const table = tab.table ?? "";
      const named =
        tab.kind === "table"
          ? {
              label: table,
              icon: input.tables.get(table)?.tableType === "view" ? Eye : Table2,
            }
          : DATABASE_TABS[tab.kind === "sql" ? "sql" : "diagram"];
      return {
        id: tab.id,
        label: named.label,
        icon: named.icon,
        active: tab.id === input.activeId,
        preview: tab.preview,
        closable: true,
        staged: tab.kind === "table" ? (input.staged.get(table) ?? 0) : 0,
      };
    }),
  ];
}
