# UI Redesign — Slice 1: Foundation (tokens + themes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a two-layer token system, 6 curated themes, 8 preset accents (+ custom hex), a `themeStore` + `useTheme` composable, a real Appearance settings page, and a CI contrast checker — without breaking any existing screen.

**Architecture:** Themes are pure data files exporting Layer-A primitives + Layer-B aliases. Engine applies a theme by writing Layer-B CSS variables under `[data-theme="<id>"]` on `<html>` and an `--accent` ramp. Components keep reading the existing Layer-B token names (renamed via shims where needed). Existing `useUIStore.theme` is retired in favor of the new `themeStore`. A `scripts/check-contrast.ts` walks every theme × pair and fails CI if a combination breaks WCAG AA (AAA for the High Contrast theme).

**Tech Stack:** Vue 3 + Pinia + TypeScript, Tailwind v4 (`@theme inline`), `vite-plus/test` (Vitest under the hood), `vite-plus` (`vp`) for all CLI commands.

**Spec:** [docs/superpowers/specs/2026-05-18-ui-redesign-design.md](../specs/2026-05-18-ui-redesign-design.md)

---

## File Structure (created / modified)

### Created

```
apps/desktop/src/themes/
├── types.ts                  # Theme, AccentRamp, semantic token interfaces
├── contrast.ts               # WCAG contrast math (relativeLuminance, ratio, classify)
├── accent-ramps.ts           # 8 preset ramps + hexToRamp() generator
├── primitives/
│   ├── codex-dark.ts
│   ├── codex-light.ts
│   ├── tokyo-night.ts
│   ├── nord.ts
│   ├── solarized-dark.ts
│   └── high-contrast.ts
├── registry.ts               # themes[] + getTheme(id) + applyTheme(html, theme, accent)
└── __tests__/
    ├── contrast.test.ts
    ├── accent-ramps.test.ts
    └── registry.test.ts

apps/desktop/src/stores/
└── theme.store.ts            # Pinia store: { themeId, accentId, customAccentHex }
apps/desktop/src/stores/__tests__/
└── theme.store.test.ts

apps/desktop/src/composables/
└── useTheme.ts

apps/desktop/src/modules/settings/
├── SettingsAppearance.vue    # New surface (theme picker + accent picker)
└── components/
    ├── ThemeCard.vue
    └── AccentSwatch.vue

apps/desktop/scripts/
└── check-contrast.ts         # Node script: walks every theme; exits non-zero on failure
```

### Modified

- `apps/desktop/src/assets/styles/main.css` — replace the single `:root` + `.dark` block with `[data-theme="<id>"]` blocks driven by the new theme files.
- `apps/desktop/src/main.ts` — initialize the active theme on app boot (before mount) to avoid FOUC.
- `apps/desktop/src/components/layout/AppShell.vue` — remove hardcoded `dark` class on the root div.
- `apps/desktop/src/stores/ui.store.ts` — remove `theme` / `setTheme` / `toggleTheme` / `applyTheme`; they move to `themeStore`.
- `apps/desktop/src/components/layout/SubNavTabs.vue` — migrate from `uiStore.theme` to `themeStore.mode`.
- `apps/desktop/src/modules/settings/SettingsTheme.vue` — replaced by `SettingsAppearance.vue` (file deleted; router updated).
- `apps/desktop/src/router/index.ts` — replace `/settings/theme` route with `/settings/appearance` (keep `/settings/theme` as a redirect for one release).
- `apps/desktop/package.json` — add `check:contrast` script.
- `vite.config.ts` (root) — wire `check-contrast.ts` into `vp run ready`.

---

## Conventions

- **Test runner:** `vp test` (uses `vite-plus/test`). Run a single test: `vp test apps/desktop/src/themes/__tests__/contrast.test.ts`. Run watch: `vp test`. Run once: `vp test --run`.
- **Type/lint/format:** `vp check`. Run before every commit.
- **Commits:** small, conventional (`feat:`, `refactor:`, `chore:`, `test:`, `docs:`). Co-Authored-By line per repo convention.
- **No hex literals in components** — only in `primitives/*.ts` and `accent-ramps.ts`.

---

## Task 1: Scaffold themes directory + types

**Files:**

- Create: `apps/desktop/src/themes/types.ts`

- [ ] **Step 1: Create the directory and the types file**

Create `apps/desktop/src/themes/types.ts`:

```ts
export type ThemeMode = "dark" | "light";
export type ContrastClass = "AA" | "AAA";

export type AccentRamp = {
  /** Reference label, e.g. "coral-amber" or "custom". */
  id: string;
  /** Display label shown in the picker. */
  label: string;
  /** 7-step ramp; index 0 = lightest, index 6 = darkest. */
  steps: readonly [string, string, string, string, string, string, string];
};

/**
 * Semantic tokens (Layer B). Every component reads from these.
 * Values are CSS color strings (any valid syntax: hex, rgb(), hsl(), oklch()…).
 */
export type SemanticTokens = {
  bgApp: string;
  bgChrome: string;
  bgSurface: string;
  bgSurfaceRaised: string;
  bgOverlay: string;

  fgDefault: string;
  fgMuted: string;
  fgSubtle: string;
  fgOnAccent: string;

  borderDefault: string;
  borderStrong: string;
  borderSubtle: string;

  accentSoft: string;
  ring: string;

  stateSuccess: string;
  stateWarning: string;
  stateDanger: string;
  stateInfo: string;
};

/**
 * A theme is pure data: semantic tokens + metadata.
 * Accent comes from a separate AccentRamp so themes and accents are orthogonal.
 */
export type Theme = {
  id: string;
  label: string;
  mode: ThemeMode;
  semantics: SemanticTokens;
  meta: { contrastClass: ContrastClass };
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/themes/types.ts
git commit -m "feat(themes): scaffold theme type system"
```

---

## Task 2: WCAG contrast math utility (TDD)

**Files:**

- Create: `apps/desktop/src/themes/contrast.ts`
- Test: `apps/desktop/src/themes/__tests__/contrast.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/src/themes/__tests__/contrast.test.ts`:

```ts
import { describe, test, expect } from "vite-plus/test";
import { relativeLuminance, contrastRatio, classifyContrast } from "../contrast";

describe("relativeLuminance", () => {
  test("returns 1 for pure white", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 4);
  });
  test("returns 0 for pure black", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 4);
  });
  test("matches the WCAG worked example for #777", () => {
    // sRGB 0x77 -> linear ~0.1845 -> Y ~0.1845 (gray)
    expect(relativeLuminance("#777777")).toBeCloseTo(0.1845, 3);
  });
  test("accepts shorthand hex", () => {
    expect(relativeLuminance("#fff")).toBeCloseTo(1, 4);
  });
});

describe("contrastRatio", () => {
  test("21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });
  test("1:1 for identical colors", () => {
    expect(contrastRatio("#abcdef", "#abcdef")).toBeCloseTo(1, 4);
  });
  test("symmetric: order does not matter", () => {
    const a = contrastRatio("#1a1a1a", "#fafaf7");
    const b = contrastRatio("#fafaf7", "#1a1a1a");
    expect(a).toBeCloseTo(b, 4);
  });
});

describe("classifyContrast", () => {
  test("FAIL below 3:1", () => {
    expect(classifyContrast(2.9)).toBe("FAIL");
  });
  test("AA-large between 3:1 and 4.5:1", () => {
    expect(classifyContrast(3.5)).toBe("AA-large");
  });
  test("AA between 4.5:1 and 7:1", () => {
    expect(classifyContrast(5)).toBe("AA");
  });
  test("AAA at 7:1 and above", () => {
    expect(classifyContrast(7)).toBe("AAA");
    expect(classifyContrast(15)).toBe("AAA");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp test apps/desktop/src/themes/__tests__/contrast.test.ts --run`
Expected: FAIL — module `../contrast` does not exist.

- [ ] **Step 3: Implement the contrast module**

Create `apps/desktop/src/themes/contrast.ts`:

```ts
/** Parse "#rgb" or "#rrggbb" into [r, g, b] integers (0–255). */
function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** sRGB channel (0–255) → linear-light (0–1) per WCAG 2.x. */
function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance per WCAG 2.x. Result in [0, 1]. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  const R = channelToLinear(r);
  const G = channelToLinear(g);
  const B = channelToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG contrast ratio (1–21). Order-independent. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastBand = "FAIL" | "AA-large" | "AA" | "AAA";

export function classifyContrast(ratio: number): ContrastBand {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA-large";
  return "FAIL";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `vp test apps/desktop/src/themes/__tests__/contrast.test.ts --run`
Expected: PASS (all 12 tests).

- [ ] **Step 5: Type/lint**

Run: `vp check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/themes/contrast.ts apps/desktop/src/themes/__tests__/contrast.test.ts
git commit -m "feat(themes): WCAG contrast math (relativeLuminance, ratio, classify)"
```

---

## Task 3: Accent ramp generator (TDD)

**Files:**

- Create: `apps/desktop/src/themes/accent-ramps.ts`
- Test: `apps/desktop/src/themes/__tests__/accent-ramps.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/src/themes/__tests__/accent-ramps.test.ts`:

```ts
import { describe, test, expect } from "vite-plus/test";
import { presetAccents, getAccentRamp, hexToRamp } from "../accent-ramps";
import { contrastRatio } from "../contrast";

describe("presetAccents", () => {
  test("ships 8 presets including coral-amber as the default", () => {
    expect(presetAccents).toHaveLength(8);
    expect(presetAccents[0].id).toBe("coral-amber");
  });
  test("every preset has 7 ramp steps", () => {
    for (const ramp of presetAccents) {
      expect(ramp.steps).toHaveLength(7);
      for (const step of ramp.steps) {
        expect(step).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });
});

describe("getAccentRamp", () => {
  test("returns preset by id", () => {
    expect(getAccentRamp("coral-amber").id).toBe("coral-amber");
    expect(getAccentRamp("blue").id).toBe("blue");
  });
  test("throws on unknown id", () => {
    expect(() => getAccentRamp("nope")).toThrow(/unknown accent/i);
  });
});

describe("hexToRamp", () => {
  test("produces 7 steps from a single hex seed", () => {
    const ramp = hexToRamp("#3b82f6");
    expect(ramp.id).toBe("custom");
    expect(ramp.steps).toHaveLength(7);
  });
  test("middle step is close to the seed color", () => {
    const seed = "#3b82f6";
    const ramp = hexToRamp(seed);
    // step[3] is the mid-tone — should be perceptually close
    expect(contrastRatio(ramp.steps[3], seed)).toBeLessThan(1.5);
  });
  test("generated ramp passes 4.5:1 against a typical light surface", () => {
    const ramp = hexToRamp("#3b82f6");
    // step[4] (slightly darker than mid) should pass AA on #ffffff
    expect(contrastRatio(ramp.steps[4], "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
  test("generated ramp passes 4.5:1 against a typical dark surface", () => {
    const ramp = hexToRamp("#3b82f6");
    // step[2] (slightly lighter than mid) should pass AA on #121214
    expect(contrastRatio(ramp.steps[2], "#121214")).toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp test apps/desktop/src/themes/__tests__/accent-ramps.test.ts --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the accent ramp module**

Create `apps/desktop/src/themes/accent-ramps.ts`:

```ts
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
  const R = r / 255,
    G = g / 255,
    B = b / 255;
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
  let r = 0,
    g = 0,
    b = 0;
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
 * Generate a 7-step ramp from a single hex seed. The seed lands on index 3
 * (mid-tone); we then walk outward in HSL lightness with a slight saturation
 * dampening at the extremes to avoid muddy hues.
 *
 * Lightness targets are tuned so:
 *   - step[2] (slightly lighter than mid) passes 4.5:1 on a #121214 surface
 *   - step[4] (slightly darker than mid) passes 4.5:1 on a #ffffff surface
 *
 * Callers that need stronger guarantees should still verify with
 * contrastRatio() against their actual background.
 */
export function hexToRamp(seedHex: string): AccentRamp {
  const [r, g, b] = parseHex(seedHex);
  const [h, s] = rgbToHsl(r, g, b);

  const targets: { l: number; sMul: number }[] = [
    { l: 0.92, sMul: 0.6 },
    { l: 0.82, sMul: 0.7 },
    { l: 0.68, sMul: 0.85 },
    { l: 0.55, sMul: 1.0 }, // seed lives here (clamped below)
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `vp test apps/desktop/src/themes/__tests__/accent-ramps.test.ts --run`
Expected: PASS.

If any test fails (especially the contrast-against-light/dark cases), adjust the `targets` lightness values in `hexToRamp()` until they pass — the algorithm is intentionally tunable.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/themes/accent-ramps.ts apps/desktop/src/themes/__tests__/accent-ramps.test.ts
git commit -m "feat(themes): preset accent ramps + hex-to-ramp generator"
```

---

## Task 4: Build 6 theme primitive files

**Files:**

- Create: `apps/desktop/src/themes/primitives/codex-dark.ts`
- Create: `apps/desktop/src/themes/primitives/codex-light.ts`
- Create: `apps/desktop/src/themes/primitives/tokyo-night.ts`
- Create: `apps/desktop/src/themes/primitives/nord.ts`
- Create: `apps/desktop/src/themes/primitives/solarized-dark.ts`
- Create: `apps/desktop/src/themes/primitives/high-contrast.ts`

Each file exports a single `Theme` whose semantic tokens have been hand-tuned to pass WCAG AA against `bgSurface` (or AAA in the High Contrast case). Verification happens via the contrast script in Task 13 — the values below are the starting palettes; Task 13 will reject any that fail and the implementer must adjust the offending token until it passes.

- [ ] **Step 1: Write `codex-dark.ts`**

Create `apps/desktop/src/themes/primitives/codex-dark.ts`:

```ts
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
    borderStrong: "#3a3a40",
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
```

- [ ] **Step 2: Write `codex-light.ts`**

Create `apps/desktop/src/themes/primitives/codex-light.ts`:

```ts
import type { Theme } from "../types";

export const codexLight: Theme = {
  id: "codex-light",
  label: "Codex Light",
  mode: "light",
  semantics: {
    bgApp: "#fafaf7",
    bgChrome: "#f4f3ee",
    bgSurface: "#ffffff",
    bgSurfaceRaised: "#ffffff",
    bgOverlay: "rgba(20, 20, 20, 0.48)",

    fgDefault: "#121212",
    fgMuted: "#5a5852",
    fgSubtle: "#8a8780",
    fgOnAccent: "#ffffff",

    borderDefault: "#d9d7ce",
    borderStrong: "#bfbcb1",
    borderSubtle: "#e4e2da",

    accentSoft: "#fde8e2",
    ring: "var(--accent)",

    stateSuccess: "#2f7d44",
    stateWarning: "#946312",
    stateDanger: "#b91c1c",
    stateInfo: "#1e4ed8",
  },
  meta: { contrastClass: "AA" },
};
```

- [ ] **Step 3: Write `tokyo-night.ts`**

```ts
import type { Theme } from "../types";

export const tokyoNight: Theme = {
  id: "tokyo-night",
  label: "Tokyo Night",
  mode: "dark",
  semantics: {
    bgApp: "#1a1b26",
    bgChrome: "#16161e",
    bgSurface: "#1f2030",
    bgSurfaceRaised: "#262738",
    bgOverlay: "rgba(10, 10, 18, 0.7)",

    fgDefault: "#c0caf5",
    fgMuted: "#8a93c2",
    fgSubtle: "#565f89",
    fgOnAccent: "#0f111a",

    borderDefault: "#2b2d40",
    borderStrong: "#3b3e57",
    borderSubtle: "#222433",

    accentSoft: "#1c2540",
    ring: "var(--accent)",

    stateSuccess: "#9ece6a",
    stateWarning: "#e0af68",
    stateDanger: "#f7768e",
    stateInfo: "#7aa2f7",
  },
  meta: { contrastClass: "AA" },
};
```

- [ ] **Step 4: Write `nord.ts`**

```ts
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
```

- [ ] **Step 5: Write `solarized-dark.ts`**

```ts
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
```

- [ ] **Step 6: Write `high-contrast.ts`**

```ts
import type { Theme } from "../types";

/**
 * AAA target: every fg/bg pair must reach 7:1. Pure black/white surfaces
 * plus thicker borders carry the visual weight.
 */
export const highContrast: Theme = {
  id: "high-contrast",
  label: "High Contrast",
  mode: "dark",
  semantics: {
    bgApp: "#000000",
    bgChrome: "#000000",
    bgSurface: "#000000",
    bgSurfaceRaised: "#0a0a0a",
    bgOverlay: "rgba(0, 0, 0, 0.85)",

    fgDefault: "#ffffff",
    fgMuted: "#e6e6e6",
    fgSubtle: "#cccccc",
    fgOnAccent: "#000000",

    borderDefault: "#ffffff",
    borderStrong: "#ffffff",
    borderSubtle: "#cccccc",

    accentSoft: "#1a1a1a",
    ring: "var(--accent)",

    stateSuccess: "#7eff9d",
    stateWarning: "#ffd166",
    stateDanger: "#ff7a7a",
    stateInfo: "#9cc7ff",
  },
  meta: { contrastClass: "AAA" },
};
```

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/themes/primitives/
git commit -m "feat(themes): six theme primitive files (codex×2, tokyo, nord, solarized, high-contrast)"
```

---

## Task 5: Theme registry + applyTheme (TDD)

**Files:**

- Create: `apps/desktop/src/themes/registry.ts`
- Test: `apps/desktop/src/themes/__tests__/registry.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/src/themes/__tests__/registry.test.ts`:

```ts
import { describe, test, expect, beforeEach } from "vite-plus/test";
import { themes, getTheme, applyTheme, DEFAULT_THEME_ID, DEFAULT_ACCENT_ID } from "../registry";
import { getAccentRamp } from "../accent-ramps";

describe("themes registry", () => {
  test("ships exactly 6 themes", () => {
    expect(themes).toHaveLength(6);
  });
  test("default theme id is codex-dark", () => {
    expect(DEFAULT_THEME_ID).toBe("codex-dark");
  });
  test("default accent id is coral-amber", () => {
    expect(DEFAULT_ACCENT_ID).toBe("coral-amber");
  });
  test("getTheme returns a theme by id", () => {
    expect(getTheme("nord").id).toBe("nord");
  });
  test("getTheme falls back to default for unknown id", () => {
    expect(getTheme("does-not-exist").id).toBe(DEFAULT_THEME_ID);
  });
});

describe("applyTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.cssText = "";
  });

  test("sets data-theme on the html element", () => {
    applyTheme(getTheme("nord"), getAccentRamp("blue"));
    expect(document.documentElement.dataset.theme).toBe("nord");
  });

  test("writes --accent and the seven accent step vars", () => {
    applyTheme(getTheme("codex-dark"), getAccentRamp("coral-amber"));
    const html = document.documentElement;
    expect(html.style.getPropertyValue("--accent")).toBeTruthy();
    expect(html.style.getPropertyValue("--accent-0")).toBeTruthy();
    expect(html.style.getPropertyValue("--accent-6")).toBeTruthy();
  });

  test("writes the semantic Layer-B vars", () => {
    applyTheme(getTheme("codex-dark"), getAccentRamp("coral-amber"));
    expect(document.documentElement.style.getPropertyValue("--bg-surface")).toBe("#121214");
    expect(document.documentElement.style.getPropertyValue("--fg-default")).toBe("#f2efe9");
  });

  test("idempotent: applying the same theme twice produces the same state", () => {
    applyTheme(getTheme("nord"), getAccentRamp("blue"));
    const snapshot = document.documentElement.style.cssText;
    applyTheme(getTheme("nord"), getAccentRamp("blue"));
    expect(document.documentElement.style.cssText).toBe(snapshot);
  });
});
```

- [ ] **Step 2: Run tests; verify they fail**

Run: `vp test apps/desktop/src/themes/__tests__/registry.test.ts --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the registry**

Create `apps/desktop/src/themes/registry.ts`:

```ts
import type { Theme, AccentRamp } from "./types";
import { codexDark } from "./primitives/codex-dark";
import { codexLight } from "./primitives/codex-light";
import { tokyoNight } from "./primitives/tokyo-night";
import { nord } from "./primitives/nord";
import { solarizedDark } from "./primitives/solarized-dark";
import { highContrast } from "./primitives/high-contrast";

export const themes: readonly Theme[] = [
  codexDark,
  codexLight,
  tokyoNight,
  nord,
  solarizedDark,
  highContrast,
] as const;

export const DEFAULT_THEME_ID = "codex-dark";
export const DEFAULT_ACCENT_ID = "coral-amber";

export function getTheme(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes.find((t) => t.id === DEFAULT_THEME_ID)!;
}

const SEMANTIC_TO_CSS_VAR: Record<keyof Theme["semantics"], string> = {
  bgApp: "--bg-app",
  bgChrome: "--bg-chrome",
  bgSurface: "--bg-surface",
  bgSurfaceRaised: "--bg-surface-raised",
  bgOverlay: "--bg-overlay",
  fgDefault: "--fg-default",
  fgMuted: "--fg-muted",
  fgSubtle: "--fg-subtle",
  fgOnAccent: "--fg-on-accent",
  borderDefault: "--border-default",
  borderStrong: "--border-strong",
  borderSubtle: "--border-subtle",
  accentSoft: "--accent-soft",
  ring: "--ring",
  stateSuccess: "--state-success",
  stateWarning: "--state-warning",
  stateDanger: "--state-danger",
  stateInfo: "--state-info",
};

/**
 * Apply a theme + accent to the document. Idempotent.
 * Safe to call on every theme change; CSS variables update without remount.
 */
export function applyTheme(theme: Theme, accent: AccentRamp): void {
  const html = document.documentElement;

  // Theme id drives any @media (prefers-color-scheme) overrides + selectors.
  html.dataset.theme = theme.id;
  html.dataset.themeMode = theme.mode;

  // Semantic Layer-B vars.
  for (const key of Object.keys(SEMANTIC_TO_CSS_VAR) as (keyof Theme["semantics"])[]) {
    html.style.setProperty(SEMANTIC_TO_CSS_VAR[key], theme.semantics[key]);
  }

  // Accent ramp (Layer A) and primary aliases.
  accent.steps.forEach((step, i) => {
    html.style.setProperty(`--accent-${i}`, step);
  });
  html.style.setProperty("--accent", accent.steps[4]);
  html.style.setProperty("--accent-hover", accent.steps[3]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `vp test apps/desktop/src/themes/__tests__/registry.test.ts --run`
Expected: PASS (10 tests).

- [ ] **Step 5: Type/lint**

Run: `vp check`. Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/themes/registry.ts apps/desktop/src/themes/__tests__/registry.test.ts
git commit -m "feat(themes): theme registry + applyTheme()"
```

---

## Task 6: Restructure main.css for the new token model

**Files:**

- Modify: `apps/desktop/src/assets/styles/main.css`

The current file defines tokens directly under `:root` (light) and `.dark` (dark) with a different naming scheme (`--surface-0/1/2/3`, `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, etc.). The new model writes Layer-B vars dynamically via `applyTheme()`, but existing components still read the old names. We solve this in **two passes**:

- **This task:** keep the old token names alive as shims that _alias_ the new Layer-B vars. Components keep working unchanged.
- **Future slices:** rename consumers progressively to the new names (`--bg-surface`, `--fg-default`, …) and delete the shims.

- [ ] **Step 1: Replace main.css**

Replace the entire contents of `apps/desktop/src/assets/styles/main.css` with:

```css
@import "tailwindcss";
@import "tw-animate-css";

@import "@vue-flow/core/dist/style.css";
@import "@vue-flow/core/dist/theme-default.css";

@custom-variant dark (&:is([data-theme-mode="dark"] *));

/* -----------------------------------------------------------------------
 * Theme tokens are written at runtime by applyTheme() (themes/registry.ts).
 * The variables below are LEGACY ALIASES that map old names → new Layer-B
 * vars so existing components keep working during the migration.
 * Do NOT add new consumers of these; read --bg-*, --fg-*, --border-*,
 * --state-*, --accent directly instead.
 * --------------------------------------------------------------------- */

:root {
  /* New Layer-B vars start with safe fallbacks so SSR/static rendering
     before applyTheme() runs doesn't show a flash of unstyled content. */
  --bg-app: #0e0e10;
  --bg-chrome: #0e0e10;
  --bg-surface: #121214;
  --bg-surface-raised: #1c1c20;
  --bg-overlay: rgba(8, 8, 10, 0.72);

  --fg-default: #f2efe9;
  --fg-muted: #a8a59c;
  --fg-subtle: #6f6c63;
  --fg-on-accent: #ffffff;

  --border-default: #2a2a2f;
  --border-strong: #3a3a40;
  --border-subtle: #1f1f23;

  --accent: #e8765a;
  --accent-hover: #ef8367;
  --accent-soft: #2a1d17;
  --ring: var(--accent);

  --state-success: #4fb06a;
  --state-warning: #e0a528;
  --state-danger: #d75a4a;
  --state-info: #6c9be0;

  /* Legacy aliases — components currently read these. */
  --background: var(--bg-app);
  --foreground: var(--fg-default);
  --surface-0: var(--bg-surface);
  --surface-1: var(--bg-chrome);
  --surface-2: var(--bg-surface-raised);
  --surface-3: var(--bg-surface-raised);
  --card: var(--bg-surface);
  --card-foreground: var(--fg-default);
  --popover: var(--bg-surface-raised);
  --popover-foreground: var(--fg-default);
  --primary: var(--fg-default);
  --primary-foreground: var(--bg-app);
  --secondary: var(--bg-surface-raised);
  --secondary-foreground: var(--fg-default);
  --muted: var(--bg-surface-raised);
  --muted-foreground: var(--fg-muted);
  --accent-foreground: var(--fg-on-accent);
  --destructive: var(--state-danger);
  --destructive-foreground: #ffffff;
  --border: var(--border-default);
  --input: var(--border-default);
  --success: var(--state-success);
  --warning: var(--state-warning);
  --info: var(--state-info);
  --error: var(--state-danger);

  /* Sidebar legacy aliases. */
  --sidebar: var(--bg-chrome);
  --sidebar-foreground: var(--fg-default);
  --sidebar-primary: var(--fg-default);
  --sidebar-primary-foreground: var(--bg-app);
  --sidebar-accent: var(--bg-surface-raised);
  --sidebar-accent-foreground: var(--fg-default);
  --sidebar-border: var(--border-subtle);
  --sidebar-ring: var(--accent);

  /* Typography + radii (unchanged from before). */
  --font-sans: "Geist", ui-sans-serif, sans-serif, system-ui;
  --font-mono: "Geist Mono", ui-monospace, monospace;
  --font-serif: ui-serif, serif;
  --radius: 0.625rem;

  /* Shadows (unchanged). */
  --shadow-2xs: 0 1px 2px 0 rgb(0 0 0 / 0.2);
  --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.3);
  --shadow-sm: 0 2px 4px -1px rgb(0 0 0 / 0.35);
  --shadow: 0 4px 12px -2px rgb(0 0 0 / 0.4);
  --shadow-md: 0 8px 24px -4px rgb(0 0 0 / 0.45);
  --shadow-lg: 0 16px 40px -8px rgb(0 0 0 / 0.5);
  --shadow-xl: 0 24px 56px -12px rgb(0 0 0 / 0.55);
  --shadow-2xl: 0 32px 64px -16px rgb(0 0 0 / 0.6);

  --tracking-normal: 0em;
  --spacing: 0.25rem;
}

@theme inline {
  --color-background: var(--bg-app);
  --color-foreground: var(--fg-default);
  --color-surface-0: var(--bg-surface);
  --color-surface-1: var(--bg-chrome);
  --color-surface-2: var(--bg-surface-raised);
  --color-surface-3: var(--bg-surface-raised);
  --color-card: var(--bg-surface);
  --color-card-foreground: var(--fg-default);
  --color-popover: var(--bg-surface-raised);
  --color-popover-foreground: var(--fg-default);
  --color-primary: var(--fg-default);
  --color-primary-foreground: var(--bg-app);
  --color-secondary: var(--bg-surface-raised);
  --color-secondary-foreground: var(--fg-default);
  --color-muted: var(--bg-surface-raised);
  --color-muted-foreground: var(--fg-muted);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-soft: var(--accent-soft);
  --color-accent-foreground: var(--fg-on-accent);
  --color-destructive: var(--state-danger);
  --color-destructive-foreground: #ffffff;
  --color-border: var(--border-default);
  --color-border-subtle: var(--border-subtle);
  --color-border-active: var(--border-strong);
  --color-input: var(--border-default);
  --color-ring: var(--accent);
  --color-success: var(--state-success);
  --color-success-bg: color-mix(in srgb, var(--state-success) 16%, var(--bg-surface));
  --color-warning: var(--state-warning);
  --color-warning-bg: color-mix(in srgb, var(--state-warning) 16%, var(--bg-surface));
  --color-info: var(--state-info);
  --color-info-bg: color-mix(in srgb, var(--state-info) 16%, var(--bg-surface));
  --color-error: var(--state-danger);
  --color-error-bg: color-mix(in srgb, var(--state-danger) 16%, var(--bg-surface));
  --color-sidebar: var(--bg-chrome);
  --color-sidebar-foreground: var(--fg-default);
  --color-sidebar-primary: var(--fg-default);
  --color-sidebar-primary-foreground: var(--bg-app);
  --color-sidebar-accent: var(--bg-surface-raised);
  --color-sidebar-accent-foreground: var(--fg-default);
  --color-sidebar-border: var(--border-subtle);
  --color-sidebar-ring: var(--accent);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
  --text-2xs: 0.625rem;
  --text-2xs--line-height: 0.875rem;
  --text-3xs: 0.5625rem;
  --text-3xs--line-height: 0.8125rem;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground antialiased;
    font-family: var(--font-sans);
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    user-select: none;
  }

  ::-webkit-scrollbar {
    width: 5px;
    height: 5px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: var(--border-default);
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--fg-muted);
  }
  ::-webkit-scrollbar-corner {
    background: transparent;
  }
}

@layer utilities {
  .surface-interactive {
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }
  .surface-interactive:hover {
    background-color: var(--bg-surface-raised);
  }

  .data-row {
    transition: background-color 80ms ease;
  }
  .data-row:hover {
    background-color: var(--bg-surface-raised);
  }
}
```

- [ ] **Step 2: Run the app to verify nothing visually regressed**

Run: `vp run tauri` (in a separate terminal)
Expected: app launches, looks identical to before (we have not yet wired the new themeStore, so the legacy aliases are doing all the work). If anything looks broken, the alias map is the suspect.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/assets/styles/main.css
git commit -m "refactor(styles): introduce Layer-B tokens with legacy aliases (no visual change)"
```

---

## Task 7: themeStore (Pinia)

**Files:**

- Create: `apps/desktop/src/stores/theme.store.ts`
- Test: `apps/desktop/src/stores/__tests__/theme.store.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/src/stores/__tests__/theme.store.test.ts`:

```ts
import { describe, test, expect, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { useThemeStore } from "../theme.store";

describe("themeStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.cssText = "";
  });

  test("defaults to codex-dark + coral-amber", () => {
    const store = useThemeStore();
    store.initialize();
    expect(store.themeId).toBe("codex-dark");
    expect(store.accentId).toBe("coral-amber");
    expect(document.documentElement.dataset.theme).toBe("codex-dark");
  });

  test("setTheme switches theme and persists", () => {
    const store = useThemeStore();
    store.initialize();
    store.setTheme("nord");
    expect(store.themeId).toBe("nord");
    expect(document.documentElement.dataset.theme).toBe("nord");
    expect(localStorage.getItem("capubridge:theme-id")).toBe("nord");
  });

  test("setAccent switches accent and persists", () => {
    const store = useThemeStore();
    store.initialize();
    store.setAccent("blue");
    expect(store.accentId).toBe("blue");
    expect(localStorage.getItem("capubridge:accent-id")).toBe("blue");
  });

  test("setCustomAccent generates and applies a custom ramp", () => {
    const store = useThemeStore();
    store.initialize();
    store.setCustomAccent("#3b82f6");
    expect(store.accentId).toBe("custom");
    expect(store.customAccentHex).toBe("#3b82f6");
    expect(localStorage.getItem("capubridge:accent-hex")).toBe("#3b82f6");
  });

  test("initialize restores from localStorage", () => {
    localStorage.setItem("capubridge:theme-id", "tokyo-night");
    localStorage.setItem("capubridge:accent-id", "purple");
    const store = useThemeStore();
    store.initialize();
    expect(store.themeId).toBe("tokyo-night");
    expect(store.accentId).toBe("purple");
  });

  test("mode getter mirrors the active theme's mode", () => {
    const store = useThemeStore();
    store.initialize();
    expect(store.mode).toBe("dark");
    store.setTheme("codex-light");
    expect(store.mode).toBe("light");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp test apps/desktop/src/stores/__tests__/theme.store.test.ts --run`
Expected: FAIL — store does not exist.

- [ ] **Step 3: Implement the store**

Create `apps/desktop/src/stores/theme.store.ts`:

```ts
import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { getTheme, applyTheme, DEFAULT_THEME_ID, DEFAULT_ACCENT_ID } from "@/themes/registry";
import { getAccentRamp, hexToRamp } from "@/themes/accent-ramps";

const LS_THEME = "capubridge:theme-id";
const LS_ACCENT = "capubridge:accent-id";
const LS_ACCENT_HEX = "capubridge:accent-hex";

export const useThemeStore = defineStore("theme", () => {
  const themeId = ref<string>(DEFAULT_THEME_ID);
  const accentId = ref<string>(DEFAULT_ACCENT_ID);
  const customAccentHex = ref<string | null>(null);

  const mode = computed(() => getTheme(themeId.value).mode);

  function currentAccent() {
    if (accentId.value === "custom" && customAccentHex.value) {
      return hexToRamp(customAccentHex.value);
    }
    try {
      return getAccentRamp(accentId.value);
    } catch {
      return getAccentRamp(DEFAULT_ACCENT_ID);
    }
  }

  function reapply() {
    applyTheme(getTheme(themeId.value), currentAccent());
  }

  function initialize() {
    const savedTheme = localStorage.getItem(LS_THEME);
    const savedAccent = localStorage.getItem(LS_ACCENT);
    const savedHex = localStorage.getItem(LS_ACCENT_HEX);

    if (savedTheme) themeId.value = savedTheme;
    if (savedAccent) accentId.value = savedAccent;
    if (savedHex) customAccentHex.value = savedHex;

    reapply();
  }

  function setTheme(id: string) {
    themeId.value = id;
    localStorage.setItem(LS_THEME, id);
    reapply();
  }

  function setAccent(id: string) {
    accentId.value = id;
    localStorage.setItem(LS_ACCENT, id);
    reapply();
  }

  function setCustomAccent(hex: string) {
    accentId.value = "custom";
    customAccentHex.value = hex;
    localStorage.setItem(LS_ACCENT, "custom");
    localStorage.setItem(LS_ACCENT_HEX, hex);
    reapply();
  }

  return {
    themeId,
    accentId,
    customAccentHex,
    mode,
    initialize,
    setTheme,
    setAccent,
    setCustomAccent,
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `vp test apps/desktop/src/stores/__tests__/theme.store.test.ts --run`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/stores/theme.store.ts apps/desktop/src/stores/__tests__/theme.store.test.ts
git commit -m "feat(stores): themeStore with persistence + accent override"
```

---

## Task 8: useTheme composable

**Files:**

- Create: `apps/desktop/src/composables/useTheme.ts`

- [ ] **Step 1: Implement the composable**

Create `apps/desktop/src/composables/useTheme.ts`:

```ts
import { computed } from "vue";
import { useThemeStore } from "@/stores/theme.store";
import { themes } from "@/themes/registry";
import { presetAccents } from "@/themes/accent-ramps";

/**
 * Component-friendly wrapper around themeStore. Exposes the active theme/
 * accent ids, the available themes/accents, and bound setters.
 *
 * Components should prefer this composable over importing the store directly
 * to avoid coupling to Pinia internals from the template.
 */
export function useTheme() {
  const store = useThemeStore();

  return {
    themeId: computed(() => store.themeId),
    accentId: computed(() => store.accentId),
    customAccentHex: computed(() => store.customAccentHex),
    mode: computed(() => store.mode),
    availableThemes: themes,
    availableAccents: presetAccents,
    setTheme: store.setTheme,
    setAccent: store.setAccent,
    setCustomAccent: store.setCustomAccent,
  };
}
```

- [ ] **Step 2: Type/lint**

Run: `vp check`. Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/composables/useTheme.ts
git commit -m "feat(composables): useTheme() for component-side access"
```

---

## Task 9: Wire theme init in main.ts; remove hardcoded `dark` from AppShell

**Files:**

- Modify: `apps/desktop/src/main.ts`
- Modify: `apps/desktop/src/components/layout/AppShell.vue`

- [ ] **Step 1: Initialize the theme store before mount**

Edit `apps/desktop/src/main.ts` and add the theme init after `app.use(pinia)`:

Replace:

```ts
const sessionStore = useSessionStore(pinia);
void sessionStore.initialize();
```

with:

```ts
import { useThemeStore } from "@/stores/theme.store";

const themeStore = useThemeStore(pinia);
themeStore.initialize();

const sessionStore = useSessionStore(pinia);
void sessionStore.initialize();
```

- [ ] **Step 2: Remove hardcoded `dark` from AppShell.vue**

In `apps/desktop/src/components/layout/AppShell.vue`, find the root element:

```vue
<div class="flex flex-col h-screen overflow-hidden bg-background dark">
```

Change to:

```vue
<div class="flex flex-col h-screen overflow-hidden bg-background">
```

- [ ] **Step 3: Run the app**

Run: `vp run tauri`
Expected: app launches in Codex Dark by default (because that's the default theme id, and the store applied it on init). Confirm the visual is unchanged from before.

- [ ] **Step 4: Manually verify a theme switch via devtools**

In the running app, open Vue DevTools, find the `theme` store, and call `setTheme("codex-light")`. Confirm:

- `<html data-theme="codex-light" data-theme-mode="light">`
- App switches to the light palette
- No console errors
- No layout shifts

Then call `setTheme("codex-dark")` to return to default.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main.ts apps/desktop/src/components/layout/AppShell.vue
git commit -m "feat(shell): initialize themeStore on boot; drop hardcoded dark class"
```

---

## Task 10: Retire useUIStore.theme; migrate the 2 consumers

**Files:**

- Modify: `apps/desktop/src/stores/ui.store.ts`
- Modify: `apps/desktop/src/components/layout/SubNavTabs.vue`
- Delete: `apps/desktop/src/modules/settings/SettingsTheme.vue` (replaced in Task 11)

- [ ] **Step 1: Identify consumers**

Run: `grep -rn "uiStore\.theme\|uiStore\.setTheme\|uiStore\.toggleTheme" apps/desktop/src/`
Expected: two files — `SubNavTabs.vue` and `SettingsTheme.vue`. If you find more, add them to the migration list below.

- [ ] **Step 2: Migrate `SubNavTabs.vue`**

Open `apps/desktop/src/components/layout/SubNavTabs.vue`. Replace any reference to `uiStore.theme`, `uiStore.setTheme`, or `uiStore.toggleTheme` with the equivalent from `useTheme()`:

- `uiStore.theme` → `useTheme().mode.value`
- `uiStore.setTheme(x)` → `useTheme().setTheme(x === "dark" ? "codex-dark" : "codex-light")`
- `uiStore.toggleTheme()` → conditional based on `useTheme().mode`

(The exact diff depends on what the file does — read it and adjust.)

- [ ] **Step 3: Strip theme code from `ui.store.ts`**

Replace `apps/desktop/src/stores/ui.store.ts` with:

```ts
import { ref } from "vue";
import { defineStore } from "pinia";

export const useUIStore = defineStore("ui", () => {
  const activePanel = ref<string>("/devices");
  const sidebarCollapsed = ref(true);

  function setActivePanel(path: string) {
    activePanel.value = path;
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  return {
    activePanel,
    sidebarCollapsed,
    setActivePanel,
    toggleSidebar,
  };
});
```

- [ ] **Step 4: Run typecheck**

Run: `vp check`
Expected: no errors. If you missed a consumer, this will flag it — fix and re-run.

- [ ] **Step 5: Run tests**

Run: `vp test --run`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/stores/ui.store.ts apps/desktop/src/components/layout/SubNavTabs.vue
git commit -m "refactor(theme): retire useUIStore.theme; consumers migrated to useTheme()"
```

---

## Task 11: SettingsAppearance — theme picker

**Files:**

- Create: `apps/desktop/src/modules/settings/SettingsAppearance.vue`
- Create: `apps/desktop/src/modules/settings/components/ThemeCard.vue`
- Delete: `apps/desktop/src/modules/settings/SettingsTheme.vue`
- Modify: `apps/desktop/src/router/index.ts`

- [ ] **Step 1: Create ThemeCard.vue**

```vue
<script setup lang="ts">
import type { Theme } from "@/themes/types";

const props = defineProps<{
  theme: Theme;
  active: boolean;
}>();

defineEmits<{ select: [id: string] }>();
</script>

<template>
  <button
    type="button"
    class="group flex flex-col gap-3 rounded-lg border p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-app)]"
    :class="
      props.active
        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
        : 'border-[var(--border-default)] hover:border-[var(--border-strong)] bg-[var(--bg-surface-raised)]'
    "
    :aria-pressed="props.active"
    @click="$emit('select', props.theme.id)"
  >
    <!-- Preview swatches: app / surface / fg / accent -->
    <div class="flex gap-1 overflow-hidden rounded-md">
      <div class="h-10 flex-1" :style="{ background: props.theme.semantics.bgApp }" />
      <div class="h-10 flex-1" :style="{ background: props.theme.semantics.bgSurface }" />
      <div class="h-10 flex-1" :style="{ background: props.theme.semantics.bgSurfaceRaised }" />
      <div class="h-10 flex-1" :style="{ background: 'var(--accent)' }" />
    </div>
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium text-[var(--fg-default)]">{{ props.theme.label }}</span>
      <span class="text-xs text-[var(--fg-muted)]">{{ props.theme.meta.contrastClass }}</span>
    </div>
  </button>
</template>
```

- [ ] **Step 2: Create SettingsAppearance.vue**

```vue
<script setup lang="ts">
import { useTheme } from "@/composables/useTheme";
import ThemeCard from "./components/ThemeCard.vue";

const { themeId, availableThemes, setTheme } = useTheme();
</script>

<template>
  <div class="flex-1 overflow-y-auto p-5">
    <div class="max-w-3xl space-y-8">
      <section>
        <header class="mb-3">
          <h2 class="text-sm font-medium text-[var(--fg-default)]">Theme</h2>
          <p class="text-xs text-[var(--fg-muted)]">
            Pick a palette. The accent color is set separately below.
          </p>
        </header>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
          <ThemeCard
            v-for="theme in availableThemes"
            :key="theme.id"
            :theme="theme"
            :active="themeId === theme.id"
            @select="setTheme"
          />
        </div>
      </section>

      <!-- Accent picker arrives in Task 12. -->
    </div>
  </div>
</template>
```

- [ ] **Step 3: Update router**

Open `apps/desktop/src/router/index.ts` and find the route entry that points at `SettingsTheme.vue`. Replace it with a route pointing at `SettingsAppearance.vue`. Keep the old `/settings/theme` path as a redirect to `/settings/appearance` for one release:

(Exact edit depends on the router file's structure; the agent should grep `SettingsTheme` and adjust the import + the route definition.)

- [ ] **Step 4: Delete the old file**

```bash
git rm apps/desktop/src/modules/settings/SettingsTheme.vue
```

- [ ] **Step 5: Run typecheck + app**

Run: `vp check` — expected: no errors.
Run: `vp run tauri` — navigate to Settings → Appearance — confirm the 6 theme cards render and clicking any one switches the theme live with no flicker.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/settings/SettingsAppearance.vue \
        apps/desktop/src/modules/settings/components/ThemeCard.vue \
        apps/desktop/src/router/index.ts
git commit -m "feat(settings): SettingsAppearance with 6-theme picker; replaces SettingsTheme"
```

---

## Task 12: AccentSwatch + accent picker UI

**Files:**

- Create: `apps/desktop/src/modules/settings/components/AccentSwatch.vue`
- Modify: `apps/desktop/src/modules/settings/SettingsAppearance.vue`

- [ ] **Step 1: Create AccentSwatch.vue**

```vue
<script setup lang="ts">
import type { AccentRamp } from "@/themes/types";

const props = defineProps<{
  accent: AccentRamp;
  active: boolean;
}>();

defineEmits<{ select: [id: string] }>();
</script>

<template>
  <button
    type="button"
    :title="props.accent.label"
    :aria-pressed="props.active"
    class="relative size-9 rounded-full transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
    :class="props.active ? 'scale-110 ring-2 ring-[var(--fg-default)]' : 'hover:scale-105'"
    :style="{ background: props.accent.steps[4] }"
    @click="$emit('select', props.accent.id)"
  />
</template>
```

- [ ] **Step 2: Extend SettingsAppearance.vue**

Add an Accent section under the Theme section. Replace the `<!-- Accent picker arrives in Task 12. -->` comment with:

```vue
<section>
  <header class="mb-3">
    <h2 class="text-sm font-medium text-[var(--fg-default)]">Accent</h2>
    <p class="text-xs text-[var(--fg-muted)]">
      The accent is the active-thing color — focus rings, active tabs, primary buttons.
    </p>
  </header>
  <div class="flex flex-wrap items-center gap-3">
    <AccentSwatch
      v-for="accent in availableAccents"
      :key="accent.id"
      :accent="accent"
      :active="accentId === accent.id"
      @select="setAccent"
    />
    <label class="ml-2 inline-flex items-center gap-2 text-xs text-[var(--fg-muted)]">
      <span>Custom</span>
      <input
        type="color"
        class="h-9 w-9 cursor-pointer rounded-md border border-[var(--border-default)] bg-transparent"
        :value="customAccentHex ?? '#3b82f6'"
        @input="(e) => setCustomAccent((e.target as HTMLInputElement).value)"
      >
    </label>
  </div>
</section>
```

Add the needed bindings to the `<script setup>` block:

```ts
import AccentSwatch from "./components/AccentSwatch.vue";

const {
  themeId,
  accentId,
  customAccentHex,
  availableThemes,
  availableAccents,
  setTheme,
  setAccent,
  setCustomAccent,
} = useTheme();
```

- [ ] **Step 3: Verify**

Run: `vp run tauri`. In Settings → Appearance, click each of the 8 swatches — the focus ring + primary button colors update live. Pick a custom hex via the color input — same effect.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/settings/components/AccentSwatch.vue apps/desktop/src/modules/settings/SettingsAppearance.vue
git commit -m "feat(settings): accent picker with 8 presets + custom hex"
```

---

## Task 13: scripts/check-contrast.ts

**Files:**

- Create: `apps/desktop/scripts/check-contrast.ts`

The script imports themes + the accent ramps + the contrast math, walks every theme × every required Layer-B pair, and exits non-zero on a single failure. It runs as a Node script (`node --import tsx scripts/check-contrast.ts` works; the team is on Vite+ which provides a tsx loader — verify by running it once below).

- [ ] **Step 1: Write the script**

Create `apps/desktop/scripts/check-contrast.ts`:

```ts
#!/usr/bin/env -S node --import tsx

import { themes } from "../src/themes/registry";
import { presetAccents } from "../src/themes/accent-ramps";
import { contrastRatio, classifyContrast } from "../src/themes/contrast";
import type { Theme } from "../src/themes/types";

type Check = {
  fg: keyof Theme["semantics"];
  bg: keyof Theme["semantics"];
  minAA: number; // 4.5 by default; lowered to 3.0 for AA-large exemptions
};

// Required pairs that must always hit at least 4.5:1 (AA).
const STRICT_CHECKS: Check[] = [
  { fg: "fgDefault", bg: "bgApp", minAA: 4.5 },
  { fg: "fgDefault", bg: "bgSurface", minAA: 4.5 },
  { fg: "fgDefault", bg: "bgSurfaceRaised", minAA: 4.5 },
  { fg: "fgDefault", bg: "bgChrome", minAA: 4.5 },
  { fg: "fgMuted", bg: "bgChrome", minAA: 4.5 },
  { fg: "fgMuted", bg: "bgSurface", minAA: 4.5 },
  { fg: "stateSuccess", bg: "bgSurface", minAA: 4.5 },
  { fg: "stateWarning", bg: "bgSurface", minAA: 4.5 },
  { fg: "stateDanger", bg: "bgSurface", minAA: 4.5 },
  { fg: "stateInfo", bg: "bgSurface", minAA: 4.5 },
];

// AA-large allowed for non-load-bearing metadata.
const RELAXED_CHECKS: Check[] = [
  { fg: "fgSubtle", bg: "bgSurface", minAA: 3.0 },
  { fg: "fgSubtle", bg: "bgSurfaceRaised", minAA: 3.0 },
  { fg: "borderDefault", bg: "bgSurface", minAA: 3.0 },
  { fg: "borderDefault", bg: "bgApp", minAA: 3.0 },
];

type Failure = {
  theme: string;
  pair: string;
  ratio: number;
  band: string;
  required: number;
};

const failures: Failure[] = [];

for (const theme of themes) {
  const required = theme.meta.contrastClass === "AAA" ? 7.0 : 0; // theme-level floor

  const runCheck = (c: Check, label: string) => {
    const fg = theme.semantics[c.fg];
    const bg = theme.semantics[c.bg];
    // Skip rgba() backgrounds — overlay is layered, not compared directly.
    if (bg.startsWith("rgba(")) return;
    const ratio = contrastRatio(fg, bg);
    const minimum = Math.max(c.minAA, required > 0 ? required : 0);
    if (ratio < minimum) {
      failures.push({
        theme: theme.id,
        pair: `${c.fg} / ${c.bg} (${label})`,
        ratio: Number(ratio.toFixed(2)),
        band: classifyContrast(ratio),
        required: minimum,
      });
    }
  };

  for (const c of STRICT_CHECKS) runCheck(c, "strict AA");
  for (const c of RELAXED_CHECKS) runCheck(c, "AA-large allowed");
}

// Accent contrast: every preset accent's step[4] should hit 4.5 against
// every theme's bgSurface.
for (const theme of themes) {
  const required = theme.meta.contrastClass === "AAA" ? 7.0 : 4.5;
  const bg = theme.semantics.bgSurface;
  for (const accent of presetAccents) {
    const ratio = contrastRatio(accent.steps[4], bg);
    if (ratio < required) {
      failures.push({
        theme: theme.id,
        pair: `accent[${accent.id}].step[4] / bgSurface`,
        ratio: Number(ratio.toFixed(2)),
        band: classifyContrast(ratio),
        required,
      });
    }
  }
}

if (failures.length === 0) {
  console.log(`✓ Contrast OK — ${themes.length} themes × ${presetAccents.length} accents.`);
  process.exit(0);
}

console.error(`✗ Contrast FAIL — ${failures.length} pair(s) below threshold:`);
for (const f of failures) {
  console.error(`  [${f.theme}] ${f.pair}: ${f.ratio}:1 (${f.band}) — needs ≥ ${f.required}:1`);
}
process.exit(1);
```

- [ ] **Step 2: Run the script**

Run: `node --import tsx apps/desktop/scripts/check-contrast.ts`
Expected: either `✓ Contrast OK` or a list of failing pairs.

If there are failures, **adjust the offending semantic token values in the corresponding `primitives/*.ts` file** until the script passes. Common fixes:

- Bump `fgMuted` brighter on dark themes
- Bump `fgMuted` darker on light themes
- Pick a deeper `stateDanger` on light themes

Iterate primitives → re-run script until clean.

- [ ] **Step 3: Add the npm script**

Edit `apps/desktop/package.json`. Add to `scripts`:

```json
"check:contrast": "node --import tsx ./scripts/check-contrast.ts"
```

- [ ] **Step 4: Verify via vp**

Run: `vp run -F desktop check:contrast`
Expected: `✓ Contrast OK …`

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/scripts/check-contrast.ts apps/desktop/package.json apps/desktop/src/themes/primitives/
git commit -m "feat(themes): contrast check script + token tuning to pass WCAG AA/AAA"
```

---

## Task 14: Wire contrast check into `vp run ready`

**Files:**

- Modify: `vite.config.ts` (root) OR add a `ready` script in the relevant package.json

How Vite+ wires `vp run ready` depends on the repo's existing convention. The reference is `apps/docs/viteplus.md`. Most repos define `ready` as a composite script. Two approaches:

**Option A (preferred):** add `check:contrast` to whatever scripts `vp run ready` aggregates. If `ready` already exists in root `package.json` or `vite.config.ts`, append it there.

**Option B (fallback):** if `vp run ready` isn't defined yet, define it. In root `package.json`:

```json
"scripts": {
  "ready": "vp check && vp test --run && vp run -F desktop check:contrast && vp run -r build"
}
```

- [ ] **Step 1: Inspect current `ready` definition**

Run: `cat package.json | grep -A2 '"ready"'` or `grep -rn "ready" vite.config.ts`. Decide on Option A or B.

- [ ] **Step 2: Wire it in**

Apply the chosen edit. Confirm by running `vp run ready` — the contrast check should appear in the output and the command should fail if any contrast pair fails.

To verify the failure path, temporarily edit `codex-dark.ts` and set `fgDefault` to `#444444` (low contrast). Run `vp run ready` — expected: red output naming the failing pair, exit code non-zero. Revert the change.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts package.json
git commit -m "chore(ci): wire contrast check into vp run ready"
```

---

## Task 15: Smoke matrix — every screen × all themes

This is a manual verification step. It catches places where components hardcode colors that don't follow the tokens.

- [ ] **Step 1: Launch the app**

Run: `vp run tauri`

- [ ] **Step 2: For each of the 6 themes**

In Settings → Appearance, switch theme. For each theme, navigate through:

- `/devices` — devices list
- `/app` — App module
- `/storage` — Storage module (default sub-tool)
- `/network` — Network module
- `/inspect` — Inspect module
- `/replay` — Replay module
- `/settings/*` — every settings sub-page
- Open the bottom dock (⌘J) — confirm it themes correctly
- Open the command palette (⌘K) — confirm it themes correctly

For each screen, note any element that looks wrong in any theme (e.g. an element stays dark in Codex Light, or has low contrast in High Contrast). Record findings in a scratch file `slice-1-findings.md` at the repo root (do not commit it — it's a working doc).

- [ ] **Step 3: Fix the offenders**

For every finding, edit the component to use `var(--fg-default)`, `var(--bg-surface)`, etc. instead of the hardcoded value. Do **not** change behavior — visual fixes only. Each fix is its own small commit.

This step may produce 0–10 commits depending on how clean the existing codebase is.

- [ ] **Step 4: Re-run the matrix**

Repeat Step 2 until every screen looks correct in all 6 themes.

- [ ] **Step 5: Delete the scratch file**

```bash
rm slice-1-findings.md
```

---

## Task 16: Final verification + slice complete

- [ ] **Step 1: Full ready run**

Run: `vp run ready`
Expected: green — `vp check`, `vp test --run`, `vp run -F desktop check:contrast`, and `vp run -r build` all pass.

- [ ] **Step 2: Tag the slice**

```bash
git tag ui-redesign/slice-1-foundation
```

(Do not push tag without user confirmation.)

- [ ] **Step 3: Confirm done conditions from spec §7 Slice 1**

- [x] `src/themes/` with 6 theme files + `accent-ramps.ts`
- [x] `tokens.css` two-layer model
- [x] `themeStore` + `useTheme()` composable
- [x] `[data-theme]` selectors; hardcoded `dark` removed from AppShell
- [x] `scripts/check-contrast.ts` + CI hook
- [x] Settings → Appearance page
- [x] Existing components keep working

**Done when:** all the above are true and the smoke matrix is clean.

---

## Risks during execution

- **Hidden hex literals in components.** Many of today's modules likely reference hex values directly. Task 15 catches these. If the catch-rate is high we may need an additional cleanup PR before declaring the slice "done."
- **Tailwind v4 `@theme inline` re-compile.** When `main.css` is edited, the Vite HMR sometimes loses class generation for `bg-surface-*` until full reload. Mitigation: hard reload after Task 6.
- **`color-mix()` browser support.** We use it for tinted state backgrounds in `@theme inline`. Tauri's bundled WebView2 (Win) and WKWebView (mac) both support `color-mix()` as of late 2024. If older OS versions are in scope, swap to pre-computed values.
- **High-Contrast theme failing AAA on some borders.** The `borderDefault: #ffffff` choice is intentional but may fail against `bgSurfaceRaised: #0a0a0a` for elements with very fine borders if anti-aliasing softens edges. If Task 13 flags this, raise `bgSurfaceRaised` to `#111111`.

## Out of scope for this slice

- Tabs (Slice 3).
- New TitleBar / Launcher Sidebar / Empty State (Slice 2).
- Module shell rebuild (Slice 3).
- AI assistant tab (Slice 5).
- Polish (motion audit, AAA tuning beyond minimum, illustrations) (Slice 6).
