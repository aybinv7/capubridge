import { toast } from "vue-sonner";
import { fileStem, saveFileAs } from "@/lib/download";
import { formatLogcatLine } from "@/lib/logcat/logcatEntry";
import type { RingBuffer } from "@/lib/ring-buffer";
import { invokeCommand } from "@/runtime/ipc/client";
import type { LogcatEntry } from "@/types/logcat.types";

export type LogsExportFormat = "txt" | "json";

function stamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function matching(
  ring: RingBuffer<LogcatEntry>,
  predicate: ((entry: LogcatEntry) => boolean) | null,
): LogcatEntry[] {
  const kept: LogcatEntry[] = [];
  ring.forEach((entry) => {
    if (!predicate || predicate(entry)) kept.push(entry);
  });
  return kept;
}

async function showInFolder(path: string) {
  try {
    await invokeCommand("show_in_folder", { path });
  } catch (error) {
    toast.error("Could not open the folder", { description: String(error) });
  }
}

/**
 * Saves every kept line the current query keeps (repeats written out), through the save
 * dialog, and names the file in a toast with a way to its folder. Cancelling saves nothing.
 */
export async function exportLogs(
  ring: RingBuffer<LogcatEntry>,
  predicate: ((entry: LogcatEntry) => boolean) | null,
  format: LogsExportFormat,
  deviceLabel: string,
): Promise<void> {
  const entries = matching(ring, predicate);
  const content =
    format === "json" ? JSON.stringify(entries, null, 2) : entries.map(formatLogcatLine).join("\n");
  const name = `${fileStem("logcat", deviceLabel, stamp())}.${format}`;
  try {
    const path = await saveFileAs(content, name, [
      format === "json"
        ? { name: "JSON", extensions: ["json"] }
        : { name: "Text", extensions: ["txt", "log"] },
    ]);
    if (!path) return;
    toast.success(`Saved ${entries.length.toLocaleString()} lines`, {
      description: path,
      action: { label: "Show in folder", onClick: () => void showInFolder(path) },
    });
  } catch (error) {
    toast.error("Could not save the lines", { description: String(error) });
  }
}
