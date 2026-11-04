#!/usr/bin/env -S node --import tsx

import { themes } from "../src/themes/registry.ts";
import { contrastRatio, classifyContrast } from "../src/themes/contrast.ts";
import type { ThemeTokens } from "../src/themes/types.ts";

type Role = keyof ThemeTokens;

const BACKGROUNDS: Role[] = ["bgApp", "bgChrome", "bgSurface", "bgSurfaceRaised"];

const TEXT_ROLES: Role[] = [
  "fgDefault",
  "fgMuted",
  "fgSubtle",
  "signalLive",
  "signalRec",
  "signalSelect",
  "signalMark",
  "stateSuccess",
  "stateWarning",
  "stateDanger",
  "stateInfo",
  "catNetwork",
  "catStorage",
  "catDevice",
  "catConsole",
  "catAgent",
];

const UI_CHECKS: Array<[Role, Role]> = [["borderStrong", "bgSurface"]];

type Failure = { theme: string; pair: string; ratio: number; band: string; required: number };

const failures: Failure[] = [];

function record(theme: string, pair: string, ratio: number, required: number) {
  if (ratio < required) {
    failures.push({
      theme,
      pair,
      ratio: Number(ratio.toFixed(2)),
      band: classifyContrast(ratio),
      required,
    });
  }
}

for (const theme of themes) {
  const textFloor = theme.meta.contrastClass === "AAA" ? 7 : 4.5;
  const { tokens } = theme;

  for (const bg of BACKGROUNDS) {
    for (const fg of TEXT_ROLES) {
      const required = fg === "fgDefault" || fg === "fgMuted" ? textFloor : 4.5;
      record(theme.id, `${fg} / ${bg}`, contrastRatio(tokens[fg], tokens[bg]), required);
    }
  }

  for (const [fg, bg] of UI_CHECKS) {
    record(theme.id, `${fg} / ${bg} (UI)`, contrastRatio(tokens[fg], tokens[bg]), 3);
  }

  record(
    theme.id,
    "primary button label (bgApp on fgDefault)",
    contrastRatio(tokens.bgApp, tokens.fgDefault),
    textFloor,
  );
  record(
    theme.id,
    "selection fill label (bgApp on signalSelect)",
    contrastRatio(tokens.bgApp, tokens.signalSelect),
    4.5,
  );
}

if (failures.length > 0) {
  console.error(`✗ ${failures.length} contrast failure(s):`);
  for (const f of failures) {
    console.error(
      `  ${f.theme.padEnd(14)} ${f.pair.padEnd(48)} ${f.ratio}:1 (${f.band}, needs ${f.required})`,
    );
  }
  process.exitCode = 1;
} else {
  console.log(
    `✓ Contrast OK — ${themes.length} themes × ${TEXT_ROLES.length} text roles × ${BACKGROUNDS.length} backgrounds.`,
  );
}
