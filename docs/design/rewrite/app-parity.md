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
- [x] Installed-package entry from the "all" listing, else the persisted cache → the "third-party" listing (an app under inspection is a user app, and listing every system package is slow), else the cached entry from either listing (`useInspectedApp.ts`)
- [x] Package details query, 15 s stale → same IPC, shared key `["package-details", serial, package]` with Device, 60 s stale (`PACKAGE_CACHE_STALE_MS`), one query for both tabs
- [x] Package dump read once, shared by permissions, uid and Capacitor detection; Refresh re-reads it → TanStack query `["app-package-dump", …]`, 30 s stale, derived permissions / Capacitor / uid (`package/usePackageDump.ts`)
- [x] Live process readings every 2.5 s → `process/useAppProcess.ts`: one shell per reading (`processRead.ts`), a self-scheduling timeout that waits for the previous read, only on Overview and Performance, paused while the window is hidden or by the person, late answers for another app dropped, history (5 min) cleared when the phone or package changes; tested in `__tests__/useAppProcess.test.ts`
- [x] Parsers: meminfo, cpuinfo, permissions, xt_qtaguid, batterystats, Capacitor → `process/meminfo.ts`, `process/cpuinfo.ts`, `package/permissions.ts`, `package/capacitor.ts`, `usage/netstats.ts`, `usage/batterystats.ts` (tests in `__tests__/processRead.test.ts`, `packageDump.test.ts`, `usage.test.ts`)
- [x] Everything resets when the phone or package changes → process history by subject key; queries keyed by serial + package; the WebView probe by target id

## Overview (`overview/`)

Header (`overview/AppHeader.vue`, `overview/AppActions.vue`, `lifecycle/useAppLifecycle.ts`)

- [x] App icon → shared `AppIcon` (`src/shared/apps/AppIcon.vue`), greyed when the app is disabled
- [x] Name: label, else the package → `targetAppName` (label, page title, address), the order the title bar uses; the package is the h1's tooltip and the first fact with copy
- [x] Chips system / user, enabled / disabled, capacitor → only the notable ones: "System app", "Disabled" (yellow); the defaults are no longer chips; Capacitor moved to the "Bridge" fact with what the page itself reports
- [x] Package name line (mono) → "Package" fact (mono, quiet, copy) in About this app, plus the palette command
- [x] Open → toast "App launched" / "Failed to launch app" → solid "Open" ("Bring to front" with its icon while the app is in the background): "X opened on the phone" / "Could not open X"; bringing forward re-probes presence instead of a toast
- [x] Stop → confirm → `am force-stop` → "App force stopped" → "Force stop" → shared confirm ("Force stop X?", neutral) → "X was stopped" (copy shared with Device › Apps)
- [x] Clear → destructive confirm → `pm clear` → "App data cleared" + refetch, or "Clear data failed", any throw "Action failed" → "Clear data" → red confirm "Clear the data of X?" → "Data of X cleared" and details, dump, traffic and battery queries invalidated, or "Could not clear the data" with the output; a throw reads "Could not finish the action on X" (tested)
- [x] New: "Restart" (force stop, then open, "X restarted"), buttons disabled while an action runs, the process read again after every action, "Show in the phone's app list" and "Refresh the app's details" icon actions

App info strip

- [x] Origin of the WebView page → "Page" fact: origin, the page title beside it, the full address on hover and copy (`overview/appFacts.ts`)
- [x] Runtime: PSS · threads → "Right now" tiles Memory (PID in the detail) and Threads (`overview/AppVitals.vue`, shared `VitalTile`)
- [x] Package: version name · target SDK → state line "Version 2.3.1 (45)" and the "Version" and "Android" facts
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
- [x] Counts runtime / granted / denied / sensitive → one quiet line "N asked while running · N allowed · N denied · N sensitive"
- [x] Filters All / Sensitive / Granted / Denied (local) → Cladd `Segmented` All / Sensitive / Allowed / Denied, still local
- [x] Refresh (spinner) → `IconAction` "Read the permissions again" (loading while reading)
- [x] Error banner with the raw error → "The phone did not send the app's permissions." + raw error + Try again
- [x] Loading / "Refresh to load permissions" / "No permissions match filter" → "Reading the app's permissions" (spinner) / "The app asks for no permissions while it runs." / "No permission matches this filter." + Show all
- [x] Rows: shield, short name, full name, group, Granted / Denied, flags → TanStack Table rows (`PermissionsTable.vue`): plain name ("Access fine location") over the full Android name (quiet mono; flags in its tooltip), group with "· sensitive", `StatusDot` + Allowed / Denied
- [x] Order: denied, sensitive, group → default order "attention" (`permissionsView.ts`, tested); new sortable Permission / Group / State headers (third click returns to the default)
- [x] Install-time permissions as chips → "Granted when installed" Cladd chips, prefix dropped
- [x] New: Allow / Deny per row (`pm grant` / `pm revoke`, names checked before the shell; denying asks first because Android stops the app; disabled with the reason for system- or policy-fixed permissions; the dump is read again, and the process after a deny) (`usePermissionChange.ts`)

## Performance (`perf/`)

- [x] Error banner "Native runtime stream failed" → `PerfStatusBar` "Stopped" (red mark) + "The phone did not answer about the app's process." with the raw error and Try again (`perf/AppPerformance.vue`)
- [x] Memory composition bar and tiles Native / Dalvik / Code / Graphics / Stack / Other with MB and % → inside the Memory card: one bar and a legend with size and share per part, "Dalvik" now reads "Java" with the hint "The Android (Dalvik / ART) heap"; a neutral ramp instead of signal colours (`perf/MemoryComposition.vue`, `process/meminfo.ts` `memoryComposition`, tested)
- [x] Empty "Native memory breakdown appears once …" → "The parts of the app's memory appear once its process is running."
- [x] Header CPU now, total PSS, "Live 2.5s" / "Stopped" pill, PID → status bar (Live / Starting / Paused / Not running / Stale / Stopped, newest reading time, Pause / Resume) and card values; PID in Overview's Memory tile and Process fact
- [x] CPU timeline (0–100 %) with average and peak → Processor card, same domain, "Average · peak", and the app / system split below the chart
- [x] Native memory chart with average and peak → Memory card (MB axis)
- [x] Thread count chart with now → Threads card, "Average · peak"
- [x] 36-sample histories cleared on target change → 120 timed samples (`SampleRing`), cleared when the phone or package changes, gaps when the app was not running or reading paused
- [x] WebView metrics: JS heap now, status word → shared `PerfWebView` (Live / Partial / Waiting / Stopped / In the background, with the source on hover)
- [x] JS heap chart (used, total) with peak; DOM nodes with peak → shared `PerfWebView`: heap used and allocated (dashed), average and peak for both, DOM nodes with average and peak
- [x] WebView reads with fallbacks, restart on target change, stop on leave → shared `useWebViewMetrics` (self-scheduling, 2 s timeout per call, `Performance.disable` on leave, paused with the window or the Pause button)

## Data Usage (merged into Performance › Totals so far, `perf/AppTotals.vue`)

- [x] Loads network and battery counters when opened → TanStack queries when Performance opens, 30 s stale (`usage/useAppUsage.ts`)
- [x] Status strip Network / Battery Ready / Unavailable + Refresh → each card says its own state; one `IconAction` "Read the totals again" re-reads the dump and both counters
- [x] Network: uid, refresh, error, skeleton, "xt_qtaguid is restricted", "Refresh to load" → "Data used" card: spinner "Reading the app's traffic counters", error with the raw text, "This phone keeps per-app traffic counters private." + why (Android 10 and later) + "Open Network"; the uid is no longer shown (an internal number)
- [x] Wi-Fi received / sent, Mobile received / sent, Total transferred → rows Wi-Fi and Mobile data with ↓ / ↑ (screen-reader words Received / Sent), the total as the card value "Since the phone started"
- [x] Battery: refresh, error, skeleton, "Refresh to load", no-data copy → "Battery use" card: spinner, error with raw text, "The phone has no battery figures for this app." + "They reset at every full charge, and some phones keep them private."
- [x] Foreground / Background CPU with bars, Wake locks when above zero → "Processor, on screen" / "Processor, in the background" with bars, "Kept the phone awake" (wake locks) when above zero; their sum is the card value
- [x] Raw `batterystats` output, folded → "Show what the phone printed" (folded, scrolls)

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

## Visual checks pending

The dev app was not running (only the installed release build), so nothing here was looked at.
Check in the dev app with the Redmi and Presalio Retail selected:

1. App › Overview, app on screen: header (icon 44 px, name, `Running` with a solid neutral dot, version in mono, no chips for a user app), the actions row (Open solid; Restart, Force stop, Clear data transparent), the two icon actions top right with their tooltips.
2. "Right now" tiles: three across at full width and one column when the panel is narrow (container query `@lg`), sparklines filling and the live dot on the newest point, PID in the Memory tile.
3. About this app: Package quiet mono with copy on hover, Page origin with the title beside it, WebView "Chrome …", Bridge "Capacitor · N plugins" with the plugin list on hover (or "from the package" when DevTools is not linked).
4. Storage: size bar, folder rows open Device › Files at the right path, the four "Open in Data" buttons.
5. Permissions: the summary line, the Segmented filter (selected segment foreground medium), rows at 30 px, Allow / Deny on the right, a policy-fixed one disabled with its tooltip, the deny confirmation, "Granted when installed" chips wrapping.
6. Press Home on the phone: the gate strip and the header both say "In the background", Open becomes "Bring to front", the WebView section says "In the background", process readings keep coming (Live).
7. Force stop from the header: the confirmation copy, then the header "Not running", the Process fact "Not running", the Memory tile "—"; App › Performance shows the "Open" notice above the charts and a gap in the charts.
8. App › Performance: status bar (dot, word, sentence, time, Pause), Memory card spanning two columns with the composition bar and legend (neutral ramp legible in Bench Dark and Light), Processor and Threads side by side from `@3xl`, the WebView section, then Totals so far.
9. Totals so far on the Redmi (Android 14): "Data used" should read "keeps per-app traffic counters private" with Open Network; "Battery use" with processor times, and "Show what the phone printed".
10. `/app/data-usage` (type it, or an old history entry) lands on Performance scrolled to Totals so far.
11. Palette (Ctrl+K) on the App route: the "App" group with the eight commands, titles naming the app.
12. Device › Apps, Device › Overview and Device › Performance after the move to `src/shared`: icons, size breakdown, folders, confirm dialogs, vitals tiles, charts, WebView section unchanged.
