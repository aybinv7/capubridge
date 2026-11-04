# UI/UX Rewrite — Progress

Study: `docs/design/2026-11-04-ui-ux-rewrite-study.md` · Branch: `feat/ui-ux-overhaul`
Decisions D1–D7 taken as recommended (owner delegated, 2026-11-04). D4: prototype A and C, choose with rationale.

## Round 0 · Foundations — done

- [x] R0.1 Async IPC — 73 synchronous `#[tauri::command]` → 0. Blocking bodies run through
      `src-tauri/src/blocking.rs::run_blocking` (`spawn_blocking`). Guard: `scripts/check-async-commands.mjs`
      in `vite.config.ts` tasks, `ready`, and both CI workflows.
- [x] R0.2 `/app` cannot freeze — package list only loads when a package is known; package query never retries;
      global queries: `retry: 1`, `refetchOnWindowFocus: false`.
- [x] R0.3 Overlay guard — `useOverlayGuard` watches body-level portals (dialog, menu, listbox, popper,
      `data-overlay`) and parks the native local webview; `attachToElement`/`resizeToElement` respect the guard.
- [x] R0.4 Active context — `activeContext.store.ts` owns the rules: target selection aligns the active device
      (local/chrome → none), device selection drops foreign targets, connection store follows the target.
      Registry snapshots older than the applied revision are ignored (async IPC can reorder them).
- [x] R0.5 Streams — logcat and console append once per animation frame via `lib/frame-batcher.ts`
      (`shallowRef`, bounded queue, hidden-window timer fallback). List virtualisation of logcat, files, apps,
      DOM tree moves to the R7 rebuilds of those screens (no throwaway work).
- [x] R0.6 `.capu` depth — DB changes are periodic snapshots with before/after JSON per row (SQLite 5 s,
      IDB/LS on events). A→B diff and query-at-T are feasible now. Per-write provenance (JS stack) needs a
      write tap (IDB/LS/SQLite call interception via CDP) → added to R8.
- [x] R0.7 Dead code — 11 orphan components, `capacitor/`, `hybrid/`, `sqlite-wasm/`, `mock-data.ts`,
      empty dirs removed. Placeholder registry entries go with the R2 IA rewrite.
- [x] R0 score + review

### R0 verification (live app, real device 24117RN76G)

| Scenario                                    | Before                               | After                                        |
| ------------------------------------------- | ------------------------------------ | -------------------------------------------- |
| `/app` with device, no target               | "Not Responding" > 7 min             | 0/20 hang samples, gate shown                |
| Devices › Apps forced rescan                | (froze class of call)                | 0/30 hang samples over 15 s ×2               |
| Local target selected → Devices overview    | stale Xiaomi shown                   | "No device selected"                         |
| Palette / device manager over local webview | rendered under webview               | webview parked while open, restored on close |
| Tests                                       | 668 / 680 (Node 26 storage failures) | 701 / 701 desktop, 126 / 126 ui              |

### Defects found during R0 verification (assigned)

- Devices › Apps header counts stale after rescan ("84 apps · 75 user") → R7
- Device manager does not close on Esc (hand-built overlay) → R3
- Self-targeting `localhost:5173` yields "2 WebView2 pages" CDP ambiguity (edge case) → R4 gate copy
- Source-size ceilings raised for `adb.rs` (+36) and `mirror.rs` (+22) by async wrappers → split in R7

## Rounds 1–9

- [x] R1 Identity + system — **Bench chosen** over Tape after live A/B: Bench keeps four distinct
      signal roles (Tape merged live≡rec and select≡mark), IBM Plex Mono is denser than Martian Mono,
      and the neutral base keeps category hues true. Tokens in `src/themes` (OKLCH, roles: surfaces,
      cut, signals, states, categories, highlight); borrowed themes and the accent picker removed;
      primary actions are neutral ink; Cladd depth ported as `shadow-bevel`/`shadow-cut`/`shadow-float`;
      IBM Plex self-hosted (Google Fonts removed); type scale with 11 px floor (676 arbitrary sizes
      replaced); ~550 raw state palette classes → semantic tokens, recording/live dots → signals;
      mark + favicon; `check:design-tokens` guard in tasks and CI; contrast check rewritten for roles;
      DESIGN.md rewritten. Deviation from study: cladd-vue leaf components are vendored when a screen
      first needs them (R2+), not wholesale in R1.
- [x] R2 Shell — title bar with mark + wordmark; `ContextBar` (device › target, link state from
      `activeContext`, "Select a target" call to action) replaces the pill; labelled rail (Device, App, Data,
      Network, Elements, Replay, Flows) with selection marker and bevel, collapse persisted; accessible
      underline sub-tabs (tablist, arrows/Home/End); `StatusBar` (adb, device, cdp link, mirror, REC
      timecode, console); record button with recording semantics; dock/mirror toggles use selection tokens;
      device pane side/width/settings persisted (`lib/persisted`), honest "Mirror stopped" + Retry state;
      `flex-row-reverse` hack removed; placeholder registry entries removed.
      Keyboard finding: WebView2 does not deliver Ctrl+1–9 or Alt+digit to the page, so rail navigation is
      Linear-style **G then key** (`useGoShortcuts`, keys in the feature registry, shown in tooltips) and the
      dock tab switch moved to Alt+digit while focused. Also fixed a TypeError in the shell key handler.
      Moved: workspace document tabs/splits and the selection inspector land with the Data workbench (R5),
      where documents and selection exist; the generic version follows from that.
- [x] R3 Command system — one registry (`stores/commands.store.ts`) fed by providers; pure keymap
      (`lib/commands`: fuzzy ranking per field, binding parse/format, chord + "G then key" dispatch, editable
      guard). New palette on Reka Dialog + Listbox: ranked results, live devices and targets, recents, key caps on
      every row, scopes `>` commands · `@` devices & targets · `:` this screen, footer hints, stale devices
      dormant until searched, caret kept after the scope prefix. **Ctrl+.** opens the action panel; Network, Device
      overview and Replay contribute actions via `useCommandProvider`. Target activation extracted to
      `useTargetActivation` (device manager + palette share it). Device manager closes on Esc. Settings › Shortcuts
      is generated from the registry. Removed the dead "Export as HAR" button. Keymap is AZERTY-safe (Shift ignored
      for punctuation chords). Commands store accepts HMR updates (an empty registry after hot reload was a dev-only
      artefact).
- [x] R4 Gates & states — pure resolver in `lib/gates` (requirement × context → one blocking reason or a
      notice), connection chain (ADB › device › target › DevTools, first break marked), copy with next actions
      for 12 states, `WorkbenchGate` on shadcn `Empty` (full + compact), `GatedRouterView` driven by
      `meta.requires` on Device, App, Data (IDB/LF/LS/Cache/OPFS), Network › Requests, Elements and plugins, and
      `GatedView` on the dock. A screen that already rendered is **degraded** (hatched stale strip) instead of
      torn down when its link drops. First run = the no-device gate (steps + live ADB watch, Wi-Fi pair,
      emulator, This PC). `cdp_probe_target` (shared client, never forwards a port) + `targetPresence` store
      detect **app in background / other WebView on screen / target gone**; two misses before "background".
      One link truth (`activeContext.link`, `LinkIndicator`) for context bar, status bar and gates; connection
      failures recorded per target and shown copyable. Device manager state moved to the UI store, opens on a
      section, **Ctrl+Shift+D**. Provenance utilities (`prov-*`) + `ProvenanceTag` (imported IDB snapshot,
      recorded replay, stale strip). Self-target ambiguity now says it is Capubridge's own dev server. Removed
      9 improvised "no device / no target" branches. Windows `cargo test` fixed (Common-Controls manifest via
      linker for every target): 173/173 Rust, 739/739 desktop tests.
- [ ] R5 Data workbench (DataGrid, changeset, FK peek, filters/grouping, provenance)
  - [x] R5a Cladd foundation (D3 enforced) — cladd-vue re-pinned to upstream Cladd 0.19.0 (`1aaad0a`) in
        its own repo (Dialog inert release with a lingering popover, nested-dialog inert, deferred-open and
        transition-less close, Textarea `plaintext-only`; regression tests fail on the old code), then
        vendored as `packages/cladd` by `scripts/sync-cladd.mjs` (216/216 behaviour tests; parity suite and
        calendar components stay upstream). `packages/ui` and `apps/ui-playground` deleted (an older fork and
        its catalogue). `cladd-bridge.css` maps Cladd's base variables to Bench roles and its accents to
        Bench meaning, clamps Cladd type to 11 px, radius 6 px; verified by compiling `main.css` with the
        Tailwind compiler (`dark:` stays the app's variant, `light:` is Cladd's class variant).
        `CladdProvider` (neutral accent, theme mode, overlays in `body`); overlay guard also matches Cladd
        dialogs/popups/popovers. Retrofitted: gate actions and copy button → Cladd Button, spinners → Cladd
        Spinner, `KeyCaps` → Cladd Shortcut via `bindingTokens`, rail tooltips → Cladd Tooltip with keys from
        the command registry (fixes the rail showing "Ctrl+," for every utility entry). Removed the shadcn
        `xs` button size. New ratchet `check:cladd-adoption` (220 retiring shadcn imports, none may be added;
        in `ready` and both CI workflows). Script guard tests now run in `test:all` (they never ran in CI).
  - [x] R5e Storage write correctness — all 27 device scripts in `cdp-protocol` go through `evaluateChecked`
        (device exceptions were read as `undefined`); host data enters scripts only as `jsLiteral` (LocalForage
        ran the edited value as code and quoted keys by hand; Cache and OPFS escaped only quotes). LocalForage
        and Cache writes surface `{ error }` and missing entries; LocalForage rename writes before it deletes.
        IndexedDB: editing an inline key moves the record in one transaction (was a duplicate), a record that
        drops its key field is refused, aborts are awaited; toasts fire only after the device answers
        (`idbWrites`); snapshot mode is read-only in the table too; detail navigation uses global offsets
        (wrong record from page 2 on). Device scripts are executed in tests against fake-indexeddb.
        Decision: menus, context menu, tree and combobox stay Reka behaviour in the app, skinned with Cladd
        tokens; cladd-vue keeps its no-headless-runtime rule.
  - [ ] R5b Shared DataGrid — **SQLite Browse done**; IndexedDB, LocalStorage, LocalForage, Cache and the SQL
        tab still to migrate. `shared/components/data/grid`: TanStack column model, row + column virtualisation,
        `role="grid"` with active-descendant, sticky header and row gutter, type glyphs + PK/FK markers,
        content-aware widths (90th percentile, kept through empty results), one click selects / Enter edits /
        Space inspects, spreadsheet keys, TSV/JSON copy, selection aggregates, Cladd-skinned context menu (also
        from the keyboard), row-state overlays for the changeset, `dir="auto"` cells for Arabic data. The
        inspector follows the selection (replaces modal-on-click) with an FK link. SQLite: filters run as SQL
        WHERE on the database with a true filtered count ("Filter = value" from the context menu), Columns menu,
        CSV/JSON/INSERT export of the whole (filtered) table, copy as INSERT. Fixed: the 99/51/50 row counts;
        every SQLite edit silently lost on refresh (device databases are now honestly read-only `local copy`,
        only imported files accept writes, clear/drop/delete guarded); OPFS databases vanishing when the app is
        backgrounded (kept, marked unreachable, rediscovered on return and when DevTools connects, since the
        first scan raced the connection); deep links lost on reload; sidebar names truncated to "c."; the
        WebView2 browser menu (Back/Refresh/Print/Inspect) on right-click. Removed the 17-file SqliteTable
        stack. New guard `check:vue-types`: vp check never type-checked Vue templates; vue-tsc found 107 errors
        (94 left, ratcheted).
- [ ] R6 Network (requests, mocks as rules, recording → mocks)
- [ ] R7 Elements + Device (tree virtualisation, a11y, lens, vitals, apps/files)
- [ ] R8 Timeline + Sessions (global buffer, lanes, scrub, A/B diff, write tap, export with redaction)
- [ ] R9 Flows + agent, polish, final scoring

## Score log

| Round    | Identity | Density | Navigation | States | Keyboard | Trust | Responsiveness | Polish | Overall |
| -------- | -------- | ------- | ---------- | ------ | -------- | ----- | -------------- | ------ | ------- |
| Baseline | 4        | 4       | 3.5        | 3      | 3        | 2     | 1.5            | 3.5    | 3.1     |
| R0       | 4        | 4       | 3.5        | 3      | 3        | 4.5   | 6              | 4      | 4.0     |
| R1       | 7        | 4.5     | 3.5        | 3      | 3        | 4.5   | 6              | 5      | 4.6     |
| R2       | 7.5      | 5       | 6.5        | 3.5    | 4.5      | 5.5   | 6              | 5.5    | 5.5     |
| R3       | 7.5      | 5       | 7.5        | 3.5    | 8        | 6     | 6              | 6      | 6.2     |
| R4       | 7.5      | 5       | 8          | 7.5    | 8        | 7     | 6              | 6.5    | 6.9     |

R0 notes: responsiveness gains are structural (no main-thread IPC, batched streams) but three perf pollers,
unvirtualised lists and the unguarded screenshot loop remain; trust gains come from one context owner and
ordered snapshots, but provenance treatments and the header/inspect state mismatch are still open. No visual
work yet, so identity, density, navigation, states and keyboard are unchanged by design.

R1 notes: identity is now owned and guarded, but the mark is not yet in the chrome, active tabs
borrow the ink fill (fix in R2), and categorical hues wait for their screens. Density gains are
typographic only until the shell and grids are rebuilt.

R2 notes: the shell now tells the truth about context and link state and reads as one product, but
there are no document tabs, no inspector and the palette is still navigation-only, which caps navigation
and keyboard. States only improved where the device pane was touched.

R3 notes: the keyboard story is now best-in-class shaped (palette with data and scopes, action panel, generated
shortcut docs) but shortcuts are not yet user-editable and only three screens contribute actions; those grow as
each screen is rebuilt. States remain the weakest dimension — R4 is next.

R4 notes: States moved most (3.5 → 7.5): every device/target screen and dock tab now shows one reason, one
explanation and the next action, and a dropped link degrades instead of blanking. It is not 9.5 yet because
SQLite, Graph and Network › Mock still gate themselves, the degraded strip and background/gone detection were not
exercised live (the running binary predates `cdp_probe_target`; needs a Rust rebuild), and no screen yet has
per-value provenance (that is R5's grid). Trust rose with one link derivation and copyable failures; it stays
below 9 until values carry provenance everywhere and the context matrix test exists.

### Open items found in R4 (assigned)

- Console and network capture auto-reconnect with backoff, contradicting AGENTS.md "do not auto-reconnect" →
  owner decision; the gate shows "disconnected" only between retries → R6
- Detached dock windows run their own Pinia without the context bootstrap, so they are ungated and see no
  target → R8 (detached windows subscribe to the shared context)
- Storage queries do not key on connection status (an early "No active CDP connection" error can stick);
  masked by the gate mounting only when connected, fixed at the root in the R5 DataGrid
- SQLite, Graph and Network › Mock keep their own mixed gating → R5 / R6
- `usePerfMetrics` never starts if mounted without a device; sidestepped by the gate remount → R7
- Background / gone / degraded states need a live check after the next Rust rebuild → start of R5

### Open items found in R5a (assigned)

- Decided (owner delegated): behaviour-heavy primitives Cladd lacks stay Reka in the app with a Cladd skin;
  cladd-vue keeps its no-headless-runtime rule
- Verified in the browser pane (frontend only, no Tauri): gate, palette and title bar render on Cladd in dark
  and light; ink primary 14.8:1, key caps 12.7:1. Found and fixed: `xs` key caps were 12 px tall around 11 px
  text (Cladd nests them; upstream sizes them for 8 px), now `sm` = 16 px keys in 24 px buttons; five
  hand-written key labels (title bar, status bar, settings) now come from the registry (`useBindingHint`).
  Still to check in the Tauri window: high-contrast theme and the native-webview overlay guard with a Cladd
  overlay → R5b
- 220 shadcn imports still to migrate as each screen is rebuilt (R5–R9)

### Open items found in R5b (assigned)

- 94 pre-existing Vue template type errors (ratcheted; burn down as files are touched) → R5–R9
- SQL tab (DataGrid results, run on open, Ctrl+Enter), Structure tab (formatted DDL, FK list, indexes) and
  the database overview's error state still use the old views → next R5b slice
- A deep link to a _table_ inside an OPFS database reopens at the database overview (the pulled session lives
  in memory) → R5d, when the session is persisted with the write path
- Cladd `Tooltip` has only top/bottom positions, so rail tooltips sit below their item → Cladd extension → R7
- The Columns popover once opened by itself after a reload; not reproduced since → watch during R5 checks
- Owner idea: an optional helper APK for data and control ADB/CDP cannot reach; it conflicts with the
  website's "no helper APK" claim → owner decision, evaluate with R8
