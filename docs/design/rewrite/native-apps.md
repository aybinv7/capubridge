# Native apps (debuggable, no WebView)

A debuggable Android app that has no WebView (Room/SQLite, Compose, Views) can now be the active
context. Until v1, a target was always a WebView found through DevTools, so such an app could never
be picked even though most of Capubridge only needs its package and ADB.

## What v1 does

- **App target.** A `CDPTarget` with `type: "app"`, id `app:{serial}:{package}`,
  `url: "android-app://{package}"`, `source: "adb"`, the device serial and package, the app's label
  as its title, and no `webSocketDebuggerUrl`. Helpers live in `src/lib/app-target.ts`.
- **Discovery.** `adb_list_debuggable_packages(serial)` (`src-tauri/src/commands/debuggable.rs`) runs
  one `adb shell` loop over `pm list packages -3` and keeps the packages where `run-as <pkg> true`
  succeeds, with a 20 s timeout. About 2.5 s for 107 apps on a Redmi. The targets store caches the
  result per device, refreshes it with every target scan, and adds an app target for each package
  with no live WebView (the selected one stays even once a WebView of it appears). Labels come from
  the installed-apps cache (`useAppTargetLabels`, mounted in `AppShell`).
- **Device manager.** A "Debuggable apps" card after the WebView cards: icon, label, package as the
  quiet line, `native` on the active row. Picking one makes it the active context.
- **Activation.** Picking an app target releases the previous DevTools link and never connects.
  `connectionStore.connect` refuses an app target before touching any state. The console lease,
  network capture (`cdpTargetId` is empty), MCP `select_target`, the inspector, inspect-plugin
  detection, recording and the App lifecycle reattach all skip it.
- **Gates.** `target` screens show `needs-webview`: "{App} has no WebView", what works instead, and
  two actions: Open Data › SQLite, and Scan targets (which switches to the app's WebView if one is
  now live). `app-target` and `data` screens open for an app target.
- **Context bar.** The app's icon and label, then a quiet `native` where the link state would be.
- **Persistence.** The selected app target is saved by its `android-app://` address and restored
  once the next scan finds it, like a WebView target.

## What works for a native app

| Screen                               | State                                               |
| ------------------------------------ | --------------------------------------------------- |
| Device › Overview, Apps, Files, Perf | Works (needs a device only)                         |
| App › Overview, Performance          | Works over ADB; no page or bridge facts             |
| Data › SQLite                        | Works: lists and opens the app's databases (run-as) |
| Data › IndexedDB, Key-value, Cache…  | `needs-webview` gate                                |
| Logs                                 | `package:mine` follows the app's package            |
| Screen (mirror, controls)            | Works                                               |
| Inspect, Console, Network            | `needs-webview` gate                                |

## Next steps

- **Data lands on SQLite.** Opening Data with an app target should land on Data › SQLite, not on a
  `needs-webview` gate. The storage module is being rebuilt; this belongs there
  (`modules/storage/useDataAppCommands.ts`, the Data index route).
- **SharedPreferences in Key-value.** Read `shared_prefs/*.xml` through `run-as` and show them in
  Key-value for app targets (read, then edit with a write-back through `run-as`).
- **Native view tree in Elements.** `uiautomator dump` (or the accessibility tree) as a read-only
  Elements tree, with bounds drawn on the mirrored screen.
- **Native recording.** Screen, logcat and SQLite snapshots without a DevTools link; today a
  recording of an app target has no CDP tracks.
- **Network for native apps.** A proxy (or the companion app) to see OkHttp/Ktor traffic.
- **MCP.** `list_targets` should include app targets, and `select_target` should accept them.
- **Use a hybrid app without its WebView.** A debuggable app with a live WebView only offers its
  WebViews; an explicit "Use the app without its WebView" on its card would let Data › SQLite and
  App screens skip the DevTools link.
- **Scan feedback.** A failed debuggable-apps scan is kept in `targetsStore.appScanError` and logged,
  but the device manager does not show it yet.
- **Viewed, not active, devices.** The app list of a device viewed in the manager but not active is
  only filled after "Scan for WebViews and debuggable apps" there.
