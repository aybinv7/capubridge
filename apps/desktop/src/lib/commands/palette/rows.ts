import type { PaletteItem, PaletteSectionView } from "./items";

export type PaletteRow =
  | { type: "header"; key: string; label: string }
  | { type: "item"; key: string; item: PaletteItem; first: boolean };

export const HEADER_HEIGHT = 28;
export const ITEM_HEIGHT = 40;
export const APP_ITEM_HEIGHT = 48;

/** Section headers and items in one list, the shape a virtual list renders. */
export function flattenRows(sections: readonly PaletteSectionView[]): PaletteRow[] {
  const rows: PaletteRow[] = [];
  for (const section of sections) {
    if (section.items.length === 0) continue;
    rows.push({ type: "header", key: `header:${section.id}`, label: section.label });
    section.items.forEach((item, index) => {
      rows.push({ type: "item", key: item.key, item, first: index === 0 });
    });
  }
  return rows;
}

export function rowHeight(row: PaletteRow): number {
  if (row.type === "header") return HEADER_HEIGHT;
  return row.item.kind === "app" ? APP_ITEM_HEIGHT : ITEM_HEIGHT;
}

/** The items only, in list order: what the arrow keys move through. */
export function itemKeys(rows: readonly PaletteRow[]): string[] {
  return rows.flatMap((row) => (row.type === "item" ? [row.key] : []));
}

/**
 * The key `delta` steps from `current` among `keys`, wrapping at both ends. With no current
 * key, forward lands on the first and backward on the last.
 */
export function stepKey(
  keys: readonly string[],
  current: string | null,
  delta: number,
): string | null {
  if (keys.length === 0) return null;
  const index = current === null ? -1 : keys.indexOf(current);
  if (index === -1) return keys[delta >= 0 ? 0 : keys.length - 1] ?? null;
  const next = (((index + delta) % keys.length) + keys.length) % keys.length;
  return keys[next] ?? null;
}

/** The row index to scroll to for a highlighted key: its section header when it opens one. */
export function scrollTargetIndex(rows: readonly PaletteRow[], key: string | null): number {
  if (key === null) return -1;
  const index = rows.findIndex((row) => row.key === key);
  if (index <= 0) return index;
  const row = rows[index];
  return row?.type === "item" && row.first ? index - 1 : index;
}
