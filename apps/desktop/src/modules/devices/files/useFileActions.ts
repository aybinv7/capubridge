import { computed, shallowRef, type Ref } from "vue";
import { toast } from "vue-sonner";
import { invokeCommand } from "@/runtime/ipc/client";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import { isFolderEntry, type DeviceFileListEntry } from "./filePaths";

interface FileActionHooks {
  beforeDelete: (entry: DeviceFileListEntry) => void;
  afterDelete: (entry: DeviceFileListEntry) => Promise<void>;
}

/** Open on this computer, choose an app, download, and delete (asked first). */
export function useFileActions(serial: Ref<string>, hooks: FileActionHooks) {
  const pendingDelete = shallowRef<DeviceFileListEntry | null>(null);

  const deleteOpen = computed({
    get: () => pendingDelete.value !== null,
    set: (open: boolean) => {
      if (!open) pendingDelete.value = null;
    },
  });
  const deleteRequest = computed<ConfirmRequest | null>(() => {
    const entry = pendingDelete.value;
    if (!entry) return null;
    return {
      title: `Delete ${entry.name}?`,
      text: isFolderEntry(entry)
        ? "The folder and everything in it are removed from the phone. This cannot be undone."
        : "The file is removed from the phone. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    };
  });

  async function openOnComputer(entry: DeviceFileListEntry) {
    if (isFolderEntry(entry)) return;
    try {
      await invokeCommand("adb_open_file", { serial: serial.value, path: entry.path });
      toast.success(`Opened ${entry.name}`);
    } catch (err) {
      toast.error(`Could not open ${entry.name}`, { description: String(err) });
    }
  }

  async function chooseApp(entry: DeviceFileListEntry) {
    try {
      await invokeCommand("adb_open_file_picker", { serial: serial.value, path: entry.path });
    } catch (err) {
      toast.error(`Could not choose an app for ${entry.name}`, { description: String(err) });
    }
  }

  async function download(entry: DeviceFileListEntry) {
    try {
      const saved = await invokeCommand("adb_pull_file", {
        serial: serial.value,
        path: entry.path,
      });
      toast.success(`Downloaded ${entry.name}`, { description: saved });
    } catch (err) {
      toast.error(`Could not download ${entry.name}`, { description: String(err) });
    }
  }

  function requestDelete(entry: DeviceFileListEntry) {
    pendingDelete.value = entry;
  }

  async function confirmDelete() {
    const entry = pendingDelete.value;
    pendingDelete.value = null;
    if (!entry) return;
    hooks.beforeDelete(entry);
    try {
      await invokeCommand("adb_delete_file", {
        serial: serial.value,
        path: entry.path,
        isDir: entry.entryType === "dir",
      });
      toast.success(`Deleted ${entry.name}`);
      await hooks.afterDelete(entry);
    } catch (err) {
      toast.error(`Could not delete ${entry.name}`, { description: String(err) });
    }
  }

  return {
    openOnComputer,
    chooseApp,
    download,
    requestDelete,
    confirmDelete,
    deleteOpen,
    deleteRequest,
  };
}
