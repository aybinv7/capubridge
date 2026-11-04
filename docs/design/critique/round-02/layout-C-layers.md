# Round 02 · Layout proposal C (Progressive layers)

2026-11-04 · Angle: persona-progressive layers · Author: principal product designer (proposal, not
critique) · `[AI-assisted]`

Inputs read in full: `LAYOUT-BRIEF.md`, `BRIEF.md`, `RUBRIC.md`, `round-01/00-synthesis.md`,
`round-01/04-product-design.md`, `round-01/05-visual-craft.md`, the capability inventory,
`apps/desktop/DESIGN.md`, the 2026-11-04 study §4 and §6, and the 2026-09-12 persistent shell contract.
I also skimmed `packages/cladd/src`, `apps/desktop/src/components/layout`, `components/gate`,
`modules/mirror` and `app/feature-registry.ts`. I read the evidence screenshots, which are 1920×1020 at
125 % scaling. **Every number in this document is in CSS px at 100 %.**

---

## 0. Thesis

**One window holds one session, and the session has three depths.**

| Depth  | Name        | What it shows                                                                                                         | Who lives there            |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **L0** | Story       | The phone's screen, the timeline, and a plain-language story of what happened. This is the home.                      | QA testers, support agents |
| **L1** | Evidence    | The inspector that follows the selection: a summary first, then raw detail, provenance, related evidence and actions. | Support agents digging in  |
| **L2** | Instruments | Data, Network, Elements, Logs and Device, built for depth.                                                            | Developers                 |

Each persona enters at a different depth, and everyone can go deeper with one click or key. The shell
never changes its regions, its order or its vocabulary between personas. **Depth is disclosed, and
never switched.**

Two regions are fixed on every screen and at every depth. Both are inviolable layout, not decoration:

- **The timeline band** runs the full width above the status bar.
- **The honesty layer** has one link chain in the context bar and one gate slot system in every
  template.

Live and recorded sessions use the same shell. Only the right edge of the timeline and the provenance
pattern change.

### What I deliberately sacrifice (summary; details in §11)

1. **No document tabs.** There is one view per instrument, plus at most one split. The 2026-11-04
   study's tab system is rejected.
2. **The device pane always sits on the right**, and no overlay ever enters the stream rectangle. The
   left-side option is removed.
3. **The timeline can never be hidden.** Its floor is 40 px, at every size.
4. **There is no "simple mode" for non-developers.** They see the same rail, folded.
5. **The full-width bottom dock is gone.** Logs become an instrument, and only interactive terminals
   (REPL, Shell) live in a workspace drawer.
6. **Rail labels disappear below 1440 px** of window width.

### A finding that changes the hard constraint

The brief says the mirror is a native child webview. For Android it is not:

- `modules/mirror/MirrorStream.vue:292` draws scrcpy frames into a DOM `<canvas>`, decoded by
  `mirrorDecoder.ts`.
- The native child webview is only used for **local browser targets**
  (`MirrorPanel.vue:414` `LocalWebviewHost`, `stores/localWebview.store.ts:176` `new Webview(...)`).
- The overlay guard (`composables/useOverlayGuard.ts`) only parks that local webview.

I still design one contract for both cases, the **"stream rectangle is a hole"** rule (§4). The reasons:

- The same pane slot hosts both sources.
- A rule that depends on the source would split every overlay decision in two.
- It keeps the door open to a native-surface mirror for performance later.

On Android the rule costs almost nothing. I flag the discrepancy so the brief can be corrected.

---

## 1. Region map

### 1.1 Full shell at 1920×1080, inspector open

```
x: 0   72                                  1200          1560                 1920
y0 ┌──────────────────────────────────────────────────────────────────────────────┐
   │◩ Live ▾ › Phone-class ▾ › Shop app ▾ › WebView ▾ │ADB● Web● Agt○ Cmp○ SDK–│ ●Capture │⌕ Search  Ctrl K│ – ▢ ×│ CONTEXT BAR 40
y40├──────┬──────────────────────────────┬──────────────┬─────────────────────────┤
   │ ▣    │ Sub-nav (Tabs)          32   │ INSPECTOR    │ Pane bar 32 [fps·age ⋯] │
   │Session│─────────────────────────────│ 360          │─────────────────────────│
   │──────│ Toolbar (Toolbar)        36   │ header 36    │                         │
   │Instr.▾│─────────────────────────────│ ───────────  │                         │
   │ Data │ [Strip gate 32 if any]       │ Summary      │   STREAM RECT  (hole)   │
   │ Netw.│                              │ Details ▸    │   ≈ 344 × 745           │
   │ Elem.│ BODY (template)              │ Provenance   │   aspect-fit, centred   │
   │ Logs │ 1128 × 764                   │ Related      │                         │
   │ Dev. │ (732 with a gate strip;      │ Actions      │                         │
   │──────│  drawer closed)              │              │                         │
   │ Flows│                              │              │─────────────────────────│
   │      │ [Drawer: REPL · Shell] 0/240 │              │ Controls 32 ◁ ○ □ 🔊     │
   │Libr. │                              │              │                         │
   │ ⚙    │                              │              │                         │
y872├──────┴──────────────────────────────┴──────────────┴─────────────────────────┤
   │ ● LIVE  buffer 5:00 │ ruler 16 ··−4:00·····−3:00·····−2:00·····−1:00·····│now  │ TIMELINE 184
   │ gutter 120          │ Screen   ▮ ▮  ▮    ▮▮      ▮       ▮ ▮      ▮    ▮ ┃     │ header 24
   │ [Save last 5 min]   │ Network  ╷╷ ╷ ╷╷╷   ╷  ╷╷  ✕     ╷  ╷╷╷   ╷     ╷ ┃     │ ruler 16
   │ [Mark  M]           │ Data     ▪   ▪▪       ▪          ▪▪            ▪ ┃     │ 6 lanes × 24
   │                     │ Logs     ·· · ···  · ·· ·  ··  · ·· ·   ··  · ·· ┃     │
   │                     │ Errors           ◆                   ◆           ┃     │
   │                     │ Marks / Steps        ▼                 ▼         ┃     │
y1056├────────────────────────────────────────────────────────────────────────────┤
   │ ⏺ Capturing 02:14 · buffer 38 MB · 2 mocks active · MCP: 1 agent (read) · Copied ✓│ STATUS 24
y1080└──────────────────────────────────────────────────────────────────────────────┘
```

Vertical split: context bar y0–40, panes y40–872 (**832**), timeline y872–1056 (**184**), status bar
y1056–1080. The canonical numbers are in the table below.

| Region      | 1920×1080 default                       | 1280×800 default                                       | Min     | Max                      | Notes                                                                                          |
| ----------- | --------------------------------------- | ------------------------------------------------------ | ------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| Context bar | 40 h                                    | 40 h                                                   | 40      | 40                       | Fixed. The draggable region is the empty space between its groups.                             |
| Rail        | 72 w (labelled)                         | 48 w (icons)                                           | 48      | 72                       | The two widths are two states, not a drag.                                                     |
| Workspace   | 1128 w (inspector open) / 1488 (closed) | 912 w                                                  | **560** | —                        | Always takes the leftover width.                                                               |
| Inspector   | 360 w column                            | shares the 320 right column, or overlays the workspace | 320     | 480                      | Closes when nothing is selected, unless pinned.                                                |
| Device pane | 360 w                                   | 320 w (shared column)                                  | 280     | 520                      | Fixed on the right. The pane bar and controls are HTML; only the stream rectangle is the hole. |
| Drawer      | 0 (closed), 240 when open               | 0 / 200                                                | 120     | 60 % of workspace height | Lives inside the workspace column only.                                                        |
| Timeline    | 184 h (expanded)                        | 40 h (collapsed)                                       | **40**  | 50 % of window height    | Expanded by default when the window is at least 960 px tall.                                   |
| Status bar  | 24 h                                    | 24 h                                                   | 24      | 24                       | Ambient facts only, never link state (§3.3).                                                   |

Pane height at 1920×1080: 1080 − 40 − 184 − 24 = **832**. Workspace body: 832 − 32 (sub-nav) − 36
(toolbar) = **764**, or 732 with a gate strip.

### 1.2 Full shell at 1280×800 (must work fully; this is the design target, not a degraded mode)

```
x: 0  48                                         960              1280
y0 ┌─────────────────────────────────────────────────────────────────┐
   │◩ Live▾ › Phone▾ › Shop app▾ › WebView▾ │● ● ○ ○ –│ ●Capture │⌕│ – ▢ ×│ 40
y40├────┬────────────────────────────────────────┬────────────────────┤
   │ ▣  │ Sub-nav 32                             │[Screen|Inspector] 32│  ← Segmented
   │────│────────────────────────────────────────│────────────────────│
   │ ▤  │ Toolbar 36                             │                    │
   │ ◎  │────────────────────────────────────────│   STREAM RECT      │
   │ ⌖  │ [Strip gate 32]                        │   ≈ 284 × 616      │
   │ ≡  │                                        │   (hole)           │
   │ ▢  │ BODY 912 × 628                         │                    │
   │────│ (24 rows at 26 px in a grid)           │                    │
   │ ▶  │                                        │                    │
   │ ▥  │              ┌ Inspector overlay 360 ─┤│────────────────────│
   │ ⚙  │              │ (only when Screen is  ││ Controls 32        │
   │    │              │  pinned / capturing)  ││                    │
y736├────┴──────────────┴───────────────────────┴┴────────────────────┤
   │ ● LIVE 5:00 │ merged lane: ╷▮╷╷▪·· ✕ ╷▮ ·▪ ◆ ╷ ··▮ ╷▪ ·· ▼ ╷▮ ┃now│ 40
y776├─────────────────────────────────────────────────────────────────┤
   │ ⏺ 02:14 · 38 MB · 2 mocks · MCP 1                               │ 24
y800└─────────────────────────────────────────────────────────────────┘
```

- Panes: 800 − 40 − 40 − 24 = **696** high. Workspace body: 696 − 68 = **628**. That is 24 grid rows
  at 26 px after a 28 px header.
- The right column is 320 wide and holds **Screen** or **Inspector**, switched with a Cladd
  `Segmented`.
- Selecting evidence switches the column to Inspector, with two exceptions where the inspector slides
  over the right 360 px of the workspace instead (z4, §4):
  - while capturing;
  - while the user has pinned Screen (`Ctrl+Shift+S`).

  The inspector never covers the hole.

### 1.3 Collapse order (narrowest window last)

Each step fires at a window width. Height is handled separately.

| Order  | Window width | What changes                                                                                                                                                    |
| ------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | < 1760       | The inspector shrinks to 320 and the device pane to 320.                                                                                                        |
| 2      | < 1600       | The context bar drops its tier labels (glyphs remain, with tooltips) and the wordmark (the mark remains).                                                       |
| 3      | < 1440       | The rail goes to 48 (icons, right-side tooltips). The inspector and Screen share the right column (§1.2).                                                       |
| 4      | < 1180       | The device pane collapses to a 48 px **screen tab**: a frame-age chip plus "Open screen", which opens the existing detached mirror window (`MirrorWindow.vue`). |
| 5      | < 1024       | Unsupported. A 1024 floor is enforced through `minWidth` in `tauri.conf`.                                                                                       |
| Height | < 960 tall   | The timeline defaults to collapsed (40). It never goes below 40.                                                                                                |

The rule behind this order: **things that show evidence go before things that show chrome**. The
timeline, the device frame and the workspace minimum of 560 are the last to give way.

---

## 2. Navigation model

### 2.1 What the rail represents: depths, then jobs inside L2

```
┌ 72 ┐
│ ▣ Session      g h   L0  the story of the open session (live or recorded)
│ ── Instruments ▾      L2  group header, 20 px, foldable (persisted)
│ ▤ Data         g s
│ ◎ Network      g n
│ ⌖ Elements     g e
│ ≡ Logs         g l
│ ▢ Device       g d
│ ──
│ ▶ Flows        g f
│ (flex)
│ ▥ Library      g r   all sessions: recordings, received captures, flow runs
│ ⚙ Settings     g ,
└────┘
```

- The rail is **not** made of protocols and **not** made of personas.
  - The top item is the depth everyone shares (L0).
  - The folded group is the expert depth (L2).
  - Flows and Library are objects that produce or hold sessions.
- **Fold rule.**
  - The way you enter sets the default fold for that install:
    - opening a `.capu` by file association or drag → **folded**;
    - opening a capture from the companion → **folded**;
    - a normal launch → **unfolded**.
  - After that, only the user changes it, and the choice is persisted.
  - Folded, the group is one 40 px row, "Instruments ▸ 5". Hover or `Alt+I` flies the items out _to the
    right of the rail_. That flyout is an overlay in the free rectangle, so it is safe.
  - Nothing is ever hidden. It is only folded.
- **Instruments that cannot run** in the current session stay in place. They are never re-ordered or
  removed. A 6 px hollow ring on the icon means "gated". An example is Elements on a recorded
  session that has no DOM track. Clicking it shows the gate.
- **Maturity** ("beta", "experimental") never appears in the rail or in tooltips. It appears once, as a
  `Chip` at the end of the instrument's sub-nav (fixes round-01 F-13 and V-08).

### 2.2 Tabs are modes, not documents

- Each instrument has a **sub-nav of modes** (Cladd `Tabs`, 32 h). Examples: Network › Requests ·
  Mocks; Device › Overview · Current app · All apps · Files · Performance · Ports.
- **There are no document tabs.** The study's tab strip would be the fourth tab system on screen,
  after the rail, the sub-nav and the drawer. At 1280 it costs 32 px of a 696 px column.
  - What document tabs give developers (keeping a request and a table both at hand) is covered by the
    inspector **pin stack** (§2.3) and **one split** (§5).
  - _Sacrificed:_ five open tables at once.
- Sources inside an instrument are a **source list**, not tabs. Examples: databases and stores in
  Data, folders in Files.

### 2.3 How the inspector follows the selection

- There is **one global selection**: `selection.store`, holding `{ kind, id, t, source, sessionId }`.
  It is written by any pane: the Story list, a grid row, a request, a DOM node, a timeline tick, or a
  frame-tap in inspect mode.
- The inspector **opens on selection and closes on Esc or deselect**. It is never an empty column.
  The study and the 09-12 contract both leave it empty.
- The inspector has a fixed section order, for every kind of evidence:
  1. **Header** (36): kind glyph, title, ‹ › within the pin stack, pin, close.
  2. **Summary**: a plain-language paragraph, for non-developers first. For example: "POST /sync
     failed with 500 after 1.2 s. 3 rows in `orders` changed in the next 400 ms."
  3. **Details** ▸: the raw payload, headers, row JSON or styles. Collapsed for L0 entry, expanded
     when the selection came from an L2 instrument.
  4. **Provenance**: the tier, the read time ("via WebView (CDP) over ADB · read 15:16:21.402 · 3 s
     ago"), and live, buffered or recorded. Uses the existing `ProvenanceTag`.
  5. **Related**: evidence from the other lanes within ±2 s by default, ranked errors › writes ›
     requests › logs, at most 8 rows. Each row is clickable and becomes the new selection.
  6. **Actions**: "Open in Network ↗" (going deeper to L2), Copy as…, Mark, Add to report.
- **Pin stack.** Pinning keeps up to 5 selections. The header's ‹ › moves through them. This
  replaces document tabs for "keep this request while I look at that row".
- In recorded sessions, and in "review" mode on the live buffer, **selection moves the playhead**. In
  live mode, selection drops a **cursor flag** on the timeline without leaving live.

### 2.4 Back and forward

- `Alt+←` and `Alt+→`, plus mouse buttons 4 and 5. The title bar's ‹ › buttons are removed; their
  space goes to the tier chain.
- History is a list of **evidence positions**, not routes. Each entry is `{ instrument, mode,
selection, playhead, filter }`.
- An entry is recorded on:
  - an explicit open;
  - a selection held for more than 1 s;
  - an instrument change.

  Cursor sweeps through a table are coalesced.

- Bounded to 100 entries per session. Not persisted across relaunches.
- The palette shows the history with `Alt+↓`.

### 2.5 Every capability has one home

See §12. Nothing is orphaned or duplicated. Logcat lives in Logs only, and the timeline only
_references_ it.

---

## 3. Timeline and context placement

### 3.1 Where the global timeline lives

- It is a full-width band between the panes and the status bar, **including under the rail**. The
  rail stops at the timeline's top edge, and the 120 px lane-label gutter sits under the rail.
- There is a reason it spans the whole width. It is the only region that crosses every column, so it
  reads as the spine, not as a panel belonging to one instrument.

**States**

| State                       | Height | Contents                                                                                                                                                                     |
| --------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collapsed                   | 40     | Ruler 16 + one merged lane 24. Ticks use the category _shape_ (▮ screen, ╷ request, ✕ failed request, ▪ data write, · log, ◆ error, ▼ mark or step) **and** the `cat-*` hue. |
| Expanded                    | 184    | Header 24, ruler 16, 6 lanes × 24: Screen, Network, Data, Logs, Errors, Marks/Steps.                                                                                         |
| Expanded + Performance lane | 208    | Adds a CPU and memory sparkline lane.                                                                                                                                        |

- Lanes come and go through a header menu. The choice is persisted.
- Toggle with `T`. `Shift+T` focuses the timeline for the keyboard: ← → steps one event, `Home` goes to
  the start, `End` goes to now.

**Header contents (expanded, 24 h)**

- Left gutter (120): the live, recorded or review badge and the buffer length.
- Right group: zoom (`Segmented` 1 m · 5 m · all), "Save last 5 min", "Mark (M)", the lane menu.

**Data source**

- Live: the bounded ring buffer that runs whenever a target is attached. Default 5 min, memory-capped.
  This is the study's §6.1 design.
- Recorded: the `.capu` index.
- **One component.** `ReplayTimeline.vue` and the replay lane components (`ReplayNetworkLane`,
  `ReplayConsoleLane`, `ReplayPerformanceLane`) are generalised into `TimelineBand` with a `source`
  prop.

### 3.2 Live, review and recorded

|              | **Live**                                            | **Review** (live buffer, playhead pulled back)                                                                 | **Recorded** (`.capu` open)                                                                                      |
| ------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Right edge   | 1 px `signal-live` now-edge, moving, labelled "now" | The now-edge keeps moving. A separate **playhead** (`signal-select`, 2 px) sits in the past.                   | A **fixed end cap** (2 px ink bar) and no now-edge. A perforated top edge (`prov-recorded`) runs along the band. |
| Time labels  | Relative (−00:42)                                   | Relative to now, with an absolute value in the tooltip                                                         | Absolute session clock (00:21.750)                                                                               |
| Gutter badge | `● LIVE` (lime dot)                                 | `◐ REVIEW −00:42` and a **Return to live** button (`End`)                                                      | `▤ RECORDED 06:12`                                                                                               |
| Instruments  | Values are live                                     | Every instrument header reads `@ −00:42 · buffered`. Writes are disabled with a reason.                        | `@ 00:21.750 · recorded`. Writes are disabled with a reason.                                                     |
| Device pane  | Live stream                                         | The live stream keeps going. The pane bar shows "Live, not at playhead" and a "Show frame at playhead" toggle. | The recorded keyframe at the playhead, labelled "Recorded frame".                                                |
| Context bar  | Solid crumb                                         | Solid crumb + a `REVIEW` chip                                                                                  | The crumb gets the `prov-recorded` perforated left edge, and the first segment reads "Recorded · 4 Nov 15:16"    |

**Lost link in the timeline.** When a link drops, the lanes after the drop time draw the `prov-stale`
hatch until the link returns. The gap is drawn into history, so a reader of the `.capu` later sees it
too. This is honesty on the spine, not in a banner.

### 3.3 The context bar (40 h): device, app, target, tier and freshness

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◩ │ Live ▾ │›│ Phone-class ▾ │›│ Shop app 2.4.1 ▾ │›│ WebView: main ▾ ││ ADB ● Web ■ 41s Agt ○ Cmp ○ SDK – ││ ●Capture │⌕ Search… Ctrl K │–▢×│
│ 24│ 72     │ │ ≤ 180         │ │ ≤ 200            │ │ ≤ 160           ││ 5 slots, 52 each = 260 (1920)     ││ 96       │ 240 (1920) / 36 │132│
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Session switcher** (first segment). It lists the live session and any recorded sessions open in
  this window, plus "New capture…" and "Open .capu…".
  - Only one session is visible at a time. Each keeps its own state: instrument, selection and
    playhead.
  - This replaces Replay as a destination.
- **Device, app and target** are three switchers, each searchable from the keyboard (`Ctrl+K`, then
  `@`).
  - Device names show a nickname or the model class. The serial appears only in the tooltip, masked
    (round-01 F-29 and V-34).
- **The tier chain** is five slots: ADB, WebView (CDP over ADB), Shell agent, Companion, SDK.
  - Each slot uses shape **and** colour:
    - `●` live (`signal-live`);
    - `■` paused;
    - `◌` connecting;
    - `○` not present (muted);
    - `–` not applicable (for example SDK for an app that does not embed it);
    - `✕` error (with an icon);
    - hatched `▨` stale.
  - **Freshness.** The age ("41s") appears next to a slot only when its last contact is older than 5 s.
    A fresh slot has no number. Absence means fresh, so the bar stays quiet when everything is
    healthy.
  - Click a slot to open a 320 wide popover with three parts:
    - what this tier provides, for example "Companion: battery, thermal, screen state, native logs
      without ADB";
    - what is missing now;
    - one fix action, such as Pair, Install companion or Bring app to front.
- **This is the only place link state appears.** The status bar loses `adb ●` and `cdp ■`
  (`StatusBar.vue:79–90`). The per-panel live pills are deleted (round-01 F-01 and V-04). This
  enforces "one link truth" (DESIGN §7) by layout, not by discipline.
- **Capture** is a neutral ink outline dot while idle (round-01 V-16). While capturing it becomes a
  filled `signal-rec` square, a timecode and "Stop".
- **Search** is 240 wide at ≥ 1600 and an icon at < 1600.

---

## 4. Layer stack

### 4.1 The "free rectangle" rule

The **stream rectangle** is the device pane minus its HTML pane bar (top 32) and controls (bottom 32).
It is the hole. Because the device pane is always on the **right edge**, the space overlays may use is
one convex rectangle:

```
freeRect = { left: 0, top: 0, right: windowWidth − devicePaneWidth, bottom: windowHeight }
```

The pane bar and controls are excluded from overlays too, for simplicity.

**Mechanism (buildable on Cladd).** Cladd positions overlays with CSS anchor positioning
(`components/overlay.contracts.ts`, `position-area` presets). Overlays portal into one
`#overlay-root`:

```css
position: fixed;
inset: 0 var(--device-pane-w) 0 0;
contain: layout;
```

- `contain: layout` makes `#overlay-root` the containing block for fixed descendants, so the
  position-try fallbacks flip _inside the free rectangle_. They can never land on the hole.
- `#overlay-root` stays a child of `body`, so `useOverlayGuard`'s body observer keeps working
  unchanged. It already searches descendants (`querySelector`).
- Reka-based layers (menus, the command palette, sheets) mount into the same root with
  `to="#overlay-root"`.
- When the device pane collapses or detaches, `--device-pane-w` becomes 0 and the overlays get the
  whole window back.

### 4.2 Z-order from base to top, and how each layer meets the mirror

| z   | Layer                                                             | Rule                                                                                                                            | Mirror (stream rectangle)                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Shell chrome: context bar, rail, status bar                       | Static                                                                                                                          | Never overlaps it.                                                                                                                                                                                                                                                                                                                  |
| 1   | Panes: workspace, inspector column, device pane, drawer, timeline | Grid areas, never overlapping each other                                                                                        | It _is_ one of the panes.                                                                                                                                                                                                                                                                                                           |
| 2   | Sticky headers: grid header, sticky first column, lane labels     | Opaque `bg-surface` plus a 1 px divider (fixes round-01 V-54)                                                                   | In-pane only.                                                                                                                                                                                                                                                                                                                       |
| 3   | Gate strips and inline gates                                      | In-flow, never floating                                                                                                         | In-pane only. The device pane has its own gates inside the stream rectangle (they are HTML that _replaces_ the canvas, which is not drawn while gated).                                                                                                                                                                             |
| 4   | Inspector overlay (1280 mode) and rail flyout (folded group)      | Slide inside the workspace rectangle, `shadow-float`, no scrim                                                                  | Never crosses x = W − pane width.                                                                                                                                                                                                                                                                                                   |
| 5   | Tooltips, popovers, selects, the tier-slot popover                | Portal into `#overlay-root`; flip within the free rectangle                                                                     | Cannot overlap by construction. Pane-bar menus open with `position-area: left span-bottom`.                                                                                                                                                                                                                                         |
| 6   | Context menus                                                     | The native WebView menu is suppressed app-wide (round-01 F-10 and V-06). App menus come from Reka in `#overlay-root`.           | A right-click **inside** the stream rectangle is device input (back), never a menu. A right-click on the pane bar opens the pane menu, leftwards.                                                                                                                                                                                   |
| 7   | Command palette                                                   | Floating, **no scrim**. Width `min(640, freeRect.width − 48)`. Centred in the free rectangle, top at 12 % of the window height. | Stays live and interactive. The palette never stacks over a dialog: opening it while a dialog is open is refused with a toast ("Close the dialog first"). This fixes round-01 F-08.                                                                                                                                                 |
| 8a  | **Sheets**: capture review, export, recording options, pairing    | Drop from the workspace top edge, at most 560 wide, with a scrim over the **free rectangle only**                               | **Stays live and interactive.** A QA tester can keep reproducing while writing the report. This is deliberate.                                                                                                                                                                                                                      |
| 8b  | **Alert dialogs**: destructive confirms, unsaved changes          | Centred in the free rectangle, with a scrim over the free rectangle                                                             | The stream rectangle is **frozen**. The canvas stops painting and shows its last frame under a 40 % scrim drawn in HTML over the canvas. A local webview is swapped for its captured frame through the existing guard (`localWebview.store.ts:364`). Device input is disabled. A pane-bar chip reads "Paused while dialog is open". |
| 9   | Toasts                                                            | Cladd `ToastsPortal`, bottom-left of the free rectangle, 16 px above the timeline band, at most 3 stacked, 360 wide             | Never overlaps it.                                                                                                                                                                                                                                                                                                                  |
| 10  | Drag ghosts                                                       | HTML ghost inside the free rectangle                                                                                            | When the pointer enters the stream rectangle, the ghost hides and the pane draws a 2 px `signal-select` inset outline with "Drop to push to device (/sdcard/Download)". The drop is read from Tauri's window drag-drop event, which works over native surfaces.                                                                     |

**Keyboard focus into the device.** When the stream rectangle has focus, keys go to the device. The
pane bar then shows a `Chip`: "Typing on device · Esc releases". This is the only place keyboard
capture can happen, and it is always labelled.

---

## 5. Docking and splitting

| Element              | Resize                         | Pin                               | Detach                                       | Split                                                                                                                                    | Persisted                               |
| -------------------- | ------------------------------ | --------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Rail                 | No (72 or 48 toggle, `Ctrl+B`) | —                                 | No                                           | —                                                                                                                                        | Width state and Instruments fold        |
| Inspector            | 320–480                        | Yes (stays open on the last item) | No                                           | —                                                                                                                                        | Width and pin (not its contents)        |
| Device pane          | 280–520                        | Screen pin (1280 mode)            | **Yes**, the existing detached mirror window | —                                                                                                                                        | Width, detached or not, mirror settings |
| Workspace            | Takes the leftover space       | —                                 | No                                           | **One vertical split of two instruments**, only when the free width is at least 1200. Both halves follow one playhead and one selection. | The split pair and the ratio            |
| Drawer (REPL, Shell) | 120 – 60 % of the column       | —                                 | **Yes** (`DockDetachedWindow.vue` exists)    | No                                                                                                                                       | Height, tab, detached                   |
| Timeline             | 40 – 50 % of the window height | —                                 | **Never**                                    | No                                                                                                                                       | Height, lanes, zoom                     |

**Persisted across relaunches**, per install in the existing `writePersisted` storage:

- all of the above;
- the last instrument and mode per session type (live or recorded);
- source-list widths per template (default 240);
- column widths per grid source.

**Not persisted:** selection, the pin stack, playhead position (live always reopens at now), open
sheets, and the history stack.

**Fixed on purpose, and why**

- **The device pane's side (right).** The free-rectangle rule needs the hole at an edge. The
  `mirrorStore.side` left option goes.
- **The timeline's existence.** It is the spine.
- **The context bar's contents and order.** Spatial memory for the honesty chain.
- **Rail order.** Never re-sorted by usage or persona.
- **Status bar contents.**

---

## 6. Screen templates

There are six templates, all built from the same three header slots:

| Slot       | Height | Component                |
| ---------- | ------ | ------------------------ |
| Sub-nav    | 32     | Cladd `Tabs`             |
| Toolbar    | 36     | Cladd `Toolbar`          |
| Strip gate | 32     | Present only when needed |

The **body** is the only part a template defines. Every body has a **G-slot** for blocking gates
(§7). Widths below are at 1920 with the inspector column open, so the workspace is 1128, and at
1280, where it is 912.

### T1 · Story (L0, the session home)

```
┌ Workspace 1128 ──────────────────────────────────────────────────────────────┐
│ Session header 56: "Checkout fails on retry" ✎ · 06:12 · Shop app 2.4.1     │  title lg 16/22 (500)
│   3 errors · 2 failed requests · 41 writes · 5 marks   [Mark M] [Export ▾]  │  meta xs 12/16
├──────────────────────────────────────────────────────────────────────────────┤
│ Toolbar 36: Segmented[All · Problems · Actions · Network · Data · Logs]  ⌕  │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Strip gate 32]                                                              │
│ 15:16:20.1  ▮ Tap  "Pay now"                                    Screen · ADB  │  row 26
│ 15:16:20.3  ╷ POST /sync                     500 · 1.2 s        Web (CDP)    │
│ 15:16:21.5  ▪ orders · 3 rows changed  status → failed          SQLite · ADB │
│ 15:16:21.6  ◆ SyncError: retry budget exhausted                 Console      │
│ 15:16:24.0  ▼ Mark "customer sees spinner"                      You          │
│   … virtualised, sticky day/minute separators 20 …                          │
└──────────────────────────────────────────────────────────────────────────────┘
 columns: time 88 (mono 12, tabular) │ glyph 20 │ sentence flex (sans 13) │ source 160 (meta 11)
```

- A row is a **sentence**, not a protocol dump. The source column is where the tier shows up.
- The template has no source list. Story is one list.
- Used by: **Session (live and recorded)**, **flow run** (`/automation/runs/:runId` and
  `.../step/:index`, because a run _is_ a session) and **Replay** (gone as a destination; a recording
  opens as a Story).

### T2 · Grid workbench (L2)

```
┌ Workspace 1128 ──────────────────────────────────────────────────────────────┐
│ Sub-nav 32: Browse · Structure · SQL · Graph              [beta]            │
│ Toolbar 36: ⌕ Filter │ WHERE ▢──────────────────────│ Group ▾ │ Columns ▾ │ ⟳│
├ Sources 240 ────┬────────────────────────────────────────────────────────────┤
│ ⌕ Filter  24    │ [Strip gate 32: "App in background — values from 15:16:02"]│
│ ▾ SQLite        │ # │ id  │ status   │ total │ updated_at        │ …         │  header 28
│   orders.db     │ 1 │ 412 │ failed   │ 18.40 │ 2026-11-04 15:16  │           │  rows 26 / 22
│ ▾ IndexedDB     │   … row + column virtualised …                             │
│ ▾ Local storage │                                                            │
│ ▸ Cache · OPFS  │                                                            │
│ ▸ LocalForage   │────────────────────────────────────────────────────────────│
│ (row 26)        │ Footer 24: 1,204 rows · read 15:16:02 via ADB · local copy │
└─────────────────┴────────────────────────────────────────────────────────────┘
 1280: sources 200, grid 712 → 7–8 columns visible at content-aware widths.
```

- Source rows say what a store is in plain words, with the engine as secondary text: "Orders",
  then "SQLite · native" in meta (fixes round-01 V-56 and F-23).
- **Graph** becomes a view of the same source, not a sibling of IndexedDB (round-01 V-49).
- The footer is the template's provenance line. It is part of the grid well, not a second status bar
  (round-01 V-57).
- Used by: **Data** (IndexedDB, IDB snapshot, Local and session storage, Cookies, Cache, OPFS,
  LocalForage, SQLite native, OPFS, jeep and imported, Graph view) and **Device › Files** (folder tree
  as the source list, listing as the grid; it opens on the current app's folders and "/" is explicit,
  per round-01 F-15).

### T3 · List and inspector (stream table, L2)

```
┌ Workspace 1128 ──────────────────────────────────────────────────────────────┐
│ Sub-nav 32: Requests · Mocks                                                 │
│ Toolbar 36: ⌕ Filter │ Segmented[All XHR WS Doc Img Script Other] │ Status: all ▾│ Preserve │ ⟲ │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Strip gate 32]                                                              │
│ Method 64 │ Status 56 │ Path flex          │ Type 64 │ Size 72 │ Time 64 │ Tier 88│ header 28
│ GET       │ 200       │ /assets/…          │ js      │ 4 KB    │ 18 ms   │ Web    │ rows 26 (22 compact)
│ POST      │ ✕ 500     │ /sync              │ fetch   │ —       │ 1.2 s   │ Web    │  ← only non-2xx is coloured
│  … virtualised; follow-tail toggle when live …                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ Footer 24: 214 requests · 3.1 MB · since 15:11:02 (buffer)                   │
└──────────────────────────────────────────────────────────────────────────────┘
 Detail = the global inspector (never an in-template pane).
```

- Used by:
  - **Network** › Requests and Mocks. For Mocks, the rule list is in the body and the rule editor is
    in the inspector.
  - **Logs** › Logcat, Console and Exceptions. A log row is a single line; the inspector shows the
    full message, the stack and related events.
  - **Device** › All apps (a table, not 120 px tiles; round-01 V-10).
  - **Device** › Ports (CDP forwards and reverse rules).
  - **Library** (sessions list).
  - **Flows** › Runs.

### T4 · Tree and detail (L2)

```
┌ Workspace 1128 ──────────────────────────────────────────────────────────────┐
│ Sub-nav 32: DOM · Components (Vue) · Accessibility                           │
│ Toolbar 36: ⌖ Pick on screen │ ⌕ Search DOM │ ⟳                             │
├ Tree flex (min 480) ───────────────────────┬ Detail 400 ─────────────────────┤
│ ▾ <html lang="en" dir="ltr">               │ Tabs: Styles · Computed · Box   │
│   ▾ <body class="…">                       │  SectionTitle + KV rows 26      │
│     ▸ <div id="app">                       │                                 │
│  rows 22, indent 12, attributes as tokens  │                                 │
└────────────────────────────────────────────┴─────────────────────────────────┘
 The detail column is part of the template because styles are a *mode of the node*,
 not a separate selection. The inspector shows the node's summary + related evidence.
 1280: detail 320, tree 592.
```

- Used by:
  - **Elements** (DOM, framework plugin route, accessibility tree once the companion exists).
  - **Flows › flow editor** (`/automation/f/:flowId`): the step tree is the tree, the step editor is
    the detail.
  - **Settings**: the section list is the tree, the form is the detail. Settings becomes a full page,
    not a modal (round-01 F-20 and V-37), with these sections:
    - General
    - Appearance
    - ADB
    - Chrome
    - Shortcuts
    - Agents and MCP
    - Companion
    - Updates

### T5 · Facts (dashboard, L2)

```
┌ Workspace 1128 ──────────────────────────────────────────────────────────────┐
│ Sub-nav 32: Overview · Current app · All apps · Files · Performance · Ports  │
│ Toolbar 36: Scope Segmented[Device | App] │ Sampling 1 s ▾ │ ⏸               │
├──────────────────────────────────────────────────────────────────────────────┤
│ Facts grid: 12 columns, gutter 16, cards are Surface, padding 12             │
│ ┌ Identity (span 4) ───┐ ┌ Vitals (span 8) ─────────────────────────────────┐ │
│ │ KV rows 26, label    │ │ CPU  ▁▂▃▂▁  12 %   via ADB · 1 s                 │ │  sparkline row 40
│ │ over value (one      │ │ Mem  ▃▃▃▄▄  234 MB via ADB · 1 s                 │ │
│ │ pattern, V-19)       │ │ Batt  not reported · needs Companion [Install]   │ │  ← inline gate
│ └──────────────────────┘ └──────────────────────────────────────────────────┘ │
│ ┌ Permissions (span 12) — T3-style table inside a Surface ─────────────────┐ │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Charts appear only after the first sample. Before that the row is an inline gate: "Waiting for
  the first sample · since 15:16:02" (round-01 F-07 and V-01).
- Used by: **Device** › Overview, Current app (merged from `app-overview` and `app-data-usage`), and
  Performance (`devices-perf` and `app-performance` merged, with a Device/App scope).

### T6 · Collection (launcher and library, L0)

```
┌ Workspace (full width when no session: inspector closed) ─────────────────────┐
│ ┌ Start (span 5) ────────────────────┐ ┌ Recent sessions (span 7) ──────────┐ │
│ │ SectionTitle "Devices"             │ │ ⌕ Filter · Segmented[All Mine       │ │
│ │ ListItem 40: ● Phone-class · USB   │ │   Received Flow runs]               │ │
│ │   Shop app ▾  [Start live] [Capture]│ │ ListItem 48: title · app · 06:12 · │ │
│ │ ListItem 40: ○ Emulator (AVD) ▸Boot│ │   3 errors · received from companion│ │
│ │ + Pair over Wi-Fi  + Connect TCP   │ │ …                                   │ │
│ ├────────────────────────────────────┤ │                                     │ │
│ │ Drop zone 120: "Drop a .capu here  │ │                                     │ │
│ │  or Open… (Ctrl+O)"                │ │                                     │ │
│ └────────────────────────────────────┘ └─────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
 1280: the two columns stack only below 880 free width; at 912 they stay side by side (5/7 of 880).
```

- Used by:
  - the **Session** item when no session is open (capture-first home);
  - **Library** (the Recent sessions column alone, at full width, in T3 rows when there are more than
    50 items);
  - **Flows** landing, a library of manual flows. The agent is one way to _author_ a flow, behind
    "New flow ▾ · Record steps · Describe to agent" (round-01 F-05).
- The model is HTTP Toolkit's Intercept page: the home is "what can I capture", not a dashboard
  ([HTTP Toolkit docs](https://httptoolkit.com/docs/getting-started/intercepting/)).

### Assignment of every current screen

| Current route or surface                                                                    | Template             | New home                                                 |
| ------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------- |
| `devices-overview`                                                                          | T5                   | Device › Overview                                        |
| `devices-apps`                                                                              | T3                   | Device › All apps                                        |
| `devices-files`                                                                             | T2                   | Device › Files                                           |
| `devices-performance`, `app-performance`                                                    | T5                   | Device › Performance (scope Device or App)               |
| `app-overview`, `app-data-usage`                                                            | T5                   | Device › Current app                                     |
| `storage-*` (indexeddb, indexeddb-snapshot, localstorage, localforage, cache, opfs, sqlite) | T2                   | Data                                                     |
| `storage-graph`                                                                             | T2 (view)            | Data › Graph mode                                        |
| `network-requests`, `network-mock`                                                          | T3                   | Network › Requests, Mocks                                |
| `inspect-elements`, `inspect-plugin`                                                        | T4                   | Elements                                                 |
| `replay`                                                                                    | T1 (recorded) and T6 | Session (recorded) and Library                           |
| `/automation`                                                                               | T6                   | Flows (library)                                          |
| `/automation/f/:flowId`                                                                     | T4                   | Flows › editor                                           |
| `/automation/runs/:runId[/step/:index]`                                                     | T1                   | Session of that run                                      |
| `settings-*` (modal)                                                                        | T4                   | Settings (full page)                                     |
| `browser-preview` (`/preview`)                                                              | —                    | Not a screen: a **device-pane source** for local targets |
| Dock: Logcat, Console, Exceptions                                                           | T3                   | Logs                                                     |
| Dock: REPL                                                                                  | Drawer               | Drawer › REPL                                            |
| `AdbReversePopover`                                                                         | T3                   | Device › Ports                                           |
| Device shell                                                                                | Drawer               | Drawer › Shell                                           |

---

## 7. States in the layout

### 7.1 One priority order and three slots

**Priority:** link gate › capability gate › error › loading › empty › content. Only the
highest-priority condition renders. A strip that carries a condition adds a "+1 more" counter for the
others it hides.

| Slot                  | Size                                                                                                                                                             | Where                    | Component (exists or to build)              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------- |
| **Chain**             | 5 slots in the context bar                                                                                                                                       | Always visible           | Extends `GateChain.vue` into the tier chain |
| **G-slot** (blocking) | Replaces the template **body** only. The sub-nav, toolbar (disabled controls get a reason tooltip) and timeline stay.                                            | Inside the template      | `WorkbenchGate.vue` / `GatedRouterView.vue` |
| **S-slot** (strip)    | 32 px band directly under the toolbar, always in the same place (round-01 F-30 and V-35). Drawn as a `prov-stale` hatch with an icon, a sentence and one action. | Inside the template      | `GateStrip.vue`                             |
| **I-slot** (inline)   | One row (26) or one card body, in place of the missing value                                                                                                     | Where the value would be | New `InlineGate` on `ProvenanceTag`         |

### 7.2 State by state

| State                                     | Chain                               | Workspace                                                                                                                                                                                                                                                                                                                       | Device pane                                                                                                                       | Timeline                                                                                                          | Space taken                    |
| ----------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Disconnected** (ADB lost, cable out)    | ADB `✕` or `▨` with age             | Screens already rendered stay mounted under an **S-slot**: "Device disconnected at 15:16:40 · values below are from then · Reconnect". Screens never rendered get a **G-slot** with the same copy and the next actions.                                                                                                         | **G-slot inside the stream rectangle**: the last frame dimmed, plus "Disconnected 0:42 ago · Reconnect". The canvas is not drawn. | Hatch from the drop time                                                                                          | Strip 32, or the body          |
| **Unauthorised**                          | ADB `✕`                             | **G-slot** in every L2 instrument that needs the device: "Allow USB debugging on the phone", a 3-step illustration, then "Waiting for approval…" with a `Spinner`. **T6 home** shows the same as the device row's state.                                                                                                        | The same G-slot copy, short form                                                                                                  | No buffer, so the band shows "No live source" in the gutter and an empty ruler                                    | Body                           |
| **Target paused** (app in background)     | Web `■` with age                    | **S-slot** "Shop app is in the background. Android paused its WebView; values are from 15:16:02. **Bring app to front**." Content stays and its values carry `prov-stale`. Instruments that read over ADB (SQLite pull, Files, Logcat, Performance) get **no strip**, because they are not paused (synthesis ruling on SQLite). | Live: it shows the launcher, which is the truth                                                                                   | Web lanes hatch from the pause time; the Screen and Logs lanes continue                                           | 32 on WebView instruments only |
| **Not debuggable**                        | Web `–` (n/a) with a tooltip        | **G-slot** in Elements, Network and Data › browser stores: "This build isn't debuggable. Any debuggable build works without code changes." Offers the SDK route, and the Companion where it covers the need. Data › SQLite (ADB, `run-as` limits) shows its own capability gate.                                                | Unaffected                                                                                                                        | Web lanes absent (not hatched: they were never available)                                                         | Body, scoped                   |
| **Companion missing**                     | Cmp `○`                             | **Never blocks.** An **I-slot** wherever a companion-sourced value would be: "Battery · not reported · needs Companion [Install]". In Data's source list, one dimmed row "SharedPreferences · needs Companion".                                                                                                                 | Pane bar: frame age stays ADB-derived; the screen-on and screen-off state shows "unknown"                                         | Lanes it would feed (thermal, native logs without ADB) are absent from the lane menu, listed as "needs Companion" | One row                        |
| **Empty** (read succeeded, nothing there) | —                                   | Body `EmptyState`, centred in the body at 40 % height: icon 16, title sm 13/18 500, a cause sentence, and one action. Only after a successful read, with its time: "No IndexedDB databases in Shop app · read 15:16:21".                                                                                                        | Not applicable                                                                                                                    | —                                                                                                                 | Body                           |
| **Loading**                               | Slot `◌` only for link loading      | Skeleton rows (26 h, `bg-surface-cut`, 3 widths) after **300 ms**. Nothing before 300 ms. The toolbar's refresh icon becomes a `Spinner`. A first read longer than 3 s adds "Reading over ADB… 4 s" in the footer.                                                                                                              | "Connecting stream…" plus a `Spinner` in the stream rectangle                                                                     | First fill draws ticks progressively. No skeleton.                                                                | In place                       |
| **Error**                                 | The affected slot `✕` if link-level | Partial failure: **S-slot** "3 of 5 stores failed to read · Details" (expands to a copyable list). Total failure: **G-slot** with the message, a copyable detail, Retry, and "Report" (opens a sheet with logs attached).                                                                                                       | G-slot in the stream rectangle: "Stream error · scrcpy exited (code) · Restart stream"                                            | An error tick on the Errors lane, so the app's own failures are evidence too                                      | Strip or body                  |

**Inviolable rules**

- **A gate never claims a fact it cannot know.** "None found" is only allowed after a successful read
  (round-01 F-06).
- **Content that rendered once is degraded, not torn down** (DESIGN §7).
- **Unknown is never drawn as zero or false.** This is the tri-state rule (round-01 F-02 and V-02).

---

## 8. Personas: progressive disclosure, not a mode switch

**Why there is no mode switch**

- A "QA mode" forks the documentation, the screenshots and the support answers.
- It gives developers a second product to learn when they help a tester.
- It hides capabilities behind an identity choice that users make once and forget.

Raycast proves the alternative. One surface serves both the casual user and the power user: the
primary action sits on Enter, and depth sits behind the Action Panel (`Ctrl+K`), which is searchable
and sectioned ([Raycast manual](https://manual.raycast.com/action-panel)).

**What changes between personas.** Only these things:

1. **The entry point**, which sets the default depth.
2. **The rail fold.**
3. **The inspector's Details default** (collapsed or expanded).

### Developer at the desk (enters at L2)

1. On launch, if the last device and app are online, the **last live session resumes in the last
   instrument** (for example Data › orders). Otherwise the T6 home opens with the device row focused.
2. The rail is unfolded and the timeline expanded (1920) or collapsed (1280).
3. **The W1 flow from round-01 in 3 steps.** Select the failed row. The inspector's Related shows
   `POST /sync 500` and `SyncError`. Click it to switch the selection; the playhead flag marks the
   moment.
4. Everything is on the keyboard:
   - `g` keys for instruments;
   - `Ctrl+K` with `#table`, `/path`, `<selector` and `t:00:21.7` scopes (the study's grammar, shipped
     in the order `#`, `/`, then `t:`);
   - `Alt+←` for back.

### QA tester capturing a session (enters at L0)

1. Opens the app → T6 home → device row → **Capture**.
2. The ring buffer was already running, so **"Save last 5 min"** also works after the fact. This
   matters, because the bug has usually already happened.
3. During capture:
   - the context bar shows a `■ 02:14` rec timecode;
   - the right column locks to **Screen** (at 1280, the inspector overlays instead);
   - the Story view is the default;
   - `M` drops a mark with an optional one-line note, typed in a 320 wide popover in the free
     rectangle.
4. **Stop** opens the **Capture review sheet** (z8a). The device stays live behind it. The sheet has:
   - title;
   - steps to reproduce, pre-filled from the Tap rows, editable;
   - marks;
   - an auto summary (errors, failed requests, writes);
   - a **redaction preview** (fields flagged by pattern, toggled per field);
   - Export `.capu`, and "Copy for ticket" (text summary and file path).
5. The tester never needs an instrument. If they get curious, the inspector's "Open in Network ↗" is
   one click away.

### Support person opening a received `.capu` (enters at L0, rail folded)

1. Double-clicks the file or drops it on the window. It opens **straight into Session · Recorded**.
   The rail is folded on first use. The timeline is perforated and has an end cap.
2. The Story reads as sentences. The "Problems" filter jumps to the three things that went wrong.
3. Selecting one shows the inspector **Summary first**. Details is collapsed, and provenance says
   "recorded · via Companion".
4. "Data at this moment ↗" opens Data at the playhead, read-only, labelled `@ 00:21.750 · recorded`.
5. This also covers the field technician's output (captured on the phone with the companion) without
   any new desktop surface.

**Benchmarks that shaped this**

- Claude Desktop and Codex keep **one conversation or thread surface** and put depth in a side pane
  (artifacts, review or diff pane) that opens when there is something to show. That is the same
  move as the inspector opening on selection
  ([Codex app docs](https://developers.openai.com/codex/app)).
- Proxyman uses three panes (sources, flows, content) with a detachable content panel and keyboard
  toggles for each pane
  ([Proxyman layout docs](https://docs.proxyman.com/basic-features/request-response-viewer)).
  T2 and T3 follow it.
- HTTP Toolkit puts a list on the left with collapsible request, response and body sections on the
  right ([View page](https://httptoolkit.com/docs/reference/view-page/)). The inspector's
  Summary/Details/Related order improves on it by putting the plain-language summary first.

---

## 9. Density and grid

The base unit is **4 px**. The only spacing values are **4, 8, 12, 16, 24, 32**. Lint bans `p-[`,
`m-[` and `gap-[`, as round-01 §6 proposed.

The type scale uses the existing DESIGN tokens only, with **no new sizes**:

| Token | Size / line height | Role                            |
| ----- | ------------------ | ------------------------------- |
| `2xs` | 11/16              | meta                            |
| `xs`  | 12/16              | data                            |
| `sm`  | 13/18              | UI                              |
| `lg`  | 16/22              | titles, at most once per screen |

- `base` (14) is used only in sheets and dialogs for body copy.
- `xl` and above are banned in product UI; `text-3xl` is removed (round-01 V-30).
- Mono weights are 400 and 500 only (V-29).
- No ALL-CAPS labels (V-32).

| Region             | Height / width                   | Row or control                                              | Padding                             | Type                                                        | Cladd and Bench                                                                                              |
| ------------------ | -------------------------------- | ----------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Context bar        | 40                               | Switchers 28, slots 28                                      | x 8, gap 8 between groups, 4 within | sm 13 sans; age 2xs mono                                    | `Toolbar`, `ToolbarButton`, `Popover`, `Chip`, `Shortcut`, `SearchField`; `bg-background`                    |
| Rail               | 72 / 48                          | Item 56 (labelled: icon 16 + gap 4 + label 2xs) / 40 (icon) | y 8, item gap 2                     | 2xs 11 500 label                                            | `List`, `ListButton`, `Tooltip` (right side); active = `accent-soft` + 2 px `signal-select` inset bar at x 4 |
| Sub-nav            | 32                               | Tab 32                                                      | x 16 (page gutter)                  | sm 13; active 500                                           | `Tabs`, `TabsList`, `Tab`; maturity `Chip` at the end                                                        |
| Toolbar            | 36                               | Controls 28 (dense 24)                                      | x 16, gap 8, separators 16 tall     | sm 13                                                       | `Toolbar`, `ToolbarSeparator`, `SearchField`, `Segmented`, `Select`                                          |
| Strip gate         | 32                               | Action button 24                                            | x 16                                | sm 13 + 2xs age                                             | `GateStrip.vue` on `SurfaceCut` + `prov-stale`                                                               |
| Source list        | 240 (1920) / 200 (1280); 180–360 | Row 26, group header 24                                     | x 8, indent 12                      | sm 13 name, 2xs engine                                      | `List`, `ListItem`, `ListTitle`, `CollapsibleRoot`; `bg-surface-0`                                           |
| Grid / table body  | flex                             | **26 default, 22 compact, 30 comfortable**; header 28       | Cell x 8                            | xs 12: mono for numbers, ids and JSON; sans for text (V-59) | Existing DataGrid on Cladd table language, `Table*`                                                          |
| Story list         | flex                             | 26; minute separators 20                                    | x 16                                | time xs mono tabular, sentence sm sans, source 2xs          | Virtualised list; `Chip` for the tier                                                                        |
| Inspector          | 360 (320–480)                    | Header 36; KV rows 26; section gap 16                       | 12                                  | Section titles sm 500 (sentence case); values xs            | `SectionTitle`, `AccordionRoot`/`AccordionItem`, `ProvenanceTag`, `Surface`                                  |
| Device pane        | 360 (280–520)                    | Bar 32, controls 32                                         | 8 around the stream                 | 2xs                                                         | `Toolbar`, `ToolbarButton`, `Chip` (frame age), `Spinner`                                                    |
| Drawer             | 240                              | Tab bar 28                                                  | 0 (terminal edge to edge)           | xs mono                                                     | `Tabs` + xterm                                                                                               |
| Timeline           | 40 / 184                         | Header 24, ruler 16, lane 24; ticks 2 × 12, errors ◆ 8      | Gutter 120, x 8                     | 2xs, mono tabular for times                                 | `Segmented`, `ToolbarButton`, `Tooltip`; `cat-*` + shape; `signal-live` now-edge, `signal-select` playhead   |
| Status bar         | 24                               | Items 20                                                    | x 10, gap 12                        | 2xs **sans**; mono only for timecodes (V-33)                | `Chip` (ghost), `Tooltip`                                                                                    |
| Sheets and dialogs | Sheet ≤ 560 w, dialog 440 w      | Controls 28                                                 | 16; section gap 24                  | base 14 body, lg 16 title                                   | `Dialog`, `Field*`, `Button` (`solid-fill` primary, `transparent` secondary)                                 |
| Toasts             | 360 w                            | —                                                           | 12                                  | sm 13                                                       | `ToastsPortal`, `Toast`                                                                                      |

**Surfaces and depth**

| Region                                                  | Token                           |
| ------------------------------------------------------- | ------------------------------- |
| Chrome (context bar, rail, status bar, timeline gutter) | `bg-background`                 |
| Workspace and inspector                                 | `bg-surface-0`                  |
| Wells (grid body, timeline lanes, inputs, the drawer)   | `bg-surface-cut` + `shadow-cut` |
| Overlays                                                | `bg-surface-2` + `shadow-float` |

- Pane borders are 1 px `--border-subtle`. Use either a bevel or a border on a given edge, never both.
- Radius: 4 for chips, cells and keycaps; 6 for controls; 8 for popovers, sheets and dialogs.

**Density check at 1280×800 (Data › SQLite)**

```
Body height: 696 − 32 − 36 = 628
Header 28 + rows 26 → 23 rows visible (27 at 22 compact)
```

Chrome above the first row is 40 + 32 + 36 + 28 = 136 px, or **17 %** of the window height, down
from 27 % (round-01 visual §4). Adding the 40 px timeline and 24 px status bar gives **25 %** of the
window for all chrome, with the spine included.

**What is missing from Cladd (stays on Reka, per DESIGN §5)**

- splitters/resizable;
- menus and context menus;
- the command palette;
- sheets;
- scroll areas.

The tree in T4 stays custom. **To build:**

- `ShellLayout` (a CSS grid with named areas: `ctx rail ws insp pane tl status`);
- `TimelineBand` (generalised from the Replay lanes);
- `TierChain` (extends `GateChain`);
- `InlineGate`;
- `#overlay-root`.

---

## 10. Migration (shippable steps, no big bang)

Each step ships behind no flag unless noted. Old routes redirect, so deep links and MCP views keep
working.

| Step                                                    | Ships                                                                                                                                                                                                                     | Changes                                                                                                                                                                 | Done when                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **M0 · Truth** (weeks 1–2, the synthesis "Truth" track) | One derived link state. Every panel reads it.                                                                                                                                                                             | Delete the per-panel live pills (`NetworkPanel.vue:128-140`). Tri-state labels. The status bar stops showing link state. `GateStrip` placement fixed under the toolbar. | No screen shows a link value that disagrees with the context bar (a test over `gateInput`). |
| **M1 · Grid skeleton**                                  | `ShellLayout` with named areas. The device pane is fixed right (the `side` option is removed; the persisted `left` value is migrated to `right`). `#overlay-root` with `contain: layout`. Native context menu suppressed. | The same screens, in new containers. Settings becomes a full page in the workspace.                                                                                     | 40 overlay placements produce 0 overlaps over the stream rectangle (risk 1 test).           |
| **M2 · Context bar**                                    | Session switcher (Live only), device, app and target switchers, `TierChain` with 5 slots. Companion and SDK show `○` or `–` honestly. Capture button restyled.                                                            | Removes the title-bar ‹ › and the "Device" mirror toggle (renamed "Screen", moved into the device pane bar).                                                            | Round-01 F-11, V-16, V-23 and V-34 closed.                                                  |
| **M3 · Timeline v1**                                    | `TimelineBand`, collapsed 40, live only, Network, Logs and Errors lanes, fed by the live ring buffer.                                                                                                                     | Generalise `ReplayTimeline.vue`. The ring buffer runs in Rust or a worker (study §9.4).                                                                                 | The band costs ≤ 2 ms per frame at 200 events/s (perf budget).                              |
| **M4 · Selection and inspector**                        | Global `selection.store`. The inspector column. Network adopts it first, then Data. Evidence back and forward.                                                                                                            | Network's in-template detail pane removed.                                                                                                                              | Network and Data share one inspector. Alt+← works across them.                              |
| **M5 · Sessions in the shell**                          | Recorded sessions open as Session (T1) through the switcher. Library (T6/T3) replaces the Replay picker. `/replay` redirects to `/library`. Expanded timeline with all lanes, recorded variant.                           | Replay player panels become the instruments "at playhead".                                                                                                              | A `.capu` opens to Story in under 1 s for a 10 MB file.                                     |
| **M6 · Rail rebuild**                                   | Session, Instruments group, Flows, Library, Settings. App merged into Device (Current app, Performance scope). Flows lands on the library. Go-keys remapped (`g h`, `g l`, `g r`; `g a` removed).                         | `feature-registry.ts` changes: labels, groups, `placement`.                                                                                                             | Every inventory row reachable (§12 table as a test fixture).                                |
| **M7 · Logs and drawer**                                | Logs instrument (T3). The drawer holds only REPL and Shell. The bottom dock region is deleted.                                                                                                                            | `BottomDock` becomes `WorkspaceDrawer`. The `/console/:tab` redirect hack is removed.                                                                                   | —                                                                                           |
| **M8 · 1280 and personas**                              | Shared right column, inspector overlay, Screen pin, entry-point fold, capture review sheet with redaction, Story filters.                                                                                                 | `.capu` file association (Tauri).                                                                                                                                       | Risk 2 and risk 3 tests pass.                                                               |

**Order rationale.** M0 lifts the binding dimension (honesty, 3.5). M1 and M2 make the shell's frame
right before any screen moves. Sessions (M5) come before the rail (M6), so Library exists before
Replay leaves the rail.

---

## 11. Prior art judged

**2026-11-04 study §4.1 anatomy**

- **Kept:**
  - the context bar;
  - the labelled rail;
  - the inspector that follows selection;
  - the always-visible timeline;
  - the status bar as ambient truth.
- **Fixed:**
  - The timeline now spans the full width, including under the rail, instead of only the workspace.
  - The inspector no longer sits under the device pane. Stacked, it would squeeze the mirror to about
    half height at 1080; it is now its own column at ≥ 1760 and shares the right column at 1280.
  - The status bar no longer repeats link state (`adb ✓ · cdp ✓`). The study's own anatomy
    duplicates it, the defect round-01 V-34 names.
- **Rejected:**
  - **Document tabs:** a fourth tab system, 32 px at 1280, and a restore-state burden.
  - **The full-width dock:** it competes with the timeline for the bottom edge.
  - **Replay as a "Sessions" rail item:** a session is the window's object, not a destination.

**2026-09-12 persistent shell contract**

- **Kept:** "routes replace feature content only" and truthful disabled actions.
- **Rejected:**
  - "Selection stays local to the current feature". That is what makes cross-lens evidence
    impossible.
  - Mirror on the left or right side.
  - The Coral accent, which no longer exists.

### What this design sacrifices

| Sacrifice                                 | Cost                                                                  | Why it is worth it                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| No document tabs                          | Developers cannot keep five tables open                               | The pin stack (5) and one split cover the 80 % case; 32 px back at 1280              |
| Mirror always right, never under overlays | Left-handed layouts lost; a local webview freezes under alert dialogs | The free-rectangle rule becomes geometry, not per-overlay code                       |
| Timeline never hidden                     | 40 px always, at 1280 too                                             | The spine is the differentiator; hiding it recreates the round-01 "invisible thesis" |
| No persona mode                           | Non-developers see a folded Instruments group                         | One product, one vocabulary, one set of docs                                         |
| No full-width dock                        | Logcat is no longer a peek-under-anything panel                       | Logs ticks are on the timeline everywhere; Logs is one `g l` away                    |
| Rail labels hidden below 1440             | Icon-only rail at 1280                                                | 24 px of width back for the grid                                                     |
| Go-key remap                              | Muscle memory for `g a` and `g r` breaks                              | It matches the new nouns                                                             |

---

## 12. Capability-to-home table (every inventory row)

| #   | Inventory capability                                                           | Home                                                                                                                                                                        | Depth            | Template     |
| --- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------ |
| 1   | Physical connections (USB, TCP/IP, wireless pair, identity)                    | Session home (T6) device column; the context bar device switcher has "Pair / Connect…"; identity in Device › Overview                                                       | L0               | T6 / T5      |
| 2   | Session management (active device, snapshots, offline, cancel, leases, queues) | The context bar session and device switchers; the tier chain shows offline state. Leases and queues: status bar item "MCP: 1 agent", whose popover lists leases and cancel. | Shell            | —            |
| 3   | Android emulators (list AVDs, launch, distinguish)                             | T6 device column ("Emulator (AVD) ▸ Boot"); a device-kind chip in the switcher                                                                                              | L0               | T6           |
| 4   | Local browser/runtime (Chrome discovery, targets, local WebView)               | Target switcher sources (Android WebView, Local Chrome, Local preview); renders in the **device pane** as a local-webview source                                            | Shell            | Pane         |
| 5   | Device operations (reboot modes, root, restart ADB, TCP mode)                  | Device › Overview, in the "Device actions" menu (Reka menu); also in the palette                                                                                            | L2               | T5           |
| 6   | Applications (list, metadata, icons, launch, stop, clear, uninstall)           | Device › All apps (list); Device › Current app (one app's actions)                                                                                                          | L2               | T3 / T5      |
| 7   | Targets (socket discovery, CDP forward, attach, external DevTools)             | Context bar target switcher; "Open in Chrome DevTools" in its menu                                                                                                          | Shell            | —            |
| 8   | Ports (CDP forwards, reverse rules, removal)                                   | Device › Ports                                                                                                                                                              | L2               | T3           |
| 9   | Device shell                                                                   | Drawer › Shell                                                                                                                                                              | L2               | Drawer       |
| 10  | Device files                                                                   | Device › Files (opens on app folders)                                                                                                                                       | L2               | T2           |
| 11  | Native logs (Logcat)                                                           | Logs › Logcat; ticks on the timeline Logs lane                                                                                                                              | L2               | T3           |
| 12  | Native performance                                                             | Device › Performance (scope Device or App); optional timeline Perf lane                                                                                                     | L2               | T5           |
| 13  | DOM                                                                            | Elements › DOM; pick-on-screen from the device pane                                                                                                                         | L2               | T4           |
| 14  | CSS                                                                            | Elements › detail column (Styles, Computed, Box)                                                                                                                            | L2               | T4           |
| 15  | JavaScript console (evaluate, capture)                                         | Capture: Logs › Console. Evaluate: Drawer › REPL.                                                                                                                           | L2               | T3 / Drawer  |
| 16  | Framework DevTools (Vue/React)                                                 | Elements › Components sub-nav, present only when detected                                                                                                                   | L2               | T4           |
| 17  | HTTP                                                                           | Network › Requests; Story rows; timeline Network lane                                                                                                                       | L2 (L0 rows)     | T3           |
| 18  | Advanced network (WebSocket, Fetch interception, mock server)                  | Network › Mocks (maturity chip); WebSocket frames in the request inspector. Hidden modes stay unrouted until ready.                                                         | L2               | T3           |
| 19  | IndexedDB                                                                      | Data › IndexedDB source                                                                                                                                                     | L2               | T2           |
| 20  | Local and session storage                                                      | Data › Local storage, Session storage sources                                                                                                                               | L2               | T2           |
| 21  | Cookies                                                                        | Data › Cookies source                                                                                                                                                       | L2               | T2           |
| 22  | Cache API                                                                      | Data › Cache source                                                                                                                                                         | L2               | T2           |
| 23  | OPFS                                                                           | Data › OPFS source (file listing in the grid; SQLite files found there link into the SQLite source)                                                                         | L2               | T2           |
| 24  | LocalForage                                                                    | Data › LocalForage source                                                                                                                                                   | L2               | T2           |
| 25  | Native SQLite                                                                  | Data › SQLite source ("native" secondary label); Structure and SQL modes                                                                                                    | L2               | T2           |
| 26  | SQLite local files (import, export, overwrite, local writes)                   | Data › SQLite source group "Local copies" with the `prov-local` dashed edge; import from T6 drop zone or `Ctrl+O`                                                           | L2               | T2           |
| 27  | Browser-backed SQLite (OPFS, SAH pool, wa-sqlite, jeep)                        | Data › SQLite source, engine as secondary text ("OPFS · SAH pool")                                                                                                          | L2               | T2           |
| 28  | Screen interaction (mirror, input, keys, clipboard, detach)                    | Device pane (pane bar, controls, detach)                                                                                                                                    | Shell            | Pane         |
| 29  | Media capture (screenshot, screen recording)                                   | Device pane bar menu ("Screenshot", "Record video"), named distinctly from Capture                                                                                          | Shell            | Pane         |
| 30  | Session recording (start, append, stop, finalize)                              | Context bar **Capture** button; "Save last 5 min" in the timeline header; capture review sheet                                                                              | Shell            | Sheet        |
| 31  | Recording library (list, read, delete, orphans, export)                        | Library (T6/T3); export from the Session header; orphan cleanup in Settings › General ("Storage")                                                                           | L0               | T6 / T3      |
| 32  | Recorded database evidence                                                     | Data instrument "at playhead" (recorded); row changes in the Story and inspector Related                                                                                    | L1 / L2          | T2           |
| 33  | Cross-track queries                                                            | Inspector › Related (±window); Story filters; palette `t:` and query scopes                                                                                                 | L1               | T1           |
| 34  | MCP (server, token, mutation mode, 56 tools per synthesis)                     | Settings › Agents and MCP (config); status bar "MCP: n agents (mode)" (live presence); agent actions appear as Marks/Steps lane ticks                                       | Shell / Settings | T4           |
| 35  | Updates                                                                        | Settings › Updates; a status bar chip when an update is ready                                                                                                               | Settings         | T4           |
| 36  | Hybrid/Capacitor-specific panels                                               | **No home** until real (inventory ruling). Elements › Components stays generic, with no Capacitor branding.                                                                 | —                | —            |
| 37  | Integrated AI chat (proposed)                                                  | Not a region. If it ships, it is an inspector action ("Explain this") and a palette scope, never a rail item.                                                               | L1               | —            |
| 38  | Automation history and approvals (proposed)                                    | Flows › Runs (T3); each run opens as a Session (T1). Approvals arrive as sheets (z8a) naming the agent and action.                                                          | L2               | T3 / T1      |
| +   | Flows: manual flows and agent runs (code, not in the Sept inventory)           | Flows (T6 library, T4 editor, T1 run)                                                                                                                                       | L2               | T6 / T4 / T1 |
| +   | Connection tiers: shell agent, companion, SDK (owner decision 2)               | Context bar tier chain; Settings › Companion (pairing, permissions, version); per-value provenance                                                                          | Shell            | —            |

The table has no duplicates. Logcat appears only in Logs, and the timeline references it. The
REPL appears only in the drawer, and Console capture only in Logs.

---

## 13. The three biggest risks, and how to test them before building

### Risk 1 · The free-rectangle containment does not hold in WebView2

If `contain: layout` on `#overlay-root` does not make position-try fallbacks respect the rectangle in
WebView2, or if Cladd overlays measure against the viewport in JavaScript, overlays will clip or
land on the hole.

**Test (1-day spike, before M1)**

- Build a throwaway page: a fixed 360 px "hole" on the right and `#overlay-root` with the inset.
- Place Cladd `Popover`, `Select`, `Tooltip` and `Popup`, plus a Reka menu, with anchors at the 4
  edges of the free rectangle and inside the pane bar.
- Run it on Windows 11 WebView2 at 100, 125 and 150 % scaling.

| Pass                                                                | Fallback                                                                                                                                           |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 of 40 placements intersect the hole, and 0 are clipped unreadably | Feed Cladd's `useAnchorPosition` an explicit boundary rectangle through a provider (an upstream cladd-vue change, synced with `vp run sync:cladd`) |

### Risk 2 · The Story does not tell a non-developer what happened

Raw events are noisy. A sentence list of 2,000 rows can be as opaque as Network.

**Test (paper and clickable prototype, before M5)**

- Use 3 real, **redacted** `.capu` files.
- Write sentence rows by hand for a 5-minute span.
- Ask 5 people (2 QA, 2 support, 1 product) to do W3 (find the failure and export it) and W4 (say what
  the app thinks the stock is).

| Pass                                                                                                     | Fallback                                                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 4 of 5 finish each task in under 2 minutes, unaided, using the Problems filter and the inspector Summary | The Story defaults to "Problems + Marks" only, and the full stream sits behind "All" |

### Risk 3 · 1280×800 is too cramped for developer work in the shared right column

Toggling Screen and Inspector may thrash. A developer who wants the mirror _and_ the inspector at 1280
may hate the overlay.

**Test (a static-layout prototype at 1280×800, before M8)**

- Three developers run W1 (row → request → log line) and W2 (the app goes to background mid-task).
- Count column toggles and overlay dismissals.

| Pass                                                                                                                                 | Fallback                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| At most 1 manual toggle per task; the grid shows at least 20 rows at 26 px (the design gives 23); nobody detaches the mirror to cope | At 1280–1439, the inspector becomes a **bottom split of the workspace** (220 h) instead of an overlay, and the right column stays Screen |

**Honourable mention (performance, not layout).** The always-on ring buffer plus a full-width band at
200 events/s must stay within the study §9.6 budgets. M3's gate (≤ 2 ms per frame) is the test.

---

`[AI-assisted]` This proposal needs an owner "explain it back" before it is adopted. The external
benchmark descriptions come from the cited public documentation pages. I did not run any product.
