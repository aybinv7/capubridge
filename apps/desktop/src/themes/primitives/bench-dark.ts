import type { Theme } from "../types";
import { benchFonts } from "../fonts";

export const benchDark: Theme = {
  id: "bench-dark",
  label: "Bench · Dark",
  direction: "bench",
  mode: "dark",
  tokens: {
    bgApp: "#0f0f0f",
    bgChrome: "#0f0f0f",
    bgSurface: "#161616",
    bgSurfaceRaised: "#1c1c1c",
    bgSurfaceCut: "#111111",
    bgOverlay: "oklch(0.1 0 0 / 0.72)",

    fgDefault: "#e8e8e8",
    fgMuted: "#b0b0b0",
    fgSubtle: "#8c8c8c",

    borderDefault: "#272727",
    borderStrong: "#6b6b6b",
    borderSubtle: "#1f1f1f",

    signalLive: "oklch(0.89 0.19 122)",
    signalRec: "oklch(0.68 0.21 27)",
    signalSelect: "#7cc4f5",
    signalMark: "oklch(0.86 0.13 85)",

    stateSuccess: "oklch(0.8 0.14 160)",
    stateWarning: "oklch(0.82 0.15 72)",
    stateDanger: "oklch(0.7 0.19 22)",
    stateInfo: "oklch(0.78 0.11 245)",

    catNetwork: "oklch(0.79 0.12 215)",
    catStorage: "oklch(0.78 0.13 300)",
    catDevice: "oklch(0.8 0.1 180)",
    catConsole: "oklch(0.84 0.11 95)",
    catAgent: "oklch(0.78 0.14 345)",

    highlight: "oklch(1 0 0)",
  },
  fonts: benchFonts,
  meta: { contrastClass: "AA" },
};
