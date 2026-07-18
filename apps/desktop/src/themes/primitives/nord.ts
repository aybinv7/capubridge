import type { Theme } from "../types";

export const nord: Theme = {
  id: "nord",
  label: "Nord",
  mode: "dark",
  semantics: {
    bgApp: "#2e3440",
    bgChrome: "#2a303d",
    bgSurface: "#3b4252",
    bgSurfaceRaised: "#434c5e",
    bgOverlay: "rgba(20, 22, 28, 0.7)",

    fgDefault: "#eceff4",
    fgMuted: "#c4ccd9",
    fgSubtle: "#9aa1b2",
    fgOnAccent: "#2e3440",

    borderDefault: "#4c566a",
    borderStrong: "#8993a5",
    borderSubtle: "#3b4252",

    accentSoft: "#3b485a",
    ring: "var(--accent)",

    stateSuccess: "#b6cf9f",
    stateWarning: "#ebcb8b",
    stateDanger: "#f29ba2",
    stateInfo: "#9cb8da",
  },
  meta: { contrastClass: "AA" },
};
