/**
 * A file size as the file browser shows it: one decimal below 10 of a unit, whole above. `compact`
 * only changes how an empty file reads ("0 B" against "0 bytes"); "—" for a size that is not one.
 */
export function formatSize(bytes: number, compact = true): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return compact ? "0 B" : "0 bytes";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}
