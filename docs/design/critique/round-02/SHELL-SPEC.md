# Capubridge shell specification (round 02 final)

2026-11-04 · Lead product designer · Base: proposal C (Progressive layers), with grafts from A, B and D ·
`[AI-assisted]`, needs the owner's "explain it back" before M1 starts.

Inputs: `LAYOUT-BRIEF.md`, `BRIEF.md`, `RUBRIC.md`, `round-01/00-synthesis.md`, the four round-02
proposals and the three judges' findings, `apps/desktop/DESIGN.md`, the capability inventory, and source
checked on 2026-11-04 (references are `file:line` and were verified for this spec).

All sizes are **CSS px at 100 %**. The owner's daily screen is 1920×1080 at 125 %, which is a
**1536×864** CSS canvas. That size is the design target. 1920×1080 and 1280×800 must also work fully.
1 px dividers are counted inside the region to their right.

---

## 0. Code facts this spec is built on

| Fact                                                                                                                                              | Where                                                                                                                   | Consequence                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| The Android mirror is an HTML `<canvas>`                                                                                                          | `modules/mirror/MirrorStream.vue:291-294`                                                                               | HTML can draw over it. Scrims, dimming and freeze are plain CSS on the canvas.                                               |
| Only the local preview is a native child webview                                                                                                  | `stores/localWebview.store.ts:176` (`new Webview`), parked at `:41`, hidden by `acquireModalGuard` `:364-367`           | Nothing in HTML can overlap its rectangle. It is the only surface that needs a freeze frame.                                 |
| The guard hides that webview for every dialog, menu, listbox and popover                                                                          | `composables/useOverlayGuard.ts:4-14`                                                                                   | Today the preview blinks off on every menu. This spec narrows the guard to alert dialogs and in-app drags (§5).              |
| A CDP endpoint is already discovered for local previews                                                                                           | `localWebview.store.ts:111` (`discoverCdpEndpoint`)                                                                     | `Page.captureScreenshot` can produce the freeze frame.                                                                       |
| Cladd Popover, Popup and Tooltip place themselves with CSS anchor positioning; there is no collision-boundary prop                                | `packages/cladd/src/composables/useAnchorPosition.ts`, `overlay.contracts.ts:148-151, 461-492`                          | A's and B's "collisionBoundary" does not exist for Cladd. The boundary needs an upstream cladd-vue change (§5.2).            |
| Only Popover can anchor to a rectangle proxy rendered inside its teleport                                                                         | `Popover.vue:169-190, 311`; `buildAnchorRectStyle` in `overlay.contracts.ts`                                            | The proxy route exists but must be extended to Popup and TooltipPrimitive.                                                   |
| Every Cladd overlay teleports to `ui.overlaysRoot` when set                                                                                       | `CladdProvider.vue:33`; `Popover.vue:197`, `Popup.vue:154`, `TooltipPrimitive.vue:77`, `Dialog.vue:156`, `Toast.vue:98` | One overlay root can be configured without touching each call site.                                                          |
| The Cladd dialog backdrop is `fixed inset-0`                                                                                                      | `overlay.contracts.ts:166`                                                                                              | Inside a contained overlay root it covers only that root, which is exactly the free rectangle.                               |
| There is no time-bounded live buffer. The only buffer is the MCP capture: 200 entries and 256 or 512 KB per target, started on first read         | `src-tauri/src/mcp/capture.rs:29-33`                                                                                    | "Save the last 5 minutes", pre-roll and a live spine need a new Rust buffer (M4). Until then the spine says "since connect". |
| The grid ladder is already 22 / 26 / 30                                                                                                           | `shared/components/data/grid/types.ts:48-52`, `DESIGN.md` §4                                                            | A's 20 / 24 / 28 change is rejected.                                                                                         |
| Gate components exist: `GateChain`, `GateStrip`, `GatedView`, `GatedRouterView`, `WorkbenchGate`, `GateActions`, `LinkIndicator`, `ProvenanceTag` | `components/gate/`                                                                                                      | Gate slots reuse them.                                                                                                       |
| Replay timeline and lanes exist                                                                                                                   | `modules/recording/ReplayTimeline.vue`, `ReplayNetworkLane.vue`, `ReplayConsoleLane.vue`, `ReplayPerformanceLane.vue`   | They become the shared `TimelineBand`. They must move to `src/shared/`, because modules may not import each other.           |
| `mirrorStore.side` supports left and right                                                                                                        | `modules/mirror/MirrorPanel.vue:117, 358, 456`; `MirrorTopBar.vue:50`                                                   | The left option is removed and the persisted value migrated.                                                                 |
| No window minimum is set                                                                                                                          | `src-tauri/tauri.conf.json`                                                                                             | M1 adds `minWidth: 1024`, `minHeight: 640`.                                                                                  |
| No `EmptyState` exists in Cladd or the app                                                                                                        | `packages/cladd/src/components`, `apps/desktop/src`                                                                     | It is a new app component, listed in §7.                                                                                     |

---

## 1. Thesis

**One window holds one session, laid out as a fixed frame around one clock.** The context bar says
what you are attached to and through which tiers. The spine directly under it says when: it spans the
whole window, it is never hidden, and it is the only time control. The workspace below shows one
instrument at a time, and the inspector beside it explains the one thing you selected, in plain words
first, then raw detail, then where and when it was read. The phone sits in a right-hand column that no
transient layer ever crosses, and streams (Logcat, Console, Shell) sit in a peekable panel under the
workspace. Live, review and recorded sessions use the same frame; only the spine's right edge, the
provenance pattern and the session switcher change. Every person enters at a different depth (story,
evidence, instrument) and can go deeper with one key. **Depth is disclosed, never switched.**

**What this design deliberately sacrifices**

| Sacrifice                                    | Cost                                                                             | Why it is worth it                                                                                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No document tabs in v1                       | A developer cannot keep five tables open                                         | Pin stack (5) and one split cover "keep this while I look at that". A tab system is an L-sized rewrite of router and registry (A's steps 7 and 9). Owner decision 2. |
| 64 px of height, permanently, for the spine  | 2.5 grid rows at 1536×864                                                        | The spine is the differentiator. 28 px strip mode exists for the dense user.                                                                                         |
| The phone column is always on the right      | Left-handed layout lost                                                          | The free rectangle must start at the viewport origin for the overlay boundary to be cheap and provable (§5.2).                                                       |
| One inspector, one split, no floating panels | No free layout                                                                   | Docked slots make the no-overlap rule provable and the 5-second honesty test passable.                                                                               |
| No persona mode                              | Non-developers see a rail with an Instruments group, folded on recorded sessions | One product, one vocabulary, one set of docs and support answers.                                                                                                    |
| Rail labels never collapse automatically     | 64 px of width at every size                                                     | Removes the two-rail-modes defect (round-01 F-22, V-66).                                                                                                             |
| Status bar never shows link state            | Users who look there for "adb ✓" must look up                                    | Removes the four-way link disagreement (F-01, F-03, V-04, V-34) by construction.                                                                                     |

---

## 2. Region map

### 2.1 Regions

| Region         | Job (one only)                                                  | 1920×1080                      | 1536×864             | 1280×800             | Min / max                           |
| -------------- | --------------------------------------------------------------- | ------------------------------ | -------------------- | -------------------- | ----------------------------------- |
| Context bar    | What is attached, through which tiers                           | h 40                           | h 40                 | h 40                 | fixed                               |
| Spine          | When: now-edge, playhead, range, density, marks, lanes          | h 64, full window width        | h 64                 | h 64                 | 28 / 50 % of window height; never 0 |
| Context notice | One window-scope condition (paused, link lost, unauthorised, …) | h 0 or 28                      | 0 or 28              | 0 or 28              | present only while true             |
| Rail           | Pick a depth or instrument                                      | w 64, labelled                 | w 64                 | w 64                 | 44 (user's compact toggle) / 64     |
| Workspace      | The current instrument (sub-nav 32 + toolbar 32 + body)         | w 1136 (inspector open) / 1496 | w 832 / 1152         | w 636 / 936          | **min 560**                         |
| Panel          | Streams: Logcat, Console (with REPL prompt), Exceptions, Shell  | closed; 240 open               | closed; 200 open     | closed; 200 open     | 120 / 60 % of workspace height      |
| Inspector      | The one selected thing: summary, details, provenance, related   | w 360                          | w 320                | w 300                | 280 / 480; closes on deselect       |
| Device pane    | The phone or the local preview                                  | w 360, frame 344×764           | w 320, frame 302×672 | w 280, frame 264×587 | 240 / 520                           |
| Status bar     | Ambient jobs and facts, never link state                        | h 24                           | h 24                 | h 24                 | fixed                               |

Vertical budget (panel closed, no notice):

| Canvas    | Context | Spine | Sub-nav | Toolbar | Body | Status | Rows at 26 after a 28 header | Chrome above first data row |
| --------- | ------- | ----- | ------- | ------- | ---- | ------ | ---------------------------- | --------------------------- |
| 1920×1080 | 40      | 64    | 32      | 32      | 888  | 24     | 33                           | 196 px = 18.1 %             |
| 1536×864  | 40      | 64    | 32      | 32      | 672  | 24     | 24 (16 with the panel open)  | 196 px = 22.7 %             |
| 1280×800  | 40      | 64    | 32      | 32      | 608  | 24     | 22 (14 with the panel open)  | 196 px = 24.5 %             |

Today the figure is 27 % (round-01 visual §4). Strip mode (spine 28) takes 36 px back: 18.5 % at 1536.

### 2.2 Collapse order

Rule: **chrome gives way before evidence.** The spine, the stream rectangle and the 560 px workspace
minimum give way last.

| Order | Trigger                   | What changes                                                                                                                                                                         |
| ----- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Workspace < 760           | Template inner columns fold: the T2 source list becomes a drawer (`Ctrl B`) with a source switcher in the toolbar; the T4 detail column folds into the inspector.                    |
| 2     | Window < 1760             | Inspector 360 → 320, device pane 360 → 320.                                                                                                                                          |
| 3     | Window < 1600             | Context bar condenses: tier words become glyphs with tooltips, the search field becomes a 28 px icon, ‹ › are removed (Alt ← → and mouse buttons 4/5 remain).                        |
| 4     | Window < 1440             | Inspector → 300, device pane → 280.                                                                                                                                                  |
| 5     | Window < 1180             | The inspector becomes an overlay drawer at the workspace's right edge (z4). The device pane becomes a 48 px **screen tab** (frame-age chip, "Open screen" opens `MirrorWindow.vue`). |
| 6     | Window < 1024             | Not supported (`minWidth: 1024` in `tauri.conf.json`).                                                                                                                               |
| H1    | Window height < 760       | Spine defaults to the 28 px strip.                                                                                                                                                   |
| H2    | Body would drop below 240 | The panel closes itself and leaves its tab header as a 28 px bar (from D).                                                                                                           |

The rail never changes mode by itself. `View › Compact rail` (44 px, icons, tooltips to the right) is a
persisted user choice.

### 2.3 Docking, splitting and persistence

| Element     | Resize                      | Split / dock                                                                                                                                                                                              | Detach                        | Persisted                                         |
| ----------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------- |
| Rail        | No                          | No                                                                                                                                                                                                        | No                            | Compact toggle; Instruments fold per session type |
| Workspace   | Leftover space              | **One vertical split** of two instruments when the workspace is ≥ 1041 (two halves of 520). Both follow one playhead and selection. Reachable at 1536 with the inspector closed and at 1920 with it open. | No                            | The split pair and ratio                          |
| Panel       | 120 – 60 %                  | One tab visible; `Ctrl Shift J` maximises it over the workspace column                                                                                                                                    | Yes, `DockDetachedWindow.vue` | Height, tab, filters, detached state              |
| Inspector   | 280 – 480                   | No                                                                                                                                                                                                        | No                            | Width and pin flag, never its contents            |
| Device pane | 240 – 520                   | No                                                                                                                                                                                                        | Yes, `MirrorWindow.vue`       | Width, detached state, mirror settings            |
| Spine       | 28 / 64 / lanes / maximised | Never                                                                                                                                                                                                     | Never                         | Height mode, lanes and order, zoom window         |

**Never persisted:** selection, pin stack, playhead (a relaunch is always live and following), the
open recorded session (the Start page offers "Reopen checkout-bug.capu"), open sheets, history, and
any live status. Cached device, app and target are restored as identifiers only and re-resolved before
any health is shown (from D).

**Fixed on purpose:** region order; the device pane on the right; the context bar's contents and
order; the spine's existence; rail order (never re-sorted by usage or persona); status-bar contents.

---

## 3. Wireframes

Glyphs: `●` live, `■` paused, `◌` connecting, `○` absent, `–` not applicable, `✕` error, `▨` stale
hatch. Lane ticks use shape and `cat-*` hue: `▮` screen, `╷` request, `✕` failed request, `▪` data
write, `·` log, `◆` error, `▼` mark or step.

### 3.1 Full shell, 1920×1080, live, inspector open, panel open

```
x 0    64                                              1200               1560                  1920
y0   ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
     │◩ ‹ ›│● Live ▾│ Phone-class ▾ › Shop app 2.4.1 ▾ › WebView main ▾│ADB● Web● Agt○ Cmp○ SDK–│○ Capture│⌕ Search… Ctrl K│–▢×│ 40 CONTEXT
y40  ├───────────────┬─────────────────────────────────────────────────────────────┬────────────────┤
     │● LIVE  5:00 ▾ │ ruler  −4:00 ····· −3:00 ····· −2:00 ····· −1:00 ····· now┃ │⤓ Save 5 min    │ 16
     │evidence since │ summary ▁▂╷╷▮ ▪ ··✕ ╷ ▮▪ ·· ◆ ╷▮ ·▪ ·· ╷ ▮ ·· ▪ ╷╷ ▮ ·   ┃ │▼ Mark  Lanes ▾ │ 28  SPINE 64
     │15:12:04   120 │ marks          ▼               ▼         [A═══════B]      ┃ │           168  │ 12 (+8 pad)
y104 ├──────┬────────┴──────────────────────────────┬──────────────────┬──────────┴────────────────┤
     │ ▣    │ Browse · Structure · SQL · Graph   beta │ ▪ Row 412   ‹ › 📌×│ Screen · scrcpy  frame 0.1s ⋯│ 32 sub-nav / headers
     │Session│──────────────────────────────────────│──────────────────│──────────────────────────────│
     │──────│ ⌕ Filter │WHERE ▢─────────│Columns ▾│ ⟳ │via ADB pull · 12 s ↻│ Summary          │                              │ 32 toolbar + provenance slot
     │Instr.▾│──────────────────────────────────────│ The order failed │   ┌──────────────────────┐   │
     │ ▤ Data│ Sources 240 │ # │ id │ status │ total │ to sync at       │   │                      │   │
     │ ◎ Net │ ⌕ Filter    │ 1 │410 │pending │ 12.00 │ 15:16:21. POST   │   │   STREAM RECTANGLE   │   │
     │ ⌖ Elem│ ▾ SQLite    │ 2 │411 │synced  │  8.50 │ /sync returned   │   │   344 × 764          │   │
     │ ▢ Dev │   Orders    │▶3 │412 │failed  │ 31.00 │ 500 in 1.2 s.    │   │   canvas (Android)   │   │
     │──────│ ▾ IndexedDB │  … 26 px rows, virtualised    │ Details ▸        │   │   or native webview  │   │
     │ ▶ Flows│ ▸ Local st.│                              │ Provenance       │   │   (local preview)    │   │
     │      │ ▸ Cache·OPFS│                              │ SQLite via ADB   │   │                      │   │
     │      │ ▸ Local cop.│ footer 24: 165 rows · page 1/4│ read 15:16:21.4  │   └──────────────────────┘   │
y816 │      ├─────────────┴────────────────────────────────┤ Related ±2 s     │                              │
     │      │ Logcat │ Console │ Exceptions │ Shell   ⌄ ⤢ ⧉ │  ✕ POST /sync 500│                              │ 28 panel tabs
     │ ▥ Lib│ ⌕ level:error tag:sync   V D I W E   ● tail  │  ◆ SyncError     │                              │ 32 query
     │ ⚙    │ 15:16:21.204 E SyncWorker POST /sync failed  │ Actions          │ ◁   ○   ▢   🔊  ⏻             │ 22 rows / 32 controls
y1056├──────┴──────────────────────────────────────────────┴──────────────────┴──────────────────────────────┤
     │ ⟳ Pulling orders.db 42 % · Buffer 4:12 / 5:00 · 38 MB · 2 mocks active · MCP 1 agent (read)            │ 24 STATUS
y1080└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
       rail 64 │ workspace 1136                                 │ inspector 360    │ device pane 360
```

### 3.2 Full shell, 1536×864 (the owner's screen), live, app in background

```
x 0    64                                     896              1216              1536
y0   ┌───────────────────────────────────────────────────────────────────────────────┐
     │◩ ‹ ›│● Live ▾│Phone-class ▾ › Shop app ▾ › WebView main ▾│● ■41s ○ ○ –│○ Capture│⌕│–▢×│ 40
y40  ├──────────────┬────────────────────────────────────────────────────┬───────────┤
     │● LIVE 5:00 ▾ │ ruler ·· −3:00 ····· −2:00 ····· −1:00 ··········now┃│⤓  ▼  ≡  │ 64
     │since 15:12:04│ summary ╷╷▮ ▪ ··✕ ╷ ▮▪ ·· ◆ ╷▮ ▨▨▨▨▨▨▨▨ web paused ▨▨┃│     120 │
y104 ├──────────────┴────────────────────────────────────────────────────┴───────────┤
     │ ▨ Shop app in background since 15:16:02 · Network, Elements, browser storage   │ 28 NOTICE, one line
     │   frozen · SQLite, Files, Logcat live (drawn on two lines here only for width) [Bring to front] +1 │
y132 ├──────┬────────────────────────────────┬──────────────────┬──────────────────┤
     │ ▣ Ses│ Requests · Mocks               │ ╷ POST /sync  📌× │ Screen  frame 0.2s│ 32
     │ Instr│ ⌕ │All XHR WS Doc│Status▾│ frozen · 15:16:02│ Summary           │                  │ 32
     │ ▤ Dat│ Method│Status│Path       │Time │ POST /sync failed │ ┌──────────────┐ │
     │ ◎ Net│ GET   │ 200  │/assets/…  │18 ms│ with 500 after    │ │              │ │
     │ ⌖ Ele│ POST  │✕ 500 │/sync      │1.2 s│ 1.2 s.            │ │  302 × 672   │ │
     │ ▢ Dev│ … 24 rows at 26 px          │ Details ▸         │ │  (launcher:  │ │
     │ ▶ Flo│                              │ Provenance        │ │  the truth)  │ │
     │      │                              │ Web (CDP) over ADB│ │              │ │
     │ ▥ Lib│ footer: 214 requests · since │ read 15:16:01.9   │ └──────────────┘ │
     │ ⚙    │ 15:12:04 (buffer)            │ Related ±2 s      │ ◁  ○  ▢   ⏻      │
y840 ├──────┴──────────────────────────────┴──────────────────┴──────────────────┤
     │ Buffer 4:12 / 5:00 · 38 MB · MCP off                                          │ 24
y864 └───────────────────────────────────────────────────────────────────────────────┘
       rail 64 │ workspace 832                │ inspector 320    │ device pane 320
```

At 832 the T2 source list stays docked (220 + grid 612). With the inspector closed the workspace is
1152 and a split is available.

### 3.3 Full shell, 1280×800, live, Data with inspector open

```
x 0    64                                700            1000          1280
y0   ┌────────────────────────────────────────────────────────────────────┐
     │◩│● Live ▾│Phone-class ▾ › Shop app ▾ › main ▾│● ● ○ ○ –│○ Capture│⌕│–▢×│ 40
y40  ├────────────┬─────────────────────────────────────────────┬─────────┤
     │● LIVE 5:00 │ ruler ····· −2:00 ····· −1:00 ········ now┃ │⤓ ▼ ≡   │ 64
     │since 15:12 │ summary ╷╷▮ ▪ ··✕ ╷ ▮▪ ·· ◆ ╷▮ ·▪ ·· ╷ ▮   ┃ │    120 │
y104 ├──────┬─────┴─────────────────────────┬───────────────┴─┬───────────┤
     │ ▣ Ses│ Browse · Structure · SQL      │ ▪ Row 412   📌× │ Screen ⋯  │ 32
     │ Instr│ Orders ▾│⌕│WHERE ▢──│ADB·12s ↻│ Summary         │           │ 32  source switcher replaces the list
     │ ▤ Dat│ # │ id │ status │ total │ upd │ The order failed│ ┌───────┐ │
     │ ◎ Net│ 1 │410 │pending │ 12.00 │ 15: │ to sync …       │ │264×587│ │
     │ ⌖ Ele│▶3 │412 │failed  │ 31.00 │ 15: │ Details ▸       │ │       │ │
     │ ▢ Dev│ … 22 rows at 26 px            │ Provenance      │ │       │ │
     │ ▶ Flo│                               │ Related ±2 s    │ └───────┘ │
     │ ▥ Lib│ footer: 165 rows · page 1/4   │ Actions         │ ◁ ○ ▢  ⏻  │
y776 ├──────┴───────────────────────────────┴─────────────────┴───────────┤
     │ Buffer 4:12 / 5:00 · 38 MB                                           │ 24
y800 └──────────────────────────────────────────────────────────────────────┘
       rail 64 │ workspace 636              │ inspector 300   │ device 280
```

No column toggles between Screen and Inspector (C's thrash risk is designed out): the inspector is
always its own column down to 1180, and the workspace's inner columns fold first.

### 3.4 Start state (no session)

```
1536×864
┌───────────────────────────────────────────────────────────────────────────────┐
│◩│ No session ▾ │ Pick a device ▾                    │ ADB ● – – – –│○ Capture│⌕│–▢×│ 40
├───────────────────────────────────────────────────────────────────────────────┤
│ No session yet. Connect a device or open a .capu to start the clock.           │ 28 SPINE strip (never 0)
├──────┬────────────────────────────────────────────────────────────────────────┤
│ ▣ Ses│ ┌ Connect a device ─────┐ ┌ Capture a session ────┐ ┌ Open a session ──┐  │ 3 doors, 280 × 120 (A)
│ Instr│ │ USB, Wi-Fi pair, TCP, │ │ Start the clock on a  │ │ Drop a .capu here│  │
│ ▤ Dat│ │ or boot an emulator   │ │ connected app         │ │ or Ctrl O        │  │
│ ◎ Net│ └───────────────────────┘ └───────────────────────┘ └──────────────────┘  │
│ ⌖ Ele│ ┌ Devices (span 5) ─────────────────┐ ┌ Recent sessions (span 7) ─────┐  │
│ ▢ Dev│ │ ● Phone-class · USB   Shop app ▾  │ │ ⌕ │All · Mine · Received · Runs│ │
│ ▶ Flo│ │            [Start live] [Capture] │ │ Checkout fails on retry       │  │ ListItem 48
│      │ │ ⚠ Second phone · waiting for USB  │ │ Shop app · 06:12 · 3 errors   │  │
│ ▥ Lib│ │   debugging approval   [Help]     │ │ received from companion       │  │
│ ⚙    │ │ ○ Emulator (AVD)          ▸ Boot  │ │ Reopen checkout-bug.capu ↺    │  │
│      │ │ + Pair over Wi-Fi  + Connect TCP  │ │ …                             │  │
├──────┴─┴───────────────────────────────────┴─┴───────────────────────────────┴──┤
│ MCP off · Update ready                                                            │ 24
└───────────────────────────────────────────────────────────────────────────────────┘
 The device pane is absent (no stream), so the free rectangle is the whole window.
```

### 3.5 Received `.capu` (recorded session), 1536×864

```
┌───────────────────────────────────────────────────────────────────────────────┐
┆▤ Recorded · Checkout fails on retry · 4 Nov 15:16 ▾│ captured via ADB + Companion │ Export ▾│⌕│–▢×│ 40, perforated left edge
├┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┤ perforated top edge (prov-recorded)
│▤ RECORDED 06:12│ 00:00 ···· 01:00 ···· 02:00 ┃ 03:00 ···· 04:00 ····· 06:12 ▌│◀◀ ▶ ▶▶ 1×│ 64, ink playhead, end cap
│◀ prev  next ▶  │ ╷╷▮ ▪ ·· ✕ ╷ ▮▪ ·· ◆ ╷▮ ┃ ·▪ ▨▨ link lost 00:42 ▨▨ ╷ ▮ ·  ▌│          │ the gap is drawn into history
├──────┬─────────┴─────────────────────────────────────────────┬──────────┴─────┤
│ ▣ Ses│ Session header 56: Checkout fails on retry · 06:12    │ ▤ Recorded frame│
│ Instr│   3 errors · 2 failed requests · 41 writes · 5 marks   │   00:21.750     │
│  ▸ 4 │ │All · Problems · Actions · Network · Data · Logs│ ⌕    │ ┌────────────┐ │
│ ▶ Flo│ 00:20.1 ▮ Tap "Pay now"                   Screen · ADB │ │  302×672   │ │
│ ▥ Lib│ 00:20.3 ✕ POST /sync failed with 500       Web (CDP)   │ │  recorded  │ │
│ ⚙    │ 00:21.5 ▪ orders: 3 rows changed           SQLite·ADB  │ │  keyframe  │ │
│      │ 00:21.6 ◆ SyncError: retry budget exhausted Console    │ └────────────┘ │
│      │ 00:24.0 ▼ Mark "customer sees spinner"     You         │ no input: read  │
│      │ Saved views: Stock for one SKU ↗ · Failed syncs ↗      │ only            │
├──────┴───────────────────────────────────────────────────────┴────────────────┤
│ Opened from file · read-only · 9.8 MB                                            │ 24
└──────────────────────────────────────────────────────────────────────────────────┘
 Instruments are folded to one row ("▸ 4"), never hidden. Selecting a row seeks the playhead and opens
 the inspector on Summary, Details collapsed. Writes are absent, with "Recorded session: read-only".
```

### 3.6 Disconnected (cable pulled mid-session), 1536×864

```
┌───────────────────────────────────────────────────────────────────────────────┐
│◩│● Live ▾│Phone-class ▾ › Shop app ▾ › main ▾│ADB ✕ 0:42 Web ▨ ○ ○ –│○ Capture│⌕│–▢×│ 40
├───────────────────────────────────────────────────────────────────────────────┤
│● LIVE 5:00 │ ╷╷▮ ▪ ·· ✕ ╷ ▮▪ ·· ◆ ╷▮ ·▪ ▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨ link lost 15:16:40 ┃ │ 64
├───────────────────────────────────────────────────────────────────────────────┤
│ ✕ Device disconnected 0:42 ago. Values below are from 15:16:40.   [Reconnect]  │ 28 NOTICE
├──────┬──────────────────────────────────────────────┬─────────────────────────┤
│ ...  │ Data › Orders (rendered before the drop):    │ ┌─────────────────────┐ │
│      │ grid stays mounted, every value hatched      │ │ last frame, dimmed  │ │
│      │ provenance slot: "stale · read 15:16:38"     │ │ Disconnected 0:42   │ │
│      │                                              │ │ ago  [Reconnect]    │ │
│      │ Elements (never rendered): G-slot            │ │ (canvas not drawn)  │ │
│      │  "No device connected" + [Reconnect]         │ └─────────────────────┘ │
│      │  [Open a .capu]                              │                         │
└──────┴──────────────────────────────────────────────┴─────────────────────────┘
```

### 3.7 Screen templates

Every template sits under the same sub-nav (32, Cladd `Tabs`) and toolbar (32, Cladd `Toolbar`, `sm`
24 px controls). The toolbar's right end is the **provenance slot**: one `ProvenanceTag` per
instrument, always in the same place (from A). Optional S-slot (32) sits directly under the toolbar.
The body is the only part a template defines, and it carries the G-slot. Widths are given at 1136
(1920, inspector open), 832 (1536) and 636 (1280).

**T1 · Story** (Session live and recorded, flow run)

```
┌ workspace ─────────────────────────────────────────────────────────────────────┐
│ Session header 56: title ✎ · duration · app · counts        [Mark M] [Export ▾] │ lg 16/22 500; meta 2xs
├────────────────────────────────────────────────────────────────────────────────┤
│ Toolbar: │All · Problems · Actions · Network · Data · Logs│ ⌕   │ live · now      │ Segmented
├────────────────────────────────────────────────────────────────────────────────┤
│ 15:16:20.1  ▮ Tap "Pay now"                                   Screen · ADB     │ row 26
│ 15:16:20.3  ✕ POST /sync failed with 500 after 1.2 s          Web (CDP)        │
│ ── 15:17 ─────────────────────────────────────────────────────────────────── │ sticky minute 20
└────────────────────────────────────────────────────────────────────────────────┘
 time 88 (mono xs tabular) │ glyph 20 │ sentence flex (sans sm) │ source 160 (2xs); 120 at 636
```

**T2 · Source list and grid** (Data, Device › Files)

```
┌ Sources 240 (220 at 832) ┬ grid ─────────────────────────────────────────────┐
│ ⌕ Filter            24   │ header 28 (name, type glyph, content-aware width)  │
│ ▾ SQLite                 │ # │ id │ status │ total │ updated_at             │
│   Orders  native         │ rows 26 / 22 / 30, row and column virtualised      │
│ ▾ IndexedDB  shop-db     │                                                    │
│ ▸ Local and session st.  │                                                    │
│ ▸ Cache · OPFS · Cookies │                                                    │
│ ▸ LocalForage            │                                                    │
│ ▾ Local copies (dashed)  ├ footer 24: 165 rows · page 1/4 · local copy ───────┤
└──────────────────────────┴────────────────────────────────────────────────────┘
 Workspace < 760: the list becomes a drawer (Ctrl B), and a source switcher sits at the toolbar's left.
 Graph is a mode in the sub-nav (Browse · Structure · SQL · Graph), never a source.
```

**T3 · Stream table** (Network › Requests and Mocks, Device › Apps and Ports, Library list, Flows › Runs)

```
┌ toolbar: ⌕ │Segmented All XHR WS Doc Img Script Other│ Status ▾ │ Preserve │ prov ┐
├ Method 64 │ Status 56 │ Path flex │ Type 64 │ Size 72 │ Time 64 │ Tier 88 ─ 28 ─┤
│ GET       │ 200       │ /assets/… │ js      │ 4 KB    │ 18 ms   │ Web           │ 26
│ POST      │ ✕ 500     │ /sync     │ fetch   │ –       │ 1.2 s   │ Web           │ only non-2xx coloured
├ footer 24: 214 requests · 3.1 MB · since 15:12:04 (buffer) ───────────────────┤
└────────────────────────────────────────────────────────────────────────────────┘
 Detail is always the shell inspector, never an in-template pane. Follow-tail toggle when live.
 Panel streams (Logcat, Console, Exceptions, Shell) use the same row language at 22 px, mono xs.
 Console has an inline REPL prompt (32) at its bottom, Chrome DevTools style.
```

**T4 · Tree and detail** (Elements, Flows › editor, Settings)

```
┌ toolbar: ⌖ Pick on screen │ ⌕ Search DOM │ ⟳                        │ CDP · live ┐
├ tree flex (min 420), rows 22, indent 12 ──────┬ detail 360 (320 at 832) ─────────┤
│ ▾ <html lang="en">                            │ Tabs: Styles · Computed · Box     │
│   ▾ <body class="…">                          │ SectionTitle + KV rows 26         │
│     ▸ <div id="app">                          │                                   │
└───────────────────────────────────────────────┴───────────────────────────────────┘
 Workspace < 760: the detail column folds into the inspector's Details section.
 Settings is a full workspace page (no modal): section list as the tree, form as the detail.
```

**T5 · Facts** (Device › Overview, Current app, Performance)

```
┌ toolbar: Scope │Device · App│ │ Sampling 1 s ▾ │ ⏸                     │ ADB · 1 s ┐
│ 12 columns, gutter 16; cards are Surface, padding 12                             │
│ ┌ Identity (span 4) ─────┐ ┌ Vitals (span 8) ───────────────────────────────────┐ │
│ │ KV rows 26 (label over │ │ CPU  ▁▂▃▂▁  12 %     via ADB · 1 s                 │ │ row 40
│ │ value, one pattern)    │ │ Mem  ▃▃▃▄▄  234 MB   via ADB · 1 s                 │ │
│ │                        │ │ Batt not reported · needs Companion [Install]      │ │ I-slot
│ └────────────────────────┘ └────────────────────────────────────────────────────┘ │
│ ┌ Permissions (span 12): T3 rows inside a Surface ────────────────────────────────┐ │
└────────────────────────────────────────────────────────────────────────────────────┘
 Charts draw nothing before the first sample: "Waiting for the first sample · since 15:16:02".
 At 636 cards stack to span 12.
```

**T6 · Collection** (Start, Library, Flows landing): see §3.4. Library is the Recent sessions column
at full width, in T3 rows above 50 items. Flows lands on its library; "New flow ▾ · Record steps ·
Describe to agent" makes the agent one way to author, not the landing (round-01 F-05).

**Spine modes** (not a template, a state of the spine)

```
Strip 28:     │● LIVE│ ruler 12 + density 16 with marks overlaid                         ┃now│
Overview 64:  │ gutter 120 │ ruler 16 │ summary 28 │ marks 12 │ +8 padding        │ tools 168 │
Lanes:        64 + 20 × n, up to 50 % of the window. Lane gutter shows the label and its tier glyph:
              Screen ADB (40, 1 fps thumbnails) · Network Web · Data writes ADB · Console Web ·
              Logcat ADB · Errors · Perf Agent/ADB (28 sparkline) · Steps · Marks.
              A lane the current tiers cannot feed draws a dashed body: "needs Companion · Install".
Maximised:    Shift T. The spine fills the workspace column (inspector and device pane stay).
              WASD zoom and pan (matched on KeyboardEvent.code). Area-drag selects a range.
```

### 3.8 Every current screen, assigned

| Current route or surface                                                                             | Template | New home                                                     |
| ---------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------ |
| `/devices/overview`                                                                                  | T5       | Device › Overview                                            |
| `/devices/apps`                                                                                      | T3       | Device › Apps (a table, not tiles)                           |
| `/devices/files`                                                                                     | T2       | Device › Files (opens on the app's folders; `/` is explicit) |
| `/devices/perf`, `/app/performance`                                                                  | T5       | Device › Performance (scope Device or App)                   |
| `/app/overview`, `/app/data-usage`                                                                   | T5       | Device › Current app                                         |
| `/storage/indexeddb`, `indexeddb-snapshot`, `localstorage`, `localforage`, `cache`, `opfs`, `sqlite` | T2       | Data sources                                                 |
| `/storage/graph`                                                                                     | T2 mode  | Data › Graph mode                                            |
| `/network/requests`, `/network/mock`                                                                 | T3       | Network › Requests, Mocks (maturity chip)                    |
| `/inspect/elements`, `/inspect/:pluginId`                                                            | T4       | Elements › DOM, Components (only when detected)              |
| `/replay`                                                                                            | T1 + T6  | Session (recorded) and Library; `/replay` redirects          |
| `/automation`                                                                                        | T6       | Flows (library)                                              |
| `/automation/f/:flowId`                                                                              | T4       | Flows › editor                                               |
| `/automation/runs/:runId[/step/:index]`                                                              | T1       | Session of that run                                          |
| `/settings/*` (general, appearance, adb, chrome, shortcuts, mcp, updates; route-modal today)         | T4       | Settings page, plus a Companion section                      |
| `/preview`                                                                                           | –        | Not a screen: a device-pane source for local targets         |
| `/console/:tab`, dock Logcat, Console, REPL, Exceptions                                              | T3 panel | Panel tabs (REPL becomes Console's prompt); route removed    |
| `AdbReversePopover`                                                                                  | T3       | Device › Ports                                               |
| Device shell                                                                                         | T3 panel | Panel › Shell                                                |

---

## 4. Navigation model

### 4.1 Rail: depths, then instruments

```
┌ 64 ┐
│ ▣  Session    Ctrl 1   L0  the story of the open session; Start when there is none
│ Instruments ▾          group header 20, foldable
│ ▤  Data       Ctrl 2   L2
│ ◎  Network    Ctrl 3   L2
│ ⌖  Elements   Ctrl 4   L2
│ ▢  Device     Ctrl 5   L2  Overview · Current app · Apps · Files · Performance · Ports
│ ▶  Flows      Ctrl 6
│ (flex)
│ ▥  Library    Ctrl 7   every session: captures, received files, flow runs
│ ⚙  Settings   Ctrl ,
└────┘
```

- Items are 48 tall (icon 16, gap 4, label 2xs 11/14). Active: `accent-soft` fill plus a 2 px
  `signal-select` inset bar at x 4.
- **Fold.** A recorded session defaults to folded; a live session defaults to unfolded. The fold is
  stored per session type and only when the user changes it, so a support-first install cannot strand
  a developer. Folded, the group is one 40 px row "Instruments ▸ 4" with a flyout to the right (z4);
  `Ctrl 2–5` work folded or not.
- An instrument that cannot run in this session stays in place with a 6 px hollow ring and shows its
  gate when opened. Maturity ("beta") appears once, as a `Chip` at the end of the sub-nav, never in
  the rail.
- **Logs are not a rail item.** Streams live in the panel (`Ctrl J`), maximised with `Ctrl Shift J`.
  The spine's Logcat and Console lanes are projections, not homes.

### 4.2 Tabs are modes

Each instrument has a sub-nav of modes (Cladd `Tabs`). There are no document tabs (§9, decision 2).
Sources inside an instrument are a source list. "Keep this while I look at that" is served by:

- the **pin stack** (up to 5 pinned selections, ‹ › in the inspector header, each pin drawn as a `◆`
  on the spine);
- **one split** of two instruments (§2.3);
- `Ctrl Enter` in the inspector opens the selection in its instrument in the other split half.

### 4.3 Inspector

- One global selection: `selection.store` = `{ kind, id, t, source, tier, readAt, sessionId }`, written
  by Story rows, grid rows, requests, DOM nodes, log lines, spine ticks and on-screen picks.
- Opens on selection, closes on `Esc` or deselect (never an empty column). `📌` keeps it open on the
  last item. `Ctrl I` toggles it.
- Fixed section order for every evidence kind:
  1. Header 32: kind glyph, title, ‹ › through pins, pin, close.
  2. **Summary**: one plain-language paragraph ("POST /sync failed with 500 after 1.2 s. 3 rows in
     orders changed in the next 400 ms.").
  3. **Details** ▸: raw payload, headers, row JSON, styles. Collapsed when entered from Story,
     expanded when entered from an instrument.
  4. **Provenance**: tier, exact read time and age, and live / buffered / recorded / stale pattern
     (`ProvenanceTag`).
  5. **Related**: other lanes within ±2 s, ranked errors › writes › requests › logs, at most 8.
  6. **Actions**, listed with their shortcuts: Open in instrument ↗, Copy as…, Mark, Add to report.
     `Ctrl .` runs them from the keyboard. Destructive device writes use an inline typed confirm,
     except uninstall and clear data, which use an alert dialog (§5).
- **Time behaviour.** In a recorded session or in Review, selecting evidence moves the playhead. In
  Live, selecting draws a `signal-select` hairline on the spine and does not leave live. `Enter` ("go
  to time") moves the playhead on purpose and enters Review (from B).

### 4.4 Live, Review and Recorded

|                  | Live                                                                        | Review (live buffer, playhead pulled back)                                                                                                             | Recorded (`.capu`)                                                                     |
| ---------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Enter by         | Default                                                                     | Scrub, `Enter` on a selection, `←` in the focused spine                                                                                                | Open a `.capu`, Library, file association, drop                                        |
| Spine right      | 1 px `signal-live` now-edge labelled "now", moving only while events arrive | Now-edge keeps moving; a 2 px **ink** playhead sits in the past; "Return to live" (`End` or `F`)                                                       | 2 px ink end cap with the end time; no now-edge; perforated top edge                   |
| Spine left       | "evidence since 15:12:04", never implies older data                         | same                                                                                                                                                   | Session start                                                                          |
| Gutter badge     | `● LIVE`                                                                    | `◐ REVIEW −00:42`                                                                                                                                      | `▤ RECORDED 06:12`                                                                     |
| Provenance slot  | `live · now` or `via ADB pull · 12 s ↻`                                     | `@ −00:42 · buffered`; an instrument that cannot answer for T says "Live DOM: not available at −00:42. Capture to record the DOM." and never shows now | `@ 00:21.750 · recorded`                                                               |
| Writes           | Through the real target                                                     | Disabled, reason "Reviewing the past: return to live to edit"                                                                                          | Absent, reason "Recorded session: read-only"                                           |
| Device pane      | Live stream                                                                 | Live stream, bar reads "Live, not at playhead" with "Show frame at playhead"                                                                           | Recorded frame at the playhead, labelled; "No frame recorded at this time" when absent |
| Session switcher | `● Live ▾`                                                                  | `● Live ▾` + `REVIEW` chip                                                                                                                             | `▤ Recorded · <title> · <date> ▾` with the `prov-recorded` perforated left edge        |

**Range.** Area-drag on the spine selects A–B (`[` and `]` set them at the playhead, aliases
`Alt A` / `Alt B`). Time-aware instruments filter to the range and say so in the provenance slot
("15:16:02 – 15:16:40 · 38 s"). Export, "Save" and the capture review sheet use the range. `Esc`
clears it.

**Link drops** are drawn into history: lanes hatch with `prov-stale` from the drop until the link
returns, and the hatch is saved in the `.capu`. Lanes that were never available are absent, not
hatched.

### 4.5 Back and forward

`Alt ←` / `Alt →`, mouse buttons 4/5, and ‹ › in the context bar at ≥ 1600. History is a list of
evidence positions `{ session, instrument, mode, selection, playhead, range, filter }`, recorded on an
explicit open, a selection held for over 1 s, an instrument change and a session change (so Back after
opening a `.capu` returns to live). Cursor sweeps are coalesced. 100 entries per session, not
persisted. `Alt ↓` in the palette lists it.

### 4.6 Palette (`Ctrl K`) go-to syntax

| Prefix | Finds                                    | Example                             |
| ------ | ---------------------------------------- | ----------------------------------- |
| (none) | Everything, ranked                       | `orders`                            |
| `>`    | Commands                                 | `> reboot bootloader`               |
| `@`    | Sessions, devices, apps, targets         | `@shop`                             |
| `#`    | Tables and stores                        | `#orders`                           |
| `/`    | Requests by path                         | `/sync 500`                         |
| `<`    | Elements by selector                     | `<button.pay`                       |
| `!`    | Problems: errors, failed requests        | `!sync`                             |
| `t:`   | A time (relative, session clock or wall) | `t:-42s`, `t:00:21.7`, `t:15:16:20` |

The prefixes are characters typed into the field, not shortcuts, so they are layout-safe. Ship order:
`>`, `@`, `#`, `/`, then `!`, `<`, `t:`.

### 4.7 Keyboard map

Bindings are matched on `KeyboardEvent.code`; every punctuation chord has a letter alias; labels are
rendered by `KeyCaps` from the active layout map, so an AZERTY user sees their own key. `Ctrl R` and
`F5` are captured and never reload the WebView. `F6` / `Shift F6` cycle focus regions: context bar →
spine → rail → workspace → panel → inspector → device pane.

| Key                                       | Action                            | Key                               | Action                                                  |
| ----------------------------------------- | --------------------------------- | --------------------------------- | ------------------------------------------------------- |
| `Ctrl K`                                  | Palette                           | `Ctrl .` (alias `Ctrl Alt A`)     | Actions for the selection                               |
| `Ctrl 1–7`, `Ctrl ,` (alias `Ctrl Alt O`) | Rail items, Settings              | `Ctrl B`                          | Template drawer (source list)                           |
| `Ctrl I`                                  | Inspector                         | `Ctrl J` / `Ctrl Shift J`         | Panel / maximise panel                                  |
| `Ctrl \` (alias `Ctrl Alt S`)             | Split / unsplit the workspace     | `Alt ←` / `Alt →`                 | Evidence back / forward                                 |
| `T` / `Shift T`                           | Spine overview ↔ lanes / maximise | `Ctrl Alt T`                      | Focus the spine                                         |
| `←` `→` (spine focused)                   | Previous / next event             | `Shift ←` `→`                     | ±1 s                                                    |
| `End` or `F`                              | Return to live                    | `Enter`                           | Go to the selection's time                              |
| `M`                                       | Mark (with optional note)         | `[` `]` (alias `Alt A` / `Alt B`) | Range start / end                                       |
| `Ctrl Shift R`                            | Capture start / stop              | `Ctrl Shift S`                    | Save the last 5 minutes as a `.capu`                    |
| `Space` / `J K L` (recorded)              | Play-pause / back, pause, forward | `Esc`                             | Clear selection, then range, then release device typing |

Single-letter keys act only when focus is not in a text field or the stream rectangle.

### 4.8 Persona entry (progressive disclosure, no mode)

| Persona                    | Enters at                                                                                    | What changes for them                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Developer at the desk      | Last live session in the last instrument when the device is online; Start otherwise          | Nothing is folded; Details expanded from instruments. W1 (row → request → log) in 3 steps via Related.    |
| QA tester capturing        | Start → Capture, or `⤓ Save 5 min` after the bug already happened (pre-roll from the buffer) | Stop opens the capture review sheet (§5, z8a) with the device still live behind it.                       |
| Support with a `.capu`     | File association or drop → Session · Recorded · Story                                        | Instruments folded; Story with Problems filter; Summary first; saved views from the developer, one click. |
| Product checking a feature | Flows library → Run                                                                          | Each step lands on the spine as a mark with pass or fail.                                                 |
| Field technician           | Companion on the phone (Capture, Send)                                                       | Desktop opens the result as a recorded session; nothing new to learn.                                     |

**Capture review sheet** (560 wide, z8a): title; steps to reproduce pre-filled from Tap rows (editable);
marks; auto summary (errors, failed requests, writes); range (editable on the spine, which stays
interactive above the sheet); redaction preview with fields flagged by pattern and toggled per field;
`Export .capu`, `Export redacted .capu`, `Copy for ticket` (text summary and file path). Saved views
travel inside the `.capu`.

### 4.9 Capability to home (every inventory row)

A home is where a capability is **operated**. Spine lanes, palette results and inspector Related rows
are projections, not second homes.

| #   | Inventory capability                                                           | Home                                                                                                            | Projections                                                       | Template     |
| --- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------ |
| 1   | Physical connections (USB, TCP/IP, wireless pair, identity)                    | Start › Devices; "Pair / Connect…" in the device switcher; identity in Device › Overview                        | Tier popover                                                      | T6 / T5      |
| 2   | Session management (active device, snapshots, offline, cancel, leases, queues) | Context bar switchers and tier chain; leases and queues in the status bar "MCP n agents" popover (list, cancel) | –                                                                 | Shell        |
| 3   | Android emulators                                                              | Start › Devices "Emulator (AVD) ▸ Boot"; device-kind chip in the switcher                                       | –                                                                 | T6           |
| 4   | Local browser and runtime (Chrome, targets, local WebView)                     | Target switcher sources (Android WebView, Local Chrome, Local preview); renders in the device pane              | –                                                                 | Pane         |
| 5   | Device operations (reboot modes, root, restart ADB, TCP mode)                  | Device › Overview "Device actions" menu                                                                         | Palette `>`; restart ADB in the ADB tier popover                  | T5           |
| 6   | Applications (list, metadata, icons, launch, stop, clear, uninstall)           | Device › Apps; one app's actions in Device › Current app                                                        | App switcher                                                      | T3 / T5      |
| 7   | Targets (socket discovery, CDP forward, attach, external DevTools)             | Target switcher; "Open in Chrome DevTools" in its menu                                                          | –                                                                 | Shell        |
| 8   | Ports (CDP forwards, reverse rules, removal)                                   | Device › Ports                                                                                                  | Web tier popover shows the forward                                | T3           |
| 9   | Device shell                                                                   | Panel › Shell                                                                                                   | –                                                                 | T3 panel     |
| 10  | Device files                                                                   | Device › Files                                                                                                  | –                                                                 | T2           |
| 11  | Native logs (Logcat)                                                           | Panel › Logcat                                                                                                  | Logcat lane; Related                                              | T3 panel     |
| 12  | Native performance                                                             | Device › Performance (Device or App scope)                                                                      | Perf lane                                                         | T5           |
| 13  | DOM                                                                            | Elements › DOM                                                                                                  | Pick on screen from the device pane                               | T4           |
| 14  | CSS                                                                            | Elements detail column (Styles, Computed, Box); the inspector below 760                                         | –                                                                 | T4           |
| 15  | JavaScript console (evaluate, capture)                                         | Panel › Console, with the REPL prompt inline                                                                    | Console lane                                                      | T3 panel     |
| 16  | Framework DevTools (Vue, React)                                                | Elements › Components, present only when detected                                                               | –                                                                 | T4           |
| 17  | HTTP                                                                           | Network › Requests                                                                                              | Network lane; Story rows; Related                                 | T3           |
| 18  | Advanced network (WebSocket, Fetch interception, mock server)                  | Network › Mocks (maturity chip); WS frames in the request inspector; unfinished modes stay unrouted             | "2 mocks active" in the status bar and notice                     | T3           |
| 19  | IndexedDB                                                                      | Data › IndexedDB                                                                                                | Data-writes lane                                                  | T2           |
| 20  | Local and session storage                                                      | Data › Local and session storage                                                                                | Data-writes lane                                                  | T2           |
| 21  | Cookies                                                                        | Data › Cookies (when the adapter is complete)                                                                   | –                                                                 | T2           |
| 22  | Cache API                                                                      | Data › Cache                                                                                                    | –                                                                 | T2           |
| 23  | OPFS                                                                           | Data › OPFS (file listing; SQLite files link into the SQLite source)                                            | –                                                                 | T2           |
| 24  | LocalForage                                                                    | Data › LocalForage                                                                                              | –                                                                 | T2           |
| 25  | Native SQLite                                                                  | Data › SQLite, "native" as secondary text; Structure and SQL modes                                              | Data-writes lane                                                  | T2           |
| 26  | SQLite local files (import, export, overwrite, local writes)                   | Data › Local copies (`prov-local` dashed edge); import by drop on Start or `Ctrl O`                             | –                                                                 | T2           |
| 27  | Browser-backed SQLite (OPFS, SAH pool, wa-sqlite, jeep)                        | Data › SQLite, engine as secondary text ("OPFS · SAH pool")                                                     | –                                                                 | T2           |
| 28  | Screen interaction (mirror, input, keys, clipboard, detach)                    | Device pane                                                                                                     | –                                                                 | Pane         |
| 29  | Media capture (screenshot, screen video)                                       | Device pane ⋯ menu ("Screenshot", "Record video"), named apart from Capture                                     | Attachment on the spine as a mark                                 | Pane         |
| 30  | Session recording (start, append, stop, finalize)                              | Context bar `Capture`; `⤓ Save 5 min` in the spine; capture review sheet                                        | Status bar timecode                                               | Sheet        |
| 31  | Recording library (list, read, delete, orphans, export)                        | Library; export from the Session header; orphan cleanup in Settings › General › Storage                         | Palette `@`; Start › Recent                                       | T6 / T3      |
| 32  | Recorded database evidence                                                     | Data at the playhead in a recorded session                                                                      | Story rows; Related; Data-writes lane                             | T2           |
| 33  | Cross-track queries                                                            | Inspector › Related; Story filters                                                                              | Palette `t:` and `!`                                              | T1           |
| 34  | MCP (server, token, mutation mode, 56 tools in code)                           | Settings › Agents and MCP                                                                                       | Status bar "MCP n agents (mode)"; agent calls as Steps-lane ticks | T4           |
| 35  | Updates                                                                        | Settings › Updates                                                                                              | Status bar "Update ready"                                         | T4           |
| 36  | Hybrid/Capacitor-specific panels                                               | **No home** until real (inventory ruling, owner decision 1); Elements › Components stays generic                | –                                                                 | –            |
| 37  | Integrated AI chat (proposed)                                                  | **No home now.** If built: an inspector action "Explain this" and a palette scope, never a rail item            | –                                                                 | –            |
| 38  | Automation history and approvals (proposed)                                    | Flows › Runs; each run opens as a Session; approvals arrive as sheets naming the agent and the action           | Steps lane                                                        | T3 / T1      |
| +   | Flows: manual flows and agent runs (in code, not in the inventory)             | Flows (T6 library, T4 editor, T1 run)                                                                           | Steps lane                                                        | T6 / T4 / T1 |
| +   | Connection tiers: shell agent, companion, SDK (owner decision 2)               | Context bar tier chain; Settings › Companion (pairing, permissions, version)                                    | Per-value tier in `ProvenanceTag`; lane glyphs                    | Shell / T4   |

Nothing is orphaned (Preview, Mocking and Graph have homes) and nothing has two homes (Overview and
Performance each had two).

---

## 5. Layer stack

### 5.1 The free rectangle

The **stream rectangle** is the device pane minus its HTML bar (top 32) and controls (bottom 32).
Transient layers never enter the device pane column at all:

```
freeRect = { left: 0, top: 0, right: windowWidth − devicePaneWidth, bottom: windowHeight }
devicePaneWidth = 0 when no stream rectangle is on screen (no session, screen tab, detached)
```

Because the pane is always on the right, the free rectangle is convex and starts at the viewport's
origin. That is the property the mechanism below depends on.

### 5.2 Mechanism (spike first, then build)

1. `#overlay-root` is a permanent child of `body`, a sibling of `#app`:
   `position: fixed; inset: 0 var(--device-pane-w) 0 0; contain: layout; pointer-events: none;`
   with `pointer-events: auto` on its children. `App.vue` passes `overlays-root="#overlay-root"` to
   `CladdProvider` (`CladdProvider.vue:33`). Reka menus, the palette and sheets portal to the same root
   with `collisionBoundary` set to it.
2. **The anchor problem C missed.** `contain: layout` makes the root the containing block of every
   fixed overlay inside it. A CSS anchor outside that containing block is not an acceptable anchor, so
   a Popover whose trigger lives in `#app` would lose its anchor. The fix is the proxy that Popover
   already has: render the anchor as a fixed rectangle inside the teleport (`Popover.vue:311`,
   `buildAnchorRectStyle`). Because the root's origin is the viewport's origin, the trigger's
   `getBoundingClientRect()` coordinates are valid inside it without translation.
3. **Upstream cladd-vue change** (then `vp run sync:cladd`; `packages/cladd` is never edited here):
   `CladdProvider` gains `overlayBoundary`; when it is set, Popover, Popup and TooltipPrimitive anchor
   through a `useAnchorProxy(trigger)` that tracks the trigger's rectangle with `ResizeObserver`, a
   capture-phase scroll listener and one `requestAnimationFrame` per change. `position-try-fallbacks`
   then flip inside the root.
4. **Fallback if (2–3) fail in WebView2:** no containment; a post-placement corrector in cladd-vue
   measures the opened overlay and, if it intersects the hole, applies the next `position-area` from
   an ordered list, then clamps `max-width`.
5. **Guard.** Once the boundary passes, `useOverlayGuard` stops hiding the local preview for menus,
   listboxes and popovers. It keeps two triggers only: an open alert dialog (`[role="alertdialog"]`,
   `.cladd-dialog`) and an in-app drag. The local preview is then swapped for a freeze frame from CDP
   `Page.captureScreenshot` (endpoint from `discoverCdpEndpoint`, `localWebview.store.ts:111`). If no
   frame arrives within 150 ms, the rectangle shows "Preview paused while the dialog is open".

**Spike pass:** 40 placements (Popover, Popup, Select, Tooltip, a Reka menu, the palette; anchors at
the four edges of the free rectangle and on the device pane bar) at 100, 125 and 150 % scaling in
WebView2 produce 0 intersections with the stream rectangle and 0 overlays clipped unreadably, and no
overlay loses its anchor while its trigger scrolls.

### 5.3 Z-order

| z   | Layer                                                                       | Placement rule                                                                                                                                                            | Android mirror (canvas)                                                                                                                                                                           | Local preview (native webview)                                                                                                                  |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Shell chrome: context bar, spine, rail, status bar                          | Static grid areas                                                                                                                                                         | Never overlaps it                                                                                                                                                                                 | Never overlaps it                                                                                                                               |
| 1   | Panes: workspace, panel, inspector, device pane                             | Grid areas, never overlapping                                                                                                                                             | It is one of the panes                                                                                                                                                                            | Same                                                                                                                                            |
| 2   | Sticky headers: grid header, first column, lane labels, minute rows         | Opaque `bg-surface-0` or `bg-surface-cut` plus a 1 px `--border-subtle` divider                                                                                           | In-pane only                                                                                                                                                                                      | In-pane only                                                                                                                                    |
| 3   | In-flow gates: notice row, S-slot, I-slot, G-slot                           | In flow, never floating                                                                                                                                                   | The pane's own G-slot replaces the canvas, which is not drawn while gated                                                                                                                         | The webview is parked while the pane is gated                                                                                                   |
| 4   | Drawers: inspector below 1180, template source drawer, rail flyout          | Slide inside the free rectangle, `shadow-float`, no scrim                                                                                                                 | Never crosses x = W − pane width                                                                                                                                                                  | Same; no freeze                                                                                                                                 |
| 5   | Tooltips                                                                    | `#overlay-root`; device-pane-bar tooltips open left or down                                                                                                               | Cannot overlap by construction                                                                                                                                                                    | Same; no freeze                                                                                                                                 |
| 6   | Popovers, selects, tier popovers, menus, context menus                      | `#overlay-root`; pane-bar menus open with `position-area: left span-bottom`. The WebView's native menu is suppressed app-wide                                             | Right-click **inside** the stream rectangle is device input (Back), never a menu                                                                                                                  | Right-click goes to the page; no app menu over it                                                                                               |
| 7   | Command palette                                                             | No scrim; width `min(640, freeRect.width − 48)`; centred in the free rectangle, top = spine bottom + 12. Refuses to open over a dialog ("Close the dialog first")         | Stays live and interactive                                                                                                                                                                        | Stays visible; no freeze                                                                                                                        |
| 8a  | Sheets: capture review, export, recording options, pairing, approvals       | At most 560 wide, from the workspace top edge; scrim over the free rectangle **below the spine**, so the range stays editable                                             | **Stays live and interactive** on purpose: QA keeps reproducing while writing                                                                                                                     | Stays live                                                                                                                                      |
| 8b  | Alert dialogs: destructive confirm (uninstall, clear data), unsaved changes | 440 wide, centred in the free rectangle; the Cladd backdrop inside the root covers only the free rectangle                                                                | **Frozen**: the canvas stops painting new frames, a 40 % HTML scrim is drawn inside the pane, input is disabled, the pane bar reads "Paused while the dialog is open"                             | **Frozen**: parked and replaced by the CDP freeze frame under the same scrim                                                                    |
| 9   | Toasts                                                                      | Cladd `ToastsPortal`; bottom-left of the free rectangle, x = 80, 16 above the status bar; 360 wide; at most 3; action results only. Read failures are gates, never toasts | Never overlaps it                                                                                                                                                                                 | Never overlaps it                                                                                                                               |
| 10  | Drag ghosts (splitters, lane reorder, pin to split)                         | HTML ghost inside the free rectangle                                                                                                                                      | Ghost hides over the stream rectangle. An OS file dragged over it shows a 2 px `signal-select` inset and "Drop to push to /sdcard/Download"; the drop is read from Tauri's window drag-drop event | **Frozen** during in-app drags (the native surface would swallow the pointer); OS file drops are refused with "Drop files on an Android screen" |

**Keyboard capture.** When the stream rectangle has focus, keys go to the device and the pane bar shows
a `Chip`: "Typing on device · Esc releases". This is the only place keyboard capture happens.

---

## 6. State and gate placement

### 6.1 Slots and priority

**Priority:** link › capability › error › loading › empty › content. Only the highest condition in a
scope renders; a slot that hides others shows "+n".

| Slot            | Size                           | Where                                                                                                               | Component                                      |
| --------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Chain           | 5 slots in the context bar     | Always visible; the **only** place link state appears                                                               | `GateChain.vue` extended into `TierChain`      |
| Notice row      | 28, full width under the spine | Window-scope conditions, one at a time: link lost › unauthorised › paused › another WebView in front › mocks active | `GateStrip.vue` on `SurfaceCut` + `prov-stale` |
| G-slot          | Replaces the template **body** | Sub-nav, toolbar (disabled controls with a reason tooltip) and spine stay                                           | `GatedRouterView.vue`, `WorkbenchGate.vue`     |
| S-slot          | 32, directly under the toolbar | Template-scope conditions only (partial read failure, an old pull)                                                  | `GateStrip.vue`                                |
| I-slot          | One row (26) or one card body  | Where the missing value would be                                                                                    | New `InlineGate.vue` on `ProvenanceTag`        |
| Provenance slot | Right end of the toolbar       | Per-instrument source and age; per value in the inspector                                                           | `ProvenanceTag.vue`                            |

**Tier chain.** Five slots: ADB · Web (CDP over ADB) · Agent (shell agent) · Companion · SDK. Each uses
shape and colour: `●` live (`signal-live`), `■` paused, `◌` connecting, `○` absent (muted), `–` not
applicable, `✕` error (with icon), `▨` stale. An age shows next to a slot only when its last contact is
older than 5 s, so a healthy bar is quiet. Clicking a slot opens a 320 px popover: what this tier
provides, what is missing now, one fix.

**Inviolable rules** (C and D):

- A single summary age never stands in for per-value freshness. Every value keeps its own source and
  read time.
- "None found" is only said after a successful read, with its time.
- Content that rendered once is degraded under a hatch, never torn down.
- Unknown is never drawn as zero, false, empty or live. A missing track is labelled unavailable.
- An error is never recorded only in a toast.

### 6.2 State by state

`{…}` are placeholders. Copy is sentence case; actions are verbs that match the palette.

| State                                     | Chain                           | Notice row / S-slot           | Workspace                                                                                                                                                                  | Device pane                                 | Spine                                                                            | Copy                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------- | ------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Disconnected** (ADB lost)               | ADB `✕ {age}`                   | Notice                        | Rendered instruments stay mounted, hatched, provenance "stale · read {time}". Never-rendered: G-slot                                                                       | G-slot: last frame dimmed, canvas not drawn | All lanes hatch from the drop                                                    | Notice: "Device disconnected {age} ago. Values below are from {time}." [Reconnect]. G-slot title "No device connected", body "Connect over USB or Wi-Fi to read {instrument}." [Connect…] [Open a .capu]                                                                                                |
| **Unauthorised**                          | ADB `✕`                         | Notice                        | G-slot in every device-scoped instrument, with a 3-step illustration and `Spinner`                                                                                         | Short G-slot                                | Gutter "No live source"; empty ruler                                             | "{device} is waiting for USB debugging approval." / "Unlock the phone and tap Allow on the USB debugging prompt." / "Waiting for approval…" [Retry] [Help]                                                                                                                                              |
| **Target paused** (app in background)     | Web `■ {age}`                   | Notice naming frozen and live | CDP-fed instruments keep values under the hatch, provenance "frozen · {time}". ADB-fed instruments (SQLite pull, Files, Logcat, Performance) carry no hatch: they are live | Live: it shows the launcher, which is true  | Web lanes hatch from the pause; Screen and Logcat continue                       | "{app} is in the background. Android paused its WebView at {time}. {CDP instruments} are frozen; {ADB instruments} are still live." [Bring to front]. One line at every width: below 1440 the lists shorten to "WebView tools are frozen; ADB tools are still live", with the full lists in the tooltip |
| **Not debuggable**                        | Web `–` with tooltip            | –                             | G-slot in Elements, Network and browser stores only; ADB instruments work                                                                                                  | Unaffected                                  | Web lanes absent (never available)                                               | "{app} {version} isn't a debuggable build." / "Any debuggable build works with no code change. Release builds need the in-app SDK." [How to build for debugging] [About the SDK]                                                                                                                        |
| **Companion missing**                     | Companion `○`                   | –                             | Never blocks. I-slot where a companion value would be; a dimmed source row "SharedPreferences · needs Companion"                                                           | Screen on/off reads "unknown"               | Companion lanes appear dashed in the lane menu and, if enabled, as a dashed body | "{value} · not reported · needs Companion" [Install over ADB]                                                                                                                                                                                                                                           |
| **Empty** (read succeeded, nothing there) | –                               | –                             | `EmptyState` at 25 % of body height, max 480 wide: icon 16, title sm 500, cause, one action. A filtered grid keeps its header and says it in the first row                 | n/a                                         | The lane shows empty, not absent                                                 | "No {things} in {scope} · read {time}." Filtered: "No rows match {where}." [Clear filter]                                                                                                                                                                                                               |
| **Loading**                               | `◌` only for a link             | –                             | Nothing for 300 ms, then `Skeleton` rows (26, three widths, no shimmer); provenance slot "◌ reading via {tier}…"; after 3 s "Reading over ADB… {n} s"; after 15 s a Cancel | "Connecting stream…" + `Spinner`            | Ticks fill progressively; no skeleton                                            | "Reading {thing} over {tier}… {n} s" [Cancel]                                                                                                                                                                                                                                                           |
| **Error**                                 | Affected slot `✕` if link-level | Partial: S-slot               | Total: G-slot with copyable detail                                                                                                                                         | G-slot "Stream error"                       | An Errors-lane tick when the app itself fails                                    | Partial: "{n} of {m} {sources} failed to read." [Details]. Total: "Couldn't read {thing}: {message}." [Retry] [Copy details] [Report…]. Action: toast "{Verb} failed: {reason}." Stream: "Stream stopped: scrcpy exited ({code})." [Restart stream]                                                     |
| **Stale** (a pull older than its policy)  | –                               | S-slot                        | Values carry `prov-stale`; provenance shows the age                                                                                                                        | –                                           | –                                                                                | "Showing a copy pulled {age} ago." [Pull again]                                                                                                                                                                                                                                                         |

---

## 7. Density grid

Base unit **4**. Spacing values **4 · 8 · 12 · 16 · 24 · 32** only; lint bans `p-[`, `m-[`, `gap-[`.
Type uses existing Bench tokens only: `2xs` 11/16 meta, `xs` 12/16 data, `sm` 13/18 UI, `base` 14/20
sheet and dialog body, `lg` 16/22 one title per screen. `xl` and above are banned in product UI. Mono
400/500 for numbers, ids, time and code only. No ALL-CAPS labels. Rows stay **22 / 26 / 30**
(`DESIGN.md` §4, `ROW_HEIGHT` in `types.ts:48`). Controls: Cladd `md` 28 default, `sm` 24 nested
(toolbars), `xs` 20 in strips (`spacing.css`: 2xs 16, xs 20, sm 24, md 28, lg 32).

| Region          | Size                    | Row or control                                                                     | Padding                         | Type                                                                     | Cladd and app components                                                                                                                                       | Bench tokens                                                                                                                                               |
| --------------- | ----------------------- | ---------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context bar     | 40                      | Switchers and slots `md` 28                                                        | x 8; 8 between groups, 4 within | sm; ages 2xs mono                                                        | `Toolbar`, `ToolbarButton`, `Popup`+`SearchField`+`List` (switchers), `Popover` (tiers), `Chip`, `Shortcut`, `SearchField`                                     | `bg-background`                                                                                                                                            |
| Spine           | 28 / 64 / lanes         | Ruler 16, summary 28, marks 12, lane 20, perf 28, screen 40; ticks 2×12, error ◆ 8 | gutter 120, x 8                 | 2xs; mono tabular for times                                              | Canvas renderer (no Cladd equivalent), `Segmented`, `ToggleButton` (Follow), `ToolbarButton`, `Tooltip`                                                        | Track well `bg-surface-cut` + `shadow-cut`; `cat-*` + shape; `signal-live` now-edge; ink playhead; `signal-select` hairline and range; `signal-mark` marks |
| Notice row      | 28                      | `Button` `xs` 20                                                                   | x 12                            | sm; age 2xs mono                                                         | `GateStrip`, `Button`                                                                                                                                          | `prov-stale` hatch on `bg-surface-cut`                                                                                                                     |
| Rail            | 64 (44 compact)         | Item 48                                                                            | y 8; 2 between items            | 2xs 500 active, 400 rest                                                 | `List`, `ListButton`, `ListTitle` (group), `Tooltip` (right), `CollapsibleRoot`                                                                                | `bg-background`; active `accent-soft` + `signal-select` bar                                                                                                |
| Sub-nav         | 32                      | Tab 32                                                                             | x 16                            | sm; active 500                                                           | `Tabs`, `TabsList`, `Tab`; maturity `Chip`                                                                                                                     | `bg-surface-0`                                                                                                                                             |
| Toolbar         | 32                      | `sm` 24, gap 8, separators 16 tall                                                 | x 16                            | sm                                                                       | `Toolbar`, `ToolbarButton`, `ToolbarSeparator`, `SearchField`, `Segmented`/`SegmentedButton`, `Select`, `ProvenanceTag`                                        | `bg-surface-0`                                                                                                                                             |
| S-slot          | 32                      | `Button` `sm` 24                                                                   | x 16                            | sm + 2xs age                                                             | `GateStrip`                                                                                                                                                    | `prov-stale`                                                                                                                                               |
| Source list     | 240 / 220; 180–360      | Row 26, group header 24                                                            | x 8, indent 12                  | sm name, 2xs engine                                                      | `List`, `ListItem`, `ListTitle`, `CollapsibleRoot`/`CollapsibleTrigger`/`CollapsiblePanel`, `SearchField`                                                      | `bg-surface-0`                                                                                                                                             |
| Grid            | flex                    | Header 28; rows 22 / 26 / 30                                                       | cell x 8                        | xs: mono for numbers, ids, JSON; sans for text                           | `DataGrid` (shared, on Cladd `Table` language); `Table`/`TableHeader`/`TableRow`/`TableCell` below 50 rows                                                     | Well `bg-surface-cut`                                                                                                                                      |
| Story           | flex                    | 26; minute separators 20                                                           | x 16                            | time xs mono tabular; sentence sm; source 2xs                            | Virtual list (Reka), `Chip` for tier                                                                                                                           | `bg-surface-0`                                                                                                                                             |
| Panel           | 240 / 200               | Tab header 28, query 32, rows 22, REPL prompt 32                                   | x 8                             | xs mono                                                                  | `Tabs`, `Segmented` `xs`, `SearchField`, xterm or virtual list                                                                                                 | Well `bg-surface-cut`                                                                                                                                      |
| Inspector       | 360 / 320 / 300         | Header 32, KV 26, section gap 16                                                   | 12                              | Section titles sm 500 sentence case; values xs; labels 2xs `--fg-subtle` | `SectionTitle`, `AccordionRoot`/`AccordionItem`, `ProvenanceTag`, `Chip`, `Shortcut`, `Button`                                                                 | `bg-surface-0`                                                                                                                                             |
| Device pane     | 360 / 320 / 280         | Bar 32, controls 32                                                                | 8 around the stream             | 2xs; mono for fps and age                                                | `Toolbar`, `ToolbarButton`, `Chip` (frame age, typing), `Spinner`, `Tooltip` (left)                                                                            | `bg-background` around the stream                                                                                                                          |
| Status bar      | 24                      | Items 20                                                                           | x 8; 16 between items           | 2xs sans; mono only for timecodes and sizes                              | `Button` `2xs` transparent, `Chip`, `Tooltip`                                                                                                                  | `bg-background`                                                                                                                                            |
| Facts (T5)      | 12 cols                 | KV 26, sparkline row 40                                                            | gutter 16; card padding 12      | xs / sm                                                                  | `Surface`/`SurfaceContent`, `SectionTitle`                                                                                                                     | `bg-surface-0`, `shadow-bevel`                                                                                                                             |
| Start (T6)      | doors 280×120           | `ListItem` 40 (devices), 48 (sessions)                                             | gutter 16; sections 24          | sm; lg for the one title                                                 | `Surface`, `List`, `ListItem`, `Button`, `Segmented`                                                                                                           | –                                                                                                                                                          |
| Sheets, dialogs | sheet ≤ 560, dialog 440 | Controls `md` 28                                                                   | 16; sections 24                 | base body, lg title                                                      | Sheet on Reka; `Dialog`/`DialogRoot`, `Field`/`FieldGroup`/`FieldLabel`/`FieldDescription`, `Switch`, `Button` (`solid-fill` primary, `transparent` secondary) | `bg-surface-2` + `shadow-float`                                                                                                                            |
| Toasts          | 360                     | –                                                                                  | 12                              | sm                                                                       | `ToastsPortal`, `Toast`                                                                                                                                        | `bg-surface-2` + `shadow-float`                                                                                                                            |

**Depth:** chrome `bg-background`; workspace and inspector `bg-surface-0`; wells `bg-surface-cut` +
`shadow-cut`; overlays `bg-surface-2` + `shadow-float`. One depth cue per edge, never bevel plus border.
Radius 4 for chips, cells and keycaps; 6 for controls; 8 for popovers, sheets and dialogs.

**Not in Cladd (stay on Reka or custom, per DESIGN §5):** splitters, menus and context menus, the
command palette (`components/command/CommandPalette.vue`), sheets, scroll areas, the tree, virtual
lists. `Skeleton` stays on `components/ui/skeleton` until Cladd has one.

**To build:** `ShellLayout` (CSS grid areas `ctx spine notice rail ws panel insp pane status`),
`TimelineBand` (shared), `TierChain`, `InlineGate`, `EmptyState`, `selection.store`, `#overlay-root`
with `useAnchorProxy` upstream, `CaptureReviewSheet`.

---

## 8. Migration

Each step ships on `feat/ui-ux-overhaul` behind its flag, keeps every old route working through
redirects, and has a release gate: no open S0 in the regions it touches, and `check:cladd-adoption`
does not go up. New shell code lives in `src/components/layout/` and `src/stores/`; anything used by
more than one module (the timeline band) moves to `src/shared/`, because modules never import each
other.

| Step                               | Scope                                                                                                                                                                                                                                                                              | Files and areas touched                                                                                                                                                                                                     | Acceptance check                                                                                                                                                                                                                                                   | Rollback                                                   | Size |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ---- |
| **M0 · Truth** (weeks 1–2)         | One derived link state; per-panel live pills deleted; status bar stops showing link, serial and model; tri-state values; no seeded zeros                                                                                                                                           | `stores/activeContext.store.ts`, `lib/gates`, `components/layout/StatusBar.vue`, Network panel pills, `components/gate/*`                                                                                                   | A test over `gateInput`: no surface shows a link value that disagrees with the context bar; the D state matrix (disconnected, unauthorised, paused, not debuggable, missing companion, partial `.capu`, recovered target) renders no missing value as zero or live | Revert; no layout changed                                  | M    |
| **S · Spikes** (week 2, gating)    | (a) overlay boundary in WebView2 (§5.2); (b) Rust ring buffer, 30-minute soak; (c) static 1536×864 mocks: spine top against bottom, 5-second test and W1                                                                                                                           | Throwaway branch; cladd-vue branch for (a)                                                                                                                                                                                  | (a) §5.2 pass. (b) desktop < 3 % CPU and < 150 MB, scrub-to-T < 50 ms, no on-device jank. (c) ≥ 90 % correct on "is this the phone now?", 100 % on recorded cases; spine placement chosen                                                                          | Not shipped                                                | M    |
| **M1 · Shell grid**                | `ShellLayout` with named areas; device pane fixed right (persisted `left` migrated to `right`); rail labels fixed; `#overlay-root` and boundary per spike (a); toasts bottom-left; native context menu suppressed; `Ctrl R` / `F5` captured; window minimum 1024×640               | `components/layout/AppShell.vue`, `Sidebar.vue`, `modules/mirror/MirrorPanel.vue`, `MirrorTopBar.vue`, `stores/mirror.store.ts`, `App.vue` (`CladdProvider`), `composables/useOverlayGuard.ts`, `src-tauri/tauri.conf.json` | 40 overlay placements, 0 intersections; the local preview no longer hides on menus or popovers; every route renders unchanged                                                                                                                                      | Flag `shell.grid` falls back to the current `AppShell`     | M    |
| **M2 · Context bar and notice**    | Session, device, app and target switchers; `TierChain` (Companion and SDK honest `○` / `–`); Capture neutral when idle; "Device" mirror toggle renamed "Screen" and moved into the pane bar; notice row with precedence                                                            | `TitleBar.vue` + `ContextBar.vue` merged, `GateChain.vue` → `TierChain`, `GateStrip.vue` placement, `MirrorTopBar.vue`                                                                                                      | Round-01 F-11, F-29, V-16, V-23, V-34 closed; serial hidden by default; one notice at a time with "+n"                                                                                                                                                             | Flag `shell.contextBar`                                    | M    |
| **M3 · Spine v0**                  | `TimelineBand` from `ReplayTimeline.vue` and the replay lanes, moved to `src/shared/components/timeline/`; strip and overview; fed "since connect" by the existing console, network and logcat stores; honest left edge                                                            | `modules/recording/Replay*`, new shared timeline, `stores/console.store.ts`, `logcat.store.ts`                                                                                                                              | ≤ 2 ms per frame at 200 events/s; no main-thread task over 16 ms; left edge reads "evidence since {time}"                                                                                                                                                          | Flag `shell.spine`                                         | M    |
| **M4 · Live buffer**               | Time-bounded Rust buffer (5 min, memory-capped) for network, console, logcat, perf 1 Hz, 1 fps frame thumbnails; "Save last 5 min"; Capture pre-roll; Review state; lanes; link-drop hatch saved to `.capu`                                                                        | New `src-tauri/src/evidence/` module (generalises `mcp/capture.rs`), recording commands, `stores/recording.store.ts`                                                                                                        | Spike (b) budgets hold in the app; `Ctrl Shift S` produces a `.capu` that opens with all buffered lanes                                                                                                                                                            | Flag `capture.buffer` off: the spine stays "since connect" | L    |
| **M5 · Selection and inspector**   | `selection.store`, inspector column, Network first, then Data (absorbs `DataGridInspector.vue`), then Elements; evidence history; `InlineGate`, `EmptyState`; provenance slot in every toolbar                                                                                     | New store, `shared/components/data/grid/DataGridInspector.vue`, Network and Data modules                                                                                                                                    | Network and Data share one inspector; `Alt ←` works across them; selecting in Live never moves the playhead                                                                                                                                                        | Per-instrument flag keeps the old detail pane              | M    |
| **M6 · Sessions in the shell**     | Recorded sessions open in the switcher as Session (T1); Library replaces the Replay picker (`/replay` → `/library`); recorded variant of spine and device pane; `.capu` file association                                                                                           | `modules/recording/ReplayView.vue`, `ReplaySessionPicker.vue`, router, Tauri file association                                                                                                                               | A 10 MB `.capu` opens to Story in under 1 s; the 5-second test passes on recorded screens                                                                                                                                                                          | `/replay` kept one release behind `shell.legacyReplay`     | L    |
| **M7 · Rail and panel**            | Rail: Session, Instruments (Data, Network, Elements, Device), Flows, Library, Settings; App merged into Device; Flows lands on the library; Settings becomes a page; `BottomDock` becomes the Panel (Logcat, Console with REPL prompt, Exceptions, Shell); `/console/:tab` removed | `app/feature-registry.ts`, `components/layout/Sidebar.vue`, `components/dock/BottomDock.vue`, `modules/app`, `modules/devices`, `modules/automation`, `modules/settings`                                                    | The §4.9 table is a reachability fixture: every row reachable, none twice                                                                                                                                                                                          | Flag `shell.legacyRail`                                    | M    |
| **M8 · Capture review and export** | Capture review sheet; range-driven Export with redaction preview; saved views inside the `.capu`; Story filters (Problems)                                                                                                                                                         | New sheet, recording export commands                                                                                                                                                                                        | W3 (find the failure, export it) in under 2 minutes for 4 of 5 non-developers                                                                                                                                                                                      | Flag `capture.review`; old stop-and-save remains           | M    |
| **M9 · Narrow widths**             | Template inner-column folding below 760; inspector overlay and screen tab below 1180; height rules                                                                                                                                                                                 | T2 and T4 templates, `ShellLayout`                                                                                                                                                                                          | At 1280×800, W1 with at most one manual toggle and ≥ 20 grid rows; nobody detaches the mirror to cope                                                                                                                                                              | Breakpoint table is data; revert the rows                  | S    |
| **M10 · Split** (optional)         | One split of two instruments; later, halves bound to different sessions (live against recorded)                                                                                                                                                                                    | `ShellLayout`, `selection.store`                                                                                                                                                                                            | Both halves follow one playhead; a recorded half carries the perforated edge on its toolbar                                                                                                                                                                        | Flag `shell.split`                                         | M    |

Order rationale: M0 lifts the binding dimension (honesty, 3.5). The spikes decide the three things the
judges found unproven before any frame moves. Sessions (M6) ship before the rail rebuild (M7), so the
Library exists before Replay leaves the rail.

---

## 9. Open decisions for the owner

1. **Spine at the top or the bottom.** Recommendation: **top**, directly under the context bar (A, B):
   who, then when, then what; it never stacks with the panel and the status bar; it does not move when
   the panel resizes. `TimelineBand` is a grid area, so the choice costs one line if spike (c) says
   bottom. Decide after spike (c).
2. **No document tabs in v1.** Recommendation: **accept.** Pin stack, one split and evidence history
   cover the comparison need at a fraction of A's cost (a new `DocumentTab` primitive, a
   `/doc/:kind/:id` router rewrite, preview tabs, editor groups). Revisit after M5 with two weeks of
   pin and split usage.
3. **Always-on live buffer.** Recommendation: on while a target is attached, 5 minutes, 64 MB cap,
   memory only, nothing written to disk until Save or Capture; screen as 1 fps thumbnails, not video;
   a Settings switch to turn it off. The owner rules on the memory budget and on holding app data in
   memory by default.
4. **Overlay boundary owned in cladd-vue.** Recommendation: **yes**, budget 3–5 days including parity
   tests (`useAnchorProxy`, `overlayBoundary` on `CladdProvider`). An app-side patch would break the
   "never edit `packages/cladd`" rule and fork the overlay behaviour.
5. **DESIGN.md amendments.** Recommendation: accept all four: the playhead is ink and lime is reserved
   for the now-edge and live dots (§2 today gives the playhead to `signal-live`); rows stay 22 / 26 / 30;
   "a summary age never stands in for per-value freshness"; "only alert dialogs and in-app drags may
   freeze the device pane".

---

## 10. Where each proposal's ideas came from

**C · Progressive layers (the base).** The L0 / L1 / L2 depth model and "depth is disclosed, never
switched"; the free rectangle with the device pane fixed right; the five-slot tier chain with the
WebView separate from ADB and an age only after 5 s; the gate slot system (chain, G, S, I) and its
priority order; the state-by-state matrix; Live / Review / Recorded with "Live, not at playhead";
link drops drawn into history; the inspector section order (Summary, Details, Provenance, Related,
Actions) and its close-on-deselect rule; the pin stack; the Story template with sentence rows and a
source column; the capture review sheet with the device live behind it; alert dialogs freezing the
canvas under an HTML scrim; drop-to-push through Tauri's drag-drop event; the "Typing on device" chip;
rail folding by entry point; Settings as a page; reuse of `ReplayTimeline`, `GateStrip`, `GateChain`,
`GatedRouterView`, `WorkbenchGate`; migration steps with done-when tests; the T1–T6 templates and
the capability table this spec extends. **Changed from C:** the overlay root (anchor proxy added,
`pointer-events: none`), the timeline (moved to the top, 64 not 184), the dock (kept as the Panel),
the rail (labels never auto-collapse), the 1280 layout (no Screen and Inspector toggle), the split
threshold (1041, not 1200).

**A · Instrument bench.** The verified mirror finding (canvas, with only the local preview native);
"only dialogs and drags may intersect the screen rectangle"; the CDP `Page.captureScreenshot` freeze
frame; the per-instrument provenance slot at the toolbar's right end; the notice that names what is
frozen and what is still live; scrub-back honesty ("Live DOM: not available at T"); the ink playhead;
the status-bar diet; the keyboard map on `KeyboardEvent.code` with letter aliases, `F6` region cycling,
captured `Ctrl R` / `F5`; rail labels that never collapse by themselves; the bottom panel for streams;
the Start page's three doors; not persisting selection, playhead or recorded context ("Reopen"
instead); sizing against 1536 CSS; the 5-second honesty test and the 2 ms spine budget. **Not taken:**
document tabs and editor groups, the navigator column, the 20 / 24 / 28 row ladder, the 28 px-only
spine, the Reka `collisionBoundary` claim for Cladd overlays.

**B · Case canvas.** The spine directly under the context bar with 28 / 64 / lanes heights and a
maximised track view; "live, held in the past" (selection draws a hairline, `Enter` goes to time,
Return to live); the honest left edge "evidence since"; area-drag range driving instruments and
Export; capture pre-roll from the buffer; saved views inside the `.capu`; recorded sessions opening on
Story with a summary; per-lane tier glyphs and dashed "needs Companion" lanes; the single notice slot
with precedence and "+n"; `Ctrl 1–7` lens keys; migration steps that delete something and sit behind a
flag; the honest costing of the ring buffer. **Not taken:** one case-wide freshness value, CDP folded
into the ADB slot, deleting the rail and the status bar, the inspector sharing the bottom panel with
logs, multi-case windows.

**D · Codex.** "A single summary age must not stand in for per-value freshness"; cached device, app and
target restored as identifiers and re-resolved before health is shown; missing tracks labelled
unavailable, never drawn as empty; an error never recorded only in a toast; the panel closing itself
before the workspace drops below its floor; the state-matrix review as a pre-build test (M0
acceptance). **Not taken:** the native-mirror premise and its consequences (no drop on the screen, an
undimmed interactive phone under destructive confirms), the bottom 116 px timeline, the job-based rail,
the conditional home for Capacitor panels.

---

`[AI-assisted]` Code references were checked on 2026-11-04 on `feat/ui-ux-overhaul`. Nothing was built
or run. The external benchmarks come from the proposals' cited public documentation.
