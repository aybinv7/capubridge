import { ref } from "vue";
import { toast } from "@/lib/toast";
import { invokeCommand, listenEvent } from "@/runtime/ipc/client";
import { formatBytes } from "@/shared/format/numbers";
import { useTargetsStore } from "@/stores/targets.store";
import type { OpfsRow } from "./opfsModel";

function quoted(text: string): string {
  return `“${text}”`;
}

/** The OPFS path being saved, for every folder on screen: one save at a time, app-wide. */
const saving = ref<string | null>(null);
let saveCount = 0;

async function cancel(saveId: string) {
  try {
    await invokeCommand("opfs_cancel_save", { saveId });
  } catch (error) {
    toast.error("The save could not be cancelled", { description: String(error) });
  }
}

/**
 * Saves an OPFS file where the person picks (the system save dialog asks before replacing a
 * file). Rust streams it from the phone straight to disk, so large files never pass through
 * this window; progress shows in the toast, which can cancel the save. The state is shared, so
 * opening another folder neither loses a running save nor starts a second one.
 */
export function useOpfsDownload() {
  const targets = useTargetsStore();

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
    if (!destination || saving.value) return;

    saveCount += 1;
    const saveId = `opfs-save-${Date.now()}-${saveCount}`;
    const cancelAction = { label: "Cancel", onClick: () => void cancel(saveId) };
    saving.value = row.path;
    const toastId = toast.loading(`Saving ${quoted(row.name)}…`, { action: cancelAction });
    let unlisten: (() => void) | null = null;
    try {
      unlisten = await listenEvent("capubridge:opfs-pull-progress", (payload) => {
        if (payload.opfsPath !== row.path) return;
        toast.loading(
          `Saving ${quoted(row.name)} — ${formatBytes(payload.loaded)} of ${formatBytes(payload.total)}`,
          { id: toastId, action: cancelAction },
        );
      });
      const result = await invokeCommand("opfs_save_file", {
        wsUrl,
        path: row.path,
        destination,
        saveId,
      });
      toast.success(`Saved ${quoted(row.name)}`, {
        id: toastId,
        action: undefined,
        description: result.changed
          ? `${destination}. The app wrote to it while it was copied, so the copy may mix old and new data; save it again with the app closed.`
          : destination,
      });
    } catch (error) {
      const message = String(error);
      if (/cancelled/i.test(message)) {
        toast.info(`Did not save ${quoted(row.name)}`, {
          id: toastId,
          action: undefined,
          description: "The save was cancelled; nothing was written.",
        });
      } else {
        toast.error(`Could not save ${quoted(row.name)}`, {
          id: toastId,
          action: undefined,
          description: message,
        });
      }
    } finally {
      unlisten?.();
      saving.value = null;
    }
  }

  return { saving, download };
}
