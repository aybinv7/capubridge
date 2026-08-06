# `@capubridge/ui` Tailwind port — handoff status

> Read this first if you're picking up the Cladd → Vue Tailwind port cold. The governing rule,
> repeated by the project owner throughout: **port, don't match.** Copy the pinned Cladd
> (`reference/cladd/`, commit `fadd8efe935111f31d7c933238db5ce5d3a55d71`) utility strings, DOM
> structure, and class names by value — rename `cladd-*` → `cui-*` — and delete the old hand-authored
> CSS rule in the _same_ change. Never re-derive or "improve" a value; if it looks awkward, that's
> upstream's awkwardness too. See `plans/tailwind-realignment.md` for the full decision record and the
> two traps below.

## Where things stand (2026-08-06)

| Family                                  | State                  | Evidence                                                                                                                                        |
| --------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface / SurfaceCut                    | **Done**               | `surfaces.css` 170→31 lines; class-merge bug fixed (`318d25e`)                                                                                  |
| Button, FocusRing, Spinner              | **Done**               | utility strings via contracts files                                                                                                             |
| Chip, Shortcut (data-display)           | **Done**               | `chip.contracts.ts`, `shortcut.contracts.ts`                                                                                                    |
| Checkbox                                | **Done**               | `806364e`; hidden-input visibility bug fixed by the Surface class-merge fix                                                                     |
| Input, Textarea                         | **Done**               | `3c9065f`; `FieldMessage.vue` deleted (not in Cladd)                                                                                            |
| Radio, Switch, RadioGroup               | **Done**               | `c87eeeb`                                                                                                                                       |
| Slider (both variants)                  | **Done**               | `7eea471`; `forms.css` now 18 lines (just the WebKit range-thumb reset, which Cladd itself hand-authors)                                        |
| **Overlays** (Popover, Tooltip, Dialog) | **Not started**        | `overlays.css` — 207 lines, still hand-authored                                                                                                 |
| **Select**                              | **Not started**        | `select.css` — 156 lines, still hand-authored; also finding 9 below                                                                             |
| `controls.css`                          | Leftover, low priority | 5 lines: `.cui-spinner__glyph { display: block }` — still referenced by `Spinner.vue`, not proven to be upstream-authored, not yet investigated |

`forms.css` is effectively finished — do not add rules back to it. `controls.css`, `overlays.css`,
`select.css` are what's left of the pre-Tailwind hand-authored CSS.

## Immediate next task: Overlays family

Port `Popover.vue`, `Tooltip.vue`, `Dialog.vue` (and their shared `overlay.contracts.ts`) onto Cladd's
utility strings, same pattern as every family above:

1. Read the matching upstream source in `reference/cladd/src/components/` (`Popover.tsx`, `Tooltip.tsx`,
   `Dialog.tsx`, `Popup.tsx`, `PopupContent.tsx`, `ModalController.tsx`, `Backdrop.tsx`).
2. Build/extend `overlay.contracts.ts` with any literal maps needed (position offsets already exist
   there — verify against upstream's 13-token `POSITIONS`).
3. Rewrite each `.vue` component's classes as `cn()` calls with copied utility strings.
4. Delete the matching rule from `overlays.css` in the **same commit** — leaving both is not a safe
   intermediate state (see trap 1 below).
5. Run `vp run ui#test` and `vp run ui#check --fix` until green.
6. Visually verify in the running playground (`vp run ui-playground#dev`, port 5174) — computed styles
   before/after, not just a screenshot.

Then Select, which is also **finding 9** from the port-fidelity audit (`plans/port-fidelity-audit.md`):
the Vue `Select` needs re-cutting onto the Phase 5 primitives (Popover/FocusTrap) rather than its
current bespoke implementation, in addition to the Tailwind conversion.

## Two traps that will cost you a debugging cycle

1. **CSS layer order beats specificity.** Our `@layer cui.components` is declared after Tailwind's
   layers, so any surviving old CSS rule silently wins over a newly-ported utility class — no
   specificity conflict, no warning. You must delete the old declaration in the _same_ change that adds
   the new utility string. A DOM class-list check will not catch this; only computed style will.
2. **Surface / SurfaceCut class merging.** Fixed in `318d25e`, but worth knowing why: binding a
   component's own class list and the consumer's `class` attribute as two separate things (Vue's
   default attr-fallthrough) means `cn()`/tailwind-merge never sees them together, so ordering in the
   compiled stylesheet decides the winner instead of the merge logic. This silently broke absolute
   positioning on Checkbox/Radio thumbs and the Switch track (they fell back to `position: relative`,
   collapsing the check glyph to 0 width). Any _new_ component that hands a positioning utility to
   `Surface`/`SurfaceCut` via `class` should be spot-checked with computed styles, not just visually.

## Also still open (lower priority, not urgent)

- Finding 7 from the port-fidelity audit: `useComponentDefaults` (Cladd's per-component default-props
  hook via `CladdProvider`) has no Vue equivalent yet. Bundle with a future pass, not blocking.
- `shared/color.ts`, `use-device`, `use-dialog`, `use-overlays-root` — unported upstream hooks/utilities,
  only needed once a consumer requires them.
- `PopoverRoot` / `PopoverTrigger` / `PopoverClose` compound-component API — upstream has it, our
  `Popover.vue` is currently a single component. Decide during the overlays pass whether to split.

## Verification checklist for every remaining family

- [ ] `vp run ui#test` — all green, no skipped assertions
- [ ] `vp run ui#check --fix` — no lint/format/type errors
- [ ] `vp run ui-playground#check` — playground still typechecks against the public export
- [ ] Live check in the playground (port 5174): computed `position`, `width`/`height`, and color values
      before vs. after, not just "looks right" in a screenshot
- [ ] Old CSS rule deleted from the relevant `styles/*.css` file in the same commit
- [ ] Upstream file + line cited in the commit message
