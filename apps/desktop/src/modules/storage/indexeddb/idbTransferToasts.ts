import { toast } from "vue-sonner";
import type { IdbTransferProgress } from "./idbImportExport";

/** A toast that follows a long export or import, with a way to cancel it between chunks. */
export function transferToast(title: string) {
  const controller = new AbortController();
  const id = toast.loading(title, {
    duration: Infinity,
    action: { label: "Cancel", onClick: () => controller.abort() },
  });

  function progress(update: IdbTransferProgress) {
    toast.loading(title, {
      id,
      duration: Infinity,
      description: `${update.store} · store ${update.storeIndex + 1} of ${update.storeCount} · ${update.records.toLocaleString("en-US")} records`,
      action: { label: "Cancel", onClick: () => controller.abort() },
    });
  }

  function done(message: string, description?: string) {
    toast.success(message, { id, description, duration: 5000, action: undefined });
  }

  function failed(error: unknown, message: string) {
    if (error instanceof Error && error.name === "AbortError") {
      toast.info("Cancelled", { id, description: undefined, duration: 4000, action: undefined });
      return;
    }
    toast.error(message, {
      id,
      description: error instanceof Error ? error.message : String(error),
      duration: 8000,
      action: undefined,
    });
  }

  function dismiss() {
    toast.dismiss(id);
  }

  return { signal: controller.signal, progress, done, failed, dismiss };
}
