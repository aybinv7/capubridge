# `@capubridge/ui` Tailwind port — handoff status

> Read this first if you're picking up the Cladd → Vue Tailwind port cold. The governing rule,
> repeated by the project owner throughout: **port, don't match.** Copy the pinned Cladd
> (`reference/cladd/`, commit `fadd8efe935111f31d7c933238db5ce5d3a55d71`) utility strings, DOM
> structure, and class names by value — rename `cladd-*` → `cui-*` — and delete the old hand-authored
> CSS rule in the _same_ change. Never re-derive or "improve" a value; if it looks awkward, that's
> upstream's awkwardness too. The validation is **comparison against the Cladd source**, not a visual
> check. See `plans/tailwind-realignment.md` for the full decision record and the two traps below.
>
> Jump to **Remaining work, in the order I'd take it** for what's left. Everything above that section
> describes what's already ported and, more usefully, the inventions that had to be undone — read the
> one for the area you're touching before you touch it.

## Where things stand (2026-08-08)

| Family                              | State    | Evidence                                                                                                             |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| Surface / SurfaceCut                | **Done** | upstream class list exactly; no data attributes; `surfaces.css` deleted                                              |
| Button, FocusRing, Spinner          | **Done** | utility strings via contracts files                                                                                  |
| Chip, Shortcut (data-display)       | **Done** | `chip.contracts.ts`, `shortcut.contracts.ts`                                                                         |
| Checkbox                            | **Done** | `806364e`; hidden-input visibility bug fixed by the Surface class-merge fix                                          |
| Input, Textarea                     | **Done** | `3c9065f`; `FieldMessage.vue` deleted (not in Cladd)                                                                 |
| Radio, Switch, RadioGroup           | **Done** | `c87eeeb`                                                                                                            |
| Slider (both variants)              | **Done** | `7eea471`; the WebKit range-thumb reset lives in `slider.css`, as upstream hand-authors it                           |
| Overlays (Popover, Tooltip, Dialog) | **Done** | `overlays.css` deleted (207→0); `Backdrop.vue` added; DOM re-cut to upstream's shape                                 |
| Select                              | **Done** | `select.css` deleted (159→0); re-cut onto `List`/`ListButton`; `SearchField` + `SectionTitle` ported                 |
| Popup, PopupContent                 | **Done** | full layer/wrapper/card, stacked-popup transforms, `inert`, drag-aware backdrop dismissal                            |
| Tooltip / TooltipPrimitive          | **Done** | split as upstream has it; shared global tooltip timer ported                                                         |
| List family, SearchField            | **Done** | `List`, `ListItem`, `ListButton`, `ListTitle`, `ListSeparator`, `SectionTitle`, `SearchField`                        |
| Theme layer / provider              | **Done** | `tokens.css` → upstream's `colors`/`radius`/`spacing`/`font-size`/`spinner` split; provider renders no DOM           |
| Toast + dialog/toast portals        | **Done** | `Toast`, `ToastRoot`/`Trigger`/`Close`, both portals, `useDialog`, `useToast`                                        |
| Stylesheets                         | **Done** | only upstream's files remain: `colors`, `radius`, `spacing`, `font-size`, `safe-areas`, `spinner`, `slider`, `input` |

## The theme layer: `UiProvider` renders no DOM element

This was the deepest invention in the port and it caused two real bugs (light mode not reaching the
page, the accent not acting as a global tone). **Upstream's `CladdProvider` renders nothing** — it is
`ThemeProvider` (pure context) wrapping the children. The cascade classes live on the **app's own root
element**, exactly like:

```html
<html class="dark cui-color-brand"></html>
```

Our version rendered a `<div class="cui-theme cui-accent-*" data-cui-theme="…">` and keyed every token
block off it, so `:root`, `<html>` and `<body>` kept the dark neutral defaults forever and anything
teleported to `body` escaped the accent entirely.

What the port changed:

- `tokens.css` is gone. Upstream's split is mirrored: **`colors.css`, `radius.css`, `spacing.css`,
  `font-size.css`, `spinner.css`** — each a 1:1 copy of the matching upstream file.
- The cascade is `:root` (dark neutral) / `.dark` / `.light` / `.cui-color-<name>`, upstream's exact
  selector lists including `:root.light` and `.light .dark [class*="cui-color-"]`. Leveling now works
  the upstream way: the `LEVELS` block **reassigns the `--color-cui-*` Tailwind theme vars** from
  `--cui-*-leveled` values, rather than our old `--cui-surface-base` recomputation.
- Variables renamed to upstream's: `--cui-accent-source`→`--cui-theme`, `--cui-background`→`--cui-bg`,
  `--cui-foreground*`→`--cui-fg*`, `--cui-hover`→`--cui-surface-hover`,
  `--cui-surface-mix-step`→`--cui-surface-mix-amount`, `--cui-shadow-*`→`--shadow-cui-*`.
- Classes renamed: `cui-accent-*` → **`cui-color-*`** (upstream's `cladd-color-*`). The `cui-light:`
  variant is now the plain `light:` variant, and `dark:` exists too — both copied from `cladd.css`.
- `UiProvider` props are upstream's `CladdProvider` props: `theme`, `accentColor`, `overlaysRoot`,
  `defaults`. `useTheme()`, `useAccentColor()`, `useOverlaysRoot()`, `useComponentDefaults()` ported.
- **Overlays now teleport into `overlaysRoot`** (`'#app, #__next, #root'`) instead of `body`, so they
  sit inside the themed root and inherit theme _and_ accent. They no longer carry a `cui-theme` class
  or `data-cui-theme` of their own — those were props of the invention.

**Consumers must now put the classes on their own root.** The playground does it in a `watchEffect`
over `document.documentElement`; `apps/desktop` still needs the same treatment. Tests mount into a
`#app` container (`tests/support/mountTree.ts`) for the same reason.

### Only `dark`/`light` goes on the root — never `cui-color-*`

Upstream applies the color class **per component** — `Surface.tsx:209` emits it only when a `color`
prop is set. And `useAccentColor()` is read by interactive components only (Checkbox, Dialog,
FocusRing, Input, Radio, Segmented, Slider, Spinner, Switch, Textarea), as their **default color
prop**. Notably not by Surface, Button, or Chip, and by no root element anywhere.

Putting `cui-color-*` on `<html>` makes the accented-dark block recompute `--cui-bg` for the whole
document, so the page background takes the accent hue — which Cladd's own docs never do. That is a
port bug, not a styling choice. Locked by the `tints the page only through a component's own color
class, never a root` test.

The app-wide accent still reaches everything, the upstream way: as context, through each interactive
component's default color.

### Surface emits exactly upstream's class list — and no data attributes

`Surface`/`SurfaceCut` no longer fall back to `useAccentColor()`: upstream is `color = ''` with
`color && cui-color-${color}` on the root and `color || inheritedColor` published to context. A
Surface with no explicit color is **not** a colored region, and now says so.

Everything else we were emitting on those roots was invented and is gone:

- `data-cui-accent`, `data-cui-surface-level`, `data-cui-surface-variant`,
  `data-cui-surface-cut-from-level` — upstream Surface has no data attributes at all. Tests now
  assert the real classes (`cui-surface-level-3`, `cui-color-red`, `text-cui-on-primary`).
- `cui-surface--{variant}`, `--outlined`, `--hoverable`, `--clickable`, `--pressed`, `--fill` —
  upstream's root is only `cladd-surface relative`, the level class, the optional color class, the
  fill/fg text class, and `cladd-hoverable`/`cladd-clickable`.
- `surfaces.css` went with them: its rules only existed to style those invented classes.

`SurfaceContext` is now upstream's `{ level, color }`, and `provideSurfaceColorReset()` is upstream's
`SurfaceColorReset` — the portal-boundary reset every overlay uses, because provide/inject crosses a
teleport but the `cui-color-*` CSS cascade does not.

### `useComponentDefaults`: why `withDefaults` can't express it

Upstream's precedence is **explicit prop → `defaults[Component]` → built-in default**, and every
component opens with `useComponentDefaults('Name', props)`. Vue's `withDefaults` cannot express that:
it fills built-ins first, so by the time you can look at a prop you can no longer tell "not passed"
from "passed the built-in value", and a provider default could never win. Booleans are worse — Vue
casts an absent `boolean` prop to `false`, so `{ Chip: { rounded: true } }` would be silently dropped.

The pattern, smallest example in `Spinner.vue`:

```ts
// every prop declared with an explicit `undefined` default — this also suppresses Vue's
// absent-boolean cast, so `undefined` really does mean "not passed"
const props = withDefaults(defineProps<SpinnerProps>(), { accent: undefined, size: undefined, … });

// built-ins live here instead, applied last
const d = useComponentDefaults("Spinner", props, { size: "sm" as const });
```

Then the body reads `d.value.size` — **and the template reads `d.size`**, because Vue auto-unwraps
the ref there. Writing `d.value.size` in a template compiles to `d.value.value.size`; it typechecks
and fails at runtime, so watch for it when converting.

Props interfaces move out of the `.vue` file into the family's contracts file (`ChipProps` →
`dataDisplay.contracts.ts`, `ButtonProps` → `button.contracts.ts`, …) with a matching
`XxxDefaultProps = Partial<Omit<XxxProps, …>>` that excludes polymorphic and per-instance props,
exactly as upstream does. `foundations/componentDefaults.ts` is the typed registry built from those.

### The stylesheet set now matches upstream's

`base.css` split into upstream's `input.css` + `slider.css` (both `@layer base`, the only layer Cladd
uses). `controls.css` and `motion.css` are **deleted**: the spinner's `display: block` hook and the
`--cui-motion-*` / `--cui-ease-*` scale had no upstream counterpart — Cladd drives motion with Tailwind
`duration-*`/`ease-*` utilities, and the spin comes from `animate-cui-spinner` on the SVG, generated by
`spinner.css`'s `@theme` block. `safe-areas.css` lost its `@layer` wrapper to match upstream, and its
`@supports` selector is now upstream's `#__next, #root, #app` list.

With those gone nothing declares `@layer cui.*`, so the layer-order line at the top of `index.css` is
gone too — upstream has no such declaration. A test asserts the exact file list so the set can't drift.

`Spinner` also dropped its invented `.cui-spinner__glyph` hook and `data-cui-size`, and now merges a
consumer `class` through `cn()` the way upstream's `className` does.

### What the overlays pass changed beyond class strings

The old Vue components wrapped each overlay in an extra positioned `div` (`.cui-popover__content`,
`.cui-dialog__layer` + `.cui-dialog__container`, `.cui-tooltip__content`) with the `Surface` nested
inside. Upstream puts the positioning, radius, shadow, and transition **on the `Surface` itself**, with
a plain unstyled container div (`.cladd-popover` / `.cladd-dialog` / `.cladd-tooltip`) that exists only
as a sibling-detection and portal hook. The port follows upstream, which means:

- The transition-end element is now the `Surface`, reached through a function ref +
  `resolveOverlayElement()` — a component ref hands back the instance, not the element.
- The container div is what `useOverlayDismiss` and the `nextElementSibling` child-overlay checks see.
  Keep those two on the container, never on the `Surface`.
- `focusTrapTopmostModalSelector` moved from `.cui-dialog__container, .cui-popup__container` to
  `.cui-dialog, .cui-popup` — the `__container` element no longer exists.
- The old `.cui-*__*` hooks are gone; parts are addressed by `data-part` (`content`, `backdrop`,
  `title`, `text`, `input`, `buttons`), named exactly as upstream names them.
- `--cui-shadow-popover` was an indirection declared in `overlays.css`; the literal now sits directly
  in `tokens.css`'s `@theme` as `--shadow-cui-popover`, matching upstream `colors.css`.
- `.cui-overlay-trigger { display: contents }` was our own rule (React clones the trigger, Vue can't
  always) — now the stock `contents` utility rides alongside the class, so the class carries no CSS.
- `useFocusTrap` now takes `active` (upstream's `active: opened`, the post-animation flag) instead of the
  model ref, and is a single `watchEffect` with the restore in its cleanup — upstream's one effect.
- Deleting the popover wrappers broke `Select`, which styled them via `select.css` and passed its class
  through `contentClassName`. Caught by a failing test; resolved by the Select pass below.

**A known upstream behavior, kept verbatim:** when a dialog contains no focusable element at all,
`focusInitial` falls through to `container.setAttribute('tabindex','-1')` + `container.focus()`. The
container is a zero-size static div at the end of the portal root, so focusing it **scrolls the page to
the bottom**, and `restoreFocus` scrolls back on close. Cladd does exactly this
(`use-focus-trap.ts:67-70`) and never hits it because its dialogs always render an action button. Ours
did, because the playground example had none. If this needs to stop being reachable it is a deliberate
deviation from upstream (`focus({ preventScroll: true })`) — decide it explicitly, don't drift into it.

### Verifying overlays in a browser: rAF is gated on tab visibility

`useOverlayLifecycle` opens on `requestAnimationFrame`, which **never fires in a hidden or backgrounded
tab**. An overlay driven from such a pane stays permanently in its closed visual state, which reads
exactly like a broken port. Shim it before the first open:

```js
window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 16);
```

Shim on a freshly loaded page — once an overlay is stuck mid-phase, re-clicking the trigger will not
re-enter the lifecycle. CSS transitions don't advance in a hidden tab either, so read the **class list**
for the target state and computed style for geometry.

### What the Select pass changed beyond class strings

Finding 9 is closed: options now ride `List` + `ListButton as="label"` instead of bespoke `Button`
rows, and the trigger no longer sits in the Popover's `trigger` slot. Behavior corrections, all of them
"we had invented something upstream doesn't do":

- **No internal filtering.** Upstream is explicit: _"The Select does not maintain any internal filter
  state; callers control matching."_ `searchFilter` (upstream's `onSearch`) returns the list; without it
  every option shows. We used to fall back to our own `.toLowerCase().includes()`.
- **The trigger renders `String(value)`, not the option label.** Upstream's `triggerValue`. Richer
  displays go through the default slot (upstream's `children`). Object options therefore show their key
  unless you pass that slot — that is upstream's behavior, not a bug.
- **`popoverOffset` default is `['-50%', 4]`**, not `4`. Note upstream's own doc comment says
  "half-width inward shift on the cross axis, 4px main-axis gap" but the **code** destructures
  `[mainOffset, crossOffset]`, so `-50%` is the _main_ axis. The code is what was ported: for
  `bottom-end` that resolves to `marginTop: calc(anchor-size(height) * -0.5)` and `marginRight: 4px`.
- **The empty state only renders on `search && searchFilter && query && !displayOptions.length`.** Ours
  showed it for any empty list.
- **`Radio`/`Checkbox` use `as="div"` + `input={!disabled}`** — a real input except when the option is
  disabled. `scrollToSelected` depends on it: it queries `input[checked]`.
- **`anchorElement`** (upstream's `anchorRef`) suppresses the trigger entirely and anchors the popover
  to a caller-owned element. This needed a matching `anchorElement` prop on `Popover`, which upstream
  has as `anchorRef` and we were missing.
- Keyboard nav is now upstream's single document handler: digits 0–9 quick-pick (skipped while the
  search input holds focus), Arrow/Tab move through `.cui-list label`, Enter/Space commit, all gated on
  `!device.mobile` via the newly ported `useDevice`.

### The two search treatments

One line drives it, exactly as upstream: `const searchInset = Boolean(props.title)`.

|                     | `title` absent                                                        | `title` present (inset)                                    |
| ------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| wrapper `Surface`   | `level="+1"`, `wrapContent`                                           | `level="+0"`, `wrapContent: false`, `bgClassName="hidden"` |
| wrapper class       | `sticky top-0 z-20 rounded-t-cui-popover border-b border-cui-outline` | `contents`                                                 |
| wrapper content     | `p-2`                                                                 | `contents`                                                 |
| `SearchField` class | `sticky z-20`                                                         | `sticky z-20 top-2 mx-2 mt-2 w-auto`                       |

Verified live: sticky mode gives surface level 5, `position: sticky`, `top: 0`, `z-index: 20`,
`border-top-left-radius: 24px`, `border-bottom: 0.8px solid` cui-outline, content padding 8px. Inset
mode collapses the wrapper to `display: contents` at level 4 with the field at `top: 8px`,
`margin: 8px 8px 0`. The playground has a `title` switch so both stay reachable.

## Remaining work, in the order I'd take it

Every item below is a pure port — read the upstream file, copy it, delete whatever of ours it
replaces. Run `vp run reference:cladd` first: the pinned checkout is gitignored and absent on a fresh
clone. Keep `vp run ui#test` green between items.

### 1. Finish threading `useComponentDefaults` (mechanical, biggest remaining chunk)

Done: `Button`, `Chip`, `FocusRing`, `ListButton`, `SearchField`, `Shortcut`, `Spinner`, `Surface`,
`SurfaceCut`, `Toast`. Remaining: the forms family (`Input`, `Textarea`, `Checkbox`, `Radio`,
`RadioGroup`, `Switch`, `Slider`, `Select`) and the overlays (`Popover`, `Dialog`, `Popup`, `Tooltip`,
`TooltipPrimitive`, `PopupContent`).

Per component: move the props interface into the family's contracts file, add
`XxxDefaultProps = Partial<Omit<XxxProps, …>>` dropping polymorphic and per-instance props, register
it in `foundations/componentDefaults.ts`, then apply the pattern documented under
"`useComponentDefaults`: why `withDefaults` can't express it". `Spinner.vue` is the smallest worked
example; `Button.vue` is the largest. Extend `tests/componentDefaults.test.ts` as you go.

### 2. Sweep the remaining non-upstream DOM hooks

Upstream emits **no `data-*` attributes anywhere** and its Surface inner layers are unclassed divs.
Ours still has:

- `data-cui-size` on `Shortcut`, and any other stray `data-cui-*` outside the ones Surface already
  lost. Grep `data-cui-` and treat each as an invention until proven upstream.
- `.cui-surface__background` / `__overlay` / `__content` and the `cui-surface-cut__*` pair.
  `SurfaceContent` upstream is just `relative h-full` with no class hook. These are load-bearing for
  the fixtures' `:deep()` selectors and a few component selectors, so unwind the consumers first.
- `data-cui-opened` on the overlays — upstream uses `data-open`. Cheap rename, but check the tests.

### 3. Split `SurfaceContent` / `SurfaceCutContent` into real components

Upstream has them as separate components; ours are inline `<component :is>` layers inside Surface.
Pairs naturally with item 2 since it removes the same class hooks. Only worth doing if a consumer
needs them, or as the tail of item 2.

### 4. Components not ported at all

Nothing in the app needs these yet, so they're the natural place to grow the library next. In rough
order of how often Cladd itself leans on them: `Segmented` + `SegmentedButton`, `Tabs` family,
`Toolbar` family, `Accordion` family, `Collapsible` family, `ToggleGroup` / `ToggleButton`, `Link`,
`NumberField`, `NumberScrubber`, `OTPField`, `ColorPicker` / `ColorEditor`, the `Calendar` /
`DatePicker` pair. `shared/color.ts` is only needed by the colour pair.

### 5. `apps/desktop` still owns no theme class

The provider stopped rendering an element, so the desktop app needs the same three lines the
playground has — `dark`/`light` toggled on `document.documentElement` — plus an `#app` (or explicit
`overlaysRoot`) for overlays to teleport into. Until then it renders with `:root`'s dark neutral
defaults, which happens to be what it wants, so nothing looks broken; it just isn't wired.

## Two traps that will cost you a debugging cycle

1. **~~CSS layer order beats specificity.~~** Retired: no hand-authored `@layer cui.*` rule survives,
   so nothing can silently out-rank a utility any more. Kept here because the reasoning still applies
   the moment anyone reintroduces a component stylesheet — don't.
2. **Surface / SurfaceCut class merging.** Fixed in `318d25e`, but worth knowing why: binding a
   component's own class list and the consumer's `class` attribute as two separate things (Vue's
   default attr-fallthrough) means `cn()`/tailwind-merge never sees them together, so ordering in the
   compiled stylesheet decides the winner instead of the merge logic. This silently broke absolute
   positioning on Checkbox/Radio thumbs and the Switch track (they fell back to `position: relative`,
   collapsing the check glyph to 0 width). Any _new_ component that hands a positioning utility to
   `Surface`/`SurfaceCut` via `class` should be spot-checked with computed styles, not just visually.

## Deliberate divergences — leave these alone unless you're changing them on purpose

- **`Backdrop.vue` is not exported** from `src/index.ts`. It exists so Popover, Dialog and Popup share
  upstream's one backdrop class string. Export it when a consumer needs it, not before.
- **`Tooltip` keeps `role="tooltip"` + `aria-describedby`.** Upstream has neither. This is the only
  accessibility affordance we add on top of the port; dropping it to match would be a regression, so
  it stays until someone decides otherwise.
- **`searchFilter`, not `onSearch`.** Upstream's `onSearch` is a callback that _returns_ the filtered
  list, which a Vue emit cannot do. Same semantics, Vue-shaped name. Same story for `anchorElement`
  (upstream `anchorRef`) and `v-model:open` (upstream `open` + `onOpenChange`).
- **Upstream's own bugs are ported as-is.** `Select`'s `popoverOffset` doc comment contradicts its
  code about which axis `-50%` applies to — the code is what we copied. `Spinner`'s root class list
  contains `cladd-spinner` twice; we emit it once, since `cn()` output is identical either way.
- **`focusInitial` can scroll the page.** When a dialog has no focusable element at all,
  `use-focus-trap.ts:67-70` falls through to `container.focus()` on a zero-size div at the end of the
  portal root. Cladd never hits it because its dialogs always render an action button. Deviating means
  `focus({ preventScroll: true })` — decide it explicitly, don't drift into it.

### The compound `*Root` / `*Trigger` / `*Close` trio

Ported for Popover and Dialog. Upstream holds open state in a React context on the `*Root`, so the Vue
shape is: `overlayRootContext.ts` (injection keys + the `{ anchor, open, setOpen }` contract),
`overlayRoot.ts` (`useOverlayRoot`, upstream's controlled/uncontrolled `open ?? defaultOpen` rule), and
one thin `.vue` per role. Three things are easy to get wrong:

- `Popover`/`Dialog` resolve open state as **own `open` → Root's state → `false`**, matching upstream's
  `open ?? ctx?.open ?? false`, through a writable `computed` that routes writes back to whichever of
  the two is in play. A plain `defineModel` cannot express the three-way fallback.
- `PopoverTrigger` registers the anchor element on the Root, and `Popover` **must consume it** when it
  has no `trigger` slot of its own (upstream's `anchorRef ?? ctx?.anchorRef`). Forget this and the
  popover mounts with no `anchor-name`, so `position-anchor` resolves to nothing and it lands at the
  document origin. `DialogTrigger` registers no anchor — dialogs are viewport-centered.
- The model prop is named **`open`** (`v-model:open`), not `modelValue`, because upstream's prop is
  `open` + `onOpenChange`. `Select` binds `v-model:open` to its inner `Popover` for this reason.

### `className` vs `contentClassName`

Upstream overlays take both: `className` styles the popover/dialog `Surface` (width, radius, position)
and `contentClassName` styles the inner scrollable content area. Since the port moved positioning onto
the `Surface`, `Popover`/`Dialog` are `inheritAttrs: false` and route the consumer's `class` to the
`Surface` (upstream also spreads `...rest` onto it), keeping `contentClassName` for the content layer.
**To widen a popover you pass `class="w-56"`, not `content-class-name`** — `w-40` lives on the Surface.

## Verification checklist for every remaining family

- [ ] The upstream file was read in full first, and the diff is a copy of it — not a reconstruction
- [ ] Every prop upstream exposes exists, including the ones nothing in this repo uses yet
- [ ] `vp run ui#test` — all green, no skipped assertions
- [ ] `vp run ui#check --fix` — no lint/format/type errors
- [ ] `vp run ui-playground#check` — playground still typechecks against the public export
- [ ] New literals locked in a contracts file and asserted by value in a test, so they can't drift
- [ ] Anything hand-authored that the port replaces is deleted in the same commit
- [ ] Upstream file + line cited in the commit message
