import { ArrowUp, PanelRight, RefreshCw, Search, Trash2 } from "lucide-vue-next";
import type { Command } from "@/lib/commands/types";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { useCommandsStore } from "@/stores/commands.store";

interface OpfsCommandDeps {
  inFolder: () => boolean;
  canRead: () => boolean;
  canWrite: () => boolean;
  refresh: () => void;
  focusFind: () => void;
  /** Whether Ctrl+F belongs to this tab: focus inside it (not in the pane) or nowhere. */
  findHere: () => boolean;
  togglePane: () => void;
  openParent: () => void;
  deleteFolder: () => void;
}

/**
 * Palette commands of the OPFS tab (group Data). Ctrl+F only takes the keys while the focus is in
 * this tab, so other panels and the pane keep their own find.
 */
export function useOpfsCommands(deps: OpfsCommandDeps) {
  const commands = useCommandsStore();
  useCommandProvider("screen.storage", (): Command[] => [
    {
      id: "data.opfs.refresh",
      title: "Read OPFS again",
      group: "Data",
      icon: RefreshCw,
      screen: true,
      keywords: ["refresh", "reload", "opfs", "files", "folders"],
      when: deps.canRead,
      run: deps.refresh,
    },
    {
      id: "data.opfs.find",
      title: "Find files in this folder",
      group: "Data",
      icon: Search,
      binding: "mod+f",
      screen: true,
      keywords: ["search", "filter", "name"],
      when: () => commands.paletteOpen || deps.findHere(),
      run: deps.focusFind,
    },
    {
      id: "data.opfs.pane",
      title: "Show or hide the record pane",
      group: "Data",
      icon: PanelRight,
      screen: true,
      keywords: ["inspector", "details", "preview", "file"],
      run: deps.togglePane,
    },
    {
      id: "data.opfs.up",
      title: "Open the folder above",
      group: "Data",
      icon: ArrowUp,
      screen: true,
      keywords: ["parent", "up", "back"],
      when: deps.inFolder,
      run: deps.openParent,
    },
    {
      id: "data.opfs.delete-folder",
      title: "Delete this folder…",
      group: "Data",
      icon: Trash2,
      screen: true,
      keywords: ["remove", "folder", "opfs"],
      when: () => deps.inFolder() && deps.canWrite(),
      run: deps.deleteFolder,
    },
  ]);
}
