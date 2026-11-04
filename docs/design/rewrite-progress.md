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

- [ ] R1 Identity + system (packages/cladd, tokens, A/C prototypes, decision)
- [ ] R2 Shell (context bar, rail, tabs/splits, device pane, inspector, status bar, persistence)
- [ ] R3 Command system (palette scopes, go-to, action panel, keymap service)
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

R0 notes: responsiveness gains are structural (no main-thread IPC, batched streams) but three perf pollers,
unvirtualised lists and the unguarded screenshot loop remain; trust gains come from one context owner and
ordered snapshots, but provenance treatments and the header/inspect state mismatch are still open. No visual
work yet, so identity, density, navigation, states and keyboard are unchanged by design.
