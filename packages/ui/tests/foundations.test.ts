import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vite-plus/test";
import {
  overlayPhases,
  resolveSurfaceLevel,
  surfaceLevels,
  surfaceVariants,
  uiAccents,
  uiSizes,
  uiThemes,
} from "../src/index.ts";

const motionCss = readFileSync(join(process.cwd(), "src", "styles", "motion.css"), "utf8");
const tokensCss = readFileSync(join(process.cwd(), "src", "styles", "tokens.css"), "utf8");
const controlsCss = readFileSync(join(process.cwd(), "src", "styles", "controls.css"), "utf8");
const surfacesCss = readFileSync(join(process.cwd(), "src", "styles", "surfaces.css"), "utf8");
const indexCss = readFileSync(join(process.cwd(), "src", "styles", "index.css"), "utf8");

const radiusScales = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"];

function tokenBlockFrom(marker: string): string {
  const start = tokensCss.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const end = tokensCss.indexOf("\n  }", start);
  expect(end).toBeGreaterThan(start);
  return tokensCss.slice(start, end);
}

function sectionFrom(css: string, marker: string, nextMarker: string): string {
  const start = css.indexOf(marker);
  const end = css.indexOf(nextMarker, start + marker.length);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end);
}

test("publishes stable foundation contracts", () => {
  expect(uiSizes).toEqual(["2xs", "xs", "sm", "md", "lg", "xl", "2xl"]);
  expect(uiAccents).toHaveLength(11);
  expect(uiThemes).toEqual(["dark", "light"]);
  expect(surfaceLevels).toEqual([1, 2, 3, 4, 5]);
  expect(surfaceVariants).toContain("gradient-fill");
  expect(overlayPhases).toEqual(["closed", "opening", "opened", "closing"]);
});

test("resolves surface depth safely", () => {
  expect(resolveSurfaceLevel(undefined, 0)).toBe(1);
  expect(resolveSurfaceLevel("+2", 2)).toBe(4);
  expect(resolveSurfaceLevel("-2", 4)).toBe(2);
  expect(resolveSurfaceLevel("3", 4)).toBe(3);
  expect(resolveSurfaceLevel(20, 0)).toBe(5);
});

test("exposes the Cladd token scales as Tailwind theme variables", () => {
  const theme = tokensCss.slice(0, tokensCss.indexOf("@layer cui.tokens"));

  expect(theme.startsWith("@theme {")).toBe(true);
  expect(theme).toContain("--spacing-cui-md: var(--cui-size-md);");
  expect(theme).toContain("--spacing-cui-nested-md: var(--cui-nested-size-md);");
  expect(theme).toContain("--spacing-cui-thumb-sm: var(--cui-thumb-sm);");
  expect(theme).toContain("--radius-cui: var(--cui-radius);");
  expect(theme).toContain("--radius-cui-focus-md: var(--cui-radius-focus-md);");
  expect(theme).toContain("--radius-cui-wrap-full-2xl: var(--cui-radius-wrap-full-2xl);");
  expect(theme).toContain("--radius-cui-tooltip: var(--cui-radius-tooltip);");
  expect(theme).toContain("--text-cui-xs: var(--cui-text-xs);");
  expect(theme).toContain("--color-cui-surface: var(--cui-surface);");
  expect(theme).toContain("--color-cui-fg-softest: var(--cui-foreground-softest);");
  expect(theme).toContain("--shadow-cui-popover: var(--cui-shadow-popover);");
  expect(theme).toContain("--animate-cui-spinner: cui-spinner-rotate 1.5s infinite linear;");
});

test("publishes stable surface, sizing, and reduced-motion tokens", () => {
  expect(tokensCss).toContain("--cui-size-md: 28px");
  expect(tokensCss).toContain("--cui-nested-size-md: calc(var(--cui-size-md) - 8px)");
  expect(tokensCss).toContain(".cui-surface-level-5");
  expect(motionCss).toContain("--cui-motion-enter: 500ms");
  expect(motionCss).toContain("prefers-reduced-motion: reduce");
});

test("locks Cladd action geometry and motion values", () => {
  expect(tokensCss).toContain("--cui-text-4xs: 6px");
  expect(tokensCss).toContain("--cui-radius-2xl: calc(var(--cui-radius) * 48 / 28)");
  expect(motionCss).toContain("animation: cui-spinner-rotate 1.5s infinite linear");
  expect(controlsCss).toContain("width: var(--cui-nested-size-2xs)");
  expect(controlsCss).toContain("width: var(--cui-nested-size-2xl)");
  expect(controlsCss).toContain("inset: -6px");
  expect(controlsCss).toContain("padding: 4px 10px");
  expect(controlsCss).toContain("width: 14px");
  expect(indexCss).toContain(":has(.cui-surface--clickable:active)");
});

test("locks the wrap radius ladder ported from Cladd radius.css", () => {
  for (const scale of radiusScales) {
    expect(tokensCss).toContain(
      `--cui-radius-wrap-${scale}: calc(var(--cui-radius-${scale}) + 4px)`,
    );
    expect(tokensCss).toContain(
      `--cui-radius-wrap-full-${scale}: calc(var(--cui-radius-full-${scale}) + 4px)`,
    );
  }
  expect(tokensCss).toContain("--cui-radius-popup: 24px");
});

test("locks the smallest size step and its nested variant", () => {
  expect(tokensCss).toContain("--cui-size-3xs: 12px");
  expect(tokensCss).toContain("--cui-nested-size-3xs: calc(var(--cui-size-3xs) - 8px)");
});

test("locks hover fill in every theme block", () => {
  const darkNeutral = tokenBlockFrom("--cui-background: #0f0f0f;");
  const darkAccent = tokenBlockFrom("--cui-background: oklch(from var(--cui-accent-source) 0.18");
  const lightNeutral = tokenBlockFrom("--cui-background: #fff;");
  const lightAccent = tokenBlockFrom("--cui-background: oklch(from var(--cui-accent-source) 1 ");

  expect(darkNeutral).toContain(
    "--cui-hover-fill: color-mix(in oklab, var(--cui-surface-white) 20%, transparent)",
  );
  expect(darkAccent).toContain(
    "--cui-hover-fill: color-mix(in oklab, var(--cui-surface-white) 40%, transparent)",
  );
  expect(lightNeutral).toContain(
    "--cui-hover-fill: color-mix(in oklab, var(--cui-surface-white) 20%, transparent)",
  );
  expect(lightAccent).toContain(
    "--cui-hover-fill: color-mix(in oklab, var(--cui-surface-white) 10%, transparent)",
  );
});

test("keeps the primary tune knobs as named retuning points", () => {
  expect(tokensCss).toContain("--cui-dark-primary-lightness: 0.95");
  expect(tokensCss).toContain("--cui-dark-primary-chroma: 0.18");
  expect(tokensCss).toContain("--cui-light-primary-lightness: 0.5");
  expect(tokensCss).toContain("--cui-light-primary-chroma: 0.18");
  expect(tokensCss.match(/var\(--cui-dark-primary-lightness\)/g)).toHaveLength(2);
  expect(tokensCss.match(/var\(--cui-dark-primary-chroma\)/g)).toHaveLength(1);
  expect(tokensCss.match(/var\(--cui-light-primary-lightness\)/g)).toHaveLength(1);
  expect(tokensCss.match(/var\(--cui-light-primary-chroma\)/g)).toHaveLength(1);
  expect(tokenBlockFrom("--cui-background: #fff;")).toContain(
    "--cui-primary: oklch(from var(--cui-accent-source) 0.1 0 h)",
  );
});

test("guards every surface hover rule behind a hover-capable pointer", () => {
  const variant = sectionFrom(
    indexCss,
    "@custom-variant cui-surface-hover",
    "@custom-variant cui-surface-press",
  );

  expect(variant).toContain("@media (hover: hover)");
  expect(variant).toContain(".cui-surface--hoverable:hover");

  const guardedCut = sectionFrom(
    surfacesCss,
    "@media (hover: hover)",
    ":where(.cui-surface-cut--clickable)",
  );
  expect(guardedCut).toContain(".cui-surface-cut--hoverable:hover");

  const allHover = surfacesCss.match(/:hover\)/g) ?? [];
  expect(allHover).toHaveLength((guardedCut.match(/:hover\)/g) ?? []).length);
});

test("collapses motion to zero under reduced motion", () => {
  const reducedMotion = motionCss.slice(
    motionCss.indexOf("@media (prefers-reduced-motion: reduce)"),
  );
  expect(reducedMotion).toContain("--cui-motion-fast: 0ms");
  expect(reducedMotion).toContain("--cui-motion-base: 0ms");
  expect(reducedMotion).toContain("--cui-motion-slow: 0ms");
  expect(reducedMotion).toContain("--cui-motion-enter: 0ms");
  expect(reducedMotion).not.toContain("--cui-ease-");

  const reducedSurfaces = surfacesCss.slice(
    surfacesCss.indexOf("@media (prefers-reduced-motion: reduce)"),
  );
  expect(reducedSurfaces).toContain("transform: none");
});

test("declares the cui layer order before importing any layer", () => {
  expect(indexCss.indexOf("@layer cui.tokens, cui.motion, cui.components, cui.utilities;")).toBe(0);
  expect(indexCss.indexOf("@import")).toBeGreaterThan(0);
});
