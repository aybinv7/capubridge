/** Text colour for a load reading: plain ink when normal, warning from 60 %, error from 80 %. */
export function loadTone(percent: number | null): string {
  if (percent === null) return "text-muted-foreground";
  if (percent >= 80) return "text-error";
  if (percent >= 60) return "text-warning";
  return "text-foreground";
}

/**
 * Text colour for memory use. Android keeps cached apps in memory on purpose, so a high share is
 * normal; it only warns from 85 % and calls 95 % an error.
 */
export function memoryTone(percent: number | null): string {
  if (percent === null) return "text-muted-foreground";
  if (percent >= 95) return "text-error";
  if (percent >= 85) return "text-warning";
  return "text-foreground";
}

/** Text colour for a battery level: error under 20 %, warning under 40 %, plain ink otherwise. */
export function batteryTone(level: number | null): string {
  if (level === null) return "text-muted-foreground";
  if (level < 20) return "text-error";
  if (level < 40) return "text-warning";
  return "text-foreground";
}
