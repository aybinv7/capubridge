import type { ComputedRef, Ref } from "vue";
import { CircleStop, Eraser, FolderOpen, Play, RefreshCw, Trash2 } from "lucide-vue-next";
import { useCommandProvider } from "@/composables/useCommandProvider";
import type { AdbPackage } from "@/types/adb.types";
import { appDisplayName, appFolders } from "./appsModel";
import type { useAppActions } from "./useAppActions";

interface AppsCommandDeps {
  selectedApp: ComputedRef<AdbPackage | null>;
  actions: ReturnType<typeof useAppActions>;
  reload: () => Promise<void>;
  openFiles: (path: string) => void;
  serial: Ref<string>;
}

/** Palette commands for the Apps tab: reload, and every action on the selected app. */
export function useAppsCommands({
  selectedApp,
  actions,
  reload,
  openFiles,
  serial,
}: AppsCommandDeps) {
  useCommandProvider("screen.device-apps", () => {
    const app = selectedApp.value;
    const reloadCommand = {
      id: "device.apps.reload",
      title: "Reload the app list",
      group: "Devices" as const,
      icon: RefreshCw,
      screen: true,
      keywords: ["packages", "refresh", "apps"],
      when: () => serial.value !== "",
      run: reload,
    };
    if (!app) return [reloadCommand];
    const name = appDisplayName(app);
    const privateData = appFolders(app, undefined)[0];
    return [
      reloadCommand,
      {
        id: "device.apps.open",
        title: `Open ${name} on the phone`,
        group: "Devices" as const,
        icon: Play,
        screen: true,
        keywords: ["launch", "start", app.packageName],
        run: () => actions.launch(app),
      },
      {
        id: "device.apps.force-stop",
        title: `Force stop ${name}`,
        group: "Devices" as const,
        icon: CircleStop,
        screen: true,
        keywords: ["kill", app.packageName],
        run: () => actions.request(app, "forceStop"),
      },
      {
        id: "device.apps.clear-data",
        title: `Clear the data of ${name}`,
        group: "Devices" as const,
        icon: Eraser,
        screen: true,
        keywords: ["reset", "pm clear", app.packageName],
        run: () => actions.request(app, "clearData"),
      },
      {
        id: "device.apps.uninstall",
        title: `Uninstall ${name}`,
        group: "Devices" as const,
        icon: Trash2,
        screen: true,
        keywords: ["remove", "delete", app.packageName],
        run: () => actions.request(app, "uninstall"),
      },
      ...(privateData
        ? [
            {
              id: "device.apps.files",
              title: `Browse the private data of ${name}`,
              group: "Devices" as const,
              icon: FolderOpen,
              screen: true,
              keywords: ["files", "sandbox", "data/data", app.packageName],
              run: () => openFiles(privateData.path),
            },
          ]
        : []),
    ];
  });
}
