# App route parity

Route `/app` (rail: App, `g a`, palette "Go to App", maturity beta), children Overview, Performance
and Data Usage, all `meta.requires: "app-target"`, rendered through `GatedRouterView` (`AppPanel.vue`).

Written before the rewrite from the code at `f0e50371`. Paths are relative to
`apps/desktop/src/modules/app/` unless they start with `src/`. After the rewrite each line is
ticked with where it lives now (`→`).

## Decisions

**What the App route owns.** The app behind the selected target, while you debug it: whether it is
running, its process (memory, processor, threads), its WebView (heap, DOM nodes, Chromium version,
the Capacitor bridge and its plugins), its lifecycle (open or bring to front, restart, force stop,
clear data), its permissions (now changeable), its storage footprint and folders, and what Android
counted for it (traffic, battery). Device › Apps stays the place for every app on the phone, with
uninstall; Device › Overview keeps its one-line "App you are inspecting" card. The App header links
to Device › Apps (`?package=`), and the palette has "Show in the phone's app list".

**One implementation, shared.** Everything both routes show now lives in `src/shared/` and both
import it (module boundaries: no module imports another):

| Was (Device module or App module)                                                                            | Now                                                                                               |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `devices/AppIcon.vue`, `devices/iconQueue.ts`, and the App module's own `AppIcon.vue`                        | `src/shared/apps/AppIcon.vue`, `iconQueue.ts` (one query key, one queue)                          |
| `devices/apps/appsModel.ts` (names, folders, sizes, actions and their copy)                                  | `src/shared/apps/appIdentity.ts`, `appFolders.ts`, `appActions.ts` (list sorting stays in Device) |
| `devices/apps/AppSizeBreakdown.vue`, `AppFolderList.vue`                                                     | `src/shared/apps/`                                                                                |
| `devices/shared/DeviceConfirmDialog.vue`, `confirm.ts`; App's shadcn `ConfirmDialog`                         | `src/shared/components/presentation/ConfirmDialog.vue`, `confirm.ts`                              |
| `devices/shared/format.ts`, `dates.ts`, `collator.ts`                                                        | `src/shared/format/numbers.ts`, `dates.ts`, `collator.ts`                                         |
| `devices/overview/OverviewFacts.vue`                                                                         | `src/shared/facts/FactList.vue` (+ `fact.ts`, title prop)                                         |
| `devices/overview/VitalTile.vue`, `devices/shared/Sparkline.vue`, `sparkline.ts`                             | `src/shared/perf/`                                                                                |
| `devices/perf/PerfCard`, `PerfChart`, `PerfLegend`, `PerfStatusBar`, `perfSeries`, `sampleRing`, tones       | `src/shared/perf/` (`PerfStatusBar` takes a mark instead of a Device phase)                       |
| `devices/perf/useWebViewMetrics`, `webViewSample`, `webViewCopy`, `PerfWebView`; App's `useAppWebMetrics.ts` | `src/shared/perf/webview/` (the App copy is gone)                                                 |

**Tabs.** Data Usage merged into Performance as "Totals so far": it held two small cards of
counters about the same subject as Performance (what the app costs), and the owner dislikes tabs
that should be one view. `/app/data-usage` redirects to `/app/performance#totals`, which scrolls to
the section. Overview and Performance stay apart: Overview is identity, actions, storage and
permissions; Performance is time series.

**Logic.** `src/composables/useAppInspector.ts` had one user, this route. Its parsers moved
verbatim into the module (`process/`, `package/`, `usage/`), with tests, and its timers became
`process/useAppProcess.ts` (one owner above the gate) and TanStack queries (`package/usePackageDump.ts`,
`usage/useAppUsage.ts`). The bugs fixed on the way are listed at the end, each with a test.

## Shell of the route (`AppPanel.vue`, `routes.ts`)

- [x] `/app` redirects to `/app/overview` → `routes.ts`
- [x] Route names `app-overview`, `app-performance`, `app-data-usage`; tab labels Overview, Performance, Data Usage → `app-overview` and `app-performance` kept; `data-usage` is an unnamed redirect to `app-performance#totals`, so the tab row shows Overview · Performance (`routes.ts`, `perf/AppPerformance.vue` scrolls to `#totals`)
- [x] Gate `app-target` on every tab through `GatedRouterView` (remounts per target id, background notice strip from the gate) → unchanged (`AppPanel.vue`)
- [x] Sub-navigation tabs from route meta → unchanged (`src/components/layout/SubNavTabs.vue`)
- [x] Rail item, `g a`, palette "Go to App" → unchanged (`src/app/feature-registry.ts`)
- [x] No palette commands of its own → new provider `screen.app`, group "App" (new in `src/lib/commands/types.ts` and the palette order): Open / Bring to front, Restart, Force stop, Clear the data, Refresh details and permissions, Pause / Resume reading the app, Copy the package name, Show in the phone's app list (`useAppCommands.ts`)

## Subject and data

- [x] Subject = selected ADB target with a package; serial from the target, else the selected device → `subject/useInspectedApp.ts`; the package name must now pass `isPackageName` before any shell use (`subject/packageName.ts`, tested)
- [x] Installed-package entry from the "all" listing, else the persisted cache → the cached entry from either listing; only when the app is in neither is the phone asked, "third-party" first and then "all", once per app (round 1: system apps had no label or icon, and the listing was refetched on every mount). The cache lookup is reactive, so the title bar, gates, target list and Device's card pick the label up when it lands (`useInspectedApp.ts`, `src/composables/useAppPackages.ts`)
- [x] Package details query, 15 s stale → same IPC, shared key `["package-details", serial, package]` with Device, 60 s stale (`PACKAGE_CACHE_STALE_MS`), one query for both tabs
- [x] Package dump read once, shared by permissions, uid and Capacitor detection; Refresh re-reads it → the package details now carry the dump (`packageDump`, plus `userId` and `appId`, `src-tauri/src/commands/package_dump.rs`), which seeds the `["app-package-dump", …]` query; the dump is read on its own only to confirm a permission change (`package/usePackageDump.ts`)
- [x] Live process readings every 2.5 s → `process/useAppProcess.ts` (round 1): `/proc/<pid>/stat` and `status` every 2.5 s on their own ADB connection beside the command queue (`useAdb().readShell`), `dumpsys meminfo --local` every fourth reading, `timeout 5` on the phone and a 6 s give-up on the desktop, only while the phone is online, every 10 s while the app has no process, 5 → 10 → 20 s after failures; the process of the inspected Android user is picked by uid; history kept per phone and app in `process/appProcessHistory.store.ts`, so leaving the route keeps it; "read now" never restarts the loop; tested in `__tests__/useAppProcess.test.ts`
- [x] Parsers: meminfo, cpuinfo, permissions, xt_qtaguid, batterystats, Capacitor → `process/meminfo.ts` (App Summary), `process/procStat.ts` and `process/cpuMeter.ts` (replace `dumpsys cpuinfo`, whose window is minutes long), `package/permissions.ts` (per user), `package/capacitor.ts`, `usage/netstats.ts`, `usage/batterystats.ts` (uid block); tested against Android 16 output in `__tests__/android16.fixtures.ts`
- [x] Everything resets when the phone or package changes → process history by subject key; queries keyed by serial + package; the WebView probe by target id

## Overview (`overview/`)

Header (`overview/AppHeader.vue`, `overview/AppActions.vue`, `lifecycle/useAppLifecycle.ts`)

- [x] App icon → shared `AppIcon` (`src/shared/apps/AppIcon.vue`), greyed when the app is disabled
- [x] Name: label, else the package → `targetAppName` (label, page title, address), the order the title bar uses; the package is the h1's tooltip and the first fact with copy
- [x] Chips system / user, enabled / disabled, capacitor → only the notable ones: "System app", "Disabled" (yellow), from the app lists or, until they land, the package's own flags; the defaults are no longer chips; Capacitor moved to the "Bridge" fact with what the page itself reports
- [x] Package name line (mono) → "Package" fact (mono, quiet, copy) in About this app, plus the palette command
- [x] Open → toast "App launched" / "Failed to launch app" → "Open" ("Bring to front" with its icon while the app is in the background), solid only when it does something (not running, or in the background), quiet with a tooltip while the app is on screen: "X opened on the phone" / "Could not open X"; bringing forward re-probes presence instead of a toast; the phone starts it through the launcher intent, so a running task comes forward instead of stacking a second activity; DevTools is attached again when the link had dropped
- [x] Stop → confirm → `am force-stop` → "App force stopped" → "Force stop" → shared confirm ("Force stop X?", neutral) → "X was stopped" (copy shared with Device › Apps)
- [x] Clear → destructive confirm → `pm clear` → "App data cleared" + refetch, or "Clear data failed", any throw "Action failed" → "Clear data" → red confirm "Clear the data of X?" → "Data of X cleared" and details, dump, traffic and battery queries invalidated, or "Could not clear the data" with the output; a throw reads "Could not finish the action on X" (tested)
- [x] New: "Restart" (force stop, then open, "X restarted", then DevTools attached to the new process's page), buttons disabled while an action runs and a palette action asked for meanwhile refused with a toast, the process read again after every action, "Show in the phone's app list" and "Refresh the app's details" icon actions

App info strip

- [x] Origin of the WebView page → "Page" fact: origin, the page title beside it, the full address on hover and copy (`overview/appFacts.ts`)
- [x] Runtime: PSS · threads → "Right now" tiles Memory, Processor ("of 8 cores") and Threads, the Threads tile only once a value was read (`overview/AppVitals.vue`, shared `VitalTile`); the PID is said once, in the Process fact
- [x] Package: version name · target SDK → the "Version" and "Android" facts (round 1: no longer repeated in the header's state line)
- [x] Signals: network total · foreground CPU time → Performance › Totals so far (data used, processor time); shown where they are read rather than empty until another tab loaded them

Storage details

- [x] App size, Data, Cache, Total → shared `AppSizeBreakdown` (bar + legend, "Not reported by this phone") in Storage (`overview/AppStorage.vue`)
- [x] Version, Version code, SDK min / target, Memory rows → "Version" (name and code), "Android" ("Targets API 34, runs from API 23") facts; Memory is the Memory tile. New facts: Installed by, Installed, Updated (in words), WebView (Chromium version), Bridge, Process (PID or Not running)

Shortcuts

- [x] IndexedDB → `/storage/indexeddb`; SQLite → `/storage/sqlite` → "Open in Data": IndexedDB, Local storage, SQLite, OPFS (`overview/dataLinks.ts`)
- [x] Private data folder → Device › Files `?path=` → shared `AppFolderList` row "Private data"
- [x] External folder → "Android/data" row; the label and the target are now the same path (bug fixed); new rows Android/media, Android/obb and Installed package when the phone reports them (`src/shared/apps/appFolders.ts`, tested)

Permissions (`overview/permissions/`)

- [x] Loaded on open → the package dump query (read when the route opens, shared)
- [x] Counts runtime / granted / denied / sensitive → one quiet line "N asked while running · N allowed · N denied · N sensitive"; when every permission is sensitive, the count, the Sensitive filter and the "· sensitive" suffix are left out
- [x] Filters All / Sensitive / Granted / Denied (local) → Cladd `Segmented` All / Sensitive / Allowed / Denied, still local
- [x] Refresh (spinner) → the header's "Refresh the app's details" (round 1: the section's own refresh was a second button for the same read)
- [x] Error banner with the raw error → "The phone did not send the app's permissions." + raw error + Try again
- [x] Loading / "Refresh to load permissions" / "No permissions match filter" → "Reading the app's permissions" (spinner) / "The app asks for no permissions while it runs." / "No permission matches this filter." + Show all
- [x] Rows: shield, short name, full name, group, Granted / Denied, flags → TanStack Table rows (`PermissionsTable.vue`): plain name ("Access fine location") over the full Android name (quiet mono; name and flags in a Cladd tooltip), group with "· sensitive", a Cladd `Switch` beside Allowed / Denied
- [x] Order: denied, sensitive, group → default order "attention" (`permissionsView.ts`, tested); new sortable Permission / Group / State headers (third click returns to the default)
- [x] Install-time permissions as chips → "Granted when installed": plain muted names ("Internet"), the Android name on hover, from the install grants the phone lists
- [x] New: Allow / Deny per row with the switch (`pm grant` / `pm revoke --user <user>`, names checked before the shell; denying asks first because Android stops the app; disabled with the reason for system-fixed, policy-fixed and restricted (`APPLY_RESTRICTION`) permissions; the row shows the asked-for state and stays busy until the dump was read again; success only when Android reports the new state, else "Android kept X allowed"; the process read again after a deny) (`usePermissionChange.ts`, tested)

## Performance (`perf/`)

- [x] Error banner "Native runtime stream failed" → `PerfStatusBar` "Stopped" (red mark) + "The phone did not answer about the app's process." with the raw error and Try again (`perf/AppPerformance.vue`)
- [x] Memory composition bar and tiles Native / Dalvik / Code / Graphics / Stack / Other with MB and % → inside the Memory card: one bar and a compact legend grid from the App Summary, which adds up to the total: Java, Native, Graphics, Code, Stack, Other (hatched), Shared, Swapped (round 1: "Other" was 59–71 % because swap sat in the total but in no part); a neutral ramp instead of signal colours (`perf/MemoryComposition.vue`, `process/meminfo.ts`, tested)
- [x] Empty "Native memory breakdown appears once …" → "The parts of the app's memory appear once its process is running."
- [x] Header CPU now, total PSS, "Live 2.5s" / "Stopped" pill, PID → a top bar with only the newest reading time and "Pause readings" / "Resume readings" (`perf/ReadingBar.vue`); the state (Live / Starting / Paused / Not running / Stale / Stopped, "in the background, Android may freeze it") in the process section's header with its one Open / Bring to front; card values; PID in the Process fact
- [x] CPU timeline (0–100 %) with average and peak → Processor card: the app's share of all cores, like Device reads the phone (round 1: it was one core's percent, 113 % against Device's 35 %), a scale of at least 0–10 % that grows to 100 %, plain ink (never error red for a busy app), "Average · peak", and the app / system split below the chart
- [x] Native memory chart with average and peak → Memory card (MB axis)
- [x] Thread count chart with now → Threads card, "Average · peak", whole-number axis without repeated labels, shown once a value was read (from `/proc/<pid>/status`; Android 16's meminfo prints none)
- [x] 36-sample histories cleared on target change → five minutes per phone and app in a store (readings every 2.5 s, memory every 10 s), gaps when the app was not running or reading paused; every chart on the page shares one five-minute window and now-edge
- [x] WebView metrics: JS heap now, status word → shared `PerfWebView` (Live / Partial / Waiting / Stopped / In the background, with the source on hover)
- [x] JS heap chart (used, total) with peak; DOM nodes with peak → shared `PerfWebView`: heap used and allocated (dashed), average and peak for both, DOM nodes with average and peak
- [x] WebView reads with fallbacks, restart on target change, stop on leave → shared `useWebViewMetrics` (self-scheduling, the selected target's own link, a 2 s limit passed to every DevTools call, a fallback that failed once not asked again, paused with the window, the Pause button and while the app is in the background, the Performance domain shared with Device and session recordings and turned off by its last holder: `src/shared/perf/webview/performanceDomain.ts`)

## Data Usage (merged into Performance › Totals so far, `perf/AppTotals.vue`)

- [x] Loads network and battery counters when opened → TanStack queries when Performance opens, 30 s stale (`usage/useAppUsage.ts`)
- [x] Status strip Network / Battery Ready / Unavailable + Refresh → each card says its own state; one `IconAction` "Read the totals again" re-reads both counters (no longer the package dump)
- [x] Network: uid, refresh, error, skeleton, "xt_qtaguid is restricted", "Refresh to load" → "Data used" card: the error first, then a spinner only while reading (round 1: it spun forever when the dump failed), one line "Android 10 and later keep per-app traffic private; Network lists what the WebView loads." + "Open Network"; the uid quietly in the card's corner, for the inspected user (user 10 reads 1010406)
- [x] Wi-Fi received / sent, Mobile received / sent, Total transferred → rows Wi-Fi and Mobile data with ↓ / ↑ (screen-reader words Received / Sent), the total as the card value "Since the phone started"
- [x] Battery: refresh, error, skeleton, "Refresh to load", no-data copy → "Battery use" card: error, spinner, "No battery figures for this app since the last full charge." only when the phone printed no block for the app's uid
- [x] Foreground / Background CPU with bars, Wake locks when above zero → round 1, from the app's uid block only (numbers were read from other lines before): "Processor, in the app's own code" / "in the system for it" with bars (Android 16 prints `Total cpu time: u=… s=…`; older phones a line per process), "On screen", "Kept the phone awake" (partial wake locks) and "Kept the screen on" (full) when above zero; days and hours are counted; the processor sum is the card value
- [x] Raw `batterystats` output, folded → "Show what the phone printed": the app's block only, cut on the phone (folded, scrolls)

## Bugs fixed on the way (each with a test)

- Every App tab built its own inspector: moving between tabs restarted the readings and dropped the history, and Data Usage read meminfo and cpuinfo every 2.5 s for nothing → one owner above the gate (`appSession.ts`), only on Overview and Performance (`useAppProcess.test.ts`).
- `setInterval` with async bodies piled calls up on a slow phone; nothing paused with the window → self-scheduling reads, paused while hidden (`useAppProcess.test.ts`).
- A late answer about the previous app could land in the new app's history → generation ticket (`useAppProcess.test.ts`).
- `dumpsys cpuinfo | head -40` read 0 % for an app below line 40, needed a second shell, and matched any package starting with the same name (`com.app2`) → one shell, `grep -F`, exact package or `package:sub` (`processRead.test.ts`).
- `batterystats` durations in milliseconds alone ("850ms") were read as minutes (`usage.test.ts`).
- A package dump without a uid showed zero traffic as if it had been counted → "not shared" (`usage.test.ts`).
- The package name went into shell commands unchecked → `isPackageName` (`packageDump.test.ts`).
- The external folder label and its target differed → one path from `appFolders`.
- WebView metrics were a second implementation of Device's → the shared one (`Performance.disable` on leave, no pile-up).

## Round 1 (review fixes)

Reshaped by `app-review.md` round 1; the lines above are updated in place. New on top of them:

- A target whose WebView does not name a valid app (`unknown`, or a `:process` suffix, which the
  Rust side now strips) shows "This WebView does not name its app" with "Choose another WebView",
  under the gate (`UnknownAppNotice.vue`), instead of spinners that never end.
- One "Bring to front" per view (`src/composables/useBringToFrontOwner.ts`): the App routes own it
  (route meta `ownsBringToFront`: the Overview header, the Performance process header); elsewhere
  the phone column's pill while the stream shows, else the gate strip. The others only say the app
  is in the background.
- About this app › Bridge lists the plugins as quiet chips behind "N plugins"
  (`src/shared/facts/FactList.vue`, `chips`); every hover text there is a Cladd tooltip.
- The private data folder and `Android/data`, `media`, `obb` follow the Android user the app runs
  as (`/data/user/10/…`, `/storage/emulated/10/…`), and an updated system app's factory copy no
  longer overrides its version (`src-tauri/src/commands/package_dump.rs`, tested).

## Visual checks pending

Round 1 could not drive the app (the owner's window did not take the navigation keys, and it was
left alone), so nothing from round 1 was looked at. The checks of the first pass above still
stand where they are not replaced here. Check in the dev app with the Redmi and Presalio Retail:

1. App › Overview, app on screen: header without the version; "Open" quiet with its tooltip;
   Restart, Force stop, Clear data transparent.
2. Home on the phone: the header says "In the background" and "Bring to front" turns solid; the
   gate strip keeps its words but has no button; the phone column (open, streaming) shows no pill
   on App routes and keeps it on Network.
3. "Right now": Memory, Processor ("of 8 cores", one decimal below 10 %) and Threads (a number,
   not "—") tiles.
4. App › Performance: top bar with only the time and "Pause readings"; the process header with
   dot, "Live", the background sentence when away, and its own Bring to front; the Memory legend in
   a compact grid with Other hatched and Swapped as its own part, no part near 60 %; Processor close
   to Device's figure for the same moment; Threads with a whole-number axis; the WebView charts end
   at the same now-edge as the process charts.
5. Leave App for Network and come back: the process charts keep their history.
6. Totals so far: "Data used" with the one-line note, Open Network and "uid 10406" in the corner;
   "Battery use" with app code, system, on screen and kept the screen on; the folded block holds
   only the `u0a406` lines.
7. Permissions: switches in 30 px rows; denying asks first, the row shows Denied with a spinner until
   the re-read; a restricted permission is disabled with its tooltip; no Sensitive filter when every
   row is sensitive; "Granted when installed" as plain names.
8. Restart from the header: after the toast, the title-bar pill goes back to the app's page
   (DevTools attached again) within a few seconds.
9. The window narrowed to about 1000 px: the context pill truncates and "Record session" shows its
   dot only.
10. Network › Requests: an id-ending request reads "snapshot/…0001"; a request taking 1–3 s is in
    ink, over 3 s in the warning colour; an open long-poll says Pending only in Status, its Time
    counts up, Size "—". Network › Mocking names the app by its installed label.
11. Device › Overview and Device › Performance after the shared WebView monitor change: the WebView
    section says "In the background · Paused until the app is back on screen" while away.
