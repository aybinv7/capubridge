# Decision: `@capubridge/ui` adopts Tailwind v4, mirroring Cladd

> Rule of record: the package mirrors the pinned Cladd baseline. Where Cladd is framework-agnostic, the
> package copies. Where Cladd is React-specific, the package transposes to Vue. Nothing is re-designed.

## Evidence

Cladd at the pinned baseline `fadd8efe935111f31d7c933238db5ce5d3a55d71` (`@cladd-ui/react` 0.18.5) is a
Tailwind v4 kit:

- `package.json`: `tailwindcss ^4.2.2`, `@tailwindcss/vite ^4.2.2`.
- `packages/cladd/package.json`: `clsx` and `tailwind-merge` as runtime dependencies.
- `src/shared/cn.ts`: `clsx` + `tailwind-merge` wrapper, called by every component.
- `src/styles/*.css`: Tailwind v4 `@theme` blocks. `src/cladd.css`: `@source`, `@custom-variant`, `@import`.
- Component source styles with utility strings (`px-2.5`, `aspect-square`, `-inset-1.5`, `scale-95`).
- `src/package.json` exports `"./css": "./cladd.css"`; `scripts/build.mjs` ships source, so a Cladd
  consumer runs Tailwind.

## Decision

The prohibition on Tailwind is removed. The package uses Tailwind v4 with `clsx` and `tailwind-merge`,
so upstream styling is copied rather than translated.

Still prohibited, for unchanged reasons: React, React DOM, Reka UI, shadcn-vue, Radix Vue (competing
behavior runtimes), Pinia, Tauri, application packages, cross-workspace imports.

Superseded: the "Consumers do not need Tailwind" styling boundary. That sentence was the only recorded
rationale for the ban, was never an ADR, and converted a copy job into an unrecorded hand translation —
the mechanism behind the port divergences listed in the port-fidelity review.

## Naming and namespace

- Component class hooks: `cladd-*` → `cui-*` (`cladd-button` → `cui-button`, `group/cladd-button` →
  `group/cui-button`). Never ship Cladd branding.
- Theme tokens: `--cladd-*` / `--*-cladd-*` → `--cui-*`, keeping upstream values and formulas exactly.
  `src/styles/tokens.css` already mirrors those values and becomes the `@theme` source.
- Utility prefix: adopt `@import "tailwindcss" prefix(cui)` only if a consumer collision is observed.
  Default to no prefix, matching upstream.
- `data-*` for runtime state, class names for static variants — upstream convention, keep it.

## What is copied, kept, discarded

**Copied verbatim (values and structure), with upstream file and line recorded per change**

- `styles/colors.css`, `radius.css`, `spacing.css`, `font-size.css`, `spinner.css`, `slider.css`,
  `input.css`, `safe-areas.css` as `@theme` and base layers.
- `cladd.css` custom variants, including the `@media (hover: hover)` guard currently missing.
- Component utility strings, per component, from the pinned TSX.
- Constant tables into `*.contracts.ts`: `POSITIONS`, `buttonIconSizes`, focusable selector list,
  spinner size map, `SLIDER_RESOLUTION`.
- `shared/cn.ts` → `src/shared/cn.ts` (framework-agnostic).
- `shared/color.ts`, `shared/next-tick.ts` when their consumers land.

**Kept from current work**

- `foundations/contracts.ts`, `surfaceLevel.ts`, surface and UI context, and the Vue component DOM
  trees and props that already match upstream (Surface, Button, Slider, FocusRing geometry, Spinner).
- All existing tests; they become value locks against the copied literals.

**Discarded**

- Hand-authored component CSS: `controls.css`, `forms.css`, `overlays.css`, `select.css`,
  `surfaces.css` (about 2,100 lines) — replaced by ported utility strings plus upstream base layers.
- `tokens.css` survives as content, converted to `@theme` form.

## Distribution

**Decided 2026-08-03: mirror Cladd.** The package ships source plus a stylesheet entry, so consumers
compile it and can override `@theme` tokens exactly as Cladd consumers do. Implemented in
`packages/ui/package.json`: `exports["."]` resolves to `src/index.ts`, `files` ships `src`, and the
`vp pack` scripts and `pack` config are removed. See `ui-package-review.md` B1 for the evidence.

Consequence for the Tailwind work: utility strings copied from upstream reach the consumer's Tailwind
build, which is upstream's own model, so no compiled-CSS artifact is required. A consumer without
Tailwind is out of scope for the same reason it is out of scope upstream.

## Sequence

1. **Done 2026-08-03.** Toolchain: `clsx` and `tailwind-merge` as runtime dependencies and
   `tailwindcss` / `@tailwindcss/vite` as dev dependencies, all from the existing catalog pins;
   `src/shared/cn.ts` ported from `reference/cladd/src/shared/cn.ts` with its `safe-*` class groups and
   the size, text, and radius theme scales renamed to `cui-`; `@source "../"` plus the
   `cui-surface-hover` and `cui-surface-press` custom variants added to `src/styles/index.css`, mirroring
   `cladd.css`.

   Consumer wiring matters and is easy to get wrong: Tailwind must own the whole CSS chain from one
   entry. Importing `tailwindcss` and the package stylesheet as two separate JS imports silently dropped
   the package CSS (69 kB to 18 kB) and leaked `@source` / `@custom-variant` into the built output. The
   working shape, which is what upstream's own playground does, is a single CSS entry:

   ```css
   @import "tailwindcss";
   @import "@capubridge/ui/styles.css";
   ```

   Verified: playground CSS 88.5 kB with zero leaked at-rules, tokens resolving live in the browser
   (`--cui-size-md: 28px`, the radius `calc()` intact), and no console errors.

2. **Done 2026-08-03.** Style foundations: `tokens.css` now opens with an `@theme` block exposing the
   upstream-shaped token names — `--spacing-cui-*` including the nested and thumb scales, the full
   `--radius-cui-*` ladder with `full`, `wrap`, `wrap-full`, `focus`, `focus-full` and the overlay radii,
   `--text-cui-*`, `--color-cui-*`, `--shadow-cui-*`, and `--animate-cui-spinner`.

   Each entry references the existing `--cui-*` custom property rather than restating a literal, so the
   plain-CSS token block stays the single source of values and no number is duplicated. The `@theme`
   block sits above the `@layer cui.tokens` wrapper, since Tailwind requires it at top level.

   This makes upstream utility strings copyable with only the `cladd` → `cui` rename. Verified by
   probing a real build: `h-cui-md`, `rounded-cui-focus-md`, `text-cui-xs`, and `bg-cui-surface` all
   generate and resolve to the right theme variables. Locked by a value-lock test over the `@theme`
   block.

3. Per family, in current phase order (surfaces, actions, data display, feedback, forms, overlays):
   replace the semantic CSS with the upstream utility strings, one family per change, tests green
   after each. Record a port manifest entry per component.
4. Resolve the two open deviations explicitly: Textarea (`contenteditable` upstream vs native
   `textarea` here) and the Popover position API (`position` token table upstream vs `side`/`align`
   here). Port unless a deviation is registered with a reason.
5. Re-audit the port-fidelity findings that Tailwind adoption does not fix: focus trap, overlay phase
   machine, `SurfaceColorReset`, `useComponentDefaults`.
6. Then continue to Phase 5 dense navigation, which is where the remaining styling volume lands.

## Risks

- Reworking styling across 19 components while the package has no committed history and 121 staged
  files. Commit the current state first so the rework is reviewable.
- Consumers that compile the package source must handle `.vue` and Tailwind in `node_modules`.
- Pinned to Tailwind v4 specifically, since upstream `@theme` and `@custom-variant` are v4 syntax.
- Some of the discarded CSS encodes behavior that upstream expresses in utilities plus variants;
  removing it without the matching utility string in place will regress geometry. One family per
  change, with value-lock tests, is the control.

## Step 3 progress: Surface converted 2026-08-03

`Surface.vue` now composes upstream's utility strings through `cn()` for its root, background, overlay,
and content layers, copied from `reference/cladd/src/components/Surface.tsx:182`-`263` and
`SurfaceContent.tsx` with `cladd` renamed to `cui`. `surfaces.css` dropped from 170 to about 110 lines;
the surface-only visual rules (variant backgrounds, gradients, fill text colour, outline shadows, hover
and press overlays) are gone, and the `cui-surface-cut` half stays until `SurfaceCut` is converted.

Verified against a computed-style baseline captured in the running playground before the change: radii
`3.42857px` and `4.57143px`, content padding, display, position, z-indices, and the outline shadow
`oklab(1 0 0 / 0.08) 1px 1px 0px 0px inset, oklab(1 0 0 / 0.07) -1px -1px 0px 0px inset` all identical
after. 75 tests pass.

### Two traps for the remaining families

1. **Layer order beats specificity, and our custom layer outranks Tailwind utilities.** Our CSS lives in
   `@layer cui.components`, declared after Tailwind's layers because the consumer imports `tailwindcss`
   first. So any surviving declaration in our CSS silently wins over the ported utility, with no
   specificity conflict to notice. This bit the fill text colour: a shared structural rule still set
   `color: var(--cui-foreground)` on `.cui-surface`, so `text-cui-on-primary` had no effect even though
   the class was applied and the variable resolved. Upstream avoids this entirely by putting its CSS in
   Tailwind's own `base` layer, never a custom layer that outranks utilities.

   Consequence: for every family, the old declaration must be **removed** in the same change that adds
   the utility. Leaving both is not a safe intermediate state. A DOM-level assertion cannot catch it —
   only computed style can.

2. **`@custom-variant` shorthand does not survive the formatter.** `@custom-variant name (&:where(…));`
   is reformatted across lines by oxfmt, and Tailwind then fails with `CssSyntaxError: Missing opening (`.
   Use the block form with `@slot`, which is formatter-stable.

Also worth recording: a paren-blind comma split corrupted `surfaces.css` selectors containing
`:not(:has(…))` during the first strip attempt, producing an eight-paren imbalance that surfaced only as
the same opaque Tailwind syntax error. Selector rewriting must track parenthesis depth.
