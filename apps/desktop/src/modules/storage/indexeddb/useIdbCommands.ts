import { PanelRight, RefreshCw, Search } from "lucide-vue-next";
import type { Command } from "@/lib/commands/types";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { useCommandsStore } from "@/stores/commands.store";

interface IdbCommandDeps {
  hasStore: () => boolean;
  canRefresh: () => boolean;
  refresh: () => void;
  focusSearch: () => void;
  /** Whether Ctrl+F belongs to this tab: focus inside it (not in the record pane) or nowhere. */
  findHere: () => boolean;
  toggleRecordPane: () => void;
}

/**
 * Palette commands of the IndexedDB tab (group Data, listed by the action panel). "Open an
 * IndexedDB export…" is app-wide (`useDataAppCommands`). Ctrl+F only takes the keys while the
 * focus is in this tab, so other panels and the record pane keep their own find.
 */
export function useIdbCommands(deps: IdbCommandDeps) {
  const commands = useCommandsStore();
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
      when: () => deps.hasStore() && (commands.paletteOpen || deps.findHere()),
      run: deps.focusSearch,
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
