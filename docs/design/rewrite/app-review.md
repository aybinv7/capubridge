# App route — review round 1

Reviewed commits `6c08457f` (shared move) and `2e0480fc` (App rewrite). Three reviews; the UI/UX
one ran live and also re-checked the Network fixes. Paths are relative to
`apps/desktop/src/modules/app/` unless they start with `src/`, `src-tauri/` or `packages/`.
Fix every blocker and major; fix minors unless noted.

## Parity and correctness

- **P1 — system/privileged apps lose label, icon and "System app" chip** in the title bar
  (`src/components/layout/ContextBar.vue`), `src/components/gate/GatedView.vue`,
  `src/components/device-manager/TargetList.vue`, Device's `OverviewApp.vue` and the App header:
  `subject/useInspectedApp.ts:43` fetches only third-party. Fall back to `ensurePackages("all")` when
  the app is in neither the third-party list nor the cache.
- **P2 — invalid package name leaves the screen stuck** (spinners forever, actions silently do
  nothing): Rust sends `"unknown"` or `com.foo:remote` (`src-tauri/src/commands/port_forward.rs:192-197`,
  `adb.rs:1709-1716`). Strip after `:`; when there is a target but no valid app, show an explicit
  message in `AppPanel.vue`. Never leave a disabled query rendering as loading.
- **P3 — "Data used" spins forever when `dumpsys package` fails** (`usage/useAppUsage.ts:44`,
  `perf/TotalsData.vue:42-48`, `perf/AppTotals.vue:38`): `isLoading`, error before loading.
- **P4 — Allow / Deny** (`overview/permissions/*`, `package/permissions.ts`):
  - reports success when Android ignored the change (restricted permissions, apps below API 23):
    verify the new state after the refetch; add `APPLY_RESTRICTION` to the fixed check;
  - acts on user 0: pass `--user <current user>` (the backend already resolves the current user,
    `src-tauri/src/commands/adb.rs:1238,1473-1479`); the owner's phone runs apps as user 10;
  - duplicates rows on multi-user phones: `parsePermissions` must read only the current user's
    section; add a multi-user fixture;
  - double click during the re-read sends the opposite change (`usePermissionChange.ts:51-66`): keep
    "changing" until the re-read lands, optimistic state;
  - `usePermissionChange` needs tests;
  - the private data folder assumes user 0 (`dataDir=/data/user/0/…`, `adb.rs:1412`).
- **P5 — CPU from a different process than memory** (`process/processRead.ts:12`, `process/cpuinfo.ts:12`):
  match by the PID.
- **P6 — battery durations drop days and hours** (`usage/batterystats.ts:3-11`): parse `d` and `h`.
- **P7 — palette-confirmed actions silently dropped while busy** (`lifecycle/useAppLifecycle.ts:49`,
  permission `apply()`): tell the user, or queue.
- **P8 — after Restart or Deny the DevTools connection drops and nothing reconnects**: reconnect the
  selected target when the app comes back (or say so with a Reconnect action).
- **P9 —** "Bring to front" via `am start -n` without MAIN/LAUNCHER can stack a second activity for
  standard-launch apps: use the launcher intent path (`monkey` or `am start -a MAIN -c LAUNCHER -n`).
- **P10 —** keep `uid` visible quietly in the "Data used" card; confirm the shared WebView monitor
  and `useWebViewRuntime` read the _selected_ target's connection, not just `activeConnection`.

## Performance

- **F1 major — readings occupy the phone's single command worker every 2.5 s, no time limit**
  (`process/useAppProcess.ts:66-82`, `src-tauri/src/session/job_queue.rs`, `device_session.rs`):
  run readings outside the serial worker (like package details) or honour a low priority; wrap in
  `timeout 5`; give up client-side after ~6 s.
- **F2 major — expensive and partly wrong readings** (`process/processRead.ts:11-12`): `/proc/<pid>/stat`
  and `/proc/<pid>/status` each tick (CPU from tick deltas, threads from `status`);
  `dumpsys meminfo --local <pkg>` every 4th tick (verify `--local` on the phone); stop polling
  `cpuinfo` faster than it refreshes.
- **F3 major — readings continue while the gate blocks** (`AppPanel.vue:13`, `process/useAppProcess.ts:44-46,76-81`):
  require the device online/authorised; back off 2.5→5→10→20 s on errors; 10 s while not running.
- **F4 major — shared WebView monitor polls a background app and piles up calls**
  (`src/shared/perf/webview/webViewSample.ts:18-37`, `packages/cdp-protocol/src/cdp/client.ts:47,108-126`,
  `runtime/useWebViewRuntime.ts:22-28`): pause while in the background; real `timeoutMs` passed to
  `client.send`; skip fallbacks after the first failure. Applies to Device too.
- **F5 major — `dumpsys package` read twice per app and again per refresh**
  (`src-tauri/src/commands/adb.rs:1364-1382`, `package/usePackageDump.ts:26`, `overview/AppOverview.vue:36-38`,
  `useAppCommands.ts:33-35`, `perf/AppTotals.vue:18-21`): one source; Totals refresh only counters.
- **F6 —** permission change re-reads the whole dump and re-enables buttons early (with P4).
- **F7 — leaving Performance may stop a recording's WebView metrics** (`src/shared/perf/webview/useWebViewMetrics.ts:56-65,106-128`,
  `src/composables/usePerfRecorder.ts`): count `Performance` domain holders per connection.
- **F8 —** chart stats rebuild for off-screen charts (`perf/ProcessCharts.vue:32-34`,
  `src/shared/perf/webview/PerfWebView.vue:37-39`); "About this app" re-renders per reading
  (`overview/AppOverview.vue:23-34`, watch the PID only); `AppPerformance.vue:25` builds an array for
  a yes/no.
- **F9 —** "read now" restarts the loop (status flickers to Starting, two reads back to back).
- **F10 —** `pm list packages -3` refetched on mount; take label/flags from details.
- **F11 —** WebView/bridge info cached per target only: key by page URL, re-read on foreground.

## UI/UX

- **U1 blocker — Battery use shows made-up numbers** (`usage/useAppUsage.ts:47` `| head -60`,
  `usage/batterystats.ts:19-28`): no `head`; find the app's uid block; parse Android 16's
  `Total cpu time: u=… s=…` and wake locks; `hasData` only when the block exists; fold only that
  block.
- **U2 major — Threads never shows a number** (with F2): read from `/proc/<pid>/status`; hide the tile
  and card until a value has been read; integer axis without repeated labels.
- **U3 major — Processor scale disagrees with Device** (113 % vs 35 % "8 cores";
  `perf/ProcessCharts.vue:13,74`, `overview/AppVitals.vue:28`, `src/shared/perf/tones.ts`): divide by
  cores like Device, or show "1.1 cores" with a 0–(cores×100) axis; same colour both tabs; never
  error red for a busy app.
- **U4 major — memory breakdown unreadable** ("Other" 59–71 %; `process/meminfo.ts`,
  `perf/MemoryComposition.vue`): parse the "App Summary" block (sums to the total), swapped memory
  as its own part, hatch Other, compact legend grid.
- **U5 major — background state said five times with three identical buttons**: one call to action
  per view; on App the header owns "Bring to front", the gate strip drops its button, the phone
  column's pill hides while the App header shows it; status reads "Live · in the background,
  Android may freeze it". Apply the same one-button rule at the shell level (Network showed two).
- **U6 major — "Open" is the solid primary while the app is on screen** (`overview/AppActions.vue:14-24`,
  `useAppCommands.ts:41-48`, Device's app card): solid only when it does something.
- **U7 major — charts don't share a time axis; history lost on route leave**: one window and now-edge
  for all charts on the page; process history in a store keyed by phone + app.
- **U8 minor —** repeated facts (version, PID, app/system split) once each.
- **U9 minor —** Allow/Deny as a Cladd `Switch` (deny still confirms), or a quiet outlined button
  on hover/focus with `tabindex="-1"`; rows ~30 px.
- **U10 minor —** hide "sensitive" count, filter and suffix when sensitive equals total.
- **U11 minor —** "Granted when installed" as plain muted names (`permissionLabel`), raw on hover.
- **U12 minor —** Cladd `HintTooltip` instead of `title` in `src/shared/facts/FactList.vue` and
  `PermissionsTable.vue`; plugins as an expandable row of quiet chips.
- **U13 minor —** remove the Permissions refresh (header refresh covers it).
- **U14 minor —** process status in its own section header; top bar keeps Pause and time only.
- **U15 minor —** Totals › Data used: no status dot as a bullet; one-line "kept private" note.
- **S1 (shell) —** at a 1002 px window the title-bar pill runs under "Record session"
  (`src/components/layout/TitleBar.vue`): let the pill truncate and the record button collapse to
  icon-only below a width.

## Network follow-ups (seen live)

- **N1 major — names ending in an ID** (`src/modules/network/requests/requestNames.ts:46-49`):
  UUID / digits / long hex → previous segment + short id ("snapshot/…0001"); same in the details
  header.
- **N2 —** two "Bring to front" buttons (strip and phone column): covered by U5's shell rule.
- **N3 —** Mocking names the app by page title (`src/modules/network/mock/NetworkMock.vue:36-37`):
  use the installed label like the title bar.
- **N4 —** a slow successful request's time in error red: warning colour or bold ink.
- **N5 —** an open long-poll: "Pending" in Status only, Time counts up live, Size "—".

## Round 1 fixes

Fixtures were captured read-only from the Redmi Note 14 (Android 16, API 36, a second user 10),
trimmed and anonymised in `__tests__/android16.fixtures.ts`. Findings from the phone that changed
the fixes: `dumpsys meminfo` prints no `Threads:` line on Android 16 (why U2 never showed a
number); the App Summary's "System" holds the swapped pages that the total counts (why U4's
"Other" was 59–71 %); `dumpsys cpuinfo` covers a window of several minutes, so it cannot feed a
2.5 s chart; the dump names the app `appId=`, not `userId=`; `batterystats --charged <pkg>` still
prints other uids' blocks; `dumpsys meminfo --local` works and does not wait on the app.

| Id  | Result | Where / how                                                                                                                                                                                                                                                                                                               |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Fixed  | `subject/useInspectedApp.ts`: cache first, then "third-party", then `ensurePackages("all")`, once per app; `useAppPackages.getCachedPackage` is reactive (bumped when a listing lands), so the title bar, gates, target list and Device's card update                                                                     |
| P2  | Fixed  | Rust strips `:process` (`package_from_cmdline`, tested); `subject/packageName.ts` `packageOfTarget`; `UnknownAppNotice.vue` under the gate; spinners use `isLoading`                                                                                                                                                      |
| P3  | Fixed  | Totals cards show the error first and spin only while fetching; the app id comes from the details                                                                                                                                                                                                                         |
| P4  | Fixed  | Verified after the re-read ("Android kept X allowed"); `APPLY_RESTRICTION` fixed; `pm grant/revoke --user <user>`; `parsePermissions(dump, user)` with a two-user fixture; busy and optimistic until the re-read; `usePermissionChange.test.ts`; Rust `dataDir` and external folders per user (`package_dump.rs`, tested) |
| P5  | Fixed  | One process per reading, picked by uid for the inspected user; memory taken from the same PID's meminfo section                                                                                                                                                                                                           |
| P6  | Fixed  | `durationMs` reads d / h / m / s / ms                                                                                                                                                                                                                                                                                     |
| P7  | Fixed  | A lifecycle or permission action asked for while another runs is refused with an info toast                                                                                                                                                                                                                               |
| P8  | Fixed  | `lifecycle/useReattach.ts`: after Restart, and after Open when the link had dropped, the phone is asked for the app's new page for up to 8 s and DevTools attaches to it; otherwise a toast points to the strip's Reconnect (after a Deny the gate strip offers it)                                                       |
| P9  | Fixed  | Rust `launcher_start_command`: `am start --user U -a MAIN -c LAUNCHER -n …` (tested)                                                                                                                                                                                                                                      |
| P10 | Fixed  | uid quietly in the "Data used" card; WebView metrics and the runtime probe read the selected target's own connection                                                                                                                                                                                                      |
| F1  | Fixed  | Readings go through `useAdb().readShell` (own ADB connection, like package details), `timeout 5` on the phone, 6 s give-up on the desktop; no Rust worker change was needed                                                                                                                                               |
| F2  | Fixed  | `/proc/<pid>/stat` + `status` each reading (CPU from tick deltas over `/proc/uptime`, threads from `status`); `dumpsys meminfo --local` every fourth reading; `dumpsys cpuinfo` dropped                                                                                                                                   |
| F3  | Fixed  | Only while the phone is online; 5 → 10 → 20 s after failures; 10 s without a process                                                                                                                                                                                                                                      |
| F4  | Fixed  | Shared monitor pauses while the app is in the background (Device too), passes `timeoutMs` to `client.send`, stops asking a fallback that failed                                                                                                                                                                           |
| F5  | Fixed  | Package details carry the dump, `userId`, `appId` (Rust); the dump query is seeded from them; Totals refresh only the counters; the palette refresh reads the details once                                                                                                                                                |
| F6  | Fixed  | With P4                                                                                                                                                                                                                                                                                                                   |
| F7  | Fixed  | `shared/perf/webview/performanceDomain.ts` counts holders per client; the recorder and both screens share it (tested)                                                                                                                                                                                                     |
| F8  | Fixed  | Chart stats only while on screen (process and WebView); facts depend on the PID, not the reading; `hasReadings` instead of an array                                                                                                                                                                                       |
| F9  | Fixed  | `readNow` reads once (or right after the reading in flight) and keeps the loop and its start time                                                                                                                                                                                                                         |
| F10 | Fixed  | No listing on mount when the app is cached; flags fall back to the package's own flags                                                                                                                                                                                                                                    |
| F11 | Fixed  | Runtime probe keyed by target and page address, read again when the app returns to the foreground                                                                                                                                                                                                                         |
| U1  | Fixed  | Battery read from the app's uid block only, cut on the phone with `sed`; Android 16's `Total cpu time: u=… s=…`, on screen, partial / full wake locks; `hasData` only with a block                                                                                                                                        |
| U2  | Fixed  | Threads from `/proc/<pid>/status`; tile and card hidden until read; integer axis                                                                                                                                                                                                                                          |
| U3  | Fixed  | Share of all cores like Device, "of 8 cores", readable 0–10 %+ scale, plain ink on both tabs                                                                                                                                                                                                                              |
| U4  | Fixed  | App Summary parts that add up to the total, Swapped split out of System, Other hatched (`fill-hatch`), compact legend grid with Cladd tooltips                                                                                                                                                                            |
| U5  | Fixed  | `useBringToFrontOwner`: App routes own it (Overview header, Performance process header); the strip drops its button; the phone column's pill hides on App routes; status "Live · In the background, Android may freeze it."; the shell rule applies everywhere (Network: pill or strip, never both)                       |
| U6  | Fixed  | Open is solid only when the app is stopped or in the background; same on Device's app card                                                                                                                                                                                                                                |
| U7  | Fixed  | One five-minute window and now-edge for the process and WebView charts (`PerfChart` `xDomain`); process history in `appProcessHistory.store.ts` per phone and app                                                                                                                                                         |
| U8  | Fixed  | Version only in facts, PID only in the Process fact, app / system split only on Performance                                                                                                                                                                                                                               |
| U9  | Fixed  | Cladd `Switch` per row (deny still confirms), rows 30 px                                                                                                                                                                                                                                                                  |
| U10 | Fixed  | Count, filter and suffix hidden when every permission is sensitive                                                                                                                                                                                                                                                        |
| U11 | Fixed  | Plain muted names, the Android name in a tooltip                                                                                                                                                                                                                                                                          |
| U12 | Fixed  | `HintTooltip` in `FactList`, `PermissionsTable`, `UsageRow`, the header name; plugins as expandable quiet chips                                                                                                                                                                                                           |
| U13 | Fixed  | Permissions refresh removed                                                                                                                                                                                                                                                                                               |
| U14 | Fixed  | Status in the process section header; the top bar keeps the time and Pause only (`ReadingBar.vue`)                                                                                                                                                                                                                        |
| U15 | Fixed  | No status dot; one-line note                                                                                                                                                                                                                                                                                              |
| S1  | Fixed  | Title bar grid lets the pill column shrink (`minmax(0,auto)`, sides at least their content); "Record session" collapses to its dot under a 64 rem title bar (container query)                                                                                                                                             |
| N1  | Fixed  | `requestNames.ts`: UUID / digits / long hex → "snapshot/…0001" (small numbers whole); the details header uses the same parts                                                                                                                                                                                              |
| N2  | Fixed  | By U5's shell rule                                                                                                                                                                                                                                                                                                        |
| N3  | Fixed  | Mocking names the app by its installed label                                                                                                                                                                                                                                                                              |
| N4  | Fixed  | 1–3 s in ink, over 3 s in the warning colour; error red stays for failures                                                                                                                                                                                                                                                |
| N5  | Fixed  | Pending only in Status; Time counts up live from one shared clock (`PendingTime.vue`, `pendingClock.ts`); Size "—"                                                                                                                                                                                                        |

Nothing skipped. Beyond the list: Rust package details took `dataDir=` from the last user section
(user 10 on the owner's phone) and the version from a hidden factory copy of updated system apps;
both fixed in `package_dump.rs`. The phone column's pill named the app by its page title; it now
uses the installed label. Round 1 was not looked at live (see the parity file's pending checks).
