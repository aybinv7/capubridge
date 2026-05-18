import type { Theme } from "../types";

/**
 * AAA target: every fg/bg pair must reach 7:1. Pure black/white surfaces
 * plus thicker borders carry the visual weight.
 */
export const highContrast: Theme = {
  id: "high-contrast",
  label: "High Contrast",
  mode: "dark",
  semantics: {
    bgApp: "#000000",
    bgChrome: "#000000",
    bgSurface: "#000000",
    bgSurfaceRaised: "#0a0a0a",
    bgOverlay: "rgba(0, 0, 0, 0.85)",

    fgDefault: "#ffffff",
    fgMuted: "#e6e6e6",
    fgSubtle: "#cccccc",
    fgOnAccent: "#000000",

    borderDefault: "#ffffff",
    borderStrong: "#ffffff",
    borderSubtle: "#cccccc",

    accentSoft: "#1a1a1a",
    ring: "var(--accent)",

    stateSuccess: "#7eff9d",
    stateWarning: "#ffd166",
    stateDanger: "#ff7a7a",
    stateInfo: "#9cc7ff",
  },
  meta: { contrastClass: "AAA" },
};
