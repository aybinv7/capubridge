import type { GridIntent } from "./gridKeys";
import type { GridRow } from "./types";

/** A section header or a note: a row that holds no data and is never copied or acted on. */
export function isStructural(row: GridRow | undefined): boolean {
  return row !== undefined && (row.section !== undefined || row.note !== undefined);
}

/** What a key does on a header or a note, in place of moving, editing or inspecting. */
export type SectionIntent =
  | { kind: "toggle"; open: boolean }
  | { kind: "action" }
  | { kind: "down" }
  | { kind: "stay" };

/**
 * Tree-grid keys on a structural row: Enter and Space open or close a header, Right opens it
 * (or steps into it when open), Left closes it; Enter and Space run a note's action. `null`
 * leaves the key to the grid.
 */
export function sectionIntent(row: GridRow | undefined, intent: GridIntent): SectionIntent | null {
  if (!row) return null;
  const section = row.section;
  if (section) {
    if (intent.kind === "edit" || intent.kind === "inspect") {
      return { kind: "toggle", open: !section.open };
    }
    if (intent.kind !== "move" || intent.extend) return null;
    if (intent.move === "right")
      return section.open ? { kind: "down" } : { kind: "toggle", open: true };
    if (intent.move === "left")
      return section.open ? { kind: "toggle", open: false } : { kind: "stay" };
    return null;
  }
  if (row.note && (intent.kind === "edit" || intent.kind === "inspect")) {
    return row.note.action && !row.note.busy ? { kind: "action" } : { kind: "stay" };
  }
  return null;
}

/**
 * The number each row shows in the gutter: data rows count from `offset + 1`, or from 1 again
 * after every section header; structural rows show none (`0`).
 */
export function gutterNumbers(rows: readonly GridRow[], offset: number): number[] {
  const numbers = Array.from<number>({ length: rows.length });
  const sectioned = rows.some((row) => row.section !== undefined);
  let count = sectioned ? 0 : offset;
  rows.forEach((row, index) => {
    if (row.section) count = 0;
    if (isStructural(row)) {
      numbers[index] = 0;
      return;
    }
    count += 1;
    numbers[index] = count;
  });
  return numbers;
}

export interface SectionValueText {
  text: string;
  /** `null` for NULL, `empty` for empty or blank text, `value` otherwise. */
  kind: "null" | "empty" | "value";
}

/** A section's value as read: NULL and empty text named, blank text quoted so it shows. */
export function sectionValueText(value: unknown, formatted: string): SectionValueText {
  if (value === null || value === undefined) return { text: "NULL", kind: "null" };
  if (value === "") return { text: "empty", kind: "empty" };
  if (typeof value === "string" && value.trim() === "")
    return { text: `“${value}”`, kind: "empty" };
  return { text: formatted, kind: "value" };
}
