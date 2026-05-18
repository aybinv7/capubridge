import type { Theme } from "../types";

export const codexLight: Theme = {
  id: "codex-light",
  label: "Codex Light",
  mode: "light",
  semantics: {
    bgApp: "#fafaf7",
    bgChrome: "#f4f3ee",
    bgSurface: "#ffffff",
    bgSurfaceRaised: "#ffffff",
    bgOverlay: "rgba(20, 20, 20, 0.48)",

    fgDefault: "#121212",
    fgMuted: "#5a5852",
    fgSubtle: "#8a8780",
    fgOnAccent: "#ffffff",

    borderDefault: "#d9d7ce",
    borderStrong: "#bfbcb1",
    borderSubtle: "#e4e2da",

    accentSoft: "#fde8e2",
    ring: "var(--accent)",

    stateSuccess: "#2f7d44",
    stateWarning: "#946312",
    stateDanger: "#b91c1c",
    stateInfo: "#1e4ed8",
  },
  meta: { contrastClass: "AA" },
};
