# Screen rewrite brief

Every main route and its child routes are being rewritten, one route at a time, by agents. The owner
is away; this file is the whole brief. Read it, then `apps/desktop/DESIGN.md`, then the route's code.

## The goal

Bring each screen up to the maturity of the Claude and ChatGPT desktop apps: their polish, calm and
clarity — **not** their chat structure. Capubridge keeps its own structure (rail, title-bar context
pill, sub-navigation tabs, phone column, console dock) in the Cladd look. A rewrite may change
layout, merge or split tabs, and add functionality when it serves the user. It may **never** drop an
existing capability.

## Non-negotiables

1. **Parity first.** Before touching a screen, write `docs/design/rewrite/<route>-parity.md`: every
   action, control, state (loading, empty, error, stale, background), shortcut, command-palette entry,
   toast and data shown today, with the file it lives in. After the rewrite, tick each line with
   where it lives now. A line that cannot be ticked is a bug, not a decision.
2. **Logic stays put.** Stores, composables, IPC and CDP code keep their behaviour; the rewrite is the
   presentation layer. Fix a real bug you find, with a test, and say so in the parity file.
3. **Project rules** (CLAUDE.md, the user's global rules): Vue `<script setup lang="ts">`, Pinia setup
   stores, TanStack Query for CDP fetches, TanStack Table plus virtual scrolling for long lists, no
   `any`, `import type`, **no code comments except JSDoc on exported or non-obvious functions**, one
   responsibility per file, module boundaries (a module imports only shared code, never another
   module's files), `vp` for every tool (`vp check`, `vp test run`, `vp run <script>`), never npm.
4. **Design rules:** Cladd components (`@capubridge/cladd`) for every control; retiring shadcn-vue
   imports may only go down (`vp run check:cladd-adoption`); semantic tokens and the type scale only
   (`vp run check:design-tokens`); `IconAction` for icon buttons (label = tooltip = accessible name);
   `StatusDot` beside a word for states; gates via `GatedRouterView`, never a screen-local "connect a
   device" message; motion with the Cladd curves `ease-cladd-spring` (popover, 300 ms) and
   `ease-cladd-settle` (popup, 500 ms), 200 ms `ease-in-out` to leave.
5. **Copy:** plain sentences a person would say, no jargon where a word will do, no raw serials, IPs
   or package names as the main label (show them quietly, or on hover), sentence case, no
   exclamation marks. A device is named with `useDeviceNamesStore().nameOf(device)`.
6. **Performance:** no work in render that can be cached; `computed` over watchers that copy state;
   lists over ~50 rows are virtualised; polling pauses when the screen or window is hidden; heavy
   components (Monaco, charts) load lazily; no layout reads in hot paths except deliberate ones.
7. **Gates before checks:** `vp check`, `vp test run` (in `apps/desktop`), and the ratchets
   `vp run check:vue-types`, `check:cladd-adoption`, `check:design-tokens`, `check:modules`,
   `check:source-size` all pass before you hand back. Tighten a ratchet with its `--update` flag when
   you lowered its count. Never run `vp dev`, `vp build` or `vp run tauri`: the owner's app is
   already running and hot-reloads your edits.
8. **Git:** commit locally on the current branch when a route is done, conventional message, end
   with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push. Never amend.

## Owner preferences that already shaped the app

- Icon-only nav rail, hidden by Ctrl+B and revealed by hovering the left edge; no logo; compact
  search; the context pill centred in the title bar; Windows caption buttons flush top-right.
- Phone column: realistic frame for phones, bare frame for web previews, rotate, controls spread
  across the width, bring-to-front when the app is in the background.
- Show, don't tell: a diagram beats a sentence (see `components/gate/GateDiagram.vue`).
- The owner dislikes: defaults with no design thought, tabs that should be one view, generic empty
  states, loud identifiers, duplicate signals for one state, overlays where a layout change was
  expected.

## Reference implementations to match

`components/device-manager/*` (two-pane dialog, rows, merged handsets), `components/gate/*`
(diagram gate), `modules/mirror/MirrorCaptureToast.vue` (toast), `modules/recording/RecordingConfigModal.vue`
(dialog), `components/command/CommandPalette.vue` (palette), `modules/mirror/WebViewportBar.vue`
(toolbar with scrubbers), `components/layout/TitleBar.vue` and `Sidebar.vue` (shell).

## Looking at the running app

The owner's dev app is running and hot-reloads. A screenshot harness lives at
`C:\Users\aybin\AppData\Local\Temp\claude\a3ec4d087af9d6dc\98fe427c-06ef-4125-9869-4f5a46592caf\scratchpad\eye\eye.ps1`
(PowerShell): `-Op list` lists windows (the main one is titled `capubridge`, process `app`);
`-Op list -H <handle> -Name <shot> -Wait 50` saves `shots\<shot>.png` without input;
`-Op click -H <handle> -X <x> -Y <y>` clicks at window-relative coordinates; `-Op keys -H <handle>
-Keys "^k"` sends keys (SendKeys syntax). Read the PNG to look at it.

- **Never click inside the phone screen** in the screen column: it taps the owner's real phone. The
  buttons around it (top bar, bottom bar) are fine.
- Navigate with the rail or with `g` + letter shortcuts; restore any state you change (rail,
  panels, selected tab) before you finish.
- A connected phone is `Redmi Note 14` over USB, app `Presalio Retail` selected.

## Review dimensions (run after each route)

1. **UI/UX:** hierarchy, density, Cladd consistency, copy, empty/loading/error states, keyboard,
   accessibility names, motion, the owner's preferences above.
2. **Performance:** render cost, reactivity, polling, list virtualisation, memory (listeners,
   intervals, object URLs), bundle (lazy loads).
3. **Parity and correctness:** every line of the parity file still reachable and working; no
   regressions in tests; edge cases (no device, offline device, app in background, stale data).

## Lessons from earlier routes (read before you start)

From the Device review (`device-review.md`), the mistakes reviewers caught most:

- Lifecycle state that outlives a remount (a monitor above a gate kept the previous device's data):
  reset on subject change, and test the lifecycle, not only pure helpers.
- A phase/status that cannot tell "user paused" from "offline", "hidden" or "just came back".
- A selected row weaker than a hovered row: selection uses the selection treatment, hover is one
  level below.
- Row actions in the tab order (hundreds of invisible tab stops): `tabindex="-1"` on row actions,
  `aria-activedescendant` on the list.
- Unbounded or uncancelled background work (icon fetches, per-keystroke queries, intervals with
  async bodies that pile up): queue, debounce, cancel, self-scheduling timeouts.
- Charts that animate on every tick (`:duration="0"` for live data).
- Raw dates and identifiers as primary text; empty states that keep a large pane open.
- Breakpoints on the window width instead of the panel (use container queries).
