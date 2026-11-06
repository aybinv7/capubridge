export type CellTone = "default" | "muted" | "subtle" | "warning" | "error";

/** The tone of an HTTP code: success stays quiet, client errors warn, server errors fail. */
export function statusTone(code: number): CellTone {
  if (code >= 500) return "error";
  if (code >= 400) return "warning";
  return "muted";
}

/** Tailwind text classes for a cell tone. */
export const TONE_CLASS: Record<CellTone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  subtle: "text-[var(--fg-subtle)]",
  warning: "text-warning",
  error: "text-error",
};
