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
    fgMuted: "#a8b6b6",
    fgSubtle: "#7d9295",
    fgOnAccent: "#002b36",

    borderDefault: "#1a4452",
    borderStrong: "#658086",
    borderSubtle: "#093945",

    accentSoft: "#0f3a44",
    ring: "var(--accent)",

    stateSuccess: "#a8c34a",
    stateWarning: "#dcb14a",
    stateDanger: "#f37270",
    stateInfo: "#5cb0e6",
  },
  meta: { contrastClass: "AA" },
};
