import { computed, type Ref } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { useTargetsStore } from "@/stores/targets.store";
import type { DeviceFileListEntry } from "../filePaths";
import { appDatabaseFromPath } from "./sqliteHeader";
import type { ViewerState } from "./viewerContent";

/**
 * Where Data › SQLite opens this database, or null when it cannot. That screen lists only the
 * databases folder of the selected app on the selected phone, so a file qualifies when it sits in
 * `/data/data/<app>/databases/` and that app is the one selected on this phone.
 */
export function useDatabaseRoute(
  serial: Ref<string>,
  entry: Ref<DeviceFileListEntry | null>,
  state: Ref<ViewerState>,
) {
  const targets = useTargetsStore();

  return computed<RouteLocationRaw | null>(() => {
    const current = state.value;
    if (current.status !== "ready" || current.content.kind !== "sqlite" || !entry.value) {
      return null;
    }
    const database = appDatabaseFromPath(entry.value.path);
    const target = targets.selectedTarget;
    if (!database || !target || target.source !== "adb") return null;
    if (target.deviceSerial !== serial.value || target.packageName !== database.packageName) {
      return null;
    }
    return { name: "storage-sqlite", params: { db: database.fileName } };
  });
}
