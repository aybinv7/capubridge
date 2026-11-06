import {
  Download,
  FileCode,
  ArrowLeftToLine,
  ArrowRightToLine,
  Code2,
  Hash,
  RotateCcw,
  TableProperties,
  X,
  ListFilter,
  Network,
  PanelRight,
  Plus,
  RefreshCw,
  Save,
  Search,
  Undo2,
} from "lucide-vue-next";
import type { Command } from "@/lib/commands/types";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { useCommandsStore } from "@/stores/commands.store";

/** What the open table's rows offer the palette while it can be edited. */
export interface SqliteEditCommands {
  canEdit: () => boolean;
  pending: () => number;
  addRow: () => void;
  save: () => void;
  discard: () => void;
}

/** The open database's tabs, for the tab keys. */
export interface SqliteTabCommands {
  has: () => boolean;
  canClose: () => boolean;
  canReopen: () => boolean;
  close: () => void;
  reopen: () => void;
  next: () => void;
  previous: () => void;
  sql: () => void;
}

interface SqliteCommandDeps {
  hasDatabase: () => boolean;
  canExport: () => boolean;
  refresh: () => void;
  focusFind: () => void;
  goToTable: () => void;
  goToRow: () => void;
  /** Opens the Filter popover on its WHERE clause (a table's rows). */
  filterWithSql: () => void;
  hasTable: () => boolean;
  /** Whether Ctrl+F belongs to this tab: focus inside it (not in the pane) or nowhere. */
  findHere: () => boolean;
  togglePane: () => void;
  exportFile: () => void;
  exportDump: () => void;
  /** The open table's edits, when its rows are shown. */
  edits: () => SqliteEditCommands | null;
  showDiagram: () => void;
  tabs: SqliteTabCommands;
}

/**
 * Palette commands of the SQLite tab (group Data). Ctrl+F only takes the keys while the focus is
 * in this tab, so other panels and the record pane keep their own find.
 */
export function useSqliteCommands(deps: SqliteCommandDeps) {
  const commands = useCommandsStore();
  const editable = () => deps.edits()?.canEdit() === true;
  const pending = () => (deps.edits()?.pending() ?? 0) > 0;
  useCommandProvider("screen.storage", (): Command[] => [
    {
      id: "data.sqlite.add-row",
      title: "Add a row",
      group: "Data",
      icon: Plus,
      binding: "mod+shift+n",
      screen: true,
      keywords: ["insert", "new", "row", "sqlite"],
      when: editable,
      run: () => deps.edits()?.addRow(),
    },
    {
      id: "data.sqlite.save",
      title: "Save changes",
      group: "Data",
      icon: Save,
      screen: true,
      keywords: ["write", "commit", "sqlite"],
      when: () => editable() && pending(),
      run: () => deps.edits()?.save(),
    },
    {
      id: "data.sqlite.discard",
      title: "Discard changes",
      group: "Data",
      icon: Undo2,
      screen: true,
      keywords: ["drop", "revert", "cancel", "sqlite"],
      when: () => editable() && pending(),
      run: () => deps.edits()?.discard(),
    },
    {
      id: "data.sqlite.diagram",
      title: "Show the diagram",
      group: "Data",
      icon: Network,
      screen: true,
      keywords: ["graph", "schema", "relations", "tables"],
      when: deps.hasDatabase,
      run: deps.showDiagram,
    },
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
      id: "data.sqlite.tab-close",
      title: "Close the tab",
      group: "Data",
      icon: X,
      binding: "mod+w",
      screen: true,
      keywords: ["tab", "close", "sqlite"],
      when: () =>
        deps.tabs.has() && deps.tabs.canClose() && (commands.paletteOpen || deps.findHere()),
      run: deps.tabs.close,
    },
    {
      id: "data.sqlite.tab-reopen",
      title: "Reopen the closed tab",
      group: "Data",
      icon: RotateCcw,
      binding: "mod+shift+t",
      screen: true,
      keywords: ["tab", "undo", "restore", "sqlite"],
      when: () =>
        deps.tabs.has() && deps.tabs.canReopen() && (commands.paletteOpen || deps.findHere()),
      run: deps.tabs.reopen,
    },
    {
      id: "data.sqlite.tab-next",
      title: "Next tab",
      group: "Data",
      icon: ArrowRightToLine,
      binding: "mod+pagedown",
      screen: true,
      keywords: ["tab", "switch", "sqlite"],
      when: () => deps.tabs.has() && (commands.paletteOpen || deps.findHere()),
      run: deps.tabs.next,
    },
    {
      id: "data.sqlite.tab-previous",
      title: "Previous tab",
      group: "Data",
      icon: ArrowLeftToLine,
      binding: "mod+pageup",
      screen: true,
      keywords: ["tab", "switch", "sqlite"],
      when: () => deps.tabs.has() && (commands.paletteOpen || deps.findHere()),
      run: deps.tabs.previous,
    },
    {
      id: "data.sqlite.tab-sql",
      title: "Open the SQL tab",
      group: "Data",
      icon: Code2,
      binding: "mod+t",
      screen: true,
      keywords: ["query", "console", "tab", "sqlite"],
      when: () => deps.tabs.has() && (commands.paletteOpen || deps.findHere()),
      run: deps.tabs.sql,
    },
    {
      id: "data.sqlite.go-to-table",
      title: "Go to a table…",
      group: "Data",
      icon: TableProperties,
      binding: "mod+p",
      screen: true,
      keywords: ["quick open", "table", "column", "find", "jump", "sqlite"],
      when: () => deps.hasDatabase() && (commands.paletteOpen || deps.findHere()),
      run: deps.goToTable,
    },
    {
      id: "data.sqlite.go-to-row",
      title: "Go to a row…",
      group: "Data",
      icon: Hash,
      binding: "mod+g",
      screen: true,
      keywords: ["key", "row", "jump", "id", "sqlite"],
      when: () => deps.hasTable() && (commands.paletteOpen || deps.findHere()),
      run: deps.goToRow,
    },
    {
      id: "data.sqlite.filter-sql",
      title: "Filter the rows with SQL",
      group: "Data",
      icon: ListFilter,
      binding: "mod+shift+f",
      screen: true,
      keywords: ["where", "filter", "sql", "condition"],
      when: () => deps.hasTable() && (commands.paletteOpen || deps.findHere()),
      run: deps.filterWithSql,
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
