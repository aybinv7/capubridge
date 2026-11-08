import type { Component } from "vue";

export type CommandGroup =
  | "Recent"
  | "Navigate"
  | "Devices"
  | "App"
  | "Targets"
  | "View"
  | "Session"
  | "Appearance"
  | "Network"
  | "Data"
  | "Help";

/** Where the palette lists a command: the destinations, the switchers, data jumps or actions. */
export type PaletteSection = "go-to" | "apps" | "switch" | "tables" | "actions";

export interface Command {
  id: string;
  title: string;
  group: CommandGroup;
  icon?: Component;
  /** Extra words the palette matches on (not shown). */
  keywords?: readonly string[];
  /** Short trailing detail, e.g. a serial or a status. */
  detail?: string;
  /** Overrides the section the group implies (navigation is "go-to", everything else "actions"). */
  section?: PaletteSection;
  /** Quiet words after the title, read when the row renders, e.g. what a screen still needs. */
  note?: () => string | null;
  /** Keyboard binding in keymap syntax (`mod+k`, `g d`). */
  binding?: string;
  /** Listed only when the query matches it, e.g. stale devices. */
  dormant?: boolean;
  /** Contributed by the active screen; listed by the action panel. */
  screen?: boolean;
  /** Bindings that also fire while typing in an input. */
  global?: boolean;
  /** Hidden from the palette when it returns false. */
  when?: () => boolean;
  run: () => void | Promise<unknown>;
}
