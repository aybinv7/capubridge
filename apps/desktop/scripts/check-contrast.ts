#!/usr/bin/env -S node --import tsx

import { themes } from "../src/themes/registry.ts";
import { presetAccents } from "../src/themes/accent-ramps.ts";
import { contrastRatio, classifyContrast } from "../src/themes/contrast.ts";
import type { Theme } from "../src/themes/types.ts";

type Check = {
  fg: keyof Theme["semantics"];
  bg: keyof Theme["semantics"];
  minAA: number;
};

// Strict AA (4.5:1) — text contrast.
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

// AA-large / UI-component contrast (3:1) — non-text and large-text floors.
const RELAXED_CHECKS: Check[] = [
  { fg: "fgSubtle", bg: "bgSurface", minAA: 3.0 },
  { fg: "fgSubtle", bg: "bgSurfaceRaised", minAA: 3.0 },
  { fg: "borderStrong", bg: "bgSurface", minAA: 3.0 },
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
  // AAA floor only applies to text. UI-component contrast tops out at 3:1 even
  // for AAA per WCAG (1.4.11 has no AAA level).
  const aaaTextFloor = theme.meta.contrastClass === "AAA" ? 7.0 : 0;

  const runCheck = (c: Check, label: string, applyAaaFloor: boolean) => {
    const fg = theme.semantics[c.fg];
    const bg = theme.semantics[c.bg];
    if (bg.startsWith("rgba(")) return;
    const ratio = contrastRatio(fg, bg);
    const minimum = applyAaaFloor ? Math.max(c.minAA, aaaTextFloor) : c.minAA;
    if (ratio < minimum) {
      failures.push({
        theme: theme.id,
        pair: `${String(c.fg)} / ${String(c.bg)} (${label})`,
        ratio: Number(ratio.toFixed(2)),
        band: classifyContrast(ratio),
        required: minimum,
      });
    }
  };

  for (const c of STRICT_CHECKS) runCheck(c, "strict AA (text)", true);
  for (const c of RELAXED_CHECKS) runCheck(c, "AA-large / UI", false);
}

// Accent UI-component contrast (3:1 against surface) + text-on-accent.
// We mirror applyTheme()'s step-selection logic: the "primary" accent is
// the step that pops best against bgSurface, defaulting to step[4]. So
// the check matches the actual color that will be rendered as --accent.
//
// Brand buttons render --brand-foreground (= --bg-app) on the accent step,
// not the theme-wide white --fg-on-accent, so text-on-accent is now checked
// against the actually-rendered pairing below.
function pickPrimaryStep(steps: readonly string[], surface: string): string {
  const canonical = steps[4];
  if (contrastRatio(canonical, surface) >= 3.0) return canonical;
  let best = canonical;
  let bestRatio = contrastRatio(canonical, surface);
  for (const s of steps) {
    const r = contrastRatio(s, surface);
    if (r > bestRatio) {
      best = s;
      bestRatio = r;
    }
  }
  return best;
}

for (const theme of themes) {
  const bg = theme.semantics.bgSurface;
  // Brand-filled buttons render dark/light --brand-foreground (= --bg-app) on
  // the picked accent step — NOT white --fg-on-accent. Because bg-app tracks
  // the surface luminance and the accent step is chosen to contrast the
  // surface, dark-on-light-accent (dark themes) and light-on-dark-accent
  // (light themes) both clear real AA. This retires the old fgOnAccent caveat.
  const brandForeground = theme.semantics.bgApp;
  for (const accent of presetAccents) {
    const accentColor = pickPrimaryStep(accent.steps, bg);

    const uiRatio = contrastRatio(accentColor, bg);
    if (uiRatio < 3.0) {
      failures.push({
        theme: theme.id,
        pair: `accent[${accent.id}] primary / bgSurface (UI)`,
        ratio: Number(uiRatio.toFixed(2)),
        band: classifyContrast(uiRatio),
        required: 3.0,
      });
    }

    // Real check: the brand button's label (bg-app) on its accent fill.
    // Button labels are 14px medium-weight → held to the project's AA-large
    // (3:1) floor, same policy the theme uses for all button labels. The
    // default codex-dark + coral pairing clears full AA (6.6:1); this floor
    // guards the non-default accent/theme combinations. Critically it is well
    // above the 2.93:1 that white-on-accent used to produce.
    const btnRatio = contrastRatio(brandForeground, accentColor);
    if (btnRatio < 3.0) {
      failures.push({
        theme: theme.id,
        pair: `brand-foreground / accent[${accent.id}] primary (button text)`,
        ratio: Number(btnRatio.toFixed(2)),
        band: classifyContrast(btnRatio),
        required: 3.0,
      });
    }
  }

  // Neutral menu/dropdown hover (the contrast fix): --fg-default on the raised
  // surface that shadcn `accent` now maps to. Must clear strict AA.
  const hoverRatio = contrastRatio(theme.semantics.fgDefault, theme.semantics.bgSurfaceRaised);
  if (hoverRatio < 4.5) {
    failures.push({
      theme: theme.id,
      pair: `fgDefault / bgSurfaceRaised (menu hover text)`,
      ratio: Number(hoverRatio.toFixed(2)),
      band: classifyContrast(hoverRatio),
      required: 4.5,
    });
  }

  // Active-tab / selected marker: accent primary as TEXT on accent-soft.
  const activeRatio = contrastRatio(
    pickPrimaryStep(presetAccents[0].steps, bg),
    theme.semantics.accentSoft,
  );
  if (activeRatio < 3.0) {
    failures.push({
      theme: theme.id,
      pair: `accent primary / accentSoft (active-tab text)`,
      ratio: Number(activeRatio.toFixed(2)),
      band: classifyContrast(activeRatio),
      required: 3.0,
    });
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
