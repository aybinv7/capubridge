import { onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { FolderOpen } from "lucide-vue-next";
import { useCommandsStore } from "@/stores/commands.store";

/** Id of the app-wide "Open an IndexedDB export…" command (also offered by the IndexedDB gate). */
export const OPEN_IDB_EXPORT_COMMAND = "data.idb.open-export";

/**
 * Data commands that work from anywhere, phone or not: opening an export lands on the ungated
 * file route of the IndexedDB tab.
 */
export function useDataAppCommands(): void {
  const router = useRouter();
  const commands = useCommandsStore();
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
