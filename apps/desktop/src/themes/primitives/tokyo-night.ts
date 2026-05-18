import type { Theme } from "../types";

export const tokyoNight: Theme = {
  id: "tokyo-night",
  label: "Tokyo Night",
  mode: "dark",
  semantics: {
    bgApp: "#1a1b26",
    bgChrome: "#16161e",
    bgSurface: "#1f2030",
    bgSurfaceRaised: "#262738",
    bgOverlay: "rgba(10, 10, 18, 0.7)",

    fgDefault: "#c0caf5",
    fgMuted: "#8a93c2",
    fgSubtle: "#565f89",
    fgOnAccent: "#0f111a",

    borderDefault: "#2b2d40",
    borderStrong: "#3b3e57",
    borderSubtle: "#222433",

    accentSoft: "#1c2540",
    ring: "var(--accent)",

    stateSuccess: "#9ece6a",
    stateWarning: "#e0af68",
    stateDanger: "#f7768e",
    stateInfo: "#7aa2f7",
  },
  meta: { contrastClass: "AA" },
};
