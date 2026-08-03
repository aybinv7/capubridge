# Review: `@capubridge/ui` and `apps/ui-playground`

> Reviewed 2026-08-03 against `plans/vue-ui-package.md` and `packages/ui/CLAUDE.md`.
> Port-fidelity findings live in `port-fidelity-audit.md`. Styling decision lives in
> `tailwind-realignment.md`.

## Verification performed

| Command           | Result                                                            |
| ----------------- | ----------------------------------------------------------------- |
| `vp run ui#test`  | pass, 41 tests across 5 files                                     |
| `vp run ui#check` | pass, 76 files formatted, 52 files without lint or type errors    |
| `vp run ui#build` | **fail**, parse error on `src/components/surface/Surface.vue:1:1` |

Everything else below is source reading, not executed evidence.

## Blocker

### B1. The package cannot be built or published

`vp pack` is tsdown and rolldown; it does not consume the root-level `plugins: [vue()]` in
`packages/ui/vite.config.ts`, so SFCs reach rolldown unhandled. Moving the plugin into `pack.plugins`
fails differently, because `@vitejs/plugin-vue` is a Vite plugin and is not rolldown-compatible.

Consequences:

- No `dist`, so `exports["."].types` (`./dist/index.d.mts`) and `import` (`./dist/index.mjs`) both
  dangle. Only the workspace `source` condition resolves, which is why the playground works and an
  external consumer cannot install the package.
- `prepublishOnly` fails. Phase 8's published-artifact and tree-shaking criteria are unreachable, as is
  Phase 1's "Vue is absent from bundled output".

Fix depends on the distribution decision in `tailwind-realignment.md`. Mirroring Cladd by shipping
source removes the SFC build entirely. Otherwise use a rolldown-compatible Vue plugin in `pack.plugins`,
then verify externalized Vue and tree shaking.

Related: `./styles.css` exports `./src/styles/index.css`, raw source shipped through `files`, so
published CSS bypasses the build and consumers pay seven chained `@import`s. Decide deliberately.

## High

### H1. Overlay positioning is Chromium-only

`useAnchorPosition.ts` is built on `position-anchor`, `position-area`, and `position-try-fallbacks` with
no fallback or feature detection. This is upstream's own technique, so it is a faithful port, but the
constraint is undocumented and no test can support Phase 4's viewport-boundary claim, since happy-dom
computes no layout. Record the browser scope in `docs/architecture.md` or add a fallback.

### H2. Dead public props

`modal` on `Dialog.vue` is never read; `aria-modal="true"` is hard-coded. `modal` and `collisionPadding`
on `Popover.vue` are never read. Exported props are API; these promise focus and scroll-locking behavior
that does not exist.

### H3. Dialog is not native

The plan says deliver a native `Dialog`. The implementation is `div[role=dialog]` plus a hand-rolled
backdrop: no `<dialog>`, no top layer, no `inert` or `aria-hidden` on the background, no scroll lock.
Tab is trapped by keydown, but an assistive-technology virtual cursor still walks the background and the
page scrolls behind the modal. Stacking depends on z-index rather than the top layer.

### H4. Focus trap defects

Two concrete failures, both fixed upstream and lost in the port (see `port-fidelity-audit.md`, finding 1):
the watcher is not `immediate`, so an overlay mounted already open never traps or moves focus; and
`previousFocus.value?.focus()` runs without checking the node is still connected, so focus silently drops
to `<body>` when the trigger has unmounted.

### H5. Popover and Tooltip have no keyboard or ARIA contract

The trigger is `<span class="cui-overlay-trigger" @click>`: no `aria-expanded`, `aria-controls`,
`aria-haspopup`, or `role`; no focus move into the content; no focus return on close; no Enter or Space
handling of its own. Keyboard access exists only when the consumer slots a real `button`. This
contradicts "support keyboard, pointer, and touch interaction from first implementation".

## Medium

### M1. Plan checkboxes ahead of evidence

`packages/ui/CLAUDE.md` requires updating plan checkboxes only with evidence. Corrected in
`vue-ui-package.md` as part of this review. Specifics:

- Phase 3 consumer fixture for form submission and reset: no forms fixture exists. `fixtures/` holds
  actions, overlays, and surfaces only, and no test covers reset.
- Phase 4 focus restoration: defective, see H4.
- Phase 4 transform origin: the port emits no per-position transform origin; upstream does.
- Phases 2, 3, 4 reduced motion: implemented only as a token collapse in `motion.css` plus two media
  queries. No test asserts reduced-motion behavior, which the package's own testing rules require.
- Phase 4 no orphan portals, listeners, or timers after unmount: no unmount-leak test exists.

### M2. `Select` shipped out of phase order

`Select` is Phase 5 material, exported, and the largest file in the package, while Phase 5 is marked not
started and every sibling primitive is missing. The playground hand-rolls `PlaygroundSegmented` and
`PlaygroundSwitchControl` out of `Button`, which is direct evidence that the dense-navigation family is
what the next real consumer needs.

### M3. No in-product consumer

Phase 7 exists so the surface and motion language is tested against a real dense workflow.
`apps/desktop` has no `@capubridge/ui` dependency and zero imports. The design language is currently
validated only against a catalog built to flatter it.

### M4. Documentation is half-wired

Nineteen exported components, nine files in `docs/components/`. Undocumented: `Surface`, `SurfaceCut`,
`UiProvider`, `Input`, `Textarea`, `Dialog`, `Popover`, `Tooltip`, `OverlayTransition`. Nothing in
`apps/docs` references the package, so there is no published documentation path. The playground's
`component-docs.ts` duplicates prop tables in TypeScript, a second source of truth that will drift.

### M5. Root `CLAUDE.md` describes the package wrongly

It calls `packages/ui` a "Reusable Vue and Reka UI component library". Reka UI is a hard-prohibited
dependency of this package. The line will mislead every agent that reads the root file first.

## Found during remediation

### R1. Input clear control had no accessible name — fixed

`Input.vue` passed `:label="props.clearLabel"` to `Button`, which has no `label` prop, so it fell through
`$attrs` and rendered as a bare `label="Clear"` HTML attribute. Upstream `Input.tsx:425` sets
`aria-label`. The clear control was unnamed for assistive technology. Now `:aria-label`.

### R2. Input clear control was active while read-only — fixed

Rendering was gated on `clearable` alone, so a read-only field exposed a working clear button that
mutated the model; `disabled` was only inert because CSS removed pointer events. Upstream
`Input.tsx:415` gates on `clearButton && !disabled && !readOnly`. Now gated the same way.

Neither behavior was covered by a test or exercised in the playground. Add a value-lock test for the
clear control's accessible name and its disabled and read-only suppression.

### R3. Textarea desynchronised permanently on native form reset — fixed

`Textarea.vue:136` renders `:value="model"`. Vue mirrors that into a `value` content attribute, which is
meaningless on `<textarea>` — the platform's default value is the element's child text content — and no
`reset` listener exists. Measured by the new fixture tests: after `form.reset()` the element value and
the submitted `FormData` entry are both empty while the component model still holds its text, and
nothing re-renders, so every later submission sends the empty string.

This was a consequence of the registered Textarea deviation (native `<textarea>` where upstream uses
`contenteditable`), not of upstream. Fixed by keeping the element's `defaultValue` in sync with the
model, so a native reset restores the bound model — the same semantics the other control families get
from Vue's attribute mirroring. Locked by `restores textarea content from a native form reset`.

### R4. Slider had no accessible name — fixed

The root was a plain `div` and `$attrs` landed there, so `aria-label` and `aria-labelledby` never reached
the input. The pre-existing assertion at `forms.test.ts:246` passed `aria-label` to the wrapper and
therefore looked like it labelled the slider without doing so.

Fixed by splitting attribute forwarding: `aria-label`, `aria-labelledby`, and `aria-describedby` are
bound to the native range input, everything else stays on the root. This also resolves the ARIA half of
`port-fidelity-audit.md` finding 12 by reverting to upstream — the added `role="slider"` and
`aria-valuemin` / `aria-valuemax` / `aria-valuenow` are removed, since a native range input carries those
semantics implicitly and upstream sets none. Accessibility improves rather than regresses: the control
now has a real name, which the added ARIA never gave it.

A narrower forwarding rule than `Input` and `Textarea` use is deliberate here. Those forward all
attributes to their inner control; `Slider`'s root is a composed visual assembly whose `class` and
`data-*` hooks belong on the root, and relocating them broke three existing selectors when tried.

### R5. Two reported defects are upstream-faithful — no code change

Both were reported as defects and both are verified as matching the pinned baseline. They are recorded
here so nobody "fixes" them into a divergence later:

- **Radio uses a hidden `type="checkbox"` input.** Upstream does the same (`Radio.tsx:173`). The
  consequences are real — exclusivity, roving focus, group `required` validation and radio-group reset
  semantics all rest on component state rather than the platform — but changing it is an improvement
  beyond upstream and needs a registered deviation, not a bug fix.
- **Select is not form-associated.** Upstream `Select.tsx` has no `name` prop and renders no `<select>`
  and no hidden input; it is a button plus popover. The port matches. What was wrong is the Phase 3
  plan criterion that implied Select participates in form submission; that wording is corrected in
  `vue-ui-package.md`.

Still to verify: whether the absence of an `aria-describedby` hook on Checkbox, Radio, Switch, and
Slider also matches upstream. Treat as unknown until checked against `reference/cladd/`.

### R6. Dead style hook in Textarea — open, deliberately not fixed

`Textarea.vue` renders its prefix and suffix as `cui-input__affix` while `forms.css` also defines
`.cui-textarea__affix`, which no markup emits. Left alone because the semantic CSS layer is scheduled
for replacement under `tailwind-realignment.md`; fixing it now is throwaway work. Resolve during that
rework.

## Low

- `styles/index.css` declares `@layer cui.tokens, cui.motion, cui.components, cui.utilities;` after the
  imports, so real layer order comes from import order and the statement is decorative. Move it above the
  imports.
- `forms.css` is 902 lines, past the repository's 800-line boundary in
  `apps/docs/architecture/source-size-governance.md`. CSS is not scanned, so it escapes governance the
  project wrote. Split it or extend the checker.
- `Dialog` imports `Input` and `Button` internally for `requireConfirmText`, baking confirmation UX into
  the overlay contract. Keep or move to a slot, deliberately.
- The package and playground are one uncommitted staged change of 121 files, against a plan that asks for
  phase-sized, feature-focused commits. Commit before the styling rework begins.

## Suggested order

1. B1, so an external consumer can resolve the package at all.
2. H2, H4, H5 — small, high-leverage, and the substance of the Phase 4 claims.
3. H1 and H3 — record the browser scope; decide native `<dialog>` or registered deviation.
4. M1 is done; keep it true by adding the three missing tests and the forms fixture.
5. Then Phase 5 dense navigation, then the desktop pilot, then the documentation gap.
