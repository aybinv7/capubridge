export type ThemeMode = "dark" | "light";
export type ContrastClass = "AA" | "AAA";

export type AccentRamp = {
  /** Reference label, e.g. "coral-amber" or "custom". */
  id: string;
  /** Display label shown in the picker. */
  label: string;
  /** 7-step ramp; index 0 = lightest, index 6 = darkest. */
  steps: readonly [string, string, string, string, string, string, string];
};

/**
 * Semantic tokens (Layer B). Every component reads from these.
 * Values are CSS color strings (any valid syntax: hex, rgb(), hsl(), oklch()…).
 */
export type SemanticTokens = {
  bgApp: string;
  bgChrome: string;
  bgSurface: string;
  bgSurfaceRaised: string;
  bgOverlay: string;

  fgDefault: string;
  fgMuted: string;
  fgSubtle: string;
  fgOnAccent: string;

  borderDefault: string;
  borderStrong: string;
  borderSubtle: string;

  accentSoft: string;
  ring: string;

  stateSuccess: string;
  stateWarning: string;
  stateDanger: string;
  stateInfo: string;
};

/**
 * A theme is pure data: semantic tokens + metadata.
 * Accent comes from a separate AccentRamp so themes and accents are orthogonal.
 */
export type Theme = {
  id: string;
  label: string;
  mode: ThemeMode;
  semantics: SemanticTokens;
  meta: { contrastClass: ContrastClass };
};
