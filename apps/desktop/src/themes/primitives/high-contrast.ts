import type { Theme } from "../types";
import { benchFonts } from "../fonts";

/**
 * AAA target: every text pair reaches 7:1. Pure black surfaces with white
 * borders carry the structure; signals keep their roles at full saturation.
 */
export const highContrast: Theme = {
  id: "high-contrast",
  label: "High Contrast",
  direction: "bench",
  mode: "dark",
  tokens: {
    bgApp: "#000000",
    bgChrome: "#000000",
    bgSurface: "#000000",
    bgSurfaceRaised: "#0a0a0a",
    bgSurfaceCut: "#000000",
    bgOverlay: "oklch(0 0 0 / 0.85)",

    fgDefault: "#ffffff",
    fgMuted: "#e6e6e6",
    fgSubtle: "#cccccc",

    borderDefault: "#ffffff",
    borderStrong: "#ffffff",
    borderSubtle: "#cccccc",

    signalLive: "#d4ff4f",
    signalRec: "#ff7a7a",
    signalSelect: "#7fdcff",
    signalMark: "#ffd166",

    stateSuccess: "#7eff9d",
    stateWarning: "#ffd166",
    stateDanger: "#ff7a7a",
    stateInfo: "#9cc7ff",

    catNetwork: "#7fdcff",
    catStorage: "#d7b3ff",
    catDevice: "#7ff0e0",
    catConsole: "#fff3a0",
    catAgent: "#ffa8d8",

    highlight: "#ffffff",
  },
  fonts: benchFonts,
  meta: { contrastClass: "AAA" },
};
