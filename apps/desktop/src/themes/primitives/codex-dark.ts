import type { Theme } from "../types";

export const codexDark: Theme = {
  id: "codex-dark",
  label: "Codex Dark",
  mode: "dark",
  semantics: {
    bgApp: "#0e0e10",
    bgChrome: "#0e0e10",
    bgSurface: "#121214",
    bgSurfaceRaised: "#1c1c20",
    bgOverlay: "rgba(8, 8, 10, 0.72)",

    fgDefault: "#f2efe9",
    fgMuted: "#a8a59c",
    fgSubtle: "#6f6c63",
    fgOnAccent: "#ffffff",

    borderDefault: "#2a2a2f",
    borderStrong: "#62626a",
    borderSubtle: "#1f1f23",

    accentSoft: "#2a1d17",
    ring: "var(--accent)",

    stateSuccess: "#4fb06a",
    stateWarning: "#e0a528",
    stateDanger: "#d75a4a",
    stateInfo: "#6c9be0",
  },
  meta: { contrastClass: "AA" },
};
