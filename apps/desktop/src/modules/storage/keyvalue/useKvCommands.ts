import { PanelRight, Plus, RefreshCw, Search } from "lucide-vue-next";
import type { Command } from "@/lib/commands/types";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { useCommandsStore } from "@/stores/commands.store";

interface KvCommandDeps {
  hasList: () => boolean;
  canRead: () => boolean;
  canWrite: () => boolean;
  refresh: () => void;
  newKey: () => void;
  focusFind: () => void;
  /** Whether Ctrl+F belongs to this tab: focus inside it (not in the pane) or nowhere. */
  findHere: () => boolean;
  togglePane: () => void;
}

/**
 * Palette commands of the Key-value tab (group Data). Ctrl+F only takes the keys while the
 * focus is in this tab, so other panels and the pane keep their own find.
 */
export function useKvCommands(deps: KvCommandDeps) {
  const commands = useCommandsStore();
  useCommandProvider("screen.storage", (): Command[] => [
    {
      id: "data.kv.refresh",
      title: "Read key-value data again",
      group: "Data",
      icon: RefreshCw,
      screen: true,
      keywords: ["refresh", "reload", "local storage", "session storage", "localforage"],
      when: deps.canRead,
      run: deps.refresh,
    },
    {
      id: "data.kv.find",
      title: "Find keys",
      group: "Data",
      icon: Search,
      binding: "mod+f",
      screen: true,
      keywords: ["search", "filter", "keys", "values"],
      when: () => deps.hasList() && (commands.paletteOpen || deps.findHere()),
      run: deps.focusFind,
    },
    {
      id: "data.kv.new",
      title: "New key",
      group: "Data",
      icon: Plus,
      screen: true,
      keywords: ["add", "create", "set item"],
      when: () => deps.hasList() && deps.canWrite(),
      run: deps.newKey,
    },
    {
      id: "data.kv.pane",
      title: "Show or hide the record pane",
      group: "Data",
      icon: PanelRight,
      screen: true,
      keywords: ["inspector", "details", "value"],
      when: deps.hasList,
      run: deps.togglePane,
    },
  ]);
}
