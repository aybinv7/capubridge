import { toast } from "@/lib/toast";
import { formatBytes } from "@/shared/format/numbers";
import type { IdbTransferProgress } from "./idbTransfer.types";

function describe(update: IdbTransferProgress): string {
  const where = `${update.store} · store ${update.storeIndex + 1} of ${update.storeCount}`;
  const records = `${update.records.toLocaleString("en-US")} records`;
  switch (update.phase) {
    case "export":
      return `${where} · ${records} · ${formatBytes(update.bytes)} written`;
    case "check": {
      const sent = update.totalBytes
        ? `${formatBytes(update.bytes)} of about ${formatBytes(update.totalBytes)}`
        : formatBytes(update.bytes);
      return `Checking the file on the phone first · ${where} · ${sent}`;
    }
    case "write":
      return `Writing · ${where} · ${records}`;
  }
}

/**
 * A toast that follows a long export or import, with a way to cancel it between chunks until
 * `lockCancel` says the transfer has reached the point where stopping would leave damage.
 */
export function transferToast(title: string) {
  const controller = new AbortController();
  let cancellable = true;
  let last = "";

  const cancelAction = () =>
    cancellable ? { label: "Cancel", onClick: () => controller.abort() } : undefined;

  const id = toast.loading(title, { duration: Infinity, action: cancelAction() });

  function render() {
    toast.loading(title, {
      id,
      duration: Infinity,
      description: last || undefined,
      action: cancelAction(),
    });
  }

  function progress(update: IdbTransferProgress) {
    last = describe(update);
    render();
  }

  function lockCancel(note: string) {
    cancellable = false;
    last = note;
    render();
  }

  function done(message: string, description?: string) {
    toast.success(message, { id, description, duration: 5000, action: undefined });
  }

  function failed(error: unknown, message: string) {
    if (error instanceof Error && error.name === "AbortError") {
      toast.info("Cancelled. Nothing was changed on the phone.", {
        id,
        description: undefined,
        duration: 4000,
        action: undefined,
      });
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

  return { signal: controller.signal, progress, lockCancel, done, failed, dismiss };
}
