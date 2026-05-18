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
    fgMuted: "#b8bfcc",
    fgSubtle: "#7a8294",
    fgOnAccent: "#2e3440",

    borderDefault: "#4c566a",
    borderStrong: "#5e6779",
    borderSubtle: "#3b4252",

    accentSoft: "#3b485a",
    ring: "var(--accent)",

    stateSuccess: "#a3be8c",
    stateWarning: "#ebcb8b",
    stateDanger: "#bf616a",
    stateInfo: "#81a1c1",
  },
  meta: { contrastClass: "AA" },
};
