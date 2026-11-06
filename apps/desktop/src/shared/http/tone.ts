export type CellTone = "default" | "muted" | "subtle" | "warning" | "error";

/**
 * The tone of an HTTP code, louder the less ordinary it is: success stays quietest, a redirect
 * a step up, and every client or server error takes the error colour.
 */
export function statusTone(code: number): CellTone {
  if (code >= 400) return "error";
  if (code >= 300) return "muted";
  return "subtle";
}

/** Tailwind text classes for a cell tone. */
export const TONE_CLASS: Record<CellTone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  subtle: "text-[var(--fg-subtle)]",
  warning: "text-warning",
  error: "text-error",
};
