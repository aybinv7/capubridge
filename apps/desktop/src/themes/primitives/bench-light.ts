import type { Theme } from "../types";
import { benchFonts } from "../fonts";

export const benchLight: Theme = {
  id: "bench-light",
  label: "Bench · Light",
  direction: "bench",
  mode: "light",
  tokens: {
    bgApp: "oklch(0.965 0.005 95)",
    bgChrome: "oklch(0.945 0.005 95)",
    bgSurface: "oklch(0.985 0.004 95)",
    bgSurfaceRaised: "oklch(0.94 0.006 95)",
    bgSurfaceCut: "oklch(0.95 0.005 95)",
    bgOverlay: "oklch(0.25 0.01 95 / 0.4)",

    fgDefault: "oklch(0.24 0.01 95)",
    fgMuted: "oklch(0.46 0.012 95)",
    fgSubtle: "oklch(0.51 0.012 95)",

    borderDefault: "oklch(0.88 0.006 95)",
    borderStrong: "oklch(0.6 0.01 95)",
    borderSubtle: "oklch(0.92 0.005 95)",

    signalLive: "oklch(0.49 0.13 128)",
    signalRec: "oklch(0.55 0.2 27)",
    signalSelect: "oklch(0.5 0.13 235)",
    signalMark: "oklch(0.5 0.12 75)",

    stateSuccess: "oklch(0.5 0.12 160)",
    stateWarning: "oklch(0.53 0.12 65)",
    stateDanger: "oklch(0.53 0.19 25)",
    stateInfo: "oklch(0.5 0.12 250)",

    catNetwork: "oklch(0.5 0.1 220)",
    catStorage: "oklch(0.5 0.15 300)",
    catDevice: "oklch(0.5 0.08 180)",
    catConsole: "oklch(0.5 0.1 85)",
    catAgent: "oklch(0.52 0.16 345)",

    highlight: "oklch(0 0 0)",
  },
  fonts: benchFonts,
  meta: { contrastClass: "AA" },
};
