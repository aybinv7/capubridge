# Device route parity

Route `/devices` (rail: Device, `g d`), children Overview, Apps, Files, Performance. Gate
`meta.requires: "device"` on every child through `GatedRouterView` (`DevicesPanel.vue`).

Written before the rewrite from the code at `a1efe0a`. Paths are relative to
`apps/desktop/src/modules/devices/` unless they start with `src/` or `src-tauri/`.
After the rewrite each line is ticked with where it lives now (`→`).

## Shell of the route

- [x] Sub-navigation tabs Overview · Apps · Files · Performance from route meta labels → unchanged (`DevicesPanel.vue`, `src/components/layout/SubNavTabs.vue`)
- [x] Gate for no ADB / no device / offline device via `GatedRouterView` → unchanged (`DevicesPanel.vue`)
- [x] `/devices` redirects to `/devices/overview` → `routes.ts`
- [x] Route names `devices-overview`, `devices-apps`, `devices-files`, `devices-performance` (used by `src/modules/app/useAppPanel.ts` → `devices-files?path=`) → `routes.ts`, components moved to `overview/`, `apps/`, `files/`, `perf/`
- [x] Palette `Go to Device` / `g d` → unchanged
- [x] `AppIcon.vue` and `DeviceLogcat.vue` imported from outside the route keep their paths → module root (AppIcon also fixed a `null` icon path type error)

## Overview (`DeviceOverview.vue`)

- [x] Device name from `useDeviceNamesStore().nameOf(device)` → `overview/OverviewHeader.vue` (the gate guarantees a device, so the info fallback is no longer needed)
- [x] Serial → quiet mono row "Serial" with copy in `overview/OverviewFacts.vue`, and the name's tooltip; no longer under the name
- [x] Connection kind word: USB or Wi-Fi → `OverviewHeader.vue` ("Online over USB", StatusDot from `describeDeviceState`)
- [x] Refresh button → `IconAction` "Refresh device info" in `OverviewHeader.vue`, spins while fetching
- [x] Display resolution → "Display 1080 × 2400 · 450 dpi" (`overview/deviceFacts.ts`, dpi is new)
- [x] Model and CPU ABI → separate "Model" (maker + model) and "Processor" (ABI) facts
- [x] Storage used / total with percentage → "69.4 GB of 229 GB used · 159 GB free" plus a meter
- [x] RAM total → "Memory" fact; the bug that hid it without storage is fixed
- [x] IP addresses → quiet "Network address(es)" row with copy, not a headline card
- [x] Android version and API level → header line next to the connection
- [x] Loading state → spinner + "Reading the phone's details" (`overview/DeviceOverview.vue`)
- [x] Error state with raw error + retry → "The phone did not send its details." + raw error + Try again (also when `getDeviceOverview` returns `null`)
- [x] Missing values shown as "—" → `deviceFacts.ts`
- [x] Palette `device.refresh-info` → kept in `DeviceOverview.vue`; new `device.copy-serial`

New on Overview: "Right now" live vitals (processor, memory, battery, download, with sparklines and
a Live / Waiting / Stale / Paused word) that open Performance (`overview/OverviewVitals.vue`,
`VitalTile.vue`, `shared/Sparkline.vue`), and "App you are inspecting" (icon, version, package,
Open, Details → Apps with that app selected) for the selected ADB target (`overview/OverviewApp.vue`).

## Apps (`apps/`)

Toolbar (`apps/AppsToolbar.vue`)

- [x] Search by label or package → Cladd `SearchField`, `filterApps` in `apps/appsModel.ts` (tested)
- [x] Scope Third-party / All / System → Cladd `Segmented` "Your apps · System · All", fetch scope unchanged; choice persisted
- [x] Grid columns 4 / 6 / 8 → icon size S / M / L (about 8 / 6 / 4 per row, now following the width), grid view only, persisted
- [x] Count of shown apps, "/total" while searching → counts inside each scope segment, "N found" while searching
- [x] "N user · M system" counts → in the scope segments (from query cache or localStorage, as before)
- [x] Refresh → `IconAction` "Reload the app list" (spins while loading)
- [x] Stop loading → "Stop loading" button while fetching; toasts "Stopped loading the app list" / "Could not stop loading the app list"
- [x] Load cancelled silently on leaving the tab → `apps/DeviceApps.vue` `onBeforeUnmount`
- [x] View toggle grid / table → `Segmented` list / icons, persisted (default list)

List

- [x] Grid tiles, disabled greyed, selection raised → `apps/AppsGrid.vue`, now virtualised by rows
- [x] Table: icon, label + package, Type, Status, APK path → `apps/AppsTable.vue` (TanStack Table + `useFixedVirtualList`): System and Disabled as chips beside the name only when true, APK path on the package's tooltip and as "Installed package" folder in the inspector
- [x] Row hover actions Open / Force stop / Clear data / Uninstall → `apps/AppRowActions.vue` (`IconAction`s)
- [x] Click selects, clicking again clears → `toggle`; new ↑ ↓ Home End (list) and arrows + Enter (grid), double-click opens the app
- [x] Empty → `apps/AppsEmpty.vue` (searching / your apps / other scopes)
- [x] First load → "Reading the apps installed on the phone"
- [x] Error + raw error + Retry → "The phone did not send its list of apps." + Try again
- [x] Selection survives a refresh while the app exists, cleared on device change → selection by package name
- [x] Resizable list / inspector split → kept (64 / 36)

Inspector (`apps/AppInspector.vue`, `AppSizeBreakdown.vue`, `AppFolderList.vue`)

- [x] Empty "Select an app" → "No app selected" + what selecting does
- [x] Header title + close → "App details" + Close `IconAction`
- [x] Icon, label, package, System/User and Enabled/Disabled → icon, name, package with copy, chips only for System app / Disabled
- [x] Version name + code → "Version"
- [x] Total storage → "Space used" with an App / Data / Cache meter; "Not reported by this phone" when absent
- [x] Min and target SDK → "Android: Targets API 35, runs from API 29"
- [x] Installer → "Installed by" (a literal `null` from the phone now reads Unknown)
- [x] First install / last update → "Installed" / "Updated"
- [x] APK, data, cache sizes → legend of the size meter
- [x] Paths with Browse → "Folders" list, each opens Files at that path; `null` paths fall back like the others (`appFolders`, tested)
- [x] Details loading → "Reading the app's details"
- [x] Details error + Retry → message + raw error + Try again
- [x] Actions Open, Browse internal data, Browse Android/data, Force stop, Clear data, Uninstall → Open, Force stop, Clear data, Uninstall buttons; the two Browse actions are the "Private data" and "Android/data" folder rows; destructive buttons disabled while acting

Actions and toasts (`apps/useAppActions.ts`, `appsModel.ts`)

- [x] Open → "X opened on the phone" / "Could not open X"
- [x] Force stop → Cladd confirm (`shared/DeviceConfirmDialog.vue`, neutral) → `am force-stop` → "X was stopped"
- [x] Clear data → confirm (red) → `pm clear` → "Data of X cleared" + details refetch, or "Could not clear the data" with output
- [x] Uninstall → confirm (red) → `pm uninstall` → "X uninstalled", selection cleared, list reloaded, or "Could not uninstall" with output
- [x] Any error → "Could not finish the action on X"

New: palette commands for the selected app (open, force stop, clear data, uninstall, browse private
data) and "Reload the app list" (`apps/useAppsCommands.ts`); `?package=` selects an app (used by Overview).

## Files (`files/`)

Navigation

- [x] `?path=` opens that folder, resets on device change, reveals it in the tree → `files/useFileBrowser.ts`; the tree now also follows every navigation
- [x] Breadcrumbs → `files/FilesBreadcrumbs.vue` (keeps the end visible, copy path); new Up button (`Backspace`)
- [x] Folder tree with lazy children, chevrons, spinner, current and ancestors, load-error toast → `files/FilesSidebar.vue` + `useFileTree.ts`, virtualised; toast "Could not open a folder in the tree"
- [x] Tree reuses the open folder's listing → `tree.remember`
- [x] Navigating leaves search and closes the viewer and the unsupported dialog → `useFileBrowser.openFolder`, `DeviceFiles.vue`; the details pane is now a toolbar toggle that stays open by choice

Toolbar (`files/FilesToolbar.vue`)

- [x] Search this folder → `SearchField`
- [x] Search scope Current folder / Entire device → `Segmented` Folder / Phone; prompt and empty copy in `FilesState.vue`; same `find` command (`deviceFileSearch.ts`, tested against the old string)
- [x] View list / grid → `Segmented`, persisted (default list); grid columns follow the width
- [x] Show / hide hidden files → pressed `IconAction`
- [x] "Add" (disabled, did nothing) → removed: there is no upload command. Upload needs an `adb push` IPC command and is a follow-up
- [x] Live refresh interval Manual … 30 s, only while visible and on the folder → Cladd `Select`, persisted, same conditions
- [x] Refresh → `IconAction` "Read the folder again"

Listing

- [x] List: icon, Name, Size, Modified, delete → `files/FilesList.vue` (virtualised, sortable Name / Size / Modified, folders always first; Download + Delete on hover)
- [x] Grid: icon, name, size or "Folder" → `files/FilesGrid.vue` (virtualised rows)
- [x] Folders first, then by name → `sortEntries` (tested)
- [x] Click selects, double-click opens → same
- [x] Loading, error, empty → `FilesState.vue` (plain sentences)
- [x] Selection kept, first entry otherwise, neighbour after delete, list focuses itself → `useFileBrowser.ts`, `DeviceFiles.vue`
- [x] Context menu Preview, Open Folder / Open in App, Open Externally, Download, Delete → one shared menu (`FileMenu.vue`): Open (folder or file), Show details, Open on this computer, Download, Delete

Keyboard (`files/useFilesKeyboard.ts`)

- [x] ↑ ↓ (a row of tiles in grid), ← parent / previous, → open folder or details / next, Backspace, Delete, Enter → same; Backspace now also works in an empty folder

Details (was Preview)

- [x] Name, icon, path, type, size, modified and the actions → `files/FileDetails.vue` (path with copy, kind in words, permissions are new)

Actions and toasts (`files/useFileActions.ts`)

- [x] Delete → Cladd confirm instead of a hand-made overlay → "Deleted X" + refresh / "Could not delete X"
- [x] Open externally → "Opened X" / "Could not open X"
- [x] Download → "Downloaded X" (saved path) / "Could not download X"

Viewer (`files/FileViewerDialog.vue`, `useFileViewer.ts`)

- [x] Image, video, JSON, text → Cladd `Dialog` near full window; content released on close. Data R2c: the body (`ViewerBody`, the views per kind, read plan, sniffing, SQLite header) lives in `src/shared/file-viewer/` so Data › OPFS previews with it; Device keeps the dialog, header, gallery, adb reader and the "Open in Data › SQLite" route (`files/viewer/`), and passes the actions it offers (`ViewerActions`)
- [x] Name, kind, size, path, External, Download → header with chip and `IconAction`s
- [x] Gallery previous / next, ← →, "n / total" → same
- [x] Loading / error + toast → same, stale reads ignored

Unsupported file (`files/FileUnsupportedDialog.vue`)

- [x] Default app, Choose app…, Download → small Cladd dialog "No preview for .apk files"

New: places (Phone storage, Downloads, Apps' shared data, Temporary, Whole phone) above the tree,
and palette commands for reload, up, hidden files, search the phone and each place.

## Performance (`perf/`)

- [x] Starts on mount, stops on unmount → one monitor for the whole route in `perf/useDeviceVitals.ts` (provided by `DevicesPanel.vue`): it reads while Overview or Performance is shown, the device is online and the window is visible, so both tabs share one ADB lease and one history
- [x] Restarts on device and target change → unchanged in `perf/usePerfMetrics.ts`
- [x] Error banner + raw error → error notice with Try again (`DevicePerf.vue`)
- [x] Skeleton / waiting / overdue → one phase from `perf/perfView.ts` (tested) shown in `PerfStatusBar.vue`
- [x] CPU total, chart with time tooltip and crosshair, core count → `PerfCard` + `PerfChart.vue` (tones only when high)
- [x] Memory % + used / total + chart → same (memory warns from 85 %, Android keeps caches in memory)
- [x] Per-core % and mini charts → `PerfCores.vue` (sparklines)
- [x] Network rates and charts → one chart, download solid, upload dashed
- [x] Battery level, charging state, bar → `PerfPower.vue`
- [x] CPU temperature + source + not-exposed note, battery temperature → `PerfPower.vue` (source on hover)
- [x] WebView heap used / total and DOM nodes with now / average / peak → `PerfWebView.vue`
- [x] WebView status, source, last update, message → header of `PerfWebView.vue` (source on hover)
- [x] Gaps never drawn as zeros → `perfSeries.ts` (tested, plus `mergeSeries`, `seriesValues`, `tickTimestamp`)

New: Pause / Resume (status bar, Overview, palette `device.perf.toggle`), newest-reading clock, Stale phase.

### Bug: "waits forever" on the owner's phone — fixed

- Every probe the Rust loop runs was timed on the Redmi Note 14 over USB: `/proc/stat`,
  `/proc/meminfo`, `/proc/net/dev`, `dumpsys battery` answer in about 150 ms each; thermal zones are
  `Permission denied` (fast) and `dumpsys hardware_properties` answers. The pipeline was never stuck.
- `truth-perf-3min.png` showed "Waiting for the first reading…" after three minutes and never
  "No reading from the device yet", which only stays hidden when `tickCount > 0`: readings had arrived.
- Root cause: commit `8ad2045` put `v-else-if="isRunning"` (the waiting message) before
  `v-else-if="hasAnySample"` (the charts) in `DevicePerf.vue`. While monitoring runs `isRunning` is
  always true, so the message hid every reading, on every device.
- Fix: `perfPhase` / `hasPerfReadings` in `perf/perfView.ts` (test "readings arriving while the
  monitor runs are live, not waiting"). Verified live on the Redmi: values and charts update.
- Seen while verifying, not changed (Rust): `perf.rs` sums every interface, so on a phone sharing
  its connection (hotspot `ap0` + mobile `ccmni0`) forwarded traffic counts both ways and download
  ≈ upload. Each tick also re-runs every temperature probe (up to 9 shells per tick on this phone).

## Known, unchanged

- ~~Listing a symlinked folder (`/sdcard`, `/etc`) shows the link itself, and expanding it in the tree
  lists `/etc/etc` (toast).~~ Fixed in round 1: `adb_list_dir` lists every path but `/` with a
  trailing slash (`src-tauri/src/commands/files.rs`), so links show their contents.
- The old `adb_perf_start` / `adb_perf_stop` commands still exist and bypass the lease holders; the
  front end no longer calls them.
- `modules/app/AppIcon.vue` (another module) still keys its icon query by APK and icon path, so the
  same icon can be fetched once per module.

## Round 1 reshapes (review `device-review.md`)

Every line above stays reachable; these are the capabilities whose shape changed.

Shell and monitor

- One owner for the monitor (`perf/useDeviceVitals.ts` `createDeviceVitals`): a queue that clears
  the history when the phone changes, then starts or stops the lease. The perf lease is now held
  by name (`device-vitals` here, `recording` in `src/composables/usePerfRecorder.ts`); the stream
  stops only when the last holder leaves (`src-tauri/src/session/perf_holders.rs`), so Overview
  never ends a recording's stream.
- Phases (`perf/perfView.ts`): new `offline`; a monitor that is not running yet, or has no reading
  since it started, is `starting` / `waiting`, never `stale`.
- History is a ring buffer with a time per sample (`perf/sampleRing.ts`); charts use real times
  and show gaps after a pause.
- WebView metrics moved out of the route monitor into `perf/useWebViewMetrics.ts`, used only by
  Performance: one read at a time, 2 s timeout per call, `Performance.disable` on leave. It says
  "In the background" (hollow dot) when the app is not on screen.
- Sampling (Rust, `src-tauri/src/commands/perf/`): one shell per tick for the `/proc` files, the
  temperature probe found once per session, battery every 10 s, a 1 s interval.

Overview

- Vital tiles: the sparkline is a full-width band along the bottom; four tiles from a 42 rem panel
  (container query), two below.
- App card: name from `src/lib/target-app-name.ts` (same order as the title bar), package on hover
  only; "Open" becomes "Bring to front" while the app is in the background.

Apps

- List: 30 px rows, columns Name | Package (quiet mono) | State (System only in All, Disabled in
  warning) | actions; sortable by name or package; header outside the listbox,
  `aria-activedescendant`, row actions out of the tab order.
- Click selects (a double-click no longer clears it); Escape or the pane's Close clears. The
  resizable 64 / 36 split is replaced by `shared/DetailsPane.vue`, which opens on selection and
  collapses when nothing is selected (same pane in Files).
- `?package=` follows the selection both ways. A linked app the saved scope hides widens the scope
  for this visit only (`apps/useAppSelection.ts`).
- System apps: "Remove for this user" (`pm uninstall --user current`) with honest copy, instead of
  a false "Uninstall".
- Dates in words; "Came with the phone" for factory dates; Updated hidden unless after Installed.
  The install date now skips other users' epoch entries (`src-tauri/src/commands/package_times.rs`).
- Details wait 200 ms after the selection settles; sizes come from a 60 s `dumpsys diskstats`
  cache per phone (`src-tauri/src/commands/package_sizes.rs`).
- Icons: keyed by phone and package, three reads at a time newest first, dropped when the row goes
  away (`iconQueue.ts`), Rust gate of three (`icon_gate.rs`); an app without an icon shows a neutral
  tile with the first letter of its name and is not asked again.
- Layout toggle is two `IconAction`s (list, icons) in Apps and Files.

Files

- Opens on phone storage (`/storage/emulated/0`) or the last folder of that phone.
- Entries the shell cannot read show their name, "No access" and a dash, not `?` rows.
- Refresh keeps the tree branch until the new listing arrives (`useFileTree.reload`).
- Sorting by Modified compares dates; names sort naturally (`shared/collator.ts`); the listing is
  sorted once per listing and order, the filter runs after.
- Toolbar: "Auto-refresh: Off / 3 s / …"; Folder / Phone only while searching; one eye toggle.
- Whole-phone search needs three characters and gives up after 10 s.
- Keys keep working after clicking a button in a row; only text fields and menus keep their keys.
- Viewer rebuilt (`files/viewer/`, body shared from `src/shared/file-viewer/` since Data R2c): one view per kind (image with zoom and pan, video and audio
  from a Blob URL, text and code with highlighting and find, JSON text or tree, SQLite facts, hex
  for anything else), previous / next over every file of the folder, read caps decided from the
  listing size (`adb_read_file_bytes`, binary IPC). The separate "No preview" dialog is folded
  into the hex view, with the same Default app, Choose app… and Download actions.
