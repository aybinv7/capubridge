import type { Theme, ThemeTokens } from "./types";
import { benchDark } from "./primitives/bench-dark";
import { benchLight } from "./primitives/bench-light";
import { highContrast } from "./primitives/high-contrast";

export const themes: readonly Theme[] = [benchDark, benchLight, highContrast] as const;

export const DEFAULT_THEME_ID = "bench-dark";

export function getTheme(id: string): Theme {
  const found = themes.find((t) => t.id === id);
  if (found) return found;
  const fallback = themes.find((t) => t.id === DEFAULT_THEME_ID);
  if (!fallback) throw new Error("default theme missing from registry");
  return fallback;
}

const TOKEN_TO_CSS_VAR: Record<keyof ThemeTokens, string> = {
  bgApp: "--bg-app",
  bgChrome: "--bg-chrome",
  bgSurface: "--bg-surface",
  bgSurfaceRaised: "--bg-surface-raised",
  bgSurfaceCut: "--bg-surface-cut",
  bgOverlay: "--bg-overlay",
  fgDefault: "--fg-default",
  fgMuted: "--fg-muted",
  fgSubtle: "--fg-subtle",
  borderDefault: "--border-default",
  borderStrong: "--border-strong",
  borderSubtle: "--border-subtle",
  signalLive: "--signal-live",
  signalRec: "--signal-rec",
  signalSelect: "--signal-select",
  signalMark: "--signal-mark",
  stateSuccess: "--state-success",
  stateWarning: "--state-warning",
  stateDanger: "--state-danger",
  stateInfo: "--state-info",
  catNetwork: "--cat-network",
  catStorage: "--cat-storage",
  catDevice: "--cat-device",
  catConsole: "--cat-console",
  catAgent: "--cat-agent",
  highlight: "--highlight",
};

/**
 * Derived roles. Primary actions are neutral (ink on paper): colour is kept for
 * meaning, so the brand fill is the foreground itself. Selection drives the
 * legacy accent, ring and soft-tint aliases.
 */
function derivedVars(tokens: ThemeTokens): Record<string, string> {
  return {
    "--accent": tokens.signalSelect,
    "--accent-hover": `color-mix(in oklab, ${tokens.signalSelect} 85%, ${tokens.highlight})`,
    "--accent-soft": `color-mix(in oklab, ${tokens.signalSelect} 16%, ${tokens.bgSurface})`,
    "--ring": tokens.signalSelect,
    "--fg-on-accent": tokens.bgApp,
    "--brand": tokens.fgDefault,
    "--brand-foreground": tokens.bgApp,
    "--brand-hover": `color-mix(in oklab, ${tokens.fgDefault} 86%, ${tokens.bgApp})`,
  };
}

/** Writes a theme to the document. Idempotent; variables update without remount. */
export function applyTheme(theme: Theme): void {
  const html = document.documentElement;
  html.dataset.theme = theme.id;
  html.dataset.themeMode = theme.mode;
  html.dataset.brand = theme.direction;
  html.classList.toggle("dark", theme.mode === "dark");
  html.classList.toggle("light", theme.mode === "light");

  for (const key of Object.keys(TOKEN_TO_CSS_VAR) as (keyof ThemeTokens)[]) {
    html.style.setProperty(TOKEN_TO_CSS_VAR[key], theme.tokens[key]);
  }
  for (const [name, value] of Object.entries(derivedVars(theme.tokens))) {
    html.style.setProperty(name, value);
  }
  html.style.setProperty("--font-sans", theme.fonts.sans);
  html.style.setProperty("--font-mono", theme.fonts.mono);
  html.style.colorScheme = theme.mode;
}
