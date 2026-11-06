import { cellToText, type GridRowState } from "@/shared/components/data/grid";

const STATE_WORDS: Record<GridRowState, string> = {
  "staged-edit": "edited, not saved",
  "staged-insert": "new, not saved",
  "staged-delete": "will be deleted",
  conflict: "changed on the device",
  recent: "written by the app just now",
  added: "added on the device",
  updated: "changed on the device",
  deleted: "deleted on the device",
};

/**
 * A row's name in the record pane: its key, `id 4182`, or `order_id 12 · line 3` for a composite
 * key; `null` when the table has no key (the row number names it then).
 */
export function recordKeyLabel(
  keyColumns: readonly string[],
  cells: Readonly<Record<string, unknown>>,
): string | null {
  if (keyColumns.length === 0) return null;
  return keyColumns.map((column) => `${column} ${keyText(cells[column])}`).join(" · ");
}

function keyText(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object" && "__type" in value && "value" in value) {
    return typeof value.value === "string" ? value.value : cellToText(value.value);
  }
  return cellToText(value);
}

/** The pane's quiet line about the row: what happened to it, in plain words. */
export function recordStateWords(
  state: GridRowState | undefined,
  change: { source?: "external" | "capubridge"; seen: string } | null,
): string | null {
  if (change) {
    return change.source === "capubridge"
      ? `changed here · ${change.seen}`
      : `changed by the app · seen ${change.seen}`;
  }
  return state ? STATE_WORDS[state] : null;
}
