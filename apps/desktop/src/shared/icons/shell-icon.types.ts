import type { Component } from "vue";

/** Rail destinations that draw a glyph. */
export type RailIconKey =
  | "device"
  | "app"
  | "data"
  | "network"
  | "elements"
  | "devtools"
  | "replay"
  | "flows"
  | "preview"
  | "settings";

/** One glyph in two weights: `regular` at rest, `filled` for the current destination or an open panel. */
export interface ShellIconPair {
  regular: Component;
  filled: Component;
}

/**
 * The shell's icons from one family, so the rail and the title bar share stroke weight, corner
 * style and optical size. Lucide has no filled weights, so the shell does not use it.
 */
export interface ShellIconSet {
  name: string;
  rail: Record<RailIconKey, ShellIconPair>;
  back: Component;
  forward: Component;
  search: Component;
  panelRight: ShellIconPair;
  panelLeft: ShellIconPair;
  panelBottom: ShellIconPair;
  timeline: ShellIconPair;
}
