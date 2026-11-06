import { onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { FolderOpen } from "lucide-vue-next";
import { useCommandsStore } from "@/stores/commands.store";
import { useTargetsStore } from "@/stores/targets.store";
import { createDataPlaces } from "./frame/dataPlaces";

/** Id of the app-wide "Open an IndexedDB export…" command (also offered by the IndexedDB gate). */
export const OPEN_IDB_EXPORT_COMMAND = "data.idb.open-export";

/**
 * Data commands that work from anywhere, phone or not: opening an export lands on the ungated
 * file route of the IndexedDB tab. Also keeps where each Data tab was left, per target, so a
 * tab opened again from elsewhere comes back to it.
 */
export function useDataAppCommands(): void {
  const router = useRouter();
  const commands = useCommandsStore();
  const targets = useTargetsStore();
  const places = createDataPlaces();
  const stopRestore = router.beforeEach(
    (to, from) => places.restore(targets.cdpTargetId, to, from) ?? true,
  );
  const stopRemember = router.afterEach((to) => places.remember(targets.cdpTargetId, to));
  onUnmounted(() => {
    stopRestore();
    stopRemember();
  });
  const dispose = commands.registerProvider("app.storage", () => [
    {
      id: OPEN_IDB_EXPORT_COMMAND,
      title: "Open an IndexedDB export…",
      group: "Data",
      icon: FolderOpen,
      keywords: ["import", "snapshot", "file", "json", "indexeddb"],
      run: async () => {
        const { openIdbExport } = await import("./indexeddb/openIdbExport");
        await openIdbExport(router);
      },
    },
  ]);
  onUnmounted(dispose);
}
