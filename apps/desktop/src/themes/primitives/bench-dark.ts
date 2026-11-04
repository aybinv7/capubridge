import type { Theme } from "../types";
import { benchFonts } from "../fonts";

export const benchDark: Theme = {
  id: "bench-dark",
  label: "Bench · Dark",
  direction: "bench",
  mode: "dark",
  tokens: {
    bgApp: "oklch(0.165 0.005 95)",
    bgChrome: "oklch(0.165 0.005 95)",
    bgSurface: "oklch(0.195 0.006 95)",
    bgSurfaceRaised: "oklch(0.235 0.007 95)",
    bgSurfaceCut: "oklch(0.175 0.006 95)",
    bgOverlay: "oklch(0.1 0.004 95 / 0.72)",

    fgDefault: "oklch(0.935 0.008 95)",
    fgMuted: "oklch(0.74 0.01 95)",
    fgSubtle: "oklch(0.62 0.01 95)",

    borderDefault: "oklch(0.28 0.006 95)",
    borderStrong: "oklch(0.52 0.008 95)",
    borderSubtle: "oklch(0.235 0.006 95)",

    signalLive: "oklch(0.89 0.19 122)",
    signalRec: "oklch(0.68 0.21 27)",
    signalSelect: "oklch(0.8 0.115 222)",
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
