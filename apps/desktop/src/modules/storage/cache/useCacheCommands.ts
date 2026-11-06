import { PanelRight, RefreshCw, Search, Trash2 } from "lucide-vue-next";
import type { Command } from "@/lib/commands/types";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { useCommandsStore } from "@/stores/commands.store";

interface CacheCommandDeps {
  hasCache: () => boolean;
  canRead: () => boolean;
  canWrite: () => boolean;
  refresh: () => void;
  focusFind: () => void;
  /** Whether Ctrl+F belongs to this tab: focus inside it (not in the pane) or nowhere. */
  findHere: () => boolean;
  togglePane: () => void;
  deleteCache: () => void;
}

/**
 * Palette commands of the Cache storage tab (group Data). Ctrl+F only takes the keys while the
 * focus is in this tab, so other panels and the pane keep their own find.
 */
export function useCacheCommands(deps: CacheCommandDeps) {
  const commands = useCommandsStore();
  useCommandProvider("screen.storage", (): Command[] => [
    {
      id: "data.cache.refresh",
      title: "Read Cache storage again",
      group: "Data",
      icon: RefreshCw,
      screen: true,
      keywords: ["refresh", "reload", "cache", "service worker", "caches"],
      when: deps.canRead,
      run: deps.refresh,
    },
    {
      id: "data.cache.find",
      title: "Find cached entries",
      group: "Data",
      icon: Search,
      binding: "mod+f",
      screen: true,
      keywords: ["search", "filter", "url", "address"],
      when: () => deps.hasCache() && (commands.paletteOpen || deps.findHere()),
      run: deps.focusFind,
    },
    {
      id: "data.cache.pane",
      title: "Show or hide the record pane",
      group: "Data",
      icon: PanelRight,
      screen: true,
      keywords: ["inspector", "details", "response", "headers"],
      when: deps.hasCache,
      run: deps.togglePane,
    },
    {
      id: "data.cache.delete",
      title: "Delete this cache…",
      group: "Data",
      icon: Trash2,
      screen: true,
      keywords: ["remove", "clear", "cache"],
      when: () => deps.hasCache() && deps.canWrite(),
      run: deps.deleteCache,
    },
  ]);
}
