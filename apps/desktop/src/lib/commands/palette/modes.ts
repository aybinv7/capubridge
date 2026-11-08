export type PaletteMode = "all" | "open" | "actions" | "device" | "table" | "screen";

export interface PaletteState {
  mode: PaletteMode;
  text: string;
}

export interface PaletteModeMeta {
  label: string;
  placeholder: string;
  /** What an empty list says in this mode. */
  empty: string;
}

export const PALETTE_MODES: Record<PaletteMode, PaletteModeMeta> = {
  all: {
    label: "",
    placeholder: "Search screens, actions, devices and apps…",
    empty: "Try a screen name, an app, or start with > for actions.",
  },
  open: {
    label: "Open app",
    placeholder: "Open an app on the phone…",
    empty: "No installed app matches.",
  },
  actions: {
    label: "Actions",
    placeholder: "Run an action…",
    empty: "No action matches.",
  },
  device: {
    label: "Devices and targets",
    placeholder: "Switch device or target…",
    empty: "No device or target matches.",
  },
  table: {
    label: "Tables and stores",
    placeholder: "Jump to a table or store…",
    empty: "Open a database in Data to list its tables here.",
  },
  screen: {
    label: "This screen",
    placeholder: "Actions on this screen…",
    empty: "This screen has no actions yet.",
  },
};

const PREFIX_MODES: Record<string, PaletteMode> = {
  ">": "actions",
  "@": "device",
  "#": "table",
  ":": "screen",
};

const OPEN_WORD = /^(?:>\s*)?open\s+/i;

/**
 * Reads what was typed into the empty-mode input. `open ` (or `>open `) enters the app list;
 * `>`, `@`, `#` and `:` enter actions, devices, tables and this screen. Anything else is a search.
 */
export function parsePaletteInput(raw: string): PaletteState {
  const trimmed = raw.trimStart();
  const open = OPEN_WORD.exec(trimmed);
  if (open) return { mode: "open", text: trimmed.slice(open[0].length) };
  const mode = PREFIX_MODES[trimmed.charAt(0)];
  if (mode) return { mode, text: trimmed.slice(1).trimStart() };
  return { mode: "all", text: raw };
}

/**
 * The state after the input changed to `raw`. A prefix only counts while no mode is entered, so
 * `@` typed inside a mode is plain text; `open ` also works after `>`.
 */
export function applyInput(state: PaletteState, raw: string): PaletteState {
  if (state.mode === "all") return parsePaletteInput(raw);
  if (state.mode === "actions") {
    const open = OPEN_WORD.exec(raw.trimStart());
    if (open) return { mode: "open", text: raw.trimStart().slice(open[0].length) };
  }
  return { mode: state.mode, text: raw };
}

/** Backspace on an empty input leaves the mode; otherwise nothing changes. */
export function leaveMode(state: PaletteState): PaletteState {
  if (state.mode === "all" || state.text !== "") return state;
  return { mode: "all", text: "" };
}
