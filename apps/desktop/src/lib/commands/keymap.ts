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

/** Cladd `Shortcut` token names for keys whose `KeyboardEvent.key` differs from the glyph name. */
const SHORTCUT_TOKENS: Record<string, string> = {
  escape: "esc",
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  " ": "space",
  delete: "del",
};

function keyToken(key: string): string {
  return SHORTCUT_TOKENS[key] ?? key;
}

/**
 * Cladd `Shortcut` input for a binding: `mod+shift+d` → `cmd shift d`, `g d` → `g d`.
 * `cmd` renders as ⌘ on macOS and CTRL elsewhere, matching what `mod` means.
 */
export function bindingTokens(binding: string): string {
  const parsed = parseBinding(binding);
  if (parsed.kind === "sequence") return parsed.keys.map(keyToken).join(" ");
  const tokens: string[] = [];
  if (parsed.chord.mod) tokens.push("cmd");
  if (parsed.chord.alt) tokens.push("alt");
  if (parsed.chord.shift) tokens.push("shift");
  tokens.push(keyToken(parsed.chord.key));
  return tokens.join(" ");
}

const LABEL_NAMES: Record<string, string> = {
  escape: "Esc",
  enter: "Enter",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  " ": "Space",
  delete: "Del",
};

function keyLabel(key: string): string {
  return LABEL_NAMES[key] ?? key.toUpperCase();
}

/**
 * Plain-text form for `title` and `aria-keyshortcuts`-style hints: `mod+shift+d` → `Ctrl+Shift+D`
 * (`⌘⇧D` on macOS), `g d` → `G then D`. Use `bindingTokens` for rendered key caps.
 */
export function bindingLabel(binding: string): string {
  const parsed = parseBinding(binding);
  if (parsed.kind === "sequence") return parsed.keys.map(keyLabel).join(" then ");
  const { chord } = parsed;
  if (isMac) {
    return `${chord.mod ? "⌘" : ""}${chord.alt ? "⌥" : ""}${chord.shift ? "⇧" : ""}${keyLabel(chord.key)}`;
  }
  const parts: string[] = [];
  if (chord.mod) parts.push("Ctrl");
  if (chord.alt) parts.push("Alt");
  if (chord.shift) parts.push("Shift");
  parts.push(keyLabel(chord.key));
  return parts.join("+");
}
