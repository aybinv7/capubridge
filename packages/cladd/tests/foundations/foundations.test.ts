import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vite-plus/test';

import {
  buttonIconSizes,
  buttonPaddings,
  buttonVerticalPaddings,
} from '../../src/components/button.contracts.ts';
import {
  chipFontSizes,
  chipIconSizes,
  chipRoundedClasses,
} from '../../src/components/chip.contracts.ts';
import {
  shortcutFontSizes,
  shortcutIconSizes,
  shortcutRoundedClasses,
} from '../../src/components/shortcut.contracts.ts';
import {
  overlayPhases,
  surfaceLevels,
  surfaceVariants,
  uiSizes,
  uiThemes,
} from '../../src/foundations/contracts.ts';
import { resolveSurfaceLevel } from '../../src/foundations/surfaceLevel.ts';
import { roundedClasses } from '../../src/shared/roundedClasses.ts';
import {
  nestedSizeClasses,
  rootSizeClasses,
} from '../../src/shared/sizeClasses.ts';

const colorsCss = readFileSync(
  join(process.cwd(), 'src', 'styles', 'colors.css'),
  'utf8',
);
const inputCss = readFileSync(
  join(process.cwd(), 'src', 'styles', 'input.css'),
  'utf8',
);
const sliderCss = readFileSync(
  join(process.cwd(), 'src', 'styles', 'slider.css'),
  'utf8',
);
const styleFiles = readdirSync(join(process.cwd(), 'src', 'styles')).sort();
const radiusCss = readFileSync(
  join(process.cwd(), 'src', 'styles', 'radius.css'),
  'utf8',
);
const spacingCss = readFileSync(
  join(process.cwd(), 'src', 'styles', 'spacing.css'),
  'utf8',
);
const fontSizeCss = readFileSync(
  join(process.cwd(), 'src', 'styles', 'font-size.css'),
  'utf8',
);
const spinnerCss = readFileSync(
  join(process.cwd(), 'src', 'styles', 'spinner.css'),
  'utf8',
);
const indexCss = readFileSync(join(process.cwd(), 'src', 'cladd.css'), 'utf8');
const focusRingSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'FocusRing.vue'),
  'utf8',
);
const spinnerSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'Spinner.vue'),
  'utf8',
);
const surfaceSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'Surface.vue'),
  'utf8',
);

const radiusScales = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'];

function squash(value: string): string {
  return value.replace(/\s+/gu, '');
}

function tokenBlockFrom(marker: string): string {
  const start = colorsCss.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const end = colorsCss.indexOf('\n}', start);
  expect(end).toBeGreaterThan(start);
  return colorsCss.slice(start, end);
}

function sectionFrom(css: string, marker: string, nextMarker: string): string {
  const start = css.indexOf(marker);
  const end = css.indexOf(nextMarker, start + marker.length);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end);
}

test('publishes stable foundation contracts', () => {
  expect(uiSizes).toEqual(['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl']);
  expect(
    [...new Set(colorsCss.match(/\.cladd-color-[a-z]+/gu) ?? [])].sort(),
  ).toEqual([
    '.cladd-color-blue',
    '.cladd-color-brand',
    '.cladd-color-cyan',
    '.cladd-color-green',
    '.cladd-color-lime',
    '.cladd-color-neutral',
    '.cladd-color-orange',
    '.cladd-color-pink',
    '.cladd-color-purple',
    '.cladd-color-red',
    '.cladd-color-yellow',
  ]);
  expect(uiThemes).toEqual(['dark', 'light']);
  expect(surfaceLevels).toEqual([1, 2, 3, 4, 5]);
  expect(surfaceVariants).toContain('gradient-fill');
  expect(overlayPhases).toEqual(['closed', 'opening', 'opened', 'closing']);
});

test('resolves surface depth safely', () => {
  expect(resolveSurfaceLevel(undefined, 0)).toBe(1);
  expect(resolveSurfaceLevel('+2', 2)).toBe(4);
  expect(resolveSurfaceLevel('-2', 4)).toBe(2);
  expect(resolveSurfaceLevel('3', 4)).toBe(3);
  expect(resolveSurfaceLevel(20, 0)).toBe(5);
});

test("mirrors Cladd's token file split and theme variables", () => {
  expect(spacingCss).toContain('--spacing-cladd-md: 28px;');
  expect(spacingCss).toContain(
    '--spacing-cladd-nested-md: calc(var(--spacing-cladd-md) - 8px);',
  );
  expect(spacingCss).toContain('--spacing-cladd-thumb-sm: 20px;');
  expect(radiusCss).toContain('--radius-cladd: var(--cladd-radius);');
  expect(radiusCss).toContain(
    '--radius-cladd-focus-md: calc(var(--radius-cladd-md) + 6px);',
  );
  expect(radiusCss).toContain(
    '--radius-cladd-wrap-full-2xl: calc(var(--radius-cladd-full-2xl) + 4px);',
  );
  expect(radiusCss).toContain('--radius-cladd-tooltip: 12px;');
  expect(fontSizeCss).toContain('--text-cladd-xs: 12px;');
  expect(colorsCss).toContain('--color-cladd-surface: var(--cladd-surface);');
  expect(colorsCss).toContain(
    '--color-cladd-fg-softest: var(--cladd-fg-softest);',
  );
  expect(colorsCss).toContain(
    '--shadow-cladd-popover: 0 24px 64px -12px rgb(0 0 0 / 0.5);',
  );
  expect(spinnerCss).toContain(
    '--animate-cladd-spinner: cladd-spinner-rotate 1.5s infinite linear;',
  );
});

test('scopes the theme cascade on .dark / .light like Cladd, not on a provider element', () => {
  // Dark neutral lives on :root so an unclassed document is already themed.
  expect(colorsCss).toContain(
    ':root,\n.dark .cladd-color-neutral,\n.dark.cladd-color-neutral {',
  );
  expect(colorsCss).toContain(':root.light,');
  expect(colorsCss).toContain(
    '.light [class*="cladd-color-"]:not(.cladd-color-neutral),',
  );
  expect(indexCss).toContain('@custom-variant dark (&:where(.dark, .dark *));');
  expect(indexCss).toContain(
    '@custom-variant light (&:where(.light, .light *));',
  );
  // The provider publishes context only — no element, no classes of its own.
  expect(colorsCss).not.toContain('cladd-theme[data-cladd-theme');
});

test("tints the page only through a component's own color class, never a root", () => {
  // Upstream applies `cladd-color-*` per component (`Surface.tsx`: color && `cladd-color-${color}`)
  // and never on :root — the app-wide accent travels as context via useAccentColor(). Putting the
  // class on a root recomputes --cladd-bg for the whole document and tints the page.
  const accentedDark = tokenBlockFrom(
    '[class*="cladd-color-"]:not(.cladd-color-neutral),',
  );
  expect(accentedDark).toContain(
    '--cladd-bg: oklch(from var(--cladd-theme) 0.18 0.02 h);',
  );

  // The untinted page background belongs to the neutral :root block (selector asserted above).
  expect(colorsCss.indexOf('--cladd-bg: #0f0f0f;')).toBeLessThan(
    colorsCss.indexOf(
      '--cladd-bg: oklch(from var(--cladd-theme) 0.18 0.02 h);',
    ),
  );

  // Surface only emits the class for an explicit color, mirroring upstream's `color &&` guard,
  // and has no useAccentColor() fallback of its own.
  expect(surfaceSource).toContain(
    'explicitColor.value && `cladd-color-${explicitColor.value}`',
  );
  expect(surfaceSource).not.toContain('accentColor');
});

test('publishes stable surface and sizing tokens', () => {
  expect(spacingCss).toContain('--spacing-cladd-md: 28px');
  expect(colorsCss).toContain('.cladd-surface-level-5');
});

test('ships only the stylesheets Cladd hand-authors', () => {
  // Upstream keeps the entry at src/cladd.css and the partials in src/styles.
  expect(styleFiles).toEqual([
    'colors.css',
    'font-size.css',
    'input.css',
    'radius.css',
    'safe-areas.css',
    'slider.css',
    'spacing.css',
    'spinner.css',
  ]);
  // Cladd wraps only the two input resets in @layer base; everything else is @theme or bare.
  expect(inputCss.startsWith('@layer base {')).toBe(true);
  expect(sliderCss.startsWith('@layer base {')).toBe(true);
  expect(indexCss).not.toContain('@layer cladd.');
});

test('locks Cladd action geometry and motion values', () => {
  expect(fontSizeCss).toContain('--text-cladd-4xs: 6px');
  expect(radiusCss).toContain(
    '--radius-cladd-2xl: calc(var(--cladd-radius) * 48 / 28)',
  );
  expect(nestedSizeClasses('2xs', 'size')).toBe('size-cladd-nested-2xs');
  expect(nestedSizeClasses('2xl', 'size')).toBe('size-cladd-nested-2xl');
  expect(indexCss).toContain(':has(.cladd-clickable:active)');
  expect(roundedClasses('md', false, false).itemRoundedClasses).toBe(
    'rounded-cladd-md',
  );
  expect(roundedClasses('md', false, false).focusRoundedClasses).toBe(
    'rounded-cladd-focus-md',
  );
  expect(roundedClasses('lg', true, true).itemRoundedClasses).toBe(
    'rounded-cladd-full-lg',
  );
  expect(rootSizeClasses('md', 'height')).toBe('h-cladd-md');
  expect(nestedSizeClasses('2xs', 'width')).toBe('w-cladd-nested-2xs');
  expect(focusRingSource).toContain('-inset-1.5');
  expect(focusRingSource).toContain('border-2 border-cladd-primary');
  expect(buttonPaddings.md).toBe('px-2.5');
  expect(buttonPaddings['2xl']).toBe('px-3.5');
  expect(buttonVerticalPaddings['2xs']).toBe('py-0');
  expect(buttonIconSizes.md).toBe('[&>svg]:size-4');
  expect(chipRoundedClasses.md).toBe('rounded-cladd-sm');
  expect(chipFontSizes['2xs']).toBe('text-cladd-4xs');
  expect(chipIconSizes.lg).toBe('[&>svg]:size-4');
  expect(shortcutRoundedClasses.md).toBe('rounded-cladd-sm');
  expect(shortcutFontSizes['2xl']).toBe('text-cladd-md');
  expect(shortcutIconSizes.xl).toBe('size-5');
});

test('locks the wrap radius ladder ported from Cladd radius.css', () => {
  for (const scale of radiusScales) {
    expect(radiusCss).toContain(
      `--radius-cladd-wrap-${scale}: calc(var(--radius-cladd-${scale}) + 4px)`,
    );
    expect(radiusCss).toContain(
      `--radius-cladd-wrap-full-${scale}: calc(var(--radius-cladd-full-${scale}) + 4px)`,
    );
  }
  expect(radiusCss).toContain('--radius-cladd-popup: 24px');
});

test('locks the smallest size step and its nested variant', () => {
  expect(spacingCss).toContain('--spacing-cladd-3xs: 12px');
  expect(spacingCss).toContain(
    '--spacing-cladd-nested-3xs: calc(var(--spacing-cladd-3xs) - 8px)',
  );
});

test('locks hover fill in every theme block', () => {
  const darkNeutral = tokenBlockFrom('--cladd-bg: #0f0f0f;');
  const darkAccent = tokenBlockFrom(
    '--cladd-bg: oklch(from var(--cladd-theme) 0.18',
  );
  const lightNeutral = tokenBlockFrom('--cladd-bg: #fff;');
  const lightAccent = tokenBlockFrom(
    '--cladd-bg: oklch(from var(--cladd-theme) 1 ',
  );

  expect(squash(darkNeutral)).toContain(
    squash(
      '--cladd-surface-hover-fill: color-mix(in oklab, var(--cladd-surface-white) 20%, transparent)',
    ),
  );
  expect(squash(darkAccent)).toContain(
    squash(
      '--cladd-surface-hover-fill: color-mix(in oklab, var(--cladd-surface-white) 40%, transparent)',
    ),
  );
  expect(squash(lightAccent)).toContain(
    squash(
      '--cladd-surface-hover-fill: color-mix(in oklab, var(--cladd-surface-white) 10%, transparent)',
    ),
  );
  // Upstream's neutral-light block omits the hover fill entirely; the port keeps that omission.
  expect(lightNeutral).not.toContain('--cladd-surface-hover-fill');
});

test('keeps the primary tune knobs as named retuning points', () => {
  expect(colorsCss).toContain('--cladd-dark-primary-lightness: 0.95');
  expect(colorsCss).toContain('--cladd-dark-primary-chroma: 0.18');
  expect(colorsCss).toContain('--cladd-light-primary-lightness: 0.5');
  expect(colorsCss).toContain('--cladd-light-primary-chroma: 0.18');
  expect(
    colorsCss.match(/var\(--cladd-dark-primary-lightness\)/g),
  ).toHaveLength(2);
  expect(colorsCss.match(/var\(--cladd-dark-primary-chroma\)/g)).toHaveLength(
    1,
  );
  expect(
    colorsCss.match(/var\(--cladd-light-primary-lightness\)/g),
  ).toHaveLength(1);
  expect(colorsCss.match(/var\(--cladd-light-primary-chroma\)/g)).toHaveLength(
    1,
  );
  expect(tokenBlockFrom('--cladd-bg: #fff;')).toContain(
    '--cladd-primary: oklch(from var(--cladd-theme) 0.1 0 h)',
  );
});

test('guards every surface hover rule behind a hover-capable pointer', () => {
  const variant = sectionFrom(
    indexCss,
    '@custom-variant cladd-surface-hover',
    '@custom-variant cladd-surface-press',
  );

  expect(variant).toContain('@media (hover: hover)');
  expect(squash(variant)).toContain('.cladd-hoverable:hover');
  expect(squash(variant)).toContain(
    squash(':not(.cladd-clickable:active:not(:has(.cladd-clickable:active)))'),
  );
});

test('drives the spinner from the theme animation, not a hand-authored rule', () => {
  // Upstream's spinner.css is a @theme block only; the animation reaches the SVG as a utility.
  expect(spinnerCss).toContain('@keyframes cladd-spinner-rotate');
  expect(spinnerCss).not.toContain('cladd-spinner__glyph');
  expect(spinnerCss.startsWith('@theme {')).toBe(true);
  expect(spinnerSource).toContain('animate-cladd-spinner');
});
