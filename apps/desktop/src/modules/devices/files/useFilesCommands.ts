import { ArrowUp, Eye, EyeOff, FolderOpen, RefreshCw, Search } from "lucide-vue-next";
import type { Command } from "@/lib/commands/types";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { FILE_PLACES } from "./filesView";
import type { useFileBrowser } from "./useFileBrowser";

interface FilesCommandDeps {
  browser: ReturnType<typeof useFileBrowser>;
}

/** Palette commands for the Files tab: reload, go up, hidden files, search everywhere, places. */
export function useFilesCommands({ browser }: FilesCommandDeps) {
  useCommandProvider("screen.device-files", (): Command[] => [
    {
      id: "device.files.reload",
      title: "Read the folder again",
      group: "Devices",
      icon: RefreshCw,
      screen: true,
      keywords: ["refresh", "files", "reload"],
      run: () => browser.refresh(),
    },
    {
      id: "device.files.up",
      title: "Up one folder",
      group: "Devices",
      icon: ArrowUp,
      screen: true,
      keywords: ["parent", "back", "files"],
      when: () => browser.dir.value !== "/",
      run: () => browser.openParent(),
    },
    {
      id: "device.files.hidden",
      title: browser.showHidden.value ? "Hide hidden files" : "Show hidden files",
      group: "Devices",
      icon: browser.showHidden.value ? EyeOff : Eye,
      screen: true,
      keywords: ["dot files", "files"],
      run: () => {
        browser.showHidden.value = !browser.showHidden.value;
      },
    },
    {
      id: "device.files.search-phone",
      title: "Search the whole phone for a file",
      group: "Devices",
      icon: Search,
      screen: true,
      keywords: ["find", "files"],
      run: () => {
        browser.scope.value = "device";
      },
    },
    ...FILE_PLACES.map<Command>((place) => ({
      id: `device.files.place.${place.key}`,
      title: `Open ${place.label} in Files`,
      group: "Devices",
      icon: FolderOpen,
      screen: true,
      keywords: [place.path, "folder", "files"],
      run: () => browser.openFolder(place.path),
    })),
  ]);
}
