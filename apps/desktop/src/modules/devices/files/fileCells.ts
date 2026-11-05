import { formatDateWords, isFactoryDate, parseDeviceDate } from "@/shared/format/dates";
import { formatSize } from "./fileKinds";
import { isFolderEntry, type DeviceFileListEntry } from "./filePaths";

/** The size column: a dash for folders and unreadable entries, "Unknown" when not listed. */
export function sizeCell(entry: DeviceFileListEntry, sizesKnown: boolean): string {
  if (isFolderEntry(entry) || entry.noAccess) return "—";
  return sizesKnown || entry.size > 0 ? formatSize(entry.size) : "Unknown";
}

/**
 * The modified column in words. An entry the shell may not read says so instead of a date;
 * system files stamped with the factory date read "Came with the phone".
 */
export function modifiedCell(entry: DeviceFileListEntry, now = Date.now()): string {
  if (entry.noAccess) return "No access";
  const time = parseDeviceDate(entry.modified, now);
  if (time === null) return "Unknown";
  return isFactoryDate(time) ? "Came with the phone" : formatDateWords(time, now);
}
