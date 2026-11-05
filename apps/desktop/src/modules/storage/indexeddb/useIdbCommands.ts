import { FolderOpen, PanelRight, RefreshCw, Search } from "lucide-vue-next";
import type { Command } from "@/lib/commands/types";
import { useCommandProvider } from "@/composables/useCommandProvider";

interface IdbCommandDeps {
  hasStore: () => boolean;
  canRefresh: () => boolean;
  refresh: () => void;
  focusSearch: () => void;
  openExport: () => void;
  toggleRecordPane: () => void;
}

/** Palette commands of the IndexedDB tab (group Data, listed by the action panel). */
export function useIdbCommands(deps: IdbCommandDeps) {
  useCommandProvider("screen.storage", (): Command[] => [
    {
      id: "data.idb.refresh",
      title: "Read IndexedDB again",
      group: "Data",
      icon: RefreshCw,
      screen: true,
      keywords: ["refresh", "reload", "indexeddb"],
      when: deps.canRefresh,
      run: deps.refresh,
    },
    {
      id: "data.idb.search",
      title: "Find rows",
      group: "Data",
      icon: Search,
      binding: "mod+f",
      screen: true,
      keywords: ["search", "filter", "records"],
      when: deps.hasStore,
      run: deps.focusSearch,
    },
    {
      id: "data.idb.open-export",
      title: "Open an IndexedDB export…",
      group: "Data",
      icon: FolderOpen,
      screen: true,
      keywords: ["import", "snapshot", "file", "json"],
      run: deps.openExport,
    },
    {
      id: "data.idb.record-pane",
      title: "Show or hide the record pane",
      group: "Data",
      icon: PanelRight,
      screen: true,
      keywords: ["inspector", "details", "record"],
      when: deps.hasStore,
      run: deps.toggleRecordPane,
    },
  ]);
}
