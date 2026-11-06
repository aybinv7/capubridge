# Design System: Bench

Capubridge is an instrument for looking inside hybrid apps running on real devices. The brand is
**Bench**: a probe between a phone and a desktop, with time as the x-axis of everything you see.

Source of truth: `src/themes/` (tokens, applied at runtime by `applyTheme`) and
`src/assets/styles/main.css` (Tailwind bindings, depth utilities, type scale).
Study and rationale: `docs/design/2026-11-04-ui-ux-rewrite-study.md`.

---

## 1. Principles

- **Colour is meaning.** Every hue owns exactly one role. Decoration never uses a signal colour.
- **One accent for the main action.** Each view or dialog has at most one primary action, filled with
  the brand accent (`variant="solid-fill" color="brand"`, the selection blue). Everything else is
  neutral. Colour otherwise means state.
- **Depth, not borders.** Surfaces are lit from the top-left (bevel) and recessed wells are cut
  in (cut). Borders exist for structure, not for decoration.
- **Dense without squinting.** Nothing below 11 px; tabular numerals for all data.
- **Honest state.** A value always says whether it is live, cached, recorded or stale.

## 2. Colour roles

Bench Dark neutrals are the approved shell design's hex values (pure neutral, no hue); everything else
is OKLCH. Dark is primary; light and High Contrast (AAA) share the same roles.

| Role                             | Token / utility                                                    | Bench Dark                     | Bench Light      | Meaning                                      |
| -------------------------------- | ------------------------------------------------------------------ | ------------------------------ | ---------------- | -------------------------------------------- |
| App background                   | `bg-background`                                                    | `#0f0f0f`                      | `0.965 0.005 95` | Window fill, chrome                          |
| Panel                            | `bg-surface-0` / `bg-card`                                         | `#161616`                      | `0.985 0.004 95` | Default content surface                      |
| Raised                           | `bg-surface-2` / `bg-popover`                                      | `#1c1c1c`                      | `0.94 0.006 95`  | Hover, menus, popovers                       |
| Cut                              | `bg-surface-cut`                                                   | `#111111`                      | `0.95 0.005 95`  | Recessed wells: inputs, code, tracks         |
| Text                             | `text-foreground`                                                  | `#e8e8e8`                      | `0.24 0.01 95`   | Primary text                                 |
| Muted text                       | `text-muted-foreground`                                            | `#b0b0b0`                      | `0.46 0.012 95`  | Secondary text                               |
| Subtle text                      | `var(--fg-subtle)`                                                 | `#8c8c8c`                      | `0.51 0.012 95`  | Tertiary text (still ≥ 4.5:1)                |
| **Live**                         | `signal-live`                                                      | `0.89 0.19 122`                | `0.49 0.13 128`  | Live data, now-edge, playhead. Nothing else. |
| **Recording**                    | `signal-rec`                                                       | `0.68 0.21 27`                 | `0.55 0.2 27`    | Recording in progress. Nothing else.         |
| **Selection**                    | `signal-select` (`ring`, `accent`)                                 | `#7cc4f5`                      | `0.5 0.13 235`   | Selection, focus, active navigation          |
| **Mark**                         | `signal-mark`                                                      | `0.86 0.13 85`                 | `0.5 0.12 75`    | User marks, bookmarks, annotations           |
| Success / Warning / Error / Info | `success` `warning` `error` `info`                                 | 160 / 72 / 22 / 245 hue        | same hues        | Outcomes                                     |
| Categories                       | `cat-network` `cat-storage` `cat-device` `cat-console` `cat-agent` | 215 / 300 / 180 / 95 / 345 hue | same hues        | Evidence kinds (lanes, badges)               |

Rules:

- Every text-capable role is ≥ 4.5:1 on app, chrome, panel and raised (AAA 7:1 in High Contrast) —
  enforced by `vp run desktop#check:contrast`.
- Categories and states are never the only signal: pair them with an icon, a label or a lane shape.
- Recording and error are both red-family; recording is always a filled square/dot with timecode,
  error is always an icon with text.

## 3. Typography

| Use                     | Family                                                                     |
| ----------------------- | -------------------------------------------------------------------------- |
| UI                      | IBM Plex Sans Variable (self-hosted, `@fontsource-variable/ibm-plex-sans`) |
| Data, code, identifiers | IBM Plex Mono 400/500 (`@fontsource/ibm-plex-mono`), tabular numerals      |

Scale (`text-*`): `2xs` 11/16 · `xs` 12/16 · `sm` 13/18 · `base` 14/20 · `lg` 16/22 · `xl` 18/24 ·
`2xl` 22/28. Arbitrary pixel sizes are rejected by `vp run check:design-tokens`.

## 4. Density, radius, depth, motion

- **Controls** 28 px default; nested controls −8 px. **Rows** 22 (compact) / 26 (default) / 30.
- **Radius** from the shell design's radius 12: `rounded-surface` 14 px (shell surfaces), `rounded-well` 10 px,
  `rounded-control` 8 px, `rounded-inner` 6 px. `--cladd-radius` is 8 px, so Cladd controls scale with their
  height (`rounded-cladd-*`: 28 px → 8 px, 24 px → ~7 px, 20 px → ~6 px); chips use the pill variants.
  Hand-built screens keep `rounded-lg` panels and `rounded-md` controls until their phase-B rebuild.
- **Depth** (ported from Cladd):
  - `shadow-bevel` — raised surfaces. Dark uses Cladd's own outline: a 1 px top-left edge at 8 % and a
    bottom-right edge at 7 %, no drop shadow, so controls read as clickable. Cladd's outline
    (`shadow-cladd-outline`) and cut outline are bridged to `--bevel` and `--cut`, and one Cladd surface
    level is the panel → raised step at Cladd's 6 % (`--cladd-surface-mix-amount`).
  - `shadow-bevel-strong` — pressed/emphasised raised surfaces.
  - `shadow-cut` — recessed wells.
  - `shadow-float` — the only drop shadow; overlays only.
- **Motion roles:** 80 ms feedback · 120 ms state · 200 ms panel · 300 ms overlay. Honour
  `prefers-reduced-motion`. Only a live recording indicator may pulse.

## 5. Components: Cladd

- **Cladd is the visual foundation** (decision D3). `@capubridge/cladd` is vendored cladd-vue: add or fix
  a primitive in cladd-vue (parity-tested against upstream Cladd), then `vp run sync:cladd`. Never edit
  `packages/cladd/src` here.
- **One palette.** `src/assets/styles/cladd-bridge.css` points Cladd's base variables at the Bench roles
  (surfaces, ink, outline) and its accents at Bench meaning (`red` → danger, `green` → success,
  `yellow`/`orange` → warning, `blue` → info, `brand` → select, `lime` → live, `cyan`/`purple`/`pink` →
  categories). Cladd's surface levels, hover and press derive from those, so no Cladd colour is tuned by
  hand. Cladd type tokens are clamped to the 11 px floor.
- **Accent for active states, neutral surfaces.** `App.vue` wraps everything in
  `CladdProvider accent-color="brand"`: every control's active state (Switch on, Checkbox, Radio, the
  selected Segmented/ToggleButton, Slider, Spinner, focus rings, input focus, a dialog's default
  confirm) takes the selection blue. Buttons do not read the provider accent, so they follow the
  hierarchy below.
  Button hierarchy:
  - **Primary** — `variant="solid-fill" color="brand"`: the one main action of a view or dialog
    (Save, Connect, Open, Apply, a non-destructive confirm).
  - **Secondary** — `variant="solid"` (neutral raised).
  - **Quiet** — `variant="transparent"`, and `IconAction` for icon buttons.
  - **Destructive** — `color="red"`, only on the button that performs the delete, clear or uninstall
    (the shared `ConfirmDialog` does this with `danger: true`); menu items that lead to it use red text.
  - Recording keeps `signal-rec` red on its own start/stop control, as its state colour.
- **Mode.** `applyTheme` sets `data-theme-mode` (the app's `dark:` variant) and the `dark`/`light` class
  (Cladd scopes and its `light:` variant).
- **Overlays** portal to `body`, so the native-webview overlay guard sees Cladd dialogs, popups and
  popovers.
- **Retiring shadcn-vue.** Button, Input, Badge (→ Chip), Select, Tooltip, Switch, Checkbox, Textarea,
  Label (→ FieldLabel), InputGroup, Collapsible, Spinner, Tabs, ButtonGroup (→ Toolbar/Segmented), Card
  (→ Surface), Popover and Dialog may not gain imports (`vp run check:cladd-adoption`, a ratchet that only
  goes down). Menus, command, scroll area, resizable and sheet stay on Reka until Cladd has them.
- **Key hints** use `KeyCaps` (Cladd `Shortcut`) fed by `bindingTokens(binding)` from the command
  registry; never hand-write a key label.
- **Icon buttons** use `IconAction` (`src/shared/components/presentation`): a quiet square Cladd `Button`
  whose `label` is both its tooltip and its accessible name, with an optional `hint` line and `KeyCaps`.
  An unexplained icon is a defect. `pressed` raises it like a selected segment.
- **State marks** use Cladd `StatusDot` (extension): solid for a present state, hollow for absent or
  unknown, an accent only when the state means something, always next to a word that names it.

## 6. Mark

`src/components/brand/BrandMark.vue` and `public/favicon.svg`: a tall bar (the phone) and a wide
bar (the desktop) joined by a step trace drawn in `signal-live`. Monochrome otherwise.

## 7. States and provenance

- **Gates.** A route declares `meta.requires` (`device`, `target`, `app-target`); panels render
  `GatedRouterView`, the dock renders `GatedView density="compact"`. The resolver
  (`src/lib/gates`) picks the first broken link of ADB › device › target › DevTools and shows
  one reason, one explanation and the next actions. The connection chain is always visible so
  the break is obvious. Never write a screen-local "no device" or "connect first" message.
- **Degraded, not torn down.** Once a screen has rendered for a subject (device or target), a
  dropped link keeps it mounted under a hatched `stale` strip instead of replacing it.
- **Notices** (app in background, another WebView on screen) never block; they sit above content.
- **One link truth.** The context pill and gates read `activeContext.link` / `gateInput`. There is no
  status bar: link state lives only in the title-bar pill, the console toggle sits in the title bar
  (with its unread mark), and recording time lives on the Record button.
- **Device names.** A device is named by maker and model ("Xiaomi 24117RN76G", `deviceNames.store`,
  `friendlyDeviceName`) everywhere: pill, device list, device header. Serials and addresses are the
  quiet secondary line (`deviceIdentity`: a Wi-Fi address without its port), never the headline.
- **Provenance** is a pattern, never a hue: `live` (solid, live dot), `cached` (dotted
  underline, `prov-cached`), `recorded` (perforated edge, `prov-recorded`), `imported` (corner
  tag, `prov-imported`), `local copy` (dashed outline, `prov-local`), `stale` (hatch,
  `prov-stale`). Label it with `ProvenanceTag`.

## 8. Shell

- **Window** on `bg-background`, no panel behind the title bar or the rail.
- **Title bar** 46 px, no border and no brand. Left: back, forward, then search (`Search or run`
  with its `KeyCaps`): the history arrows keep the fixed leftmost spot they have in every browser and
  editor, and search follows them as the next way to go somewhere. Centre: the context pill (live
  mark · device · `/` · app · link word · chevron, a level-1 Cladd `Button` with a 1 px line and the
  bevel). Right: a ghost Record button (hollow ring when idle), the console toggle (`PanelBottom`,
  unread dot, `mod+j`) and the screen toggle (`PanelRight`, or `PanelLeft` when the column sits left; `…Close` while open). Toggles
  are raised while their panel is open. Window controls stay at the far right.
- **Shell icons** come from one family, `shellIcons` (`src/shared/icons`): the rail, back/forward,
  search and the panel toggles, each as a regular/filled pair; filled marks the current destination
  or an open panel. The set is Tabler (outline at stroke 1.75, hand-drawn filled companions);
  Phosphor and Fluent mappings sit beside it for comparison and switch with one line in
  `shell-icons.ts`. Lucide stays everywhere else.
- **Rail** Cladd `NavRail` icon-only (56 px) with `NavRailItem` 44 × 44 and 20 px icons (the
  feature's `railIcon` key), filled while current, read from the item's scoped `icon` slot; each item is
  named by its label and explains itself in a side tooltip (label, maturity, `KeyCaps`) that opens to
  the right so it never covers a neighbour. The current item is raised two levels with the bevel.
  `mod+b` (`view.toggle-rail`) hides the whole rail and brings it back; the choice persists. The
  footer holds Settings.
- **Surfaces** the main content and the screen column are `rounded-surface` panels with a 1 px
  `border-border-subtle` line and `shadow-bevel`, 8 px apart and 8 px from the right and bottom edges.
- **Device manager** a Cladd `Dialog` (900 × 600): devices on the left grouped USB · Wi-Fi ·
  Emulators · This computer · Not connected (seen in the last day) · Earlier connections (folded)
  (Cladd `ListButton` with the tight focus ring, the viewed one in Cladd's selected treatment); the
  list scrolls above a separate footer with the Wi-Fi and emulator entry points. The right side shows
  the viewed device (state, numbered next steps when it cannot be used) and its WebViews: one Cladd
  `Surface` card per app (icon, app label, package as the quiet line, an `In use` chip), its pages
  inside; pages no app was matched to sit last under "Not linked to an app" with a plain-words
  reason, and an unanswered DevTools socket reads as "Chrome browser" with what to do. Rows name a
  kind only when it is not a page. Opening focuses the device column, not a row, so no ring is drawn
  until a key is pressed; arrows move within a column, ←/→ between columns, Enter acts, Esc closes.
  Opening never changes the selected device.
- **Screen column** a quiet 40 px top bar ("Screen", a `StatusDot`, the state word and frame rate or
  frame age in mono, then `IconAction`s: screenshot `Camera`, record `CircleDot`, own window
  `SquareArrowOutUpRight`, settings popover), a recessed well holding a 4 px bezel fitted to the
  stream like `object-fit: contain` (`fitDeviceFrame`: no bands, corner radius about 8.5 % of the
  short side, a landscape stream lies on its side and widens the column), and one full-width Cladd
  `Toolbar`: volume left, back/home/recents centred, rotation and screen off right. Rotation turns
  auto-rotate off and holds portrait or landscape through the device settings, verified by reading
  them back; while held, a raised lock turns auto-rotate back on. States: starting, waiting for the first
  frame, live, unchanged (scrcpy sends nothing for a still screen, so it is not called stalled),
  stopped with what happened, what to do and the raw error, and an app-in-background notice.
- **Section tabs** Cladd `Tabs` with solid active segments: 28 px, `rounded-cladd-md`, selected raised
  with the bevel and medium weight, a 1 px soft line under the row.

## 9. Guards

| Check                                      | Command                         |
| ------------------------------------------ | ------------------------------- |
| Contrast of every role on every background | `vp run desktop#check:contrast` |
| Type scale and semantic colours only       | `vp run check:design-tokens`    |
| No synchronous IPC                         | `vp run check:async-commands`   |
| No new shadcn where Cladd has a component  | `vp run check:cladd-adoption`   |

Remaining migrations (owned by later rounds): categorical hues (violet, teal, indigo, cyan, pink)
in network, elements, storage and replay become `cat-*` / code-syntax tokens as those screens are
rebuilt; then the design-token guard extends to every palette hue.
