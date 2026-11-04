import type { GridMove } from "./selection";

export type GridIntent =
  | { kind: "move"; move: GridMove; extend: boolean }
  | { kind: "edit" }
  | { kind: "inspect" }
  | { kind: "delete" }
  | { kind: "copy"; withHeader: boolean }
  | { kind: "selectAll" }
  | { kind: "clear" };

const ARROWS: Record<string, GridMove> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  PageUp: "pageUp",
  PageDown: "pageDown",
};

type KeyInput = Pick<KeyboardEvent, "key" | "shiftKey" | "ctrlKey" | "metaKey" | "altKey">;

/**
 * Maps a keydown on the grid to an intent. Spreadsheet conventions: arrows move,
 * Shift extends, Ctrl+arrow and Ctrl+Home/End jump, Enter edits, Space inspects.
 */
export function gridIntent(event: KeyInput): GridIntent | null {
  const mod = event.ctrlKey || event.metaKey;
  if (event.altKey) return null;
  const extend = event.shiftKey;

  if (event.key in ARROWS) {
    const move = ARROWS[event.key];
    if (!move) return null;
    if (mod && move === "up") return { kind: "move", move: "first", extend };
    if (mod && move === "down") return { kind: "move", move: "last", extend };
    if (mod && move === "left") return { kind: "move", move: "home", extend };
    if (mod && move === "right") return { kind: "move", move: "end", extend };
    return { kind: "move", move, extend };
  }
  if (event.key === "Home") return { kind: "move", move: mod ? "first" : "home", extend };
  if (event.key === "End") return { kind: "move", move: mod ? "last" : "end", extend };
  if (event.key === "Tab") return { kind: "move", move: extend ? "left" : "right", extend: false };
  if (event.key === "Enter" || event.key === "F2") return { kind: "edit" };
  if (event.key === " ") return { kind: "inspect" };
  if (event.key === "Delete") return { kind: "delete" };
  if (event.key === "Escape") return { kind: "clear" };
  if (mod && event.key.toLowerCase() === "a") return { kind: "selectAll" };
  if (mod && event.key.toLowerCase() === "c") return { kind: "copy", withHeader: extend };
  return null;
}
