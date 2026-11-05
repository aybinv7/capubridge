import type { FileEntry } from "@/types/adb.types";
import {
  fileNameFromPath,
  normalizePath,
  sortEntries,
  type DeviceFileListEntry,
} from "./filePaths";

export const DEVICE_SEARCH_MIN_CHARS = 3;
export const DEVICE_SEARCH_TIMEOUT_S = 10;
export const DEVICE_SEARCH_DEBOUNCE_MS = 450;
export const DEVICE_SEARCH_LIMIT = 180;

const ENTRY_TYPES = new Set<FileEntry["entryType"]>(["dir", "symlink", "file", "other"]);

function shellQuote(value: string): string {
  return value.replace(/'/g, "'\\''");
}

function doubleQuote(value: string): string {
  return value.replace(/(["\\$`])/g, "\\$1");
}

function findPattern(value: string): string {
  return value.replace(/(\\|\*|\?|\[|\])/g, "\\$1");
}

/**
 * One shell command that looks for names containing `query` in the places apps keep files:
 * shared storage, app data, temp, installed packages and the system, de-duplicated, capped at
 * `limit`, each line `type<TAB>path`. The whole walk gives up after `DEVICE_SEARCH_TIMEOUT_S`.
 */
export function deviceSearchCommand(query: string, limit = DEVICE_SEARCH_LIMIT): string | null {
  const escaped = shellQuote(findPattern(query.trim()));
  if (!escaped) return null;
  const roots = [
    "/sdcard/Android/data",
    "/storage/emulated/0/Android/data",
    "/sdcard -maxdepth 8",
    "/storage/emulated/0 -maxdepth 8",
    "/data/local/tmp",
    "/data/data -maxdepth 4",
    "/data/app -maxdepth 4",
    "/system -maxdepth 7",
    "/vendor -maxdepth 6",
  ];
  const finds = roots.map((root) => `find ${root} -iname '*${escaped}*' 2>/dev/null; `).join("");
  return (
    `timeout ${DEVICE_SEARCH_TIMEOUT_S} sh -c "${doubleQuote(finds)}" | awk '!seen[$0]++' | head -n ${limit} ` +
    `| while IFS= read -r p; do ` +
    `if [ -L "$p" ]; then t=symlink; ` +
    `elif [ -d "$p" ]; then t=dir; ` +
    `elif [ -f "$p" ]; then t=file; ` +
    `else t=other; fi; ` +
    `printf '%s\\t%s\\n' "$t" "$p"; done`
  );
}

/** Reads the search output into entries; sizes and dates are unknown, folders come first. */
export function parseDeviceSearch(output: string): DeviceFileListEntry[] {
  const seen = new Set<string>();
  const entries: DeviceFileListEntry[] = [];
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [kind = "", ...rest] = trimmed.split("\t");
    const path = normalizePath(rest.join("\t").trim());
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const entryType = ENTRY_TYPES.has(kind as FileEntry["entryType"])
      ? (kind as FileEntry["entryType"])
      : "other";
    entries.push({
      name: fileNameFromPath(path),
      path,
      size: 0,
      modified: "—",
      permissions: "---------",
      entryType,
    });
  }
  return sortEntries(entries);
}
