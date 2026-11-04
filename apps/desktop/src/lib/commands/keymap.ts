/**
 * Bindings are written as `mod+k`, `mod+shift+p`, `escape`, or a two-key sequence `g d`.
 * `mod` is Ctrl on Windows/Linux and Cmd on macOS.
 */
export interface ParsedChord {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

export type ParsedBinding =
  | { kind: "chord"; chord: ParsedChord }
  | { kind: "sequence"; keys: [string, string] };

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function parseBinding(binding: string): ParsedBinding {
  const trimmed = binding.trim().toLowerCase();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 2 && !parts[0].includes("+") && !parts[1].includes("+")) {
    return { kind: "sequence", keys: [parts[0], parts[1]] };
  }
  const tokens = trimmed.split("+");
  const key = tokens.pop() ?? "";
  return {
    kind: "chord",
    chord: {
      mod: tokens.includes("mod"),
      shift: tokens.includes("shift"),
      alt: tokens.includes("alt"),
      key,
    },
  };
}

export function normalizeKey(event: Pick<KeyboardEvent, "key">): string {
  const key = event.key.toLowerCase();
  if (key === "esc") return "escape";
  return key;
}

/** Punctuation lives on shifted keys in many layouts (AZERTY's "."), so Shift is layout noise there. */
function isLayoutDependent(key: string): boolean {
  return key.length === 1 && !/[a-z0-9]/.test(key);
}

export function matchesChord(chord: ParsedChord, event: KeyboardEvent): boolean {
  const mod = isMac ? event.metaKey : event.ctrlKey;
  const shiftMatches = isLayoutDependent(chord.key) || event.shiftKey === chord.shift;
  return (
    mod === chord.mod &&
    shiftMatches &&
    event.altKey === chord.alt &&
    normalizeKey(event) === chord.key
  );
}

const KEY_LABELS: Record<string, string> = {
  escape: "Esc",
  enter: "Enter",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  ",": ",",
  ".": ".",
};

function keyLabel(key: string): string {
  return KEY_LABELS[key] ?? key.toUpperCase();
}

/** Display form, split into keycaps: `mod+shift+p` → ["Ctrl", "Shift", "P"], `g d` → ["G", "D"]. */
export function formatBinding(binding: string): string[] {
  const parsed = parseBinding(binding);
  if (parsed.kind === "sequence") return parsed.keys.map(keyLabel);
  const caps: string[] = [];
  if (parsed.chord.mod) caps.push(isMac ? "⌘" : "Ctrl");
  if (parsed.chord.alt) caps.push(isMac ? "⌥" : "Alt");
  if (parsed.chord.shift) caps.push(isMac ? "⇧" : "Shift");
  caps.push(keyLabel(parsed.chord.key));
  return caps;
}
