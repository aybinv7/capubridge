import { ref } from "vue";
import { toast } from "vue-sonner";
import { invokeCommand, listenEvent } from "@/runtime/ipc/client";
import { formatBytes } from "@/shared/format/numbers";
import { useTargetsStore } from "@/stores/targets.store";
import type { OpfsRow } from "./opfsModel";

function quoted(text: string): string {
  return `“${text}”`;
}

/**
 * Saves an OPFS file where the person picks (the system save dialog asks before replacing a
 * file). Rust streams it from the phone straight to disk, so large files never pass through
 * this window, and progress shows in the toast.
 */
export function useOpfsDownload() {
  const targets = useTargetsStore();
  const saving = ref<string | null>(null);

  async function download(row: OpfsRow) {
    if (row.kind !== "file" || saving.value) return;
    const wsUrl = targets.selectedTarget?.webSocketDebuggerUrl;
    if (!wsUrl) {
      toast.error(`Could not save ${quoted(row.name)}`, {
        description: "The DevTools link to this page is closed.",
      });
      return;
    }
    let destination: string | null;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      destination = await save({ defaultPath: row.name });
    } catch (error) {
      toast.error(`Could not save ${quoted(row.name)}`, { description: String(error) });
      return;
    }
    if (!destination) return;

    saving.value = row.path;
    const toastId = toast.loading(`Saving ${quoted(row.name)}…`);
    let unlisten: (() => void) | null = null;
    try {
      unlisten = await listenEvent("capubridge:opfs-pull-progress", (payload) => {
        if (payload.opfsPath !== row.path) return;
        toast.loading(
          `Saving ${quoted(row.name)} — ${formatBytes(payload.loaded)} of ${formatBytes(payload.total)}`,
          { id: toastId },
        );
      });
      const result = await invokeCommand("opfs_save_file", {
        wsUrl,
        path: row.path,
        destination,
      });
      toast.success(`Saved ${quoted(row.name)}`, {
        id: toastId,
        description: result.changed
          ? `${destination}. The app wrote to it while it was copied, so the copy may mix old and new data; save it again with the app closed.`
          : destination,
      });
    } catch (error) {
      toast.error(`Could not save ${quoted(row.name)}`, {
        id: toastId,
        description: String(error),
      });
    } finally {
      unlisten?.();
      saving.value = null;
    }
  }

  return { saving, download };
}
