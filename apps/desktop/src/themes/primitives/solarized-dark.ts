import type { Theme } from "../types";

export const solarizedDark: Theme = {
  id: "solarized-dark",
  label: "Solarized Dark",
  mode: "dark",
  semantics: {
    bgApp: "#002b36",
    bgChrome: "#022832",
    bgSurface: "#073642",
    bgSurfaceRaised: "#0e4250",
    bgOverlay: "rgba(0, 18, 22, 0.7)",

    fgDefault: "#eee8d5",
    fgMuted: "#93a1a1",
    fgSubtle: "#586e75",
    fgOnAccent: "#002b36",

    borderDefault: "#1a4452",
    borderStrong: "#2c5867",
    borderSubtle: "#093945",

    accentSoft: "#0f3a44",
    ring: "var(--accent)",

    stateSuccess: "#859900",
    stateWarning: "#b58900",
    stateDanger: "#dc322f",
    stateInfo: "#268bd2",
  },
  meta: { contrastClass: "AA" },
};
