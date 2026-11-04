import type { Component } from "vue";

export type CommandGroup =
  | "Recent"
  | "Navigate"
  | "Devices"
  | "Targets"
  | "View"
  | "Session"
  | "Appearance"
  | "Network"
  | "Data"
  | "Help";

export interface Command {
  id: string;
  title: string;
  group: CommandGroup;
  icon?: Component;
  /** Extra words the palette matches on (not shown). */
  keywords?: readonly string[];
  /** Short trailing detail, e.g. a serial or a status. */
  detail?: string;
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
