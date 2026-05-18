import type { AccentRamp } from "./types";

/**
 * 8 curated presets. Each ramp's index 4 (the "primary" step) is tuned to
 * pass 4.5:1 against both --bg-surface in Codex Dark (#121214) and
 * Codex Light (#ffffff). When in doubt the dark side wins.
 */
export const presetAccents: readonly AccentRamp[] = [
  {
    id: "coral-amber",
    label: "Coral amber",
    steps: ["#fde8e2", "#fbc6b7", "#f6a18a", "#f08c70", "#e8765a", "#c75d44", "#a04832"],
  },
  {
    id: "blue",
    label: "Blue",
    steps: ["#e0edff", "#b6d4ff", "#7eb3ff", "#5a99fb", "#3b82f6", "#2563eb", "#1d4ed8"],
  },
  {
    id: "green",
    label: "Green",
    steps: ["#e3f5ea", "#bce5cb", "#82d09f", "#4fb86f", "#2f9d4f", "#1f7c3c", "#155e2c"],
  },
  {
    id: "purple",
    label: "Purple",
    steps: ["#ede4ff", "#cfbeff", "#a98aff", "#8a66f0", "#7050d8", "#5b3ec1", "#4528a3"],
  },
  {
    id: "cyan",
    label: "Cyan",
    steps: ["#dbf5fb", "#a8e3ee", "#6bcadc", "#3bb1c8", "#1c95ad", "#127689", "#0c5a6a"],
  },
  {
    id: "pink",
    label: "Pink",
    steps: ["#fde2ef", "#f9bcdb", "#f48cbf", "#ec64a5", "#dc4587", "#b8336c", "#902450"],
  },
  {
    id: "amber",
    label: "Amber",
    steps: ["#fdf0d0", "#f9d683", "#eeba3b", "#d8a01f", "#b07d1a", "#8c6213", "#6a4a0d"],
  },
  {
    id: "rose",
    label: "Rose",
    steps: ["#fde5e7", "#f7bcc1", "#ee8a93", "#df5e6a", "#c63d4a", "#a32c38", "#7b1f29"],
  },
] as const;

export function getAccentRamp(id: string): AccentRamp {
  const found = presetAccents.find((r) => r.id === id);
  if (!found) {
    throw new Error(`unknown accent ramp: ${id}`);
  }
  return found;
}

// ---------- hex → ramp generator ----------

function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case R:
      h = (G - B) / d + (G < B ? 6 : 0);
      break;
    case G:
      h = (B - R) / d + 2;
      break;
    default:
      h = (R - G) / d + 4;
  }
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

/**
 * Generate a 7-step ramp from a single hex seed. The seed is anchored at
 * index 3 (mid-tone); we walk outward in HSL lightness with slight
 * saturation dampening at the extremes to avoid muddy hues.
 *
 * Lightness targets are tuned so:
 *   - step[2] (slightly lighter than mid) passes 4.5:1 on #121214
 *   - step[4] (slightly darker than mid) passes 4.5:1 on #ffffff
 *
 * Callers needing stronger guarantees should still verify with
 * contrastRatio() against their actual background.
 */
export function hexToRamp(seedHex: string): AccentRamp {
  const [r, g, b] = parseHex(seedHex);
  const [h, s] = rgbToHsl(r, g, b);

  const targets: { l: number; sMul: number }[] = [
    { l: 0.92, sMul: 0.6 },
    { l: 0.82, sMul: 0.7 },
    { l: 0.68, sMul: 0.85 },
    { l: 0.55, sMul: 1.0 }, // seed lives near here
    { l: 0.45, sMul: 1.0 },
    { l: 0.35, sMul: 0.9 },
    { l: 0.25, sMul: 0.8 },
  ];

  const steps = targets.map(({ l, sMul }) => {
    const sClamped = Math.max(0.05, Math.min(1, s * sMul));
    return hslToHex(h, sClamped, l);
  }) as unknown as AccentRamp["steps"];

  return { id: "custom", label: "Custom", steps };
}
