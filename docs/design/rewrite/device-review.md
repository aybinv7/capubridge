# Device route — review round 1

Reviewed commit `3b1ec74`. Three independent reviews (UI/UX in the running app, performance from
code, parity from the pre-rewrite sources) plus the orchestrator's own look. Fix everything marked
blocker and major; fix minors unless a note says otherwise. Paths are relative to
`apps/desktop/src/modules/devices/` unless they start with `src/` or `src-tauri/`.

## Parity and correctness

- **P1 major — Switching phones shows the previous phone's vitals.** The monitor moved into
  `DevicesPanel.vue`, above the gate that remounts per device, and `perf/usePerfMetrics.ts` never
  resets history/`latest`/`tickCount`. Add `reset()` and call it from `perf/useDeviceVitals.ts`
  when the serial changes.
- **P2 major — Phase is wrong when the monitor stops for any reason but Pause.** `perf/perfView.ts:26-31`
  returns "paused" (readings, not running) or "starting" forever (no readings) for offline phone,
  hidden window, or returning from another tab; returning from Apps shows a false "Stale". Give
  `PerfPhaseInput` an `active` flag and an `offline` phase; "not running yet with an old reading"
  is "starting", not "stale". Pause button state must match.
- **P3 major — Refreshing a folder empties its tree branch.** `files/useFileBrowser.ts:157` calls
  `tree.forget(dir)`; the refill watch on `listing.data` does not fire when TanStack Query returns
  the same object. Keep the branch until new data arrives, or `tree.remember(dir, data)` after the
  refetch resolves.
- **P4 — Undeclared behaviour changes.** Restore or deliberately document in the parity file:
  network download and upload now share one axis so upload flattens (give upload its own scale or
  a second small chart); WebView allocated-heap average and peak dropped (restore); Overview now
  holds the ADB perf lease (see F4/F3, it must not hurt recordings).
- **P5 — Double-click in Apps launches but leaves the app unselected** (`apps/AppsTable.vue:134-135`,
  `apps/AppsGrid.vue:110-111`): click must select, not toggle, or ignore `event.detail > 1`.
- **P6 — Chart times wrong after any gap** (`perf/perfSeries.ts:105` assumes 1 s ticks): store a
  timestamp per sample.
- **P7 — Files keys dead after clicking a row button** (`files/useFilesKeyboard.ts:25`): ignore only
  events from text inputs and menus.
- **P8 — Grids subtract padding twice** (`apps/AppsGrid.vue:27-31`, `files/FilesGrid.vue:25-28`).
- **P9 minor —** an app link to an uninstalled app permanently flips the persisted scope to All
  (`apps/DeviceApps.vue:100`): make that scope change temporary; palette "Browse the private data"
  ignores the reported data dir (`apps/useAppsCommands.ts:38`); sorting by Modified compares text
  (`files/filePaths.ts:62`), parse dates.

## Performance

- **F1 major — 5–9 adb shells per sample, period not 1 s** (`src-tauri/src/commands/perf.rs:292-321,398-415`):
  read the three `/proc` files in one `cat` with markers, discover the temperature source once per
  session and reuse it (or stop probing when none exists), read battery every ~10 s, and use
  `tokio::time::interval` with `MissedTickBehavior::Delay`. Add Rust tests for the parsing.
- **F2 major — unovis charts fully redraw with a 600 ms animation ~7×/s** (`perf/PerfChart.vue:77-117`,
  `perf/usePerfMetrics.ts:441-443`): `:duration="0"`, hoist constant props (margins, dash arrays),
  give WebView series their own counter, skip updates for charts out of view.
- **F3 major — WebView CDP poll runs on Overview and piles up** (`perf/usePerfMetrics.ts:204-305,359-365`):
  only Performance wants WebView metrics; replace `setInterval(async)` with a self-scheduling
  timeout after each tick, short timeout (~2 s), `Performance.disable` on stop.
- **F4 major — perf lease is a flag, not a count** (`perf/useDeviceVitals.ts:44`,
  `src-tauri/src/session/live_features.rs:80-125`, `src-tauri/src/session/registry.rs`,
  `src/composables/usePerfRecorder.ts:121,153`): count lease holders; start on the first, stop on the
  last, so Overview never interrupts a recording's perf stream. Rust test.
- **F5 major — arrow keys in Apps fire `package-details` per app** (`apps/DeviceApps.vue:60-70`,
  `src-tauri/src/commands/adb.rs:1427-1435`): debounce the selection (~200 ms) before the query key;
  cache `dumpsys diskstats` per device (~60 s) and look the package up in it.
- **F6 major — unbounded, uncancelled icon fetches** (`AppIcon.vue:21-40`, `adb.rs:1567-1650`):
  front-end queue with 3–4 in flight that drops requests whose row unmounted, a semaphore in Rust,
  key icons by serial + package only (`overview/OverviewApp.vue:78` fetches twice), do not refetch
  icons that came back empty.
- **F7 major — file viewer loads whole files** (`files/useFileViewer.ts:67-81`, `src-tauri/src/commands/files.rs`):
  cap in-app preview (~20 MB images/text, truncate text), stream video/large files via a temp file +
  `convertFileSrc` or a Blob URL revoked on close.
- **F8 minor —** use `shallowRef`/fixed ring buffers for histories, build series only for visible
  charts (`perf/usePerfMetrics.ts`, `perf/perfSeries.ts`).
- **F9 minor —** two code paths restart the monitor on device change (`perf/usePerfMetrics.ts:382-427`
  vs `perf/useDeviceVitals.ts:44-47`): one owner, queued.
- **F10 minor —** Files filter re-sorts per keystroke; Apps sorts twice: one shared `Intl.Collator`,
  sort once per listing+order, then filter.
- **F11 minor —** whole-phone file search: ≥3 characters, `timeout 10`, cancel the previous search.
- **F12 minor —** subscribe to perf events only while the lease runs; pause the 1 s clock when not
  live or stale.

## UI/UX

- **U1 blocker — Files opens on `/` with broken `?` rows** (`files/useFileBrowser.ts:37`,
  `files/FilesList.vue`): open on phone storage (or the last folder for that device); never show raw
  `ls` leftovers — show the link name with a quiet "No access", "Unknown" for dates; fix the parser
  in `adb_list_dir` if it is the source (also the `/etc/etc` symlink toast: list with a trailing
  slash for links).
- **U2 major — selected row is weaker than a hovered row** (`apps/AppsTable.vue:179-183`,
  `apps/AppsGrid.vue:277-281`, `files/FilesList.vue:113-117`, `files/FilesSidebar.vue`): selection
  uses the selection treatment (Cladd `ListButton :selected` or `signal-select`), hover one level
  below.
- **U3 major — Uninstall offered on system apps with false copy** (`apps/AppInspector.vue:116-127`,
  `apps/AppRowActions.vue:256-263`, `apps/appsModel.ts`): disable with a reason, or offer "Remove for
  this user" (`pm uninstall --user 0`) with honest copy.
- **U4 major — WebView says "Live" while the app is in the background** (`perf/PerfWebView.vue`,
  `overview/OverviewApp.vue`): read presence; show "In the background · readings may be frozen"
  with a hollow dot; the Overview app card's Open becomes "Bring to front".
- **U5 major — app title falls back to the package name** (`overview/OverviewApp.vue:27-28`): one
  shared app-name helper with the title bar's order; drop the duplicate package line.
- **U6 major — raw dates, "Updated" before "Installed"** (`apps/AppInspector.vue:46-47`, Files):
  dates in words; ≤ 2009-01-01 reads "Came with the phone"; hide Updated when not after Installed.
- **U7 major — Apps details pane keeps 36 % when empty; Files uses a different pattern**
  (`apps/DeviceApps.vue:326-346`, `files/DeviceFiles.vue:167`): one pattern for both — collapses
  when nothing is selected, opens on selection with the settle curve, same header and close.
- **U8 major — keyboard and screen readers** (`apps/AppsTable.vue`, `files/FilesList.vue`,
  `files/DeviceFiles.vue`): `aria-activedescendant` with row ids, row actions `tabindex="-1"`, sort
  header outside the listbox, visible focus ring on the pane.
- **U9 major — Apps list is one stretched column with loud "System" chips**: 30 px rows with Name |
  Package (quiet mono) | Kind | actions; System as quiet text, or group under "Your apps" / "System".
- **U10 major — rainbow placeholder icons, wrong letter, pulsing on every open**
  (`src/shared/components/presentation/ApplicationIcon.vue`): neutral surface tile, first letter of
  the app name, no pulse for cached empties.
- **U11 minor —** grid tiles top-aligned with a fixed two-line label box; long words wrap so the
  clamp ellipsis works (`apps/AppsGrid.vue:276,294`).
- **U12 minor —** Performance: y-axis units (rate, MB), a solid/dashed legend, plain copy instead of
  "Live metrics (performance domain)", rename "Battery and temperature".
- **U13 minor —** keep `?package=` in the URL as selection changes (`apps/DeviceApps.vue`).
- **U14 minor —** Files toolbar: "Auto-refresh: Off / 5 s", scope only while searching, one eye icon
  with pressed state, `IconAction` for layout buttons.
- **U15 minor —** container breakpoints on the panel width, not the window (`overview/OverviewVitals.vue`,
  `perf/DevicePerf.vue`).
- **O1 (orchestrator) —** Overview vital tiles: the sparkline is a tiny graph squeezed in the
  bottom-right corner; make it a full-width band along the tile's bottom.
- **O2 (orchestrator) —** Performance "Load per core": eight fixed-width tiles stop short of the row;
  let them fill the width (auto-fit grid).
- **O3 (orchestrator) —** Performance battery card has a large empty area under the bar; size the
  card to its content or use the space (charge history).

## Round 1 fixes

Every finding is fixed; nothing was skipped. Details of each reshaped capability are in
`device-parity.md` › "Round 1 reshapes".

| Id             | Status | Where                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1             | fixed  | `perf/useDeviceVitals.ts` (single queue, `reset()` on phone change), test `perf/__tests__/useDeviceVitals.test.ts`                                                                                                                                                                                                                                                                                                       |
| P2             | fixed  | `perf/perfView.ts` (`active`, `offline`, run-relative readings), `usePerfPhase.ts`, tests in `perfView.test.ts`                                                                                                                                                                                                                                                                                                          |
| P3             | fixed  | `files/useFileTree.ts` `reload`, `useFileBrowser.refresh`, test `files/__tests__/useFileTree.test.ts`                                                                                                                                                                                                                                                                                                                    |
| P4             | fixed  | upload has its own chart and scale (`perf/PerfNetwork.vue`); allocated heap average and peak restored (`PerfWebView.vue`); lease holders (`src-tauri/src/session/perf_holders.rs`)                                                                                                                                                                                                                                       |
| P5             | fixed  | click selects, `event.detail > 1` ignored (`apps/AppsTable.vue`, `AppsGrid.vue`, Files list and grid)                                                                                                                                                                                                                                                                                                                    |
| P6             | fixed  | a time per sample (`perf/sampleRing.ts`), gaps after pauses                                                                                                                                                                                                                                                                                                                                                              |
| P7             | fixed  | `shared/keyTargets.ts`, `files/useFilesKeyboard.ts`                                                                                                                                                                                                                                                                                                                                                                      |
| P8             | fixed  | `AppsGrid.vue`, `FilesGrid.vue` use the content width once                                                                                                                                                                                                                                                                                                                                                               |
| P9             | fixed  | temporary scope widening (`apps/useAppSelection.ts`); palette uses the reported data dir; Modified sorts by date (`files/filePaths.ts`)                                                                                                                                                                                                                                                                                  |
| F1             | fixed  | `src-tauri/src/commands/perf/` (one shell per tick, probe cached, battery every 10 s, `interval` + `Delay`), 16 Rust tests                                                                                                                                                                                                                                                                                               |
| F2             | fixed  | `perf/PerfChart.vue` (`duration` 0, hoisted constants, series built only while on screen); WebView has its own version counter                                                                                                                                                                                                                                                                                           |
| F3             | fixed  | `perf/useWebViewMetrics.ts` (Performance only, self-scheduling, 2 s timeout, `Performance.disable`)                                                                                                                                                                                                                                                                                                                      |
| F4             | fixed  | holder-named leases, Rust tests in `session::perf_holders`                                                                                                                                                                                                                                                                                                                                                               |
| F5             | fixed  | 200 ms debounce (`apps/DeviceApps.vue`), 60 s diskstats cache (`src-tauri/src/commands/package_sizes.rs`)                                                                                                                                                                                                                                                                                                                |
| F6             | fixed  | `iconQueue.ts` (3 in flight, newest first, dropped on unmount), `icon_gate.rs`, key by phone + package, empty icons cached                                                                                                                                                                                                                                                                                               |
| F7             | fixed  | `adb_read_file_bytes` (binary, capped), viewer caps and Blob URLs revoked on close (`files/viewer/`)                                                                                                                                                                                                                                                                                                                     |
| F8             | fixed  | `SampleRing` (typed arrays), lazy series                                                                                                                                                                                                                                                                                                                                                                                 |
| F9             | fixed  | one owner (`createDeviceVitals`)                                                                                                                                                                                                                                                                                                                                                                                         |
| F10            | fixed  | `shared/collator.ts`, sort once then filter (Apps and Files)                                                                                                                                                                                                                                                                                                                                                             |
| F11            | fixed  | three characters, `timeout 10`, verified on the Redmi                                                                                                                                                                                                                                                                                                                                                                    |
| F12            | fixed  | events subscribed only while the lease runs; the phase clock pauses when not running                                                                                                                                                                                                                                                                                                                                     |
| U1             | fixed  | opens on phone storage or the last folder; `?` rows parsed as "No access"; trailing slash for links (`src-tauri/src/commands/files_parse.rs`, `files.rs`)                                                                                                                                                                                                                                                                |
| U2             | fixed  | `shared/rowState.ts` selection tint and line, hover one level below (Apps, Files, tree, places)                                                                                                                                                                                                                                                                                                                          |
| U3             | fixed  | "Remove for this user" (`pm uninstall --user current`) with honest copy                                                                                                                                                                                                                                                                                                                                                  |
| U4             | fixed  | WebView "In the background · readings may be frozen", hollow dot; Overview app card "Bring to front"                                                                                                                                                                                                                                                                                                                     |
| U5             | fixed  | `src/lib/target-app-name.ts`, shared with `ContextBar.vue`; package line dropped                                                                                                                                                                                                                                                                                                                                         |
| U6             | fixed  | `shared/dates.ts` (words, factory date, Updated only after Installed), Files dates too; Rust keeps the earliest real install time                                                                                                                                                                                                                                                                                        |
| U7             | fixed  | `shared/DetailsPane.vue` for Apps and Files, settle curve in, 200 ms out                                                                                                                                                                                                                                                                                                                                                 |
| U8             | fixed  | `aria-activedescendant` with row ids, actions `tabindex="-1"`, sort headers outside the listbox, focus ring                                                                                                                                                                                                                                                                                                              |
| U9             | fixed  | 30 px rows, Name / Package / State / actions, System as quiet text                                                                                                                                                                                                                                                                                                                                                       |
| U10            | fixed  | neutral letter tile from the app name, no pulse                                                                                                                                                                                                                                                                                                                                                                          |
| U11            | fixed  | top-aligned tiles, fixed two-line label box, `overflow-wrap: anywhere`                                                                                                                                                                                                                                                                                                                                                   |
| U12            | fixed  | y-axis units (%, KB/s, MB), solid / dashed legend, plain WebView copy, "Battery and heat"                                                                                                                                                                                                                                                                                                                                |
| U13            | fixed  | `?package=` follows the selection (debounced)                                                                                                                                                                                                                                                                                                                                                                            |
| U14            | fixed  | "Auto-refresh: Off", scope only while searching, one eye, `IconAction` layout toggle                                                                                                                                                                                                                                                                                                                                     |
| U15            | fixed  | container queries on Overview vitals and Performance                                                                                                                                                                                                                                                                                                                                                                     |
| O1             | fixed  | `overview/VitalTile.vue` full-width band                                                                                                                                                                                                                                                                                                                                                                                 |
| O2             | fixed  | `perf/PerfCores.vue` auto-fit                                                                                                                                                                                                                                                                                                                                                                                            |
| O3             | fixed  | battery card holds a last-hour charge history (`PerfPower.vue`)                                                                                                                                                                                                                                                                                                                                                          |
| V1 file viewer | fixed  | `files/viewer/` (header with path copy, Download, Open, Choose app; prev / next; image zoom and pan with checkerboard and dimensions; media from Blob URLs; text with line numbers, lazy shiki, wrap, Ctrl+F, truncation note; JSON text / tree; SQLite facts and Data › SQLite when the file is the selected app's database; hex for the rest; loading, too large and error states), tests in `files/viewer/__tests__/` |

Found while fixing:

- `dumpsys package` prints one `firstInstallTime` per user and the last one is often the epoch, so
  "Installed" read Unknown for most apps (fixed, Rust test `package_times`).
- Rows of `ls` for device nodes (`1,   3` in the size column) were mis-parsed (fixed in
  `files_parse.rs`).
- A Rust change restarts the owner's app, which also drops the selected target.
- Not changed: `perf.rs` still sums every interface, so a phone sharing its connection shows
  download ≈ upload; `adb_perf_start` / `adb_perf_stop` bypass the lease holders (unused by the UI);
  the App module's own `AppIcon.vue` keys icons differently.
