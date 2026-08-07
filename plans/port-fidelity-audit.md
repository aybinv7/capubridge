# Port-fidelity audit: `@capubridge/ui` against pinned Cladd

> Reviewed 2026-08-03 against `@cladd-ui/react` 0.18.5 at commit
> `fadd8efe935111f31d7c933238db5ce5d3a55d71`, the baseline recorded in `THIRD_PARTY_NOTICES.md`.
>
> Rule of record: port, do not match. Framework-agnostic upstream code is copied by value.
> React-specific upstream code is transposed to Vue with its semantics preserved. Nothing is
> re-designed. Styling follows `tailwind-realignment.md`.

## The three buckets

| Bucket                | Upstream content                                                                        | Required treatment                            |
| --------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| A. Framework-agnostic | `styles/*.css`, `@theme` values, constant tables, DOM node trees, algorithms, selectors | Copy by value, record upstream file and lines |
| B. React runtime      | hooks, context, `cloneElement`, refs, phase machines                                    | Transpose to Vue, preserve semantics exactly  |
| C. Tailwind utilities | utility strings in component source                                                     | Copy verbatim once Tailwind is adopted        |

Bucket C was previously a hand translation with no record. That is the mechanism behind most findings
below and is addressed by `tailwind-realignment.md`.

## Faithful ports, verified

These are correct and must not be disturbed by later work:

- Token layer: radius ladder copied including upstream's `calc(var(--cui-radius) * 12 / 28)` Firefox
  length-division workaround; all eleven accent hex values identical; every `oklch(from …)` and
  `color-mix` formula matches `styles/colors.css` across dark, accent-dark, light, accent-light.
- `Surface`: props map 1:1 to `Surface.tsx`, including `bgClassName`, `overlayPosition`, `wrapContent`,
  `beforeContent`, `as`, `clickable`, `hoverable`, `pressed`, level clamp 1 to 5, and the deepest-press
  rule `:active:not(:has(.cui-surface--clickable:active))`.
- `Button`: props, spinner size map, icon, padding and font maps, radius and height ladders all match
  `Button.tsx` literal for literal. Corrected on 2026-08-03: the earlier claim that the `data-*` set
  matches was wrong — see finding 11.
- `Slider`: `sliderResolution = 1000`, the log-scale `fromSlider` / `toSlider` formulas, and the
  geometric literals in both variant branches are upstream's. Corrected on 2026-08-03: this component
  also carries real deviations — see finding 12.
- The `contextmenu` preventDefault is genuine upstream behavior, present upstream on Button, Chip,
  Input, Checkbox, Radio, Switch, Slider, Segmented, and Toolbar. It is ported on Button but missing on
  Slider (finding 12).
- `FocusRing` geometry: 2px border, `scale(0.95)`, `inset: -6px` matching `-inset-1.5`, 200ms.
- `Spinner`: 1.5s infinite linear rotation.
- CSS anchor positioning is upstream's own technique (`area`, `justifySelf`/`alignSelf`,
  `anchor-size()`), so adopting it was correct. Its Chromium-only support is inherited from upstream,
  not introduced here, and belongs in `docs/architecture.md` as a scope note.

## Findings: matched instead of ported

### 1. `useFocusTrap` re-implemented, dropping upstream fixes

`src/composables/useFocusTrap.ts` against `hooks/use-focus-trap.ts`:

- Focusable selector reduced from upstream's 14 entries to 6. Lost `area[href]`, `[contenteditable="true"]`,
  `audio[controls]`, `video[controls]`, `iframe`, `object`, `embed`, `summary`, and the
  `:not([type="hidden"])` guard on inputs.
- `isVisible()` with `checkVisibility()` reduced to a bare `hidden` attribute filter.
- Lost the `container.setAttribute('tabindex','-1')` fallback when nothing is focusable.
- Lost `!container.contains(activeEl)` re-entry handling on both Tab directions.
- Lost the `container.isConnected` guard.
- Lost the "focus is already inside the container" check before stealing focus.
- Lost `restoreFocus`, `setInitialFocus`, and `initialFocusRef` options.
- Lost `document.contains(previouslyFocused)` before restoring focus. This is the defect recorded as
  H4 in `ui-package-review.md`: upstream had already fixed it.
- The watcher is not `immediate`, so an overlay mounted already open never traps or moves focus.

Remedy: transpose `hooks/use-focus-trap.ts` line for line into a Vue composable, keeping the option
surface and the selector list in `*.contracts.ts`.

### 2. Overlay lifecycle replaced with a CSS transition wrapper

Upstream splits this into `ModalController.tsx` (phase machine: closed, opening, opened, closing;
unmounts only at closed) plus `hooks/use-modal-utils.ts`, 137 lines of bucket-B logic. The package has
`OverlayTransition.vue`, 31 lines wrapping Vue `<Transition>`. Behaviors that do not exist here:

- `transitionend` completion targeted at a specific element, with `checkVisibility()` synthetic
  completion when the element never animates.
- Double `requestAnimationFrame` before the open callback.
- Unmount-while-closing fires `closed` synthetically. Upstream documents the case: a parent overlay
  finishing first removes the child before its own `transitionend` can fire. Phase 4's "exit callbacks
  run after visual completion" depends on this.
- `lazy` opening on the next tick.
- Escape suppression when the next element sibling is a child overlay.
- Drag-out guard: a press starting inside must not dismiss on release outside.

Remedy: port the phase machine and modal utilities as composables. Keep Vue `<Transition>` only as the
CSS trigger, not as the lifecycle contract.

### 3. Popover API re-designed

Upstream public surface: `position` as 13 tokens driven by a `POSITIONS` table of
`{area, justifySelf, alignSelf, origin, offsetProperties, centered}`; `offset` as
`number | string | [main, cross]` where a percentage resolves to `calc(anchor-size(width|height) * f)`;
`viewportMargin`; `anchorRect` for pointer-position menus; `root` portal selector or `false` for inline;
`backdrop` and `backdropTransparent`; a `PopoverRoot` / `PopoverTrigger` / `PopoverClose` compound with
controlled and uncontrolled state; and `openTopLevelPopovers`, which closes unrelated top-level
popovers so chains do not stack.

**Mostly fixed 2026-08-03.** The `POSITIONS` table, `resolveOffset` with `anchor-size()`,
`viewportMargin`, `backdrop` / `backdropTransparent`, `anchorRect`, `root`, per-position transform origin,
and the upstream prop names are ported; the invented `side` / `align` / `sideOffset` / `alignOffset` API
and the never-read `collisionPadding` and `modal` props are gone. `openTopLevelPopovers` is ported as
`popoverChain.ts`: top-level popovers are mutually exclusive, nested popovers register with their parent,
and a closing popover cascades to its registered children. Registration is tied to the live phase, not to
component mount, because upstream's effect lives in the inner component that only exists while open —
registering at mount would let a second, still-closed popover close the open one.

Still open: the `PopoverRoot` / `PopoverTrigger` / `PopoverClose` compound. The single-component form with
a `trigger` slot covers the same ground today; the compound matters for sibling-JSX composition and is a
public-API addition rather than a behavioural gap.

### 4. Textarea DOM diverged — fixed 2026-08-03 by porting

Upstream `Textarea.tsx` is a `contenteditable` element with manually enforced `maxLength`; the package
rendered a native `<textarea>`. Resolved in upstream's favour: the editor is now `contenteditable`, with
the JavaScript `maxlength` clamp plus caret restoration, plain-text paste interception, the internal
text state, the `innerText` sync gated on `updateContentOnChange`, and the separate placeholder layer.
`rows`, `resize`, `name`, `required`, and `autofocus` are gone, because upstream has none of them.

Consequences accepted: the control no longer participates in form submission or reset, and `<label for>`
no longer associates with it, so consumers name it with `aria-labelledby`. The fixture, tests, and
component doc were updated to match rather than papered over. `role="textbox"` and `aria-multiline` are
added and registered, since `contenteditable` carries no implicit textbox semantics.

The rule collision that produced this divergence is fixed at the source: `packages/ui/CLAUDE.md` no
longer says "use native elements first" unconditionally. Upstream decides the DOM.

### 5. `@media (hover: hover)` guard missing

`cladd.css` wraps the surface-hover custom variant in `(hover: hover)` with an explicit comment that
the state must not stick on touch devices. No `hover: hover` exists anywhere in
`packages/ui/src/styles/`. Symptom: hover state sticks after tap, while Phases 2 and 3 claim touch
support.

### 6. `SurfaceColorReset` not ported

Upstream resets the region accent at portal boundaries because React context crosses portals while the
`cladd-color-*` CSS cascade does not. Vue provide/inject crosses `<Teleport>` the same way, and
`Dialog`, `Popover`, and `Tooltip` all teleport. Same defect class, already solved upstream.

### 7. `useComponentDefaults` absent

Every upstream component runs `useComponentDefaults('X', props)` and exports an `XDefaultProps` type so
consumers set global defaults through the provider. `contexts/uiContext.ts` carries only theme and
accent. This is a public design-system API missing from the port, and it is trivially transposable.

### 8. Un-ported framework-agnostic assets

All bucket A or trivially bucket B, none blocked by React:

- `shared/color.ts` (402 lines of color math). `shared/next-tick.ts` turned out to be a double
  `requestAnimationFrame`, which the ported overlay lifecycle already implements exactly.
- `hooks/use-device.ts`, `hooks/use-overlays-root.ts`, `hooks/use-dialog.ts`.
- ~~`styles/safe-areas.css` (220 lines).~~ **Partially ported 2026-08-03**: the custom-property half is in
  `src/styles/safe-areas.css` and imported. Its 28 `@utility` blocks are Tailwind v4 custom utilities and
  cannot land before the styling realignment, so they are deferred there rather than half-translated.
- 14 `--radius-cladd-wrap-*` and `wrap-full-*` tokens, required by `NumberField` and `Toolbar`.
- `--spacing-cladd-3xs: 12px` and its nested variant; `--radius-cladd-popup`.
- `hover-fill` in the light-neutral block.
- The four primary-tune knobs (`dark`/`light` primary lightness and chroma) were inlined as the
  literals `0.95` and `0.18`, removing a retuning point upstream exposes deliberately.
- `--shadow-cladd-popover` (`styles/colors.css:30`, `0 24px 64px -12px rgb(0 0 0 / 0.5)`) is not ported.
  `styles/overlays.css` uses invented shadow values for both popover and tooltip instead.
- ~~The `--cladd-surface-original-mix` and `--highlight-original-mix` consumer override hooks
  (`styles/colors.css:377, 385, 391, 397, 420`) are lost.~~ **Fixed 2026-08-03**: all five sites now read
  `var(--cui-surface-original-mix, 100%)` or `var(--cui-highlight-original-mix, 100%)`, so consumers can
  retune the surface-cut, foreground-soft ladder, and highlight mixes as upstream allows.

### 10. Hover variant omits upstream's self-pressed exclusion

Upstream's surface-hover variant excludes the self-pressed state with
`:not(.cladd-clickable:active:not(:has(.cladd-clickable:active)))` (`cladd.css:13-15`). The port omits
that clause and relies on later equal-specificity press rules winning by source order. Rendered output
matches today, so this is a registered deviation rather than a defect, but it is fragile under any
reordering of `surfaces.css`.

### 9. `Select` ported against components that do not exist

Upstream `Select.tsx` composes `List`, `ListButton`, `SearchField`, `SectionTitle`, `Checkbox`, `Radio`,
`Popover`, `DropdownIcon`, and `useDevice`. Because Phase 5 has not landed, the port inlines that markup
into one 456-line file. This is why `Select` shipped out of phase order, and it must be re-cut onto the
Phase 5 primitives when they arrive or it will diverge permanently.

### 11. Button divergences found while writing its port manifest

Verified against `Button.tsx`. The first three are **fixed 2026-08-03** and locked by tests in
`tests/actions.test.ts`:

- ~~`data-pressed` (`Button.tsx:190`) is not emitted.~~ Now emitted.
- ~~`data-cui-explicit-accent` replaces upstream's `color !== 'neutral'` condition, so `color="neutral"`
  on a non-fill variant renders a different label color.~~ The hook is now scoped to non-neutral explicit
  accents, matching `Button.tsx:194-197`. The fill case already resolved correctly through
  `.cui-surface--fill`, which sets `--cui-on-primary` for any fill variant as upstream does.
- ~~`contextmenu` preventDefault moved from capture phase to bubble phase.~~ Back on the capture phase.
- `surfaceLevel` and `variant` are withheld from `SurfaceCut`, where upstream forwards them through
  `...rest`. Upstream leaks them to the DOM, since `SurfaceCut.tsx` declares neither, so the port's
  behavior is arguably better — register it as a deviation either way.
- Three `data-*` attributes exist that upstream does not emit.
- `useComponentDefaults` absent, as everywhere else (finding 7).

### 12. Slider divergences found while writing its port manifest

Verified against `Slider.tsx` and `styles/slider.css`:

- ~~The `contextmenu` preventDefault (`Slider.tsx:274`) is missing entirely.~~ **Fixed 2026-08-03**, on
  the capture phase as upstream.
- ~~The `input` prop default is flipped from upstream `false` to `true`.~~ **Fixed 2026-08-03**; default
  is `false`, matching `Slider.tsx:148`.
- `role="slider"` and `aria-valuemin` / `aria-valuemax` / `aria-valuenow` were added; upstream has no
  ARIA on this component, relying on the native range input. **Reverted on 2026-08-03** to match
  upstream. The genuine defect underneath — consumer labelling attributes landing on the wrapper `div`
  instead of the control, so the slider had no accessible name — is fixed separately by forwarding
  `aria-label`, `aria-labelledby`, and `aria-describedby` to the input. See `ui-package-review.md` R4.
- `step` now always rounds and clamps; `progress` is clamped; `log` silently falls back to linear when
  `min <= 0` instead of failing.
- `disabled` dims the whole root instead of only the range and handle.
- The `rangeFill && progress > 0.5` handle recolour is absent.
- Vue-only `name`, `accent`, `update:value`, and arrow-key handling, which diverges from the scale
  mapping under `log`.
- The native input is absolutely positioned at `opacity: 0` instead of upstream's in-flow input, with
  two conflicting `touch-action` declarations.
- Roughly 90 lines of orphan CSS (`.cui-slider__thumb`, `.cui-slider__thumb-line`, `--cui-slider-value`,
  `[data-orientation]`) with no upstream counterpart and no consumer in the SFC.

This is the clearest evidence for process fix 2: the component the audit initially called faithful had
eleven unrecorded divergences, and they only surfaced when someone filled in a manifest line by line.

## Process fixes

1. **Vendor the reference.** It currently exists only at `/tmp/capubridge-cladd-reference-fadd8e`, which
   no other machine, agent, or CI job can reach. Pin a checkout inside the repo and point
   `packages/ui/CLAUDE.md` at the path. This is the root cause: "port from pinned source" with the
   source in a temp directory degrades into porting from memory.
2. **Per-component port manifest**: `docs/port/<Component>.md` with upstream path and commit, and a
   prop-by-prop table marked ported, transposed, or deviated with a reason, plus every literal value and
   its upstream line. `THIRD_PARTY_NOTICES.md` lists 25 files and zero mappings, so nothing is
   diff-checkable today.
3. **Bucket-A extraction rule**: constant tables are copied into `*.contracts.ts` and never retyped
   inline. `POSITIONS`, `buttonIconSizes`, the focusable selector list, the spinner size map,
   `SLIDER_RESOLUTION`. A table that exists upstream but not in `*.contracts.ts` is the review flag.
4. **Bucket-B transposition table**, written once and followed: `useEffect` to `watch`, `watchEffect`,
   `onMounted`, `onUnmounted`; `RefObject` to `shallowRef`; `createContext` to a typed `InjectionKey`;
   `cloneElement` to slot plus `cloneVNode`, reusing `VNodeRenderer.ts`; phase machine to the same phase
   machine, never substituted by Vue `<Transition>`.
5. **Value-lock tests as a genre.** `tests/actions.test.ts` already does this. Extend it to the overlay
   position table, the focusable selector, and copied geometry, so a re-derivation fails a test rather
   than passing review.
6. **Deviation register.** Every intentional divergence gets one line with a reason: Textarea DOM, any
   API rename, the escape-nesting mechanism. Anything divergent and unregistered is a defect, not a
   choice.
7. **Reword the parity gate** in `vue-ui-package.md` from "match upstream duration, easing, transform
   origin" to "copied from `<file>:<lines>` at `fadd8ef`". A gate phrased as _match_ invites eyeballing;
   a gate phrased as _copied from_ is checkable with a diff.

## Remediation order

1. Vendor the reference and add the port manifest template. Nothing else is verifiable without it.
2. Port `use-focus-trap` and the modal phase machine. These carry live defects.
3. Copy the `POSITIONS` table, adopt upstream Popover props, delete the dead props.
4. Add the `(hover: hover)` guard, `SurfaceColorReset`, and `useComponentDefaults`.
5. Copy the missing tokens and CSS files; restore the primary-tune knobs as variables.
6. Resolve the Textarea deviation.
7. Re-cut `Select` onto Phase 5 primitives when they land.
