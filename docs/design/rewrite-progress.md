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
- [ ] R3 Command system (palette scopes, go-to, action panel, keymap service; palette keeps stale query; device manager ignores Esc; Settings › Shortcuts documents non-existent shortcuts)
- [ ] R4 Gates & states (gate component, provenance treatments, first run)
- [ ] R5 Data workbench (DataGrid, changeset, FK peek, filters/grouping, provenance)
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
