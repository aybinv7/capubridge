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

Mirror Cladd: ship source plus a stylesheet entry, so consumers compile Tailwind and can override
`@theme` tokens the same way Cladd consumers do. Keep a compiled-CSS artifact as the fallback path for
a consumer without Tailwind.

Note: source shipping also removes the current blocker — `vp pack` cannot parse `.vue` files, so the
package has no `dist` and its `exports` point at files that do not exist. Confirm the chosen
distribution shape before fixing the build, since it decides whether the build must compile SFCs.

## Sequence

1. Toolchain: add `tailwindcss`, `@tailwindcss/vite`, `clsx`, `tailwind-merge`; wire the Vite config;
   port `cn.ts`.
2. Style foundations: convert `tokens.css` to `@theme`, import upstream base layers and custom
   variants verbatim. Verify token parity with a value-lock test.
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
