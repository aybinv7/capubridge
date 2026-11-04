# Capubridge UI/UX Rewrite — Study

`[AI-assisted]` · 2026-11-04 · branch `feat/ui-ux-overhaul` · status: **draft for decision**

> Thesis: **One clock. One context. One truth.**
> Capubridge already sees more of a hybrid app than any tool on the market. The rewrite turns that
> capability into an instrument: every panel shares the same device context, the same time axis and
> the same evidence, and nothing on screen is ever ambiguous about where a value came from.

---

## 0. Executive summary

- **Where we are.** Capability ≈ 9/10, experience ≈ 3/10 (measured, §2). The gap is not cosmetic. It is
  three structural failures: the UI thread blocks on device I/O (73 synchronous Tauri commands),
  eight independent selection sources disagree about _what you are looking at_, and the native
  preview webview draws over every overlay. On top of that sits an identity borrowed from other
  products ("Codex Dark" is literally a theme name) and a token system bypassed 1,300+ times.
- **Where we go.** A workbench organised around three primitives — **Context** (device › app ›
  target), **Time** (one timeline whose right edge is _live_) and **Evidence** (requests, rows,
  elements, logs, frames, all cross-linked). Replay stops being a destination; it becomes the past
  of the same timeline you are already looking at.
- **What beats the competition.** Not polish. The wedge is what nobody else can do because nobody else
  sees storage + network + DOM + screen of a _WebView on a real phone_ at once: a shared clock,
  "why is this row like this?" provenance, staged DB edits on a live device, storage diffs between two
  moments, recordings that become mocks (§5, §6).
- **cladd-vue verdict: yes — as the visual foundation, not as a drop-in kit.** Details and conditions in §8.
- **Brand: full rebrand.** Three directions with verified contrast; recommendation: decide through
  live shell prototypes in round 1, not through mood boards (§7).
- **Plan.** Round 0 = engineering foundations (no design reaches 9.5 on a frozen UI), then 9 design
  rounds scored against a measurable rubric (§11, §12).

### Decisions needed from the owner

| #   | Decision                                                                                 | Recommendation                          |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------- |
| D1  | Adopt the three-primitive model (Context / Time / Evidence) as the IA backbone           | Yes                                     |
| D2  | Make the timeline global (always-on bounded buffer, Replay = scrolled-back live)         | Yes — it is the moat                    |
| D3  | cladd-vue as visual foundation, vendored into the monorepo, replacing `packages/ui`      | Yes, with conditions §8                 |
| D4  | Rebrand direction: A Bench Instrument / B Radiograph / C Field Recorder                  | Prototype A and C live, pick in round 1 |
| D5  | Drop borrowed theme presets; ship one branded dark/light pair + High Contrast            | Yes                                     |
| D6  | Staged DB changesets (no direct writes on Enter/blur)                                    | Yes — safety on live devices            |
| D7  | Round 0 (IPC async, single context, overlay layering, virtualization) before visual work | Yes                                     |

---

## 1. Method and evidence

- **Live inspection** with a Win32 capture/input harness (guarded: refuses input unless the target
  window is foreground; never clicks inside the mirror). ~70 screenshots across Capubridge (empty,
  local target, live Xiaomi 24117RN76G running Presalio Retail, a recorded session), Claude Desktop,
  Codex (ChatGPT app), VS Code, and cladd.io.
- **Code audit** of `apps/desktop` (screen map, interaction model, tokens, density, perf risks) and
  `src-tauri` (sync commands).
- **Prior design work**: `docs/design/2026-09-12-*` (v1/v2/v3 directions, shell contract, capability
  inventory) and concepts 01–09.
- **Brand audit**: icons, favicon, docs, website2, README, theme registry, with numeric contrast checks.
- **Competitor research**: Chrome DevTools, Android Studio inspectors, RN DevTools, Flipper, Reactotron,
  Proxyman, HTTP Toolkit, Replay.io, Sentry Replay, Pernosco, Redux DevTools, TablePlus, DataGrip,
  Beekeeper, Supamode, Linear, Raycast, Zed, Warp, Codex app, Figma, VS Code, Arc. Sources inline in §5.
- **cladd-vue**: repo evaluation (code, tests, a11y) + visual review of upstream cladd.io.

Limits: scores are expert judgement against a fixed rubric, not user research. Codex got a shorter
visit. `/app` and Devices → Apps were not opened live because `/app` froze the app (see §2.3).

---

## 2. Where we are

### 2.1 Scorecard (same 8 dimensions for every product)

| Dimension                      | Claude Desktop | VS Code | Codex   | **Capubridge** |
| ------------------------------ | -------------- | ------- | ------- | -------------- |
| Visual identity                | 8              | 7       | 6.5     | **4**          |
| Density & hierarchy            | 7              | 9.5     | 7       | **4**          |
| Navigation & wayfinding        | 9              | 9       | 7       | **3.5**        |
| Empty / loading / error states | 8              | 7       | 5.5     | **3**          |
| Keyboard & command             | 9.5            | 10      | 7       | **3**          |
| Trust (state honesty)          | 8.5            | 8.5     | 8       | **2**          |
| Responsiveness                 | 8              | 9       | 6.5     | **1.5**        |
| Polish & consistency           | 8              | 7.5     | 7       | **3.5**        |
| **Overall**                    | **8.4**        | **8.5** | **6.9** | **≈3.1**       |

Target: **≥ 9.5 overall, no dimension < 9.**

### 2.2 Screen-by-screen findings

Legend: **Keep** = worth carrying forward · **Kill** = remove · **Fix** = defect.

| Screen                                             | Observed                                                                                                                                                     | Keep                                                                                           | Kill / Fix                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title bar / context pill**                       | `device › target` pill, Record, Dock, Mirror                                                                                                                 | Centred context, global Record                                                                 | Fix: shows live context while viewing a recording; "no target" with no next step; ⌘ glyphs on Windows                                                                                                                                                                                                         |
| **Device manager modal**                           | Devices / emulators / remote / This PC, targets per device                                                                                                   | Grouping by connection kind                                                                    | Fix: "stale" devices offered WiFi/Disconnect; `1/7` unexplained; 90 % black scrim; hand-built overlay, no focus trap (1,006 lines)                                                                                                                                                                            |
| **Rail**                                           | 7 icons + settings, labels only on hover, 5/7 "beta"                                                                                                         | Fixed rail position                                                                            | Kill: maturity badges on the main nav; Fix: no labels, intermittent ignored clicks                                                                                                                                                                                                                            |
| **Devices › Overview**                             | 6 rainbow-icon cards, one value each, ~85 % empty                                                                                                            | Device facts                                                                                   | Kill: card grid; Fix: showed a _different, stale_ device than the header                                                                                                                                                                                                                                      |
| **Devices › Files**                                | Tree + Windows-style yellow folder grid, two folders named `?`                                                                                               | Tree, search, refresh                                                                          | Fix: duplicate tree/grid, unnamed entries, per-row ContextMenu instances (1,195 lines)                                                                                                                                                                                                                        |
| **Devices › Performance**                          | Live CPU / mem / per-core / net / battery / temp                                                                                                             | Real data, time axis                                                                           | Fix: rainbow per-core colours carry no meaning; three independent 1 s pollers                                                                                                                                                                                                                                 |
| **Devices › Apps / App**                           | Not opened live                                                                                                                                              | —                                                                                              | Fix: `/app` froze the app for >7 min (sync `session_refresh_packages`); "App" vs "Devices › Apps" naming collision                                                                                                                                                                                            |
| **Storage › SQLite**                               | Overview (46 tables, rows chart), Browse / Structure / SQL, filters, JSON row view                                                                           | DB overview, Structure + indexes, JSON detail with prev/next, NULL styling, SAH-pool detection | Fix: row count 99 vs 51 vs 50; Columns popover empty (grouping unreachable); double-click = inline edit contradicting hint; Esc doesn't close detail; SQL tab never rendered; schema as one unformatted paragraph; no FK display; 45 px rows; fixed 250 px columns; names truncated to "c." while badges stay |
| **Storage › IDB / LS / LF / Cache / OPFS / Graph** | Sidebar + empty centre                                                                                                                                       | Import snapshot                                                                                | Fix: Graph tab click ignored; sidebar width changes between visits                                                                                                                                                                                                                                            |
| **Network › Requests**                             | Chrome-like dense table, type chips, preserve, HAR                                                                                                           | Density, filters                                                                               | Fix: "idle"/"live" pill ambiguous; red dot semantics unclear                                                                                                                                                                                                                                                  |
| **Network › Mocking**                              | OFF / CDP / HTTP, rules, import, create                                                                                                                      | Mode model                                                                                     | Fix: two empty states side by side, tiny text                                                                                                                                                                                                                                                                 |
| **Inspect › Elements**                             | DOM tree, styles / computed / box model, device overlay with a11y info on hover                                                                              | **Inspect overlay on the live phone**                                                          | Fix: attributes rendered without spaces (`<htmllang="en"dir=…`); styles listed twice; header "connected" while panel says "connect first"                                                                                                                                                                     |
| **Inspect › Vue**                                  | Diagnostic for stripped DevTools with exact fix + Re-check / Attach anyway                                                                                   | **Best error state in the product** — template for all gates                                   | —                                                                                                                                                                                                                                                                                                             |
| **Replay**                                         | Recorded frame, tabs with counts, timeline with event ticks, perf charts                                                                                     | Timeline with typed ticks, counts                                                              | Fix: live context shown over a recording; icon fonts render as boxes in recorded frames; Elements not synced to playhead; PII recorded unmasked (automation masks it, recording does not)                                                                                                                     |
| **Automation**                                     | Agent composer, task history, package picker                                                                                                                 | Composer + mirror pairing                                                                      | Fix: blank history column, package shown with no device                                                                                                                                                                                                                                                       |
| **Bottom dock**                                    | Logcat / REPL / Console / Exceptions, level chips with counts, pop-out                                                                                       | **VS Code-grade dock**                                                                         | Fix: logcat is `v-for` (not xterm, not virtualised), whole-array copy per line                                                                                                                                                                                                                                |
| **Command palette**                                | Navigation only (9 items + 1 command)                                                                                                                        | Fast open                                                                                      | Fix: no actions, no data, no hints; reimplements installed `ui/command`                                                                                                                                                                                                                                       |
| **Settings**                                       | Route rendered as modal; Appearance (6 themes × 8 accents), ADB / Chrome mostly read-only, Shortcuts (documents shortcuts that don't exist), AI/MCP, Updates | AI/MCP structure                                                                               | Kill: borrowed theme presets, read-only tabs; Fix: Chrome tab claims fixed port 9223 (ports are dynamic)                                                                                                                                                                                                      |
| **Mirror pane**                                    | scrcpy stream, toolbar, tap-through                                                                                                                          | **Hero capability**                                                                            | Fix: opened as silent black box; closed itself when opening a DB; no "target app in background" signal                                                                                                                                                                                                        |

### 2.3 Systemic problems (verified in code)

1. **Main-thread IPC** — 73 of 167 `#[tauri::command]` are synchronous; all 18 `session_*`
   (`session/registry.rs:474-701`), `adb_list_devices` (`commands/adb.rs:666`), `adb_list_dir`
   (`commands/files.rs:521`), mirror screenshot/scrcpy, emulator. Each blocks the window during ADB I/O.
   Reproduced: `/app` with no target froze the window > 7 min at 0 % CPU.
2. **Eight selection sources** — `session.store`, `devices.store`, two localStorage keys,
   `targets.selectedTarget` (36 readers), `connection.selectedTargetId` (8 readers),
   `targets.cdpTargetId`, `storage-context.selectedOriginsByTarget`. `selectTarget` never sets the device
   (`targets.store.ts:206`). Reproduced: header _Local › localhost:5173_ over a stale Xiaomi overview.
3. **Native webview z-order** — local targets are a native child webview positioned by
   `getBoundingClientRect` (`localWebview.store.ts:255`); it draws above all DOM. The hide guard is wired
   in 3 places; ~20 dialogs, every menu, popover and toast can render underneath. Reproduced with Settings.
4. **Unvirtualised streams** — logcat (900 rows `v-for`), console (500), exceptions, files, app list
   (300+), DOM tree, replay console; per-line full-array copies (`logcat.store.ts:65`, `console.store.ts:243`).
5. **Token system bypassed** — 736 arbitrary text sizes (`text-[10px]` ×318, `text-[9px]` ×67), 580 raw
   palette classes, 84 hex literals, 18 distinct muted opacities, undefined `bg-status-success`,
   stale `DESIGN.md`.
6. **No shared gate** for no-device / no-target / disconnected / error; each screen improvises.
7. **Mega-components** — 22 files > 500 lines (`SqliteExplorer.vue` 2,179).
8. **Inverted dependencies** — shared shell imports modules (`SubNavTabs.vue:5`, `AppShell.vue:8`,
   `TitleBar.vue:22`, `useMcpBridge.ts:10`).
9. **Hand-built overlays** without focus trap / ARIA (`DeviceManagerModal.vue:522`, `CommandPalette.vue`).
10. **Keyboard** — 6 independent `window` listeners that can collide; Settings documents 4 shortcuts
    that don't exist; F5 / Ctrl+R not intercepted.
11. **Layout not persisted** — 17 resizable groups without `auto-save-id`; rail and mirror state lost;
    `flex-row-reverse` moves the rail when the mirror docks left.
12. **Primitive drift** — 288 raw `<button>` vs 232 `<Button>`, Button h-9 vs house h-7, `title=` tooltips
    in ~45 files, 25 raw `<table>`, two lucide packages.
13. **Dead surface** — ~25 orphan files, `capacitor/` and `hybrid/` modules, `mock-data.ts` (1,729 lines),
    15 empty `ai-elements-core` dirs.
14. **Redundant polling** — 3 perf pollers at 1 s; unguarded `Page.captureScreenshot` loop.
15. **IA confusion** — "App" vs "Devices › Apps"; screen-local tabs not in the URL; build-flag maturity.

### 2.4 Brand as-is

Four different marks (app icon, docs, concepts, `@capubridge/ui`), the **stock Vite favicon** shipped
in the desktop app, coral used simultaneously for selection, recording, unread dot and mirror state,
fonts declared (Geist) but never loaded while unused Inter/JetBrains Mono are fetched from Google Fonts,
accent comment claiming 4.5:1 where coral on white is 2.93:1, `fg-subtle` 3.56:1 used for 9 px text.

---

## 3. Product thesis and principles

### 3.1 The model: Context · Time · Evidence

- **Context** — exactly one active `device › app › target` at a time, owned by one store, visible in one
  place, changeable from the keyboard. Every panel derives from it. A recording is just another context
  (`session › app › target @ recorded`), so live and recorded can never be confused.
- **Time** — one timeline per context. Its right edge is _now_ (live). An always-on bounded buffer
  (last N minutes, configurable) means you can rewind without having pressed Record. Recording = pinning
  a range of that buffer to a `.capu` file. Replay = opening a `.capu` as a context.
- **Evidence** — every item (request, row, write, element, log line, frame, perf sample, agent action) is
  an addressable object with a timestamp and links to related evidence. Panels are _lenses_ over evidence.

### 3.2 Principles (each is testable)

| #   | Principle                                     | Test                                                                                     |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| P1  | **The UI never waits on the device**          | 0 synchronous IPC; input → visible feedback ≤ 100 ms p95                                 |
| P2  | **One truth per value**                       | Every value carries provenance: live / cached / recorded / imported / local copy / stale |
| P3  | **Nothing writes by accident**                | All device writes go through a staged changeset with preview + commit                    |
| P4  | **Everything is reachable from the keyboard** | Every action in the palette; documented shortcuts = implemented shortcuts (tested)       |
| P5  | **Selection is the navigation**               | Selecting evidence anywhere reveals related evidence everywhere                          |
| P6  | **Empty is an instruction**                   | Every gate state says why and offers the next action (Vue-tab pattern)                   |
| P7  | **Density without squinting**                 | 24–28 px rows, ≥ 11 px text at ≥ 4.5:1, no arbitrary sizes                               |
| P8  | **Identity from meaning**                     | Colour encodes one thing each (live, recording, selection, category) — never decoration  |
| P9  | **Layout is yours**                           | Every split, pane, tab and filter persists and is URL-addressable                        |
| P10 | **Local-first, private by default**           | Redaction applies to recordings, exports and MCP alike                                   |

---

## 4. Information architecture

### 4.1 Shell anatomy

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◉ Context bar:  [device ▾] › [app ▾] › [target ▾]   ● live 42ms   ⏺ REC   ⌘K   ▢ ▢ ▢ │  title bar
├────┬───────────────────────────────────────────────────────────┬─────────────────────┤
│ R  │ Tabs:  product ×  │ POST /sync ×  │ <div.card> ×  │ +      │  Device pane         │
│ a  │───────────────────────────────────────────────────────────│  (mirror + lens)     │
│ i  │                                                           │                      │
│ l  │                Workspace (lens content, splittable)       │──────────────────────│
│    │                                                           │  Inspector           │
│ la │                                                           │  (selection-driven:  │
│ be │                                                           │   details, related   │
│ ls │                                                           │   evidence, actions) │
├────┴───────────────────────────────────────────────────────────┴─────────────────────┤
│ Timeline  ◀━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃━━━━━━━━━━━━━━━━━━━━━━━━━━━▶ now  [N][DB][E]│  always visible
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Dock: Logcat · Console · REPL · Exceptions                         (collapsible)      │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Status: adb ✓ · cdp ✓ 42 ms · fps 58 · mem 312 MB · batt 27 % · mocks 2 · REC 00:21  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Context bar** replaces the pill: three segments, each a keyboard-searchable switcher; shows link
  health and latency; turns into `session › app @ 10:06` with a distinct recorded treatment when a
  recording is open.
- **Rail** with labels (collapsible to icons, persisted). Maturity badges move to Settings.
- **Workspace tabs** — documents, not modes: a table, a request, an element, a query, a session, a flow.
  Pin, split, drag, restore on relaunch.
- **Device pane** — the mirror is a first-class docked pane with the inspect lens; it never opens empty.
- **Inspector** — follows selection; shows details, provenance and _related evidence_.
- **Timeline** — global, always present (collapsible to a 6 px strip), typed lanes.
- **Status bar** — ambient truth (connections, vitals, active mocks, recording).

### 4.2 Rail (new)

| New          | Contains                                                                                       | Replaces                                                            |
| ------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Device**   | Overview (vitals strip), Apps (merged with App inspector), Files, Performance, Logcat shortcut | Devices + App                                                       |
| **Data**     | IndexedDB, SQLite, LocalStorage, LocalForage, Cache, OPFS, Graph — one data workbench          | Storage                                                             |
| **Network**  | Requests, Mocks, Throttling, WebSockets                                                        | Network                                                             |
| **Elements** | DOM, Styles, Accessibility, Vue / React components                                             | Inspect                                                             |
| **Sessions** | Recording library, compare, export, annotations                                                | Replay destination (playback itself moves into the global timeline) |
| **Flows**    | Manual flows, agent runs (experimental)                                                        | Automation                                                          |
| Settings     | Full page, not a route-modal                                                                   | Settings modal                                                      |

### 4.3 Navigation grammar

- Rail = lens. Tabs = open documents. Inspector = selection. Timeline = time. Dock = streams.
- **Go-to syntax** in the palette: `@` device/target, `#` table/store, `/` request path, `<` element
  selector, `>` command, `t:` timestamp (`t:00:21.7`).
- Back / forward work across tabs and selections (history of evidence, not routes).
- Every tab state is in the URL (deep-linkable; MCP can open any view).

---

## 5. Learn, then beat

### 5.1 What the best do (to adopt) and where they fail (to exploit)

| Product                             | Adopt                                                                                                                                                                                                                           | Their weakness → our opening                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude Desktop**                  | Typed search scopes with keyboard footer hints; context panel (env, branch, context %); actionable empty state                                                                                                                  | Searches only its own history → our palette searches **live runtime data**                                                                                                                    |
| **Codex app**                       | Inline file chips; split result pane with tabs; access level always visible                                                                                                                                                     | Bare spinners; consumer features in a pro shell → we render cached state instantly, pro-only shell                                                                                            |
| **VS Code**                         | Command palette as universal entry; status bar; panel model; density                                                                                                                                                            | Generic identity, notification clutter → our identity is meaningful, our status bar is device truth                                                                                           |
| **Chrome DevTools**                 | Performance _Insights_ that highlight trace events; annotations saved in traces; Recorder steps editable                                                                                                                        | Panels share no clock; AI sends page data to Google ([source](https://developer.chrome.com/docs/devtools/ai-assistance/data-usage-and-enterprise-controls)) → shared clock, local-first agent |
| **Android Studio**                  | Logcat `key:value` query grammar with autocomplete ([source](https://developer.android.com/studio/debug/logcat)); Database Inspector live mode + offline mode ([source](https://developer.android.com/studio/inspect/database)) | **Network Inspector can't see WebView traffic** ([source](https://developer.android.com/studio/profile/network-profiler)); live DB mode makes the grid read-only; inspectors unlinked         |
| **RN DevTools / Reactotron**        | Unified performance timeline; hover component → highlight on device                                                                                                                                                             | No storage link                                                                                                                                                                               |
| **Flipper**                         | —                                                                                                                                                                                                                               | Removed from RN 0.74 ([RFC](https://github.com/react-native-community/discussions-and-proposals/discussions/641)); SDK-in-app + plugin sprawl → we stay SDK-free                              |
| **Proxyman / HTTP Toolkit**         | Rule engine (match → mock / redirect / fail / breakpoint); one-click Android setup                                                                                                                                              | No replay, rules easy to forget → mocks visible on the timeline, recordings become mocks                                                                                                      |
| **Replay.io**                       | Retroactive print statements: one value at every hit, markers on timeline ([docs](https://docs.replay.io/reference-guide/debugging/print-statements))                                                                           | Pivoted away from standalone devtools → we embed time-travel in the daily tool, not as a product of its own                                                                                   |
| **Sentry Replay**                   | Breadcrumbs synced to player; click a request timestamp to seek ([docs](https://docs.sentry.io/product/explore/session-replay/web/replay-details))                                                                              | No storage, cloud-only, slow players → local `.capu`, storage lanes                                                                                                                           |
| **Pernosco**                        | Dataflow: click a value, trace where it came from ([post](https://robert.ocallahan.org/2019/11/explaining-dataflow-in-pernosco.html))                                                                                           | Native code only → we apply provenance to **storage rows**                                                                                                                                    |
| **Redux DevTools**                  | Jump / Skip per action; state diff per action                                                                                                                                                                                   | App-state only → we diff the whole device storage between two moments                                                                                                                         |
| **TablePlus**                       | Colour-coded staged edits, review generated SQL, Ctrl+S commit ([docs](https://docs.tableplus.com/gui-tools/code-review-and-safemode/commit-changes))                                                                           | Desktop DBs only → staged edits on a **live phone**, with conflict detection                                                                                                                  |
| **DataGrip / Beekeeper / Supamode** | Filter-by-value context action; aggregates in status bar; FK click-through; FK shown as labels                                                                                                                                  | FK opens new tabs (fragmentation) → FK _peek_ in the inspector with a back stack                                                                                                              |
| **Linear**                          | Optimistic local-first UI, no spinners; theme generated from 3 inputs in LCH ([post](https://linear.app/blog/how-we-redesigned-the-linear-ui))                                                                                  | — (benchmark for speed and restraint)                                                                                                                                                         |
| **Raycast**                         | Action panel lists actions _with_ shortcuts (teaches the keyboard)                                                                                                                                                              | —                                                                                                                                                                                             |
| **Zed**                             | 8 ms frame budget as a hard spec ([post](https://zed.dev/blog/videogame))                                                                                                                                                       | — (benchmark for smoothness)                                                                                                                                                                  |
| **Warp**                            | Command + output as one addressable block                                                                                                                                                                                       | Login wall backlash → no accounts, ever                                                                                                                                                       |
| **Figma**                           | —                                                                                                                                                                                                                               | UI3 floating panels rolled back ([analysis](https://uxdesign.cc/figma-scrapes-ui3s-floating-panels-44303803c1ad)) → docked, resizable panes only                                              |

### 5.2 Fifteen ways we win on their own game

1. **One session clock** across screen, DOM, console, network, DB writes, logcat. Selecting anything moves
   the playhead; the playhead filters every lens. _Beats Sentry (no storage) and Android Studio (unlinked)._
2. **"Why is this row like this?"** — per-cell write history: transaction, JS stack, network response, tap
   that caused it. _Beats Database Inspector and TablePlus (no provenance)._
3. **Live + edit at once** — live writes stream in while your edits sit in a colour-coded changeset; commit
   reviews generated SQL/JS, runs in one transaction, flags conflicts. _Beats Database Inspector (read-only
   in live mode)._
4. **Query storage at time T** (snapshot + write log). _Beats DB Inspector offline mode (last state only)._
5. **Storage diff A → B** between two timeline marks. _Beats every DB GUI._
6. **Recording → mock set** — replay the app offline with exactly what the user got. _Beats Proxyman / HTTP
   Toolkit (no replay) and LogRocket (no mocks)._
7. **Mocks on the timeline** — every mocked/breakpointed request is marked. _Beats Charles / Proxyman._
8. **Zero-setup WebView network** — no SDK, no cert. _Beats Android Studio (OkHttp only) and Flipper._
9. **Mirror → element → component → data chain** in one breadcrumb. _Beats Layout Inspector and RN DevTools._
10. **One query grammar everywhere** (`level:error tag:sync & url:/api/*`), saved queries as pinned lenses.
    _Beats Logcat (grammar only in Logcat)._
11. **Selection-scoped action panel** with shortcuts listed. _Beats Android Studio menus; matches Raycast._
12. **Annotated, portable `.capu`** — notes, arrows, ranges stored locally; share without a cloud.
    _Beats LogRocket / PostHog players._
13. **Flows that assert on data** ("after step 4, `orders` +1 row status=pending"). _Beats Chrome Recorder._
14. **Local-first agent on the same timeline** — its actions are markers, redaction runs before anything
    leaves the machine. _Beats Chrome AI assistance._
15. **Two-device compare** — same flow on two phones, timelines aligned by step, storage/network diffs.
    _No surveyed competitor does this (unverified that none does)._

> **Feasibility gate.** 2, 4 and 5 require `.capu` to record DB writes with before/after values and a JS
> stack. `recording_db.rs` already tracks changed rows — verify the captured depth before designing the UI
> around these (task in round 0).

---

## 6. Signature experiences (specs)

### 6.1 The Timeline

- Always visible strip under the workspace; expands to lanes: **Screen** (keyframes), **Network**,
  **Storage writes**, **Console / Logcat**, **Errors**, **Perf**, **Agent / Flow steps**, **Marks**.
- Right edge = _now_. A bounded ring buffer (default 5 min, configurable, memory-capped) runs whenever a
  target is attached. **Record** pins a range (with pre-roll) into a `.capu`.
- Scrub preview ≤ 50 ms: keyframe index for frames, DB checkpoints every N writes, state(T) = checkpoint
  - log replay.
- Selecting evidence anywhere moves the playhead; moving the playhead filters every lens to "at T"
  (and labels them **@ 00:21.750 · recorded**).
- Marks A/B → "Compare A → B" opens a diff document (storage, network, DOM).
- Lane semantics use colour **and** shape (tick / bar / dot) for colour-blind safety.

### 6.2 Data workbench

- One grid component (TanStack table + row _and_ column virtualisation) for SQLite, IDB, LS, LF, Cache.
- 26 px rows (compact 22 / comfortable 30), content-aware column widths, type glyph + PK/FK markers
  in headers, NULL / blob / JSON renderers.
- **Changeset**: edits colour-coded (modified / added / deleted) → "Pending changes (n)" bar → review
  generated SQL / IDB JS → **Commit (Ctrl+S)** in one transaction → read-back verification → conflict
  marker if the device changed the row meanwhile. Enter/blur never writes.
- **FK peek** in the inspector with back stack; FK values rendered as labels when a display column exists.
- Filters: header quick-filters + structured builder + raw `WHERE`; right-click "filter = value",
  "copy as INSERT / JSON"; **Group by** with counts; aggregates of selection in the status bar.
- **Provenance** column toggle and per-cell write history (§5.2-2); **Watch table** highlights rows
  written in the last N seconds (live) or at T (recorded).
- One row count source; estimated counts labelled "≈".
- Structure tab: columns, indexes, FKs, triggers, formatted DDL.

### 6.3 Device pane

- Mirror with transport-grade controls; inspect lens (hover → element + a11y, click → select everywhere).
- Foreground awareness: "Presalio Retail is in background — target paused" when the user switches apps.
- Never opens as a black box: connecting / no device / stream error each have a gate.
- Local webview targets: rendered as captured frames while any overlay is open (fixes z-order by design,
  §9.3).

### 6.4 Command system

- Palette = navigation + actions + data: scopes (Commands, Devices, Targets, Tables, Requests, Elements,
  Sessions), recents, keyboard footer (Esc · ←/→ scope · Tab compose · Alt+↵ actions).
- **Action panel (Ctrl+.)** scoped to the current selection, each action shows its shortcut.
- One keymap service; focus regions (rail, tabs, workspace, inspector, timeline, dock); conflicts
  detected at registration; Settings → Shortcuts editable and generated from the registry.

### 6.5 Honest state system

- **Provenance treatments** distinct from semantic colour: live (solid), cached (dotted underline),
  recorded (tape-edge stripe), imported (corner tag), local copy (dashed border), stale (hatched).
- Connection health in the context bar and status bar; never "connected" on one surface and "connect
  first" on another (single derived state).
- Gate component for every screen: _no device · no target · target in background · disconnected ·
  unsupported (with fix) · error (with copyable detail)_.

### 6.6 Sessions

- Library with search, device/app filters, duration, size, annotations, redaction status.
- Recording frames render with captured fonts (fix icon boxes); Elements panel synced to playhead.
- Export: `.capu`, HAR, mock set, storage snapshot; redaction preview before export.

### 6.7 Flows and agent

- Agent and flow steps are timeline markers; selecting a step moves the playhead and highlights the
  element on the frame.
- Assertions on data, not only DOM.

---

## 7. Brand and visual language

### 7.1 What changes regardless of direction

- One mark, one wordmark, one favicon (remove Vite default), fonts **bundled locally**.
- One branded **dark + light** pair + **High Contrast**. Remove Codex / Nord / Solarized / Tokyo presets
  and the 8-accent picker (identity is not a user preference).
- Colour roles are exclusive: _live/now_, _recording_, _selection_, categories (network, storage, device,
  console, agent), semantics (success/warn/error/info). No colour serves two roles.
- Type scale: 11 / 12 / 13 / 15 / 18 / 24 px; minimum 11 px at ≥ 4.5:1; tabular figures in data.
- Density scale: control 28 px, nested −8 px (Cladd rule), rows 22 / 26 / 30.
- Radius 4–6 px for controls in dense areas, 8 px for panels.
- Motion roles: 80 ms (feedback), 120 ms (state), 200 ms (panel), 300 ms (overlay); reduced-motion honoured;
  nothing pulses except a live recording indicator.
- Icons: one lucide package + a custom domain set (device, target, webview, tape, lens, changeset).

### 7.2 Three directions (contrast verified numerically)

|            | **A · Bench Instrument**                                                    | **B · Radiograph**                                             | **C · Field Recorder**                                                  |
| ---------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Metaphor   | Oscilloscope probe between phone and desktop; time is the x-axis everywhere | X-ray through native shell → WebView → JS → storage            | Every session is tape; live = record head, replay = rewound tape        |
| Dark base  | `oklch(0.185 0.006 95)` `#131310`                                           | `oklch(0.17 0.028 250)` `#06101b`                              | `oklch(0.19 0.012 60)` `#18130e`                                        |
| Light base | `oklch(0.975 0.005 95)`                                                     | `oklch(0.97 0.008 240)`                                        | `oklch(0.965 0.014 85)`                                                 |
| Signal 1   | Phosphor `#c6ed47` = **live / playhead only** (13.9:1)                      | Contrast-agent orange `#ff9b50` = **what you examine** (9.1:1) | REC `#f75839` = **record head / playhead only** (5.7:1)                 |
| Signal 2   | Tally red = recording                                                       | Lens cyan = layer boundaries, inspect overlay                  | Grease-pencil `#f8d14f` = marks / selection                             |
| Type       | IBM Plex Sans (+ Condensed headers) / Plex Mono                             | Hanken Grotesk / Fragment Mono                                 | Archivo (width axis) / Martian Mono                                     |
| Motion     | Linear sweep, ~120 ms, no springs                                           | Layered "exposure" fades, one scan on attach                   | Transport physics: inertial scrub, 80 ms snap                           |
| Logo       | Tall bar + wide bar joined by a step trace                                  | Overlapping portrait + landscape, orange intersection          | Two spools joined by a tangent tape line                                |
| Risk       | Chartreuse → "hacker terminal" cliché; success must be mint + icon          | Navy is the most common devtool base                           | Closest to today's coral; REC vs error hue proximity; can drift vintage |

**Recommendation.** A and C both express the thesis (time as identity). B depends on discipline to stay
distinct. Build the **shell prototype in A and C** in round 1 with real data (SQLite grid, network, timeline,
mirror) and choose on the running app, not on swatches. Semantic and category values for each direction
are in the brand audit notes (kept with this study).

---

## 8. Design system — the cladd-vue verdict

### 8.1 What cladd-vue is (your Vue port of Cladd)

- `cladd-vue@0.1.5`, ~93 SFCs, strict TS, 232 tests / 31 files, per-component contracts, parity
  screenshots. Last commit 2026-09-07. Upstream Cladd is **React-only** (cladd.io says so), now v0.19.0 —
  cladd-vue is the _only_ Vue path and is behind upstream.
- Design language: OKLCH colours derived from one theme hue, 5 surface levels with inset highlights
  (bevelled "machined" panels) and recessed cuts, 28 px controls with −8 px nesting, 11 scoped accents,
  motion roles with `@starting-style`.
- Upstream's own positioning matches Capubridge exactly: "editors, dashboards, internal tools; users spend
  hours in it; dense, breathable UIs with depth; dark-first".
- Gaps for a dev tool: **no menu, context menu, combobox/command, tree, scroll area, resizable/split**;
  overlays use native CSS anchor positioning with no collision/flip fallback (risk on WebKitGTK and older
  WKWebView); hand-rolled focus/dismiss stack; happy-dom tests only.
- `packages/ui` in this repo is an older fork of the same code (diverged: Popover −219 lines, Select −296)
  and is imported **zero** times by the desktop app (175 files use shadcn-vue).

### 8.2 Verdict

**Yes — cladd-vue becomes Capubridge's visual foundation, under these conditions:**

1. **Vendor it into the monorepo** as `packages/cladd` and **delete `packages/ui`**. One canonical copy;
   fixes land with the app; publish externally later if you want.
2. **Behaviour comes from Reka UI**, appearance from Cladd. Menus, context menus, command, combobox, tree,
   dialog focus management, scroll area and resizable stay Reka primitives, restyled with Cladd tokens.
   Cladd's own overlay positioning is replaced by Reka's (floating-ui collision handling).
3. **Re-point Cladd's single theme hue to the new brand tokens** (§7). Out of the box, Cladd would make
   Capubridge look like "a Cladd app" — tasteful but not ours. Identity comes from the brand layer and
   the signature components (§6), not from the kit.
4. **Keep only what earns its place**: Surface / SurfaceCut, size scale, Button, Toolbar, Segmented,
   ToggleGroup, Chip, Shortcut (kbd), NumberField / NumberScrubber, Field / InputGroup, Switch, Checkbox,
   Slider, SectionTitle, Tooltip styling. Bring these to upstream parity first.
5. **Build a `workbench` layer** for what no kit provides: DataGrid (TanStack + virtualisation), LogStream,
   Timeline, TreeView, Inspector, SplitLayout (persisted), Gate (empty/error states), ContextBar, StatusBar,
   CodeView (Monaco lazy).
6. **shadcn-vue's styled layer is retired progressively**; Reka stays.

**Why not the alternatives:** adopting Cladd wholesale leaves ~40 % of what the desktop uses (and the hardest
a11y parts) uncovered; keeping shadcn and restyling tokens cannot express Cladd's surface-depth model — you
get "shadcn, darker".

**Risks:** single maintainer (you), pre-1.0, 0 external users; surface depth relies on DOM context and must
not cost anything inside virtualised rows (use plain classes there); two styling vocabularies during
migration (mitigated by one token source of truth and a lint rule).

### 8.3 Layering

```
brand tokens (OKLCH, roles, provenance)      packages/cladd/tokens
  └─ cladd foundation (surfaces, sizes, controls)      packages/cladd
       └─ Reka behaviour primitives (menus, dialog, tree, combobox, scroll, resize)
            └─ workbench components (DataGrid, Timeline, LogStream, Inspector, Gate…)   apps/desktop/src/shared/workbench
                 └─ modules (device, data, network, elements, sessions, flows)
```

Lint rules: no raw palette classes, no arbitrary text sizes, no raw `<button>/<table>` in modules,
no module → module imports, shared never imports modules.

---

## 9. Engineering foundations ("no bugs, fully smooth")

### 9.1 IPC

- Convert all 73 synchronous commands to `async` (or `#[tauri::command(async)]` + `spawn_blocking`).
  Priority: `session_*` (18), `adb_list_devices`, `adb_list_packages`, `adb_list_dir`, `adb_shell_command`,
  mirror screenshot/scrcpy, emulator.
- Cancellation tokens on long ADB calls; the cancel command itself must be async.
- CI check: fail on any new synchronous `#[tauri::command]`.

### 9.2 One active context

- `ActiveContext` store = single source of truth `{ kind: live|recorded, device, app, target, session }`.
  Everything else (connection, storage origin, mirror, dock) is derived. Delete the 7 other sources.
- Detached windows subscribe to the same context via events (no forked state).
- Scenario test matrix (≥ 30 transitions: plug/unplug, target navigate, app background, open recording,
  switch local ↔ device) asserting no two surfaces disagree.

### 9.3 Native webview layering

- Global overlay registry: any Reka overlay (dialog, menu, popover, toast, sheet, palette) registers;
  while count > 0 the local webview is replaced by its last captured frame. Not opt-in per screen.
- Track position with ResizeObserver **and** transition end; no `flex-row-reverse` layout hacks.

### 9.4 Streams and rendering

- Ring buffers in Rust or a worker; batched append per animation frame; no full-array copies.
- Virtualise every list > 50 rows (logcat, console, exceptions, files, apps, DOM tree, replay lanes).
- One perf sampler shared by Device, App and Timeline; in-flight guard on screenshot loops.
- Parse logcat / HAR / `.capu` off the main thread.

### 9.5 Layout, routing, keyboard

- All splits persisted (`auto-save-id`), rail and device-pane state persisted, tab sets restored.
- Tab/pane/filter state in the URL.
- Central keymap + focus regions; documented = implemented (generated docs).

### 9.6 Budgets (CI-measured where possible)

| Metric                                       | Budget                  |
| -------------------------------------------- | ----------------------- |
| Input → visible feedback                     | ≤ 100 ms p95            |
| Main-thread long tasks during scroll / scrub | 0 > 50 ms               |
| Grid scroll, 100k rows                       | 60 fps sustained        |
| Panel / tab switch (cached)                  | ≤ 1 frame               |
| Timeline scrub preview                       | ≤ 50 ms                 |
| Mirror latency                               | ≤ 70 ms (scrcpy parity) |
| Cold start → interactive shell (release)     | ≤ 800 ms                |
| Logcat ingest without drops                  | ≥ 5,000 lines/s         |

### 9.7 Quality gates

- Visual regression with the screenshot harness (fixed scenarios, both themes, 1002×752 and 1920×1020).
- Axe-style a11y checks on every overlay; keyboard-only walkthrough per screen.
- Dead code removal (~25 orphan files, `capacitor/`, `hybrid/`, `mock-data.ts`, empty dirs).

---

## 10. Screen specs (summary)

| Screen                     | Purpose                                       | Layout                                                                                                                   | Beats                          |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| **Context bar + switcher** | Choose device › app › target, see link health | 3 segments, each a searchable popover; recorded mode visually distinct                                                   | Claude env panel               |
| **Device › Overview**      | Is this device healthy and what's running     | Vitals strip (CPU, mem, battery, temp, net) + foreground app + targets list + recent sessions; no card grid              | Android Studio Running Devices |
| **Device › Apps**          | Find app, inspect, open target                | Virtualised list, inspector on the right (merged App inspector), actions with shortcuts                                  | Android Studio App Inspection  |
| **Device › Files**         | Browse / pull / push                          | Tree + list (single view), path bar, preview in inspector                                                                | adb shell                      |
| **Device › Performance**   | Correlate vitals with events                  | Lanes aligned to the global timeline, not standalone charts                                                              | Chrome Performance             |
| **Data**                   | Explore, query, edit safely                   | Sidebar of stores (stable width), tabs per table/query, DataGrid, inspector, changeset bar                               | TablePlus, DB Inspector        |
| **Network**                | Requests, mocks                               | Dense table, waterfall lane in timeline, inspector (headers/body/timing/initiator), mocks as rules with timeline markers | Chrome Network, Proxyman       |
| **Elements**               | DOM / a11y / framework                        | Tree (virtualised), styles/computed/box/a11y in inspector, hover sync with device pane                                   | Layout Inspector               |
| **Sessions**               | Find, compare, export recordings              | Library list + preview; open = recorded context                                                                          | Sentry Replay library          |
| **Flows**                  | Author / run flows and agent goals            | Step canvas + inspector; runs as timeline markers                                                                        | Chrome Recorder                |
| **Dock**                   | Streams                                       | Logcat (xterm or virtualised), Console, REPL, Exceptions with shared query grammar                                       | Logcat v2                      |
| **Settings**               | Real configuration                            | Full page, sections, search; shortcut editor; MCP clients                                                                | VS Code settings               |
| **First run**              | From install to first target in < 60 s        | Guided connect (USB / Wi-Fi pair / emulator / local URL) with live checks                                                | —                              |

---

## 11. Scoring rubric (makes 9.5 measurable)

Each dimension scores 10 only if every check passes; each failed check costs ≥ 1 point.

| Dimension      | Checks                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Identity       | One mark/favicon/wordmark; bundled fonts; 0 raw palette classes; each colour has one role               |
| Density        | Rows 22/26/30 only; min text 11 px ≥ 4.5:1; 0 arbitrary sizes; content-aware columns                    |
| Navigation     | Labelled rail; all state in URL; back/forward across evidence; no ignored clicks in 100 scripted clicks |
| States         | Every screen passes the 6 gate states; no silent blank panes                                            |
| Keyboard       | Every action in palette; selection action panel; documented = implemented (test)                        |
| Trust          | Provenance on every value; 30-scenario context matrix passes; no write without changeset                |
| Responsiveness | All budgets in §9.6 met; 0 sync IPC                                                                     |
| Polish         | Visual regression green; motion roles only; a11y checks green; no overlay under webview                 |

---

## 12. Roadmap (max 10 rounds)

Each round: implement → recapture fixed scenarios → score against §11 → owner review → next.

| Round                         | Scope                                                                                                                               | Exit criteria                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **0 · Foundations**           | Async IPC (73), `ActiveContext`, overlay registry for webview, virtualise streams, verify `.capu` DB-write depth, dead code removal | 0 sync IPC; context matrix green; no overlay under webview; `/app` cannot freeze |
| **1 · Identity + system**     | Vendor cladd-vue → `packages/cladd`, tokens, type/density/motion; shell prototypes in A and C                                       | Owner picks direction on the running app                                         |
| **2 · Shell**                 | Context bar, labelled rail, workspace tabs/splits, device pane, inspector, status bar, persisted layout                             | Navigation + trust ≥ 9                                                           |
| **3 · Command system**        | Palette scopes, go-to syntax, action panel, keymap service, shortcut editor                                                         | Keyboard ≥ 9.5                                                                   |
| **4 · Gates & states**        | Gate component, provenance treatments, first-run flow                                                                               | States ≥ 9.5                                                                     |
| **5 · Data workbench**        | DataGrid, changeset, FK peek, filters/grouping, provenance, watch table                                                             | Data scenarios pass; TablePlus parity + live                                     |
| **6 · Network**               | Requests, mocks as rules with markers, recording → mocks                                                                            | Proxyman parity on core flows                                                    |
| **7 · Elements + Device**     | Tree virtualisation, a11y, device pane lens, vitals, apps/files                                                                     | Layout Inspector parity + storage link                                           |
| **8 · Timeline + Sessions**   | Global buffer, lanes, scrub, A/B diff, annotations, export with redaction                                                           | Scrub ≤ 50 ms; diff works on real data                                           |
| **9 · Flows + agent, polish** | Timeline markers for runs, data assertions, motion, a11y pass, visual regression at 2 sizes                                         | All dimensions ≥ 9, overall ≥ 9.5                                                |

---

## 13. Assumptions · risks · alternatives

**Assumptions**

- `.capu` can carry DB writes with enough fidelity (before/after, stack) — verify in round 0.
- Rolling-buffer memory stays bounded on long sessions (cap + spill to disk).
- Tauri child webview can be snapshotted fast enough to stand in during overlays.

**Risks**

- Scope: the rewrite touches every module — mitigated by round exit criteria and no-parallel-redesign rule.
- cladd-vue single-maintainer dependency — mitigated by vendoring and owning it as in-house code.
- Rebrand fatigue (third direction change since September) — mitigated by choosing on a running
  prototype with real data, and documenting the decision rationale (missing last time).
- Performance budgets may need Rust-side work beyond IPC (stream parsing) — budgeted in round 0/8.

**Alternatives considered**

- _Restyle only_ (tokens + polish): fastest, but leaves trust and responsiveness at ≤ 5 — rejected.
- _Adopt cladd-vue wholesale_: coherent look, ~40 % of needed primitives missing — rejected.
- _Keep Replay as a separate destination_: simpler, but forfeits the strongest differentiator — rejected.
- _Floating panels_ (Figma UI3 style): rejected on Figma's own rollback evidence.

---

## Appendix A — Defect list from live inspection

1. `/app` with device but no target freezes the window (> 7 min, 0 % CPU) — `session_refresh_packages` sync.
2. Header context ≠ Devices › Overview device (stale Xiaomi under _Local › localhost:5173_).
3. Settings dialog rendered under the native preview webview.
4. Rail clicks intermittently ignored (Storage, Graph, Devices).
5. Inspect › Elements: attributes concatenated without spaces; duplicate style declarations.
6. Header "connected" while Inspect says "connect to a target first".
7. Device manager: emulator "stale" yet offering WiFi / Disconnect.
8. Mirror pane opens as an empty black box; closed itself when opening a database.
9. SQLite: row counts 99 / 51 / 50 for one table.
10. SQLite: Columns popover empty → grouping and visibility unreachable.
11. SQLite: double-click enters inline edit, footer says it opens details.
12. SQLite: row detail opened on an unclicked row (cause unverified — may be the input harness); Esc does not close it.
13. SQLite: SQL tab content never rendered.
14. SQLite: schema shown as one unformatted paragraph; FKs not shown.
15. SQLite: empty filter keeps the "active" indicator after cancel.
16. Storage sidebar width changes between visits; names truncated to "c." while badges remain.
17. Replay: live context shown over a recording; icon fonts render as boxes; Elements not synced to playhead.
18. Replay: personal data captured unmasked in recorded LocalStorage.
19. Settings › Chrome claims fixed CDP port 9223; Settings › Shortcuts documents 4 non-existent shortcuts.
20. Shipped favicon is the Vite default.
