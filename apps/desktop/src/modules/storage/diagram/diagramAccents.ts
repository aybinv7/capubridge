/** Note accents, each a theme colour so a note reads the same in dark and light. */
export const NOTE_ACCENTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "var(--color-signal-mark)", label: "Mark" },
  { value: "var(--color-info)", label: "Blue" },
  { value: "var(--color-success)", label: "Green" },
  { value: "var(--color-warning)", label: "Amber" },
  { value: "var(--color-cat-storage)", label: "Violet" },
  { value: "var(--color-cat-agent)", label: "Pink" },
];

export const DEFAULT_NOTE_ACCENT = "var(--color-signal-mark)";
