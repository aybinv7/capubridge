# Round 02 · Layout proposal B (Case canvas)

2026-11-04 · Angle: evidence-first case canvas · Designer: principal product design (staff+) · Status:
`[AI-assisted]`, pending the owner's explain-it-back.

Inputs: `LAYOUT-BRIEF.md`, `BRIEF.md`, `RUBRIC.md`, `round-01/00-synthesis.md`, `round-01/04-product-design.md`,
`round-01/05-visual-craft.md`, `2026-09-12-capability-inventory.md`, `apps/desktop/DESIGN.md`, the shell
source (`components/layout/*`, `app/feature-registry.ts`, `modules/mirror/*`, `modules/recording/*`,
`stores/localWebview.store.ts`, `composables/useOverlayGuard.ts`), `packages/cladd/src/components`, and the
round-01 evidence screenshots. Nothing was built or run.

---

## 0. Thesis

**The window holds one case: a time range of evidence about one app on one device. Live is a case whose
right edge is "now", and a received `.capu` is the same case with a hard right edge.** There is no rail and
no Replay destination, and the timeline is not a panel you open. A full-width **spine** (the timeline) sits
directly under the case bar on every screen, so the reading order is _who and what_ (the case bar), then
_when_ (the spine), then _what you are looking at_ (the lens). Lenses (Story, Data, Network, Logs,
Elements, Device, Checks) are synchronised views over the same clock, chosen from a 32 px lens bar. One
docked inspector follows the selection. The phone screen is a fixed right-hand column that HTML never
overlaps, and the layout is planned around that hole instead of hiding the screen. For a developer doing
quick live inspection, this is a live case that opens on the last lens they used, one keystroke from any
table or request. For QA and support it is a story they can read from top to bottom. It is one shell,
with no mode switch.

**What I deliberately give up** (§12 has the full list): the permanent labelled rail; the status bar;
VS Code-style document tabs inside the workspace; putting the mirror on the left; modal dialogs as a
pattern; 48–64 px of vertical space above every lens.

---

## 1. Benchmarks: what I take and what I reject

| Product                                                                                            | What it does                                                                                                                                         | Take                                                                                                                  | Reject                                                                                               |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Chrome Performance panel ([ref](https://developer.chrome.com/docs/devtools/performance/reference)) | An overview strip (CPU, NET, screenshots) **at the top**; tracks; a bottom tab panel for the selection (Summary, Event log); zoom breadcrumbs        | The time overview sits above the detail, and range selection drives the detail                                        | One panel per protocol, and the overview disappears in other panels                                  |
| Perfetto ([ref](https://perfetto.dev/docs/visualization/perfetto-ui))                              | Pinned tracks; a bottom "Current selection" drawer (Q); WASD navigation; `.`/`,` steps to the adjacent slice; `F` fits the selection; area selection | Pinned lanes, the keyboard-first time navigation, and a detail panel that **moves to the bottom** when width is short | Engineer-only density; a non-developer cannot read it                                                |
| Sentry Session Replay ([ref](https://docs.sentry.io/product/session-replay/replay-details/))       | The player is the hero; the timeline is under the player; Activity/Console/Network tabs sync and auto-scroll; a request's timestamp seeks the player | Activity as a readable story; every row carries a seek affordance                                                     | The timeline is scoped to the player (bottom), and there is no live device and no data               |
| Replay.io ([ref](https://docs.replay.io/basics/replay-devtools/overview))                          | **Viewer mode vs DevTools mode** toggle; a focus window that narrows the time range; comments at a point in time                                     | The focus window, which becomes the spine's range handles                                                             | The mode switch: it splits one audience into two products. I use progressive disclosure instead (§8) |
| Linear issue view and Peek ([ref](https://linear.app/docs/peek.md))                                | J/K moves through a list while a preview follows; properties live in a side panel; the palette's quick look shows a preview                          | Keyboard selection with a following inspector; properties with provenance in a side column                            | Peek is a floating pop-up, which would collide with the native screen. My inspector is docked        |

**Judging the prior art (study §4.1).** I keep the context bar, the selection-driven inspector, the
always-visible timeline and the evidence palette. I reject four things:

1. **The labelled rail.** It answers "which protocol?", and the case answers "which evidence?". The
   synthesis already found the rail mixes nouns of different kinds (04 §2).
2. **Document tabs inside the workspace.** A tab per table or request recreates the IDE and fights the
   one-clock idea. Selection, history and pins replace it (§2).
3. **The timeline at the bottom, stacked over the dock and the status bar.** That puts three horizontal
   bars at the bottom of the window (timeline, dock, status), and the timeline becomes chrome you stop
   seeing.
4. **The mirror and the inspector stacked in one right column.** The arithmetic does not work at 1080:
   a 20:9 phone at 276 px wide is 613 px tall. Add 64 px of mirror controls and the inspector is left
   with about 200 px, which is useless.

I fix the persistent-shell contract's "global feature rail" by deleting it.

---

## 2. Finding that changes the constraint (verify before building)

The brief calls the mirror "a native child webview". In source, only **local-preview targets** are native:
`LocalWebviewHost.vue` attaches a Tauri `Webview`, and `localWebview.store.ts:41-52` parks it off-screen
while `acquireModalGuard()` (`:364-367`) hides it. The Android scrcpy stream is drawn into an **HTML
`<canvas>`** (`MirrorStream.vue:292`), so HTML _can_ draw over it today. The external "SC" window is a
separate native process.

**Decision:** treat the Screen column's rectangle as a _no-overlap zone for every backend_. There are three
reasons:

- the behaviour is the same whatever is behind the column;
- the current local-preview path keeps working;
- a future native or hardware-decoded scrcpy surface costs nothing.

The only place the canvas fact helps is the _freeze-frame_ fallback (§4), which becomes trivial for Android.

---

## 3. Shell wireframes

Notation: `│` is a 1 px divider (`--border-subtle`). Heights are on the right edge, widths are under each
column, and all sizes are CSS px at 100 %.

### 3.1 Full shell at 1920 × 1080 (live case, everything open)

```
x0                                                                                                   x1920
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐ y0
│◧│● LIVE Phone A › Retail app 0.1.10 › WebView main ▾│ADB● Shell● Comp○ SDK○│read 0.4 s│ ⌕ Find evidence… Ctrl K │○ Capture│⇪│─ ▢ ✕│ 40 CASE BAR
├═════════════════════════════════════════ now-edge trace, 1 px lime, moves only while live ═══════════════┤
│ ◀◀ ▶  15:16:22.4   ● Following │ ruler   ┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬──── now ┃│ 16
│ window 5:00 ▾  lanes ▾         │ summary ▁▂▅▇▃▁▁▂▁▃▆█▅▂▁▁▁▂▁▁▃▁ ▲ ▲         ▁▂▃▁   ▁▂▅▇▃       ▲      ┃│ 28 SPINE (64)
│ 200                            │ marks   ◆A            ◆B    [■■ capture range ■■■■■■■■■]               ┃│ 12 +8 pad
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤ y104
│ Story 1.2k │ Data │ Network 84 │ Logs 3.4k ⚠12 │ Elements │ Device │ Checks          ▭ Drawer ▯ Insp ▯ Screen│ 32 LENS BAR
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤ y136
│ ▨ Retail app is in the background since 15:16:20 · WebView values frozen · [Bring to front]     (slot)  │ 28 NOTICE (only when set)
├───────────────────────────────────────────────────────┬────────────────────────┬─────────────────────────┤ y164
│ LENS TOOLBAR  ⌕ Filter   [Segmented]   @ now · 2 s    │ INSPECTOR  POST /sync  │ SCREEN  ⟲ ⌂ ▢ ⧉ ⋯       │ 36 / 32
├───────────────────────────────────────────────────────┤ 15:16:21.7 · ADB/CDP   ├─────────────────────────┤
│                                                       │ ───────────────────────│ ┌─────────────────────┐ │
│  LENS CONTENT (template T1–T6)                        │ Detail                 │ │                     │ │
│  rows 26 px · 12 px side padding                      │ Related ±2 s           │ │  no-overlap zone    │ │
│                                                       │  · row 412 written     │ │  276 × 613 (20:9)   │ │
│                                                       │  · console.error …     │ │                     │ │
│                                                       │ Actions                │ │                     │ │
│                                                       │                        │ └─────────────────────┘ │
├───────────────────────────────────────────────────────┴────────────────────────┤ ◁  ○  ▢   vol  power    │ 32
│ DRAWER  Logs ▾ │ Console │ Shell                         (default closed, 240) │                         │
│ › REPL input                                                                   │                         │
└────────────────────────────────────────────────────────────────────────────────┴─────────────────────────┘ y1080
  lens 1258                                              │ insp 360               │ screen 300
```

With the notice slot closed, the canvas is 944 px tall (y136–1080). With the drawer closed, lens content
gets about 908 px, which is 34 rows at 26 px. That is 52 % more rows than today's 32 px Network rows.

### 3.2 Full shell at 1280 × 800 (inspector moves to the bottom)

```
x0                                                                                       x1280
┌──────────────────────────────────────────────────────────────────────────────────────────┐ y0
│◧│● LIVE Phone A › Retail app › main ▾│●●○○│0.4 s│              ⌕ │○ Capture│⇪│ ─ ▢ ✕ │ 40
├══════════════════════════════════════════════════════════════════════════════════════════┤
│ ▶ 15:16:22 ●Follow│ ruler ┬────┬────┬────┬────┬────┬────┬────┬────┬────┬──── now ┃     │ 12
│ 160               │ summary ▁▂▅▇▃▁▁▂▁▃▆█▅▂▁▁▁▂▁▁▃▁ ▲ ▲  ▁▂▃▁ ◆A [■■■]          ┃     │ 28  SPINE compact (48)
├──────────────────────────────────────────────────────────────────────────────────────────┤ y88
│ Story │ Data │ Network 84 │ Logs ⚠12 │ Elements │ Device │ Checks          ▭ ▯ ▯         │ 32
├──────────────────────────────────────────────────────────────┬───────────────────────────┤ y120
│ LENS TOOLBAR 36                                              │ SCREEN toolbar 32         │
├──────────────────────────────────────────────────────────────┤ ┌───────────────────────┐ │
│ LENS CONTENT                                       440 tall  │ │ no-overlap zone       │ │
│ (16 rows at 26)                                              │ │ 236 × 524             │ │
├──────────────────────────────────────────────────────────────┤ │                       │ │
│ [Selection] [Logs] [Console]       BOTTOM PANEL 240 (tabs 28)│ └───────────────────────┘ │
│ Inspector body, two-column KV at ≥ 900 px                    │ ◁ ○ ▢               32    │
└──────────────────────────────────────────────────────────────┴───────────────────────────┘ y800
  lens 1019                                                     │ screen 260
```

### 3.3 Region map (Q1)

| Region         | 1920×1080                                | 1280×800                                  | Min                       | Max                    | Notes                                                                  |
| -------------- | ---------------------------------------- | ----------------------------------------- | ------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| Case bar       | 40 h                                     | 40 h                                      | 40                        | 40                     | Fixed. Merges today's title bar, context pill and status bar           |
| Now-edge trace | 1 h, inside the case bar's bottom border | same                                      | –                         | –                      | Brand signature (05 §5): moves while live, hatches while paused        |
| Spine          | 64 h                                     | 48 h (compact, default under 900 px tall) | 28 (strip)                | 40 % of canvas (lanes) | Never 0. `T` toggles overview/lanes, `Shift+T` maximises (template T5) |
| Lens bar       | 32 h                                     | 32 h                                      | 32                        | 32                     | Fixed. Layout toggles sit right-aligned                                |
| Notice slot    | 0 or 28                                  | 0 or 28                                   | 0                         | 28                     | **One** slot, for one notice at a time, the most severe (§7)           |
| Lens content   | 1258 w                                   | 1019 w                                    | 560 w                     | –                      | Takes the remaining space                                              |
| Inspector      | 360 w, right                             | 240 h, bottom                             | 300 w / 160 h             | 520 w / 50 % h         | Right when lens ≥ 760 px after placement, otherwise bottom             |
| Screen column  | 300 w                                    | 260 w                                     | 220 w (store bound today) | 560 w                  | Always right. Collapses to a 40 px strip under 1100 px window width    |
| Drawer         | 0 (closed) / 240 h                       | shares the bottom panel                   | 120                       | 60 % h                 | Holds a second lens (Logs by default). `Ctrl+J`                        |
| Toasts         | 360 w, bottom-left of the lens area      | 320 w                                     | –                         | 3 stacked              | Never in the right half (§4)                                           |

**What collapses first as the window narrows:**

1. The inspector moves from right to bottom (when the lens would be under 760 px).
2. The case bar condenses: tier words become 8 px glyphs with tooltips, the palette field becomes an
   icon, and Capture loses its label.
3. The spine's left gutter shrinks from 200 to 160, and transport keeps only ▶ and the clock.
4. The Screen column shrinks from 300 to 240.
5. Lens bar counts drop, then labels shorten (Network → Net is **not** allowed; labels stay and the bar
   scrolls with chevrons).
6. Under 1100 px the Screen becomes a 40 px strip (live dot, frame age, expand).

The window minimum is 1024 × 640.

---

## 4. Layer stack and the native screen (Q4)

The rule that replaces "hide the mirror while a modal is open": **every floating layer is positioned
inside the _safe area_, which is the window minus the Screen column's rectangle, inset by 8 px.** The
Screen column is a layout sibling, so panes can never overlap it. Only floating layers need the rule.
Implementation: one `useSafeArea()` provider gives every Reka/Cladd floating element
`collisionBoundary = safeAreaEl` and `avoidCollisions: true`. It extends `useOverlayGuard`, which
already watches body portals.

| z    | Layer                                                      | Behaviour                                                                                                                                                                                                  | With the Screen column                                                                                                                                                                                                                                                                    |
| ---- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Shell: case bar, spine, lens bar                           | Static                                                                                                                                                                                                     | The case bar runs above the column (HTML, fine): the native rect starts at the Screen toolbar's bottom edge                                                                                                                                                                               |
| 1    | Panes: lens, drawer, inspector, Screen                     | Layout siblings (Reka Splitter)                                                                                                                                                                            | Never overlap by construction                                                                                                                                                                                                                                                             |
| 2    | Sticky headers: grid head, time gutter, lane labels        | Inside panes                                                                                                                                                                                               | n/a                                                                                                                                                                                                                                                                                       |
| 3    | Spine hover readout and hairlines                          | Drawn **inside** the spine's own canvas, not floating                                                                                                                                                      | n/a. The readout flips to the left of the cursor near the right edge                                                                                                                                                                                                                      |
| 4    | Inspector                                                  | Docked, never floating. Peek (`Space`) focuses it and does not pop anything up                                                                                                                             | n/a                                                                                                                                                                                                                                                                                       |
| 5    | Tooltips, popovers                                         | Floating in the safe area                                                                                                                                                                                  | Tooltips on the Screen toolbar open **to the left**. Tier popovers open downward from the case bar and are clamped to the safe area                                                                                                                                                       |
| 6    | Menus, context menus                                       | Same boundary. App-defined only; the WebView default is suppressed (F-10)                                                                                                                                  | Right-click on the screen (inspect mode) opens a menu anchored to the column's **left** edge at the cursor's y                                                                                                                                                                            |
| 7    | Palette                                                    | Top-centred **in the safe area**: 640 w at 1920, 560 w at 1280. Top at y = 64; max height is the safe-area bottom − 24                                                                                     | Never overlaps. It is the top layer and always wins over 5–6 (fixes F-08)                                                                                                                                                                                                                 |
| 8    | Dialogs                                                    | **Avoided by design.** Confirmations happen inline in the inspector (§6). Only two dialogs remain: an unrecoverable confirm (uninstall, clear data, which needs the package name typed) and device pairing | **Freeze-frame swap:** under a scrim, the native surface is parked and replaced by its last captured frame as an `<img>`, dimmed with the scrim. For Android the canvas simply stays and is dimmed. On close it restores within one frame. The current "hide" behaviour (V-38) is retired |
| 9    | Toasts                                                     | Bottom-left of the lens area, 16 px from the edges                                                                                                                                                         | Never on the right, so never near the column                                                                                                                                                                                                                                              |
| 10   | Drag ghosts (splitters, lens-to-drawer, lane reorder)      | Topmost HTML                                                                                                                                                                                               | The ghost is hidden while the pointer is over the column rect. The column is not a drop target                                                                                                                                                                                            |
| Page | Full-page takeovers: Settings, Export, Pairing, Cases home | Replace the canvas below the case bar; `Esc` returns                                                                                                                                                       | Screen column parked (no live case needed). The spine stays in Export, where you choose the range                                                                                                                                                                                         |

---

## 5. Navigation model (Q2)

- **The rail represents nothing, because there is no rail.** The **lens bar** holds seven fixed
  _lenses_, which are views of the case, in a fixed order for muscle memory: `Ctrl+1…7` (AZERTY-safe, with
  no punctuation keys). A lens is a **mode** of the case: it is never closed and never duplicated.
- **Documents are cases.** You can open several cases (a live one plus received `.capu`s). When more than
  one is open, case tabs (160–220 px) appear inside the case bar, to the left of the case switcher. A
  case can be detached into its own window (Tauri multi-window), which is how you compare live with a
  customer capture side by side. There are no per-table or per-request tabs. A specific object is
  reached through the lens's own navigator (the source list in Data, the request list in Network) plus
  history plus pins.
- **The inspector follows the selection.** Selection is global:
  `selection = { caseId, evidenceRef, t? }`. Every lens writes to it, and the inspector renders a
  resolver per evidence type (request, row, element, log line, app, file, flow step).
  - **Recorded case:** selecting evidence that has a time _moves the playhead_.
  - **Live case:** selection draws a select-blue hairline on the spine at that time and **does not
    move the playhead**, so a developer is never pulled out of live. `Enter` ("go to time") moves it
    deliberately.
  - **Pins:** `P` pins the current inspector item. Up to 5 pins stack at the top of the inspector as
    28 px cards and appear as ◆ marks on the spine.
- **Back and forward walk evidence history, not routes.** `Alt+←/→` and mouse buttons 4 and 5 move
  through entries of the form `(case, lens, selection, playhead)`. Scrubbing is coalesced into one
  entry. An FK peek in the inspector pushes an entry, so Back returns to the row.
- **The palette finds evidence.** It has these scopes: `>` commands, `@` cases and devices, `#` tables and
  stores, `/` requests, `<` elements, `!` errors, `t:` time. `Ctrl+.` opens the action panel for the
  selection.

### Keyboard spine

| Key                        | Action                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `T` / `Shift+T`            | Spine overview ↔ lanes / maximise the spine (template T5)                           |
| `F` or `End`               | Follow live: return the playhead to now                                             |
| `Space` (recorded)         | Play or pause                                                                       |
| `J` / `K` / `L` (recorded) | Back, pause, forward                                                                |
| `Alt+↑/↓`                  | Previous or next evidence of the same type (Perfetto's `,` `.` remapped for AZERTY) |
| `M`                        | Drop a mark at the playhead                                                         |
| `Shift+M`                  | A/B compare range                                                                   |
| `Ctrl+Shift+R`             | Capture start/stop                                                                  |
| `Ctrl+J`                   | Drawer                                                                              |
| `Ctrl+I`                   | Inspector                                                                           |
| `Ctrl+Shift+S`             | Screen column                                                                       |
| `Esc`                      | Clear selection                                                                     |

---

## 6. Timeline and context placement (Q3)

**Where the spine lives:** full width, directly under the case bar, on every lens, live or recorded. It is
never a destination. It has three heights:

| State              | Height                                | Contents                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strip              | 28                                    | Ruler (12) + now-edge + marks overlaid. For users who want the maximum number of rows                                                                                                                                                                                        |
| Overview (default) | 64 at ≥ 900 px tall, 48 below         | Ruler 16 · summary lane 28 (stacked density per category, using the `cat-*` colour **plus** a shape: tick for network, bar for data writes, dot for logs, ▲ for errors) · marks 12 (user marks, flow steps, capture brackets)                                                |
| Lanes              | 64 + 20 × n, up to 40 % of the canvas | Screen thumbnails · Interactions · Network · Data writes · Console · Logcat · Errors · Perf (28 px sparkline) · Flow/agent steps · Marks. Each lane label (160 px gutter) carries its **tier glyph**. A lane its tier cannot feed shows a dashed "needs Companion" body (§7) |

The left gutter (200 / 160 px) holds the transport, the clock in mono at 12 px, the Follow toggle, the
window selector (live: 1 / 5 / 15 min, bounded by the buffer) and the lane picker.

**Live vs recorded.** One shell; the right edge tells the truth.

| Signal                     | Live                                                                          | Live, held in the past                                                                                   | Recorded (`.capu`)                                                      |
| -------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Case switcher prefix       | `● LIVE` (lime dot)                                                           | `● LIVE · held −00:12.4`                                                                                 | `▣ CASE` with a perforated left edge (`prov-recorded`) and the duration |
| Spine right edge           | A lime now-edge that moves, plus the moving trace in the case bar             | A lime now-edge, an ink playhead, and a `Return to live (F)` button at the end of the ruler              | A hard end cap with the end time, an ink playhead, and play controls    |
| Lens header chip           | `now · read 2 s ago`                                                          | `@ −00:12.4` if the lens can reconstruct that time, otherwise `showing now · no history before 15:16:20` | `@ 15:16:21.7 · recorded`                                               |
| Left edge                  | `evidence since 15:12:04` (when the buffer started); never implies older data | same                                                                                                     | The case start                                                          |
| Imported from phone or SDK | –                                                                             | –                                                                                                        | Adds a corner tag: "captured on phone · companion" or "· in-app SDK"    |

**Amendment to DESIGN.md §2:** the playhead is **ink**, not lime. Lime means live, and a recorded playhead is not live.

**How the case bar shows device, app, target, tier and freshness:**

- **Case switcher (Cladd `Popup` + `SearchField` + `List`), max 520 px.** It shows the device nickname
  (the serial is masked and revealed on hover; F-29), then the app icon, name and version, then the
  target. Each segment opens the switcher pre-scoped (`@` grammar).
- **Tier cluster, four fixed slots: `ADB · Shell · Comp · SDK`.** Each slot is an 8 px glyph and, at
  1920, a word. The glyphs are: filled when connected; ring when absent; half when degraded; hatched when
  paused. CDP is shown _inside_ the ADB slot, because it rides the forward. Click a slot to get a popover:
  what this tier delivers right now, what is missing, and the fix ("Companion not installed: native
  network, battery truth and prefs unavailable. [Install over ADB]").
- **Freshness, one value for the whole case:** `read 0.4 s` when live; `paused 00:42` with a hatch; `link
lost 15:16:22` in warning colour. It is derived from `activeContext.link` (the one link truth). No
  other surface may restate the link state (fixes V-34). The status bar is deleted.

---

## 7. States in the layout (Q7)

The rule is **"smallest honest scope wins"**: a gate occupies the smallest region that is actually broken,
and the content it replaces is never claimed to be empty. Gates use the existing resolver (`lib/gates`)
and `GatedView`.

| State                                | Where the gate goes                                                                                                                                                               | Space it takes                       | What stays visible                                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Disconnected** (case had evidence) | Case bar freshness turns warning ("link lost 15:16:22"). The spine's right edge becomes a hatched band from that time on. A notice slot gives the reason and a `Reconnect` action | 28 px notice + hatch                 | Everything already captured, marked stale (degraded, not torn down)                                                                                            |
| **Disconnected** (no evidence yet)   | Cases home, device row gate                                                                                                                                                       | The page                             | The Sources list                                                                                                                                               |
| **Unauthorised**                     | The device row in Cases home and the case switcher: "Allow USB debugging on the phone" plus a live re-check                                                                       | 1 row (32)                           | Other devices                                                                                                                                                  |
| **Target paused** (background)       | One notice slot, plus a hatched now-edge, plus `@ frozen 15:16:20` chips on CDP-fed lens headers                                                                                  | 28                                   | CDP lenses keep their last values under the hatch. ADB-fed lanes (Logcat, SQLite pull, vitals) **keep moving**. That is exactly the honesty the brief asks for |
| **Not debuggable**                   | A lens gate on CDP lenses (Elements, WebView network, IDB/LS): reason, "works on any debuggable build, no code change", what still works over ADB                                 | The lens content (the toolbar stays) | Spine, Logs (Logcat), Device, native SQLite                                                                                                                    |
| **Companion missing**                | Inline at the capability: a dashed lane body on the spine; a section gate inside the lens ("Native requests need the Companion"); a ring glyph in the tier cluster                | 1 lane (20) or 1 section (min 96)    | The rest of the lens                                                                                                                                           |
| **Empty**                            | The lens content's `EmptyState`: cause, then one or two actions ("No requests since 15:12:04. Reload the app"). Never claims "none" unless the read succeeded                     | The lens content                     | Spine (it shows the empty lane too)                                                                                                                            |
| **Loading**                          | Skeleton rows only after 300 ms, inside the region that is loading. The lane shows `reading…`                                                                                     | The region                           | Everything else                                                                                                                                                |
| **Error**                            | Inline at the smallest scope (lane, section, lens) with copyable detail. A toast **only** for a user-initiated action that failed after you left its region                       | Region / 360 px toast                | Everything else                                                                                                                                                |

**Precedence in the single notice slot:** link lost > unauthorised > paused > another WebView in front >
mocks active. Lower-priority notices become a count on the slot ("+1").

---

## 8. Personas (Q8)

**Progressive disclosure, no mode switch** (the reasoning against Replay.io's viewer/DevTools toggle is in §1).
Three mechanisms do the work:

1. **The default lens depends on the case kind.** A recorded case opens on **Story**, with an auto
   summary card at the top: errors, failed requests, data writes, marks. A live case opens on the **last
   lens used for live**.
2. **Writes appear only where they are true.** Recorded cases are read-only by nature. In live cases,
   mutations appear only as inspector actions, behind an inline typed confirm for destructive ones (fixes
   F-19), never as hero buttons.
3. **Saved views.** A developer saves a Data or Network filter as a named view inside the case ("Stock for
   SKU"). It appears in Story's summary card as a one-click link.

| Persona                                       | Path                                                                                                                                                                                                                                                   | Steps                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Developer at the desk (quick live inspection) | The app starts and auto-opens the live case for the last device and app if it is online, then `Ctrl+K #orders` gives the grid at now, then `Ctrl+J` shows Logcat and console beside it                                                                 | 1 keystroke + 1 query. Today it takes 3 clicks plus knowing that SQLite sits under Data |
| QA capturing                                  | `○ Capture` (it pre-rolls the last 2 min from the buffer), reproduce, `Stop`. The case closes into a recorded case on Story with its summary, then `⇪ Share` goes to the Export page (range on the spine, a redaction preview, `.capu`/HAR, copy path) | 4 actions, no file system knowledge (fixes W3)                                          |
| Support opening a received `.capu`            | Double-click the file or drop it on the window, then Story with summary and saved views, then click "Stock for SKU", then Data @ T                                                                                                                     | No ADB, no device. The tier cluster says "recorded · captured by companion"             |
| Product checking a feature                    | `Ctrl+7` Checks, then the library, then Run, and each step lands on the spine as a mark with pass/fail                                                                                                                                                 | Same shell                                                                              |
| Field technician                              | Companion only: Capture on the phone, then Send. Desktop opens the result as a case                                                                                                                                                                    | None on desktop                                                                         |

---

## 9. Docking and splitting (Q5)

| Element                          | Split                                          | Drag                  | Pin                          | Detach                                | Persists across relaunches                                                  |
| -------------------------------- | ---------------------------------------------- | --------------------- | ---------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| Lens / inspector / Screen widths | Yes (Reka Splitter)                            | Dividers              | –                            | –                                     | Yes, per window                                                             |
| Inspector placement              | Auto (right/bottom by width), user-overridable | –                     | Items (max 5)                | –                                     | Override yes; pins per case                                                 |
| Drawer                           | Holds one lens, so two lenses show at once     | Lens tab → drawer     | –                            | –                                     | Lens and height                                                             |
| Spine                            | Height and lanes                               | Lane reorder          | Lanes pinned to the overview | –                                     | Height, lanes, order, window                                                |
| Screen column                    | Width                                          | –                     | –                            | Yes (existing detached mirror window) | Width, detached state                                                       |
| Cases                            | –                                              | Case tab → new window | –                            | Yes                                   | Recorded cases reopen lazily. The live case reopens if its device is online |
| Filters and saved views          | –                                              | –                     | –                            | –                                     | Filters per lens; saved views inside the `.capu`                            |

**Fixed on purpose:**

- Case bar height and order.
- The spine's position at the top. It can never be hidden; the minimum is the 28 px strip.
- Lens order (`Ctrl+1…7` must never move).
- The Screen column on the **right**. The mirror store's `side: left` option is retired, so the safe area
  stays predictable.
- One notice slot.
- The **live** case's playhead and selection are not persisted, because "live" is not a saved state.

---

## 10. Screen templates (Q6)

Six templates. Every one sits under the same case bar, spine and lens bar, so only the lens content area
is drawn below. The widths shown are for the 1258 px lens at 1920.

### T1 · Stream (time-ordered evidence)

```
┌ toolbar 36 ─ ⌕ Filter (SearchField sm, 280) │ Segmented: All Req Data Logs Err │ @ now · 2 s ┐
├ 72 time gutter ┬ 16 ┬ summary (Sans 13) ─────────────────────────┬ tier 40 ┬ meta 96 ───────┤
│ 15:16:21.7     │ ┃  │ POST /sync → 500                            │ ADB     │ 412 ms         │ 26
│ 15:16:22.0     │ ▮  │ orders · row 412 · status → failed          │ ADB     │ 1 write        │ 26
│ 15:16:22.1     │ •  │ console.error SyncError: timeout            │ ADB     │                │ 26
│ 15:16:22.1     │ ▲  │ Logcat E/Retail: sync aborted               │ Shell   │                │ 26
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Virtualised. Hovering a row draws a hairline on the spine. Space focuses the inspector. Rows are 26, or 22 compact.
```

Used by Story, Logs (Logcat + console + exceptions, with a 32 px REPL input at the bottom), Network
requests, and Checks › Run detail.

### T2 · Source tree + grid (Data)

```
┌ sources 240 ───────────┬ toolbar 36: table ▸ breadcrumb · WHERE well · ⌕ · Columns · Export ─┐
│ ⌕ Filter               │ header 26 (type glyph + name, content-aware widths)                  │
│ Native                 ├──────────────────────────────────────────────────────────────────────┤
│  ▸ store.sqlite3       │ rows 26 · mono for numbers/ids · Sans for text · NULL subtle italic  │
│ WebView                │                                                                      │
│  ▸ IndexedDB · 3       │                                                                      │
│  ▸ OPFS SQLite         │                                                                      │
│ Local copies           ├ footer 24: 50 of 165 · @ now · ADB pull 2 s ago · local copy ────────┤
└────────────────────────┴──────────────────────────────────────────────────────────────────────┘
```

Used by every Data source (IDB, LS/SS, LocalForage, Cache, OPFS, SQLite native/OPFS/jeep, cookies). The
graph view is a toggle in the toolbar, not a source. This gives three rows of chrome before the data
(36 + 26), against today's six (V-57, the 27 % chrome ratio).

### T3 · Tree + detail

```
┌ toolbar 36: ⌕ Search DOM · ◎ Inspect on screen · Segmented: DOM │ Components ─────────────────┐
├ tree (fills lens) · rows 22 · indent 12 · attributes as spaced tokens (fixes V-09) ──────────┤
│ ▾ <body class="…">                                                                          │
│   ▸ <div id="app">                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Detail (styles, computed, box model, file preview) renders in the INSPECTOR, not a second pane.
```

Used by Elements (DOM, framework components) and Device › Files (opens on the app's folders when a case
app exists; `/` is an explicit choice).

### T4 · List–detail (objects)

```
┌ toolbar 36: ⌕ · Segmented filter · "84 shown of 439" (one count source) ─────────────────────┐
├ table 26 rows (Cladd Table / DataGrid), name first, ids secondary ───────────────────────────┤
│ ▢ Retail app        com.example.retail     0.1.10   running   234 MB                         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 The selected object is shown in the inspector: facts with their source, then actions (Open as case, Launch, Stop…).
```

Used by Device › Apps, Device › Ports, Network › Mocks, Checks › Library, and Cases home.

### T5 · Track view (the maximised spine)

```
┌ lane gutter 160 ┬ ruler 16 ─────────────────────────────────────────────────────────────────────┐
│ Screen   ADB    │ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ (thumbnails 36 × 20)                                    40   │
│ Network  ADB    │ ┃ ┃┃  ┃     ┃┃┃                                                       20   │
│ Data     ADB    │ ▮   ▮▮                                                                  20   │
│ Perf     Shell  │ ▁▂▃▅▇▅▃▂▁ CPU · ▂▂▃▃ mem (MB, units on axis)                            28   │
│ Native net Comp │ ┄┄┄┄┄┄┄┄ needs Companion · Install ┄┄┄┄┄┄┄┄                            20   │
└─────────────────┴──────────────────────────────────────────────────────────────────────────────┘
 Shift+T. WASD zoom/pan (Perfetto). Area-drag selects a range, which drives every lens and Export.
```

Used for Device › Vitals (CPU, memory, battery and thermal as lanes, never as hero numbers: fixes F-02
and F-07), case comparison A/B, and Export range selection.

### T6 · Page (full-page takeover)

```
┌ section nav 200 ┬ content max 720, 16 px gutter, sections 24 apart ─────────────────────────────┐
│ General         │ Field rows 32: label (Sans 13) left 240 · Cladd control right                   │
│ Connection      │                                                                                │
│ Agents & MCP    │                                                                                │
└─────────────────┴────────────────────────────────────────────────────────────────────────────────┘
```

Used by Settings, Export and redaction, Device pairing, and the Companion install walkthrough.

### Current screens → template

| Today                                            | Becomes                                              | Template                    |
| ------------------------------------------------ | ---------------------------------------------------- | --------------------------- |
| Device › Overview                                | Device lens › Overview (fact sheet + actions)        | T4 (facts in the inspector) |
| Device › Apps                                    | Device › Apps                                        | T4                          |
| Device › Files                                   | Device › Files                                       | T3                          |
| Device › Performance                             | Device › Vitals                                      | T5                          |
| Device › Logcat (dock)                           | Logs lens                                            | T1                          |
| App › Overview, App › Data usage                 | The app's inspector (from Apps or the case switcher) | T4 detail                   |
| App › Performance                                | Device › Vitals filtered to the case app             | T5                          |
| Data › IDB, LocalForage, LS, Cache, OPFS, SQLite | Data lens sources                                    | T2                          |
| Data › Graph                                     | Data toolbar view toggle                             | T2                          |
| Network › Requests                               | Network lens                                         | T1                          |
| Network › Mocking                                | Network › Mocks (behind the maturity flag)           | T4                          |
| Elements, Vue                                    | Elements lens (DOM, Components)                      | T3                          |
| Replay picker                                    | Cases home                                           | T4 (page)                   |
| Replay player                                    | **Dissolved:** a recorded case in the same shell     | all                         |
| Flows (agent)                                    | Checks lens: Library, Runs; the agent is an author   | T4 + T1                     |
| Console, REPL, Exceptions (dock)                 | Logs lens; the drawer by default                     | T1                          |
| Settings (route-modal)                           | Settings page                                        | T6                          |
| Preview (palette-only)                           | Cases home › Sources › Local preview                 | T4                          |
| Mirror pane                                      | Screen column                                        | –                           |

---

## 11. Capability → home (every inventory row)

| Inventory row                                                 | Home                                                                                                                                       | Notes                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| Physical connections                                          | Cases home › Sources (USB, Wi-Fi connect, pair → T6 Pairing page); case switcher `@`                                                       | –                                   |
| Session management                                            | The case model: case bar (active device/app/target), derived link state, freshness. Leases and queues → Settings › Agents & MCP › Activity | –                                   |
| Android emulators                                             | Cases home › Sources › Emulators (launch)                                                                                                  | –                                   |
| Local browser/runtime                                         | Cases home › Sources › Chrome on this PC, Local preview; renders in the Screen column (the native case)                                    | –                                   |
| Device operations (reboot, root, ADB restart, TCP)            | Device › Overview actions + palette `>`; ADB restart is also in the ADB tier popover                                                       | –                                   |
| Applications (list, metadata, launch, stop, clear, uninstall) | Device › Apps (T4); detail and actions in the inspector, with typed confirm for destructive actions; "Open as case"                        | –                                   |
| Targets (sockets, CDP forward, external DevTools)             | The case switcher's third segment; "Open in Chrome DevTools" in its menu                                                                   | –                                   |
| Ports                                                         | Device › Ports (T4)                                                                                                                        | –                                   |
| Device shell                                                  | Device › Shell, openable in the drawer                                                                                                     | –                                   |
| Device files                                                  | Device › Files (T3)                                                                                                                        | –                                   |
| Native logs (Logcat)                                          | Logs lens + Logcat lane                                                                                                                    | –                                   |
| Native performance                                            | Device › Vitals (T5) + Perf lane                                                                                                           | –                                   |
| DOM                                                           | Elements (T3) + Screen inspect mode                                                                                                        | –                                   |
| CSS                                                           | Inspector › Styles, Computed, Box for the selected element                                                                                 | –                                   |
| JavaScript console                                            | Logs lens (stream) + REPL row; drawer default                                                                                              | –                                   |
| Framework DevTools                                            | Elements › Components, shown only when detected                                                                                            | –                                   |
| HTTP                                                          | Network lens (T1) + Network lane                                                                                                           | –                                   |
| Advanced network (WS, interception, mocks)                    | WS frames in the request inspector; Network › Mocks behind the maturity flag; "mocks active" notice                                        | –                                   |
| IndexedDB                                                     | Data (T2) › WebView                                                                                                                        | –                                   |
| Local and session storage                                     | Data › WebView                                                                                                                             | –                                   |
| Cookies                                                       | Data › WebView (when the adapter ships)                                                                                                    | –                                   |
| Cache API                                                     | Data › WebView                                                                                                                             | –                                   |
| OPFS                                                          | Data › WebView (file tree source)                                                                                                          | –                                   |
| LocalForage                                                   | Data › WebView                                                                                                                             | –                                   |
| Native SQLite                                                 | Data › Native                                                                                                                              | –                                   |
| SQLite local files (import/export/overwrite)                  | Data › Local copies + Cases home › Import                                                                                                  | –                                   |
| Browser-backed SQLite                                         | Data › WebView with a human source label ("OPFS · SAH pool")                                                                               | –                                   |
| Screen interaction                                            | Screen column (live)                                                                                                                       | –                                   |
| Media capture (screenshot, screen recording)                  | Screen toolbar; the output lands as a mark on the spine                                                                                    | –                                   |
| Session recording                                             | `○ Capture` in the case bar (with pre-roll)                                                                                                | –                                   |
| Recording library                                             | Cases home › Recent cases (search, filters, size, redaction status)                                                                        | –                                   |
| Recorded database evidence                                    | Data @ T in recorded cases + Data writes lane                                                                                              | –                                   |
| Cross-track queries                                           | Inspector › Related (±2 s correlate); Story filter grammar; palette `t:` and `!`                                                           | –                                   |
| MCP (server, token, mutation mode, tool catalog)              | Settings › Agents & MCP; live agent calls appear on the Agent lane and as an `Agent ●` chip in the case bar                                | 56 tools in code (synthesis ruling) |
| Updates                                                       | Settings › Updates                                                                                                                         | –                                   |
| Hybrid/Capacitor panels                                       | **No home, deliberately**, per owner decision 1. Facts surface inside Data and Elements only                                               | –                                   |
| Integrated AI chat                                            | None now. Future: Inspector › Ask, scoped to the selection                                                                                 | Proposed                            |
| Automation history and approvals                              | Checks › Runs; approvals as inline cards in the inspector + Agent lane                                                                     | Proposed                            |
| _(not in inventory)_ Flows / agent                            | Checks lens                                                                                                                                | –                                   |
| _(not in inventory)_ Companion pairing and install            | ADB tier popover → T6 walkthrough                                                                                                          | –                                   |
| _(not in inventory)_ Settings                                 | T6 page                                                                                                                                    | –                                   |

**MCP catalog → UI home:**

| Tool group        | UI home                       |
| ----------------- | ----------------------------- |
| Session           | Case switcher                 |
| Emulator          | Sources                       |
| Device            | Screen / Device               |
| Web               | Lenses                        |
| Frontend bridge   | Capture                       |
| Recorded evidence | Cases home and recorded cases |

Every agent call is shown on the Agent lane. Nothing is orphaned, and each capability has exactly one
primary home; the palette is an index, not a second home.

---

## 12. Density and grid (Q9)

**Base unit 4.** Spacing scale **4 · 8 · 12 · 16 · 24 · 32**, nothing else. **Type** uses five existing
Bench tokens only:

| Role  | Token       | Size/line | Weight          |
| ----- | ----------- | --------- | --------------- |
| meta  | `text-2xs`  | 11/16     | 400             |
| data  | `text-xs`   | 12/16     | 400             |
| ui    | `text-sm`   | 13/18     | 400, 500 active |
| title | `text-base` | 14/20     | 500             |
| page  | `text-xl`   | 18/24     | 600, T6 only    |

Mono is used at 400/500 only, for numbers, ids, time and code.

| Region                | Height / width                                    | Padding                | Type                                                          | Components                                                                                                                                                 |
| --------------------- | ------------------------------------------------- | ---------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Case bar              | 40; controls 28; gap 8                            | x 8                    | Crumb `sm`; tiers `2xs`; clock `xs` mono                      | Cladd `Toolbar`, `ToolbarButton`, `Popup`+`List`+`SearchField`, `Popover`, `Button` (`transparent`; Capture `solid-fill` only while recording), `Shortcut` |
| Spine                 | 64 / 48 / 28; lanes 20, perf 28, screen 40        | Gutter 200/160, x 8    | Ruler `2xs` mono subtle; lane labels `2xs`                    | Custom canvas renderer (no Cladd equivalent), `ToggleButton` for Follow, `Segmented` for the window                                                        |
| Lens bar              | 32; tab x-padding 12                              | x 8                    | `sm` 500 active; counts `2xs` mono subtle                     | Cladd `Tabs`/`TabsList`/`Tab` (navigation only)                                                                                                            |
| Notice slot           | 28                                                | x 12                   | `sm`                                                          | `Surface` + hatch (`prov-stale`) + `Button`                                                                                                                |
| Lens toolbar          | 36; controls 24; gap 8                            | x 12                   | `sm`                                                          | `Toolbar`, `SearchField` sm, `Segmented` (filters only), `ToolbarButton`                                                                                   |
| Rows                  | 26 default / 22 compact (T3 tree 22)              | Cell x 8               | `xs` data                                                     | `DataGrid` (shared, on Cladd table language), `Table` for under 50 rows, Reka virtualiser                                                                  |
| Inspector             | 360 (300–520) or 240 h                            | 12; sections 16 apart  | Title `base` 500; KV label `2xs` subtle at 120 px, value `xs` | `Surface`, `SectionTitle`, `List`, `Chip` (neutral; state chips carry an icon), `Button`                                                                   |
| Screen column         | 300 (220–560); toolbar 32 with 24 buttons; nav 32 | 12                     | –                                                             | Existing `MirrorPanel`; `ToolbarButton`; `Tooltip` (left)                                                                                                  |
| Drawer / bottom panel | 240 (120–60 %); tab strip 28                      | x 12                   | `xs`                                                          | `Tabs` dense                                                                                                                                               |
| Toast                 | 360 w                                             | 12                     | `sm`                                                          | Cladd `ToastsPortal` (bottom-left)                                                                                                                         |
| Page (T6)             | Content max 720; rows 32                          | Gutter 16; sections 24 | Title `xl`                                                    | `FieldGroup`, `Field`, `Select`, `Switch` (fixes V-05)                                                                                                     |

**Radius:** 4 for chips and cells, 6 for controls (`--cladd-radius`), 8 for popovers and pages.
**Depth:** bevel or border on each edge, never both; `shadow-float` on floating layers only.

**Still on Reka until Cladd has an equivalent:** menus and context menus, the command palette, the
splitter, the tree, and virtual lists (DESIGN §5). That is a buildability risk the shell owns (§14).

---

## 13. Migration (Q10)

Each step ships alone, is behind a flag where it is risky, and deletes something.

| Step                                                 | Ships                                                                                                                                                                                                | Deletes                                                                                    | Reuses                                                                    | Flag                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | --------------------------------------- |
| **M0 · Truth** (wk 1–2, the synthesis "Truth" track) | One derived link state; `GatedView` everywhere; the safe-area provider (popovers, menus and toasts avoid the Screen rect; toasts move bottom-left); freeze-frame swap for dialogs                    | Per-panel status pills, hide-the-mirror behaviour, seeded zeros                            | `lib/gates`, `activeContext.store`, `useOverlayGuard`                     | –                                       |
| **M1 · Case bar**                                    | Title bar + context pill + status bar merged into the case bar: tier cluster, freshness, `Capture` (neutral idle state), mirror toggle renamed "Screen"                                              | **Status bar**, the "Device" toggle name (F-11), the red idle dot (V-16)                   | `TitleBar`, `ContextBar`, `StatusBar` logic                               | –                                       |
| **M2 · Spine v0**                                    | Collapsed spine under the case bar, fed by today's live stores (network, console, logcat) **since connect**, with an honest left edge                                                                | –                                                                                          | `ReplayTimeline`, the replay `clock` (`positionMs`), lane components      | `shell.spine` (default on after 1 week) |
| **M3 · Recorded = case**                             | Opening a `.capu` opens a recorded case in the same shell; lenses read through a `CaseSource` interface (live store or recorded track); Cases home replaces the Replay picker and the Device landing | The `/replay` route and `ReplayView`'s private tab strip                                   | Replay panels become lens adapters                                        | –                                       |
| **M4 · Lens bar**                                    | Rail → lens bar; Device + App merged into the Device lens; Flows → Checks with the library first                                                                                                     | The rail (kept one release behind `shell.legacyRail`), duplicated Overview and Performance | `featureRegistry` → `lensRegistry` (the `placement` field already exists) | `shell.legacyRail`                      |
| **M5 · Story + inspector**                           | Story lens, the global selection store, inspector with Related, evidence history, palette `#` `/` `!` `t:`                                                                                           | Route-based ‹ › history                                                                    | `query_recording` correlate logic                                         | –                                       |
| **M6 · Buffer**                                      | Live ring buffer (default 5 min, memory-capped), Capture pre-roll, spine lanes and T5, the drawer                                                                                                    | The dock as a separate concept                                                             | `BottomDock` → drawer                                                     | `capture.buffer`                        |
| **M7 · Tiers**                                       | Companion and SDK slots light up; lane and section gates for missing tiers                                                                                                                           | –                                                                                          | –                                                                         | Ships with Companion v0                 |

**Honest cost:** M3 and M6 are the expensive steps. `CaseSource` touches every lens, and the ring buffer
is new work in Rust: no buffer exists in the source today. M0–M2 are about two weeks of shell work and
already deliver "the timeline is visible on every screen".

---

## 14. Assumptions, the three biggest risks, alternatives

**Assumptions:**

- A live ring buffer can hold 5 minutes of network, console, logcat and perf evidence within budget.
- `.capu` and live events can share one typed event index at interactive speed (study §5.2).
- Reka floating-ui accepts a per-instance `collisionBoundary`.
- Tauri supports a second window per case.

**Risks, and how to test each before building:**

1. **The live spine is empty or costly without a ring buffer.** If it shows only "since connect" and
   costs CPU, it becomes chrome.
   - **Test (3-day spike, Rust):** a 30-minute soak on a mid-range phone with network, console, logcat
     and a 1 Hz perf buffer.
   - **Budgets:** desktop under 3 % CPU and 150 MB; no measurable on-device jank in the frame lane;
     scrub-to-T under 50 ms.
   - **Fail:** ship M2 "since connect" only, and make the buffer opt-in.
2. **Losing the rail slows down expert developers.** Lens keys and a 32 px tab bar might be slower than
   a labelled rail for spatial users.
   - **Test:** a clickable prototype (the two variants, via `anthropic-skills:prototype`) with 5
     developers and 6 timed quick-inspection tasks: open a table, find a request, see Logcat beside the
     grid, find an element from the screen, read app facts, switch app. The current build is the
     baseline.
   - **Pass:** median time no worse, and fewer pointer travels.
   - **Fail:** keep `shell.legacyRail` as a user preference. The rest of the design survives.
3. **Non-developers misread "@ T" against "now".** Live-held and recorded semantics could confuse the
   people the case model is built for.
   - **Test:** a 5-second test plus tasks W3/W4 with 5 QA and support people, using a recorded case and
     a live-held case in a prototype.
   - **Pass:** at least 4 out of 5 correctly state whether the Data grid shows now or the past, and they
     finish W3 in under 2 minutes.
   - **Fail:** make the lens header chip a full-width 24 px time band in the lens (hatched for the past).

**Alternatives considered:**

- **Spine at the bottom (Sentry, the study):** rejected. It stacks with the drawer and loses the reading
  order.
- **Keep the rail and add the spine:** this is proposal A territory. It is cheaper, but the protocol
  nouns stay as the IA.
- **Merged stream as the only surface (04 §8.4):** rejected as the sole surface, because expert work
  needs dense single-lens grids. It is kept as the Story lens and the default for recorded cases.

**What this design sacrifices, plainly:**

- The always-visible rail with spatial one-click navigation.
- The status bar and its vitals line (vitals live on the Perf lane).
- Per-object document tabs.
- A left-side mirror.
- Most modal dialogs.
- 48–64 px of vertical space on every lens.
- Replay as a place.
- Viewing two live devices in one window (use a second window).
