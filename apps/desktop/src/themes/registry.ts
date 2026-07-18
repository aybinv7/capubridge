import type { Theme, AccentRamp } from "./types";
import { contrastRatio } from "./contrast";
import { codexDark } from "./primitives/codex-dark";
import { codexLight } from "./primitives/codex-light";
import { tokyoNight } from "./primitives/tokyo-night";
import { nord } from "./primitives/nord";
import { solarizedDark } from "./primitives/solarized-dark";
import { highContrast } from "./primitives/high-contrast";

export const themes: readonly Theme[] = [
  codexDark,
  codexLight,
  tokyoNight,
  nord,
  solarizedDark,
  highContrast,
] as const;

export const DEFAULT_THEME_ID = "codex-dark";
export const DEFAULT_ACCENT_ID = "coral-amber";

export function getTheme(id: string): Theme {
  const found = themes.find((t) => t.id === id);
  if (found) return found;
  const fallback = themes.find((t) => t.id === DEFAULT_THEME_ID);
  if (!fallback) throw new Error("default theme missing from registry");
  return fallback;
}

const SEMANTIC_TO_CSS_VAR: Record<keyof Theme["semantics"], string> = {
  bgApp: "--bg-app",
  bgChrome: "--bg-chrome",
  bgSurface: "--bg-surface",
  bgSurfaceRaised: "--bg-surface-raised",
  bgOverlay: "--bg-overlay",
  fgDefault: "--fg-default",
  fgMuted: "--fg-muted",
  fgSubtle: "--fg-subtle",
  fgOnAccent: "--fg-on-accent",
  borderDefault: "--border-default",
  borderStrong: "--border-strong",
  borderSubtle: "--border-subtle",
  accentSoft: "--accent-soft",
  ring: "--ring",
  stateSuccess: "--state-success",
  stateWarning: "--state-warning",
  stateDanger: "--state-danger",
  stateInfo: "--state-info",
};

/**
 * Apply a theme + accent to the document. Idempotent.
 * Safe to call on every theme change; CSS variables update without remount.
 */
export function applyTheme(theme: Theme, accent: AccentRamp): void {
  const html = document.documentElement;

  // Theme id drives any selectors that need to know which theme is active.
  html.dataset.theme = theme.id;
  html.dataset.themeMode = theme.mode;

  // Semantic Layer-B vars.
  for (const key of Object.keys(SEMANTIC_TO_CSS_VAR) as (keyof Theme["semantics"])[]) {
    html.style.setProperty(SEMANTIC_TO_CSS_VAR[key], theme.semantics[key]);
  }

  // Accent ramp (Layer A) and primary aliases. The "primary" step is the one
  // with the strongest contrast against bgSurface — usually step[4], but on
  // themes whose bgSurface is lighter/darker than codex, a neighbouring step
  // may pop better.
  accent.steps.forEach((step, i) => {
    html.style.setProperty(`--accent-${i}`, step);
  });
  const primaryIndex = pickAccentPrimaryIndex(accent, theme.semantics.bgSurface);
  html.style.setProperty("--accent", accent.steps[primaryIndex]);
  html.style.setProperty("--accent-hover", accent.steps[Math.max(0, primaryIndex - 1)]);

  // Brand button surface. Unlike --accent (tuned to pop as a thin mark against
  // the panel), the brand fill carries a text label, so it is chosen to clear
  // strict AA with the theme's own dark/light ink.
  const brand = pickBrandButton(accent, theme.semantics);
  html.style.setProperty("--brand", brand.fill);
  html.style.setProperty("--brand-foreground", brand.fg);
  html.style.setProperty("--brand-hover", brand.hover);
}

/**
 * Choose the accent step + ink for a brand-filled BUTTON so the label clears
 * strict AA (4.5:1). Scans the mid range of the ramp (skips the two palest
 * pastels), pairs each step with whichever of the theme's dark/light ends
 * gives more contrast, and picks the qualifying step closest to the canonical
 * mid-tone (index 4) so it still reads as the accent. There is always a
 * qualifier because the ramp's dark and light ends sit near the luminance
 * extremes. Hover shifts one step in the direction that raises label contrast.
 */
export function pickBrandButton(
  accent: AccentRamp,
  semantics: Theme["semantics"],
): { fill: string; fg: string; hover: string } {
  const darkInk = semantics.bgApp;
  const lightInk = semantics.fgDefault;
  const surface = semantics.bgSurface;
  // A filled button must both carry a readable label (>= 4.5) AND stay visibly
  // distinct from the panel it sits on (>= 2:1). On dark themes with dark
  // accents this rules out the darkest steps (which blend into the panel) and
  // steers the pick toward lighter steps that pop against the panel and take
  // dark ink.
  const MIN_LABEL = 4.5;
  const MIN_VS_PANEL = 2.0;

  let best: { i: number; fill: string; fg: string; ratio: number; dist: number } | null = null;
  for (let i = 2; i <= 6; i++) {
    const step = accent.steps[i];
    const onDark = contrastRatio(darkInk, step);
    const onLight = contrastRatio(lightInk, step);
    const ratio = Math.max(onDark, onLight);
    const fg = onDark >= onLight ? darkInk : lightInk;
    const dist = Math.abs(i - 4);
    if (ratio < MIN_LABEL) continue;
    if (contrastRatio(step, surface) < MIN_VS_PANEL) continue;
    if (!best || dist < best.dist || (dist === best.dist && ratio > best.ratio)) {
      best = { i, fill: step, fg, ratio, dist };
    }
  }

  if (!best) {
    // Degenerate ramp (shouldn't happen for the curated presets): fall back to
    // the highest-contrast step/ink pairing available.
    let fbFill = accent.steps[4];
    let fbFg = darkInk;
    let fbRatio = 0;
    for (const step of accent.steps) {
      for (const ink of [darkInk, lightInk]) {
        const r = contrastRatio(ink, step);
        if (r > fbRatio) {
          fbRatio = r;
          fbFill = step;
          fbFg = ink;
        }
      }
    }
    return { fill: fbFill, fg: fbFg, hover: fbFill };
  }

  // Hover: move one step toward higher label contrast (lighter fill under dark
  // ink, darker fill under light ink), clamped to the ramp.
  const hoverIdx = best.fg === darkInk ? Math.max(0, best.i - 1) : Math.min(6, best.i + 1);
  return { fill: best.fill, fg: best.fg, hover: accent.steps[hoverIdx] };
}

/**
 * Choose the accent step whose contrast against the given surface is highest.
 * Prefers step[4] (the brand-canonical mid-tone) when it already passes 3:1.
 */
function pickAccentPrimaryIndex(accent: AccentRamp, surface: string): number {
  const canonical = 4;
  const canonicalRatio = contrastRatio(accent.steps[canonical], surface);
  if (canonicalRatio >= 3.0) return canonical;

  let best = canonical;
  let bestRatio = canonicalRatio;
  for (let i = 0; i < accent.steps.length; i++) {
    const r = contrastRatio(accent.steps[i], surface);
    if (r > bestRatio) {
      best = i;
      bestRatio = r;
    }
  }
  return best;
}
