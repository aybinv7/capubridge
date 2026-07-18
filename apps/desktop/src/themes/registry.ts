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
