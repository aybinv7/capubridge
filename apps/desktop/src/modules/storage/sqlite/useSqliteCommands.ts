import { Download, FileCode, PanelRight, RefreshCw, Search } from "lucide-vue-next";
import type { Command } from "@/lib/commands/types";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { useCommandsStore } from "@/stores/commands.store";

interface SqliteCommandDeps {
  hasDatabase: () => boolean;
  canExport: () => boolean;
  refresh: () => void;
  focusFind: () => void;
  /** Whether Ctrl+F belongs to this tab: focus inside it (not in the pane) or nowhere. */
  findHere: () => boolean;
  togglePane: () => void;
  exportFile: () => void;
  exportDump: () => void;
}

/**
 * Palette commands of the SQLite tab (group Data). Ctrl+F only takes the keys while the focus is
 * in this tab, so other panels and the record pane keep their own find.
 */
export function useSqliteCommands(deps: SqliteCommandDeps) {
  const commands = useCommandsStore();
  useCommandProvider("screen.storage", (): Command[] => [
    {
      id: "data.sqlite.refresh",
      title: "Read the database again",
      group: "Data",
      icon: RefreshCw,
      screen: true,
      keywords: ["refresh", "reload", "sqlite", "pull"],
      when: deps.hasDatabase,
      run: deps.refresh,
    },
    {
      id: "data.sqlite.find",
      title: "Find rows",
      group: "Data",
      icon: Search,
      binding: "mod+f",
      screen: true,
      keywords: ["search", "filter", "sqlite"],
      when: () => deps.hasDatabase() && (commands.paletteOpen || deps.findHere()),
      run: deps.focusFind,
    },
    {
      id: "data.sqlite.pane",
      title: "Show or hide the record pane",
      group: "Data",
      icon: PanelRight,
      screen: true,
      keywords: ["inspector", "details", "row"],
      run: deps.togglePane,
    },
    {
      id: "data.sqlite.export-file",
      title: "Save a copy of the database file…",
      group: "Data",
      icon: Download,
      screen: true,
      keywords: ["export", "sqlite", "download", "db"],
      when: deps.canExport,
      run: deps.exportFile,
    },
    {
      id: "data.sqlite.export-dump",
      title: "Save the database as SQL…",
      group: "Data",
      icon: FileCode,
      screen: true,
      keywords: ["export", "dump", "sql"],
      when: deps.canExport,
      run: deps.exportDump,
    },
  ]);
}
