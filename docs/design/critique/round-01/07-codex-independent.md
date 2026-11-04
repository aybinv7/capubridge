# Round 01 · 07 · Independent review (Codex)

**Scope:** Part 1 is my blind pass, drafted before I opened the round-01 reports. I treated `panel-01-device.png` as Flows, excluded `panel-12-palette.png` from palette judgments, and did not assess the redacted mirror areas. Part 2 is a separate cross-examination. This was a read-only review; I did not run the app, builds, tests, or device actions.

## Part 1 — Blind review

### Severity-ranked findings

#### S0 — False device readings

**F01. Performance turns “no sample yet” into zero.** In `panel-04`, CPU, memory, and network show zero values while Per Core says “Waiting for CPU data.” The history arrays start filled with zeroes, the summary values fall back to zero, and the chart timestamp falls back to the current time. That presents missing data as a fresh measurement. ([usePerfMetrics.ts:26](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/devices/usePerfMetrics.ts:26), [DevicePerf.vue:243](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/devices/DevicePerf.vue:243), [DevicePerf.vue:88](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/devices/DevicePerf.vue:88))

_Fix direction:_ Use an explicit waiting or unavailable state until a real sample arrives. Timestamp the actual sample, and show the collection error when one exists.

**F02. Missing battery data becomes “Discharging.”** `panel-04` shows `--%` beside “Discharging.” When `battery` is null, the template’s conditional still selects that label. ([DevicePerf.vue:247](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/devices/DevicePerf.vue:247), [DevicePerf.vue:662](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/devices/DevicePerf.vue:662))

_Fix direction:_ Give battery state an explicit unknown value; show charging status only when a battery sample exists.

#### S1 — Trust and task flow

**F03. Network says “live” while the selected app is paused.** `panel-07` shows a green `live` pill while the context says `paused` and a banner says WebView data may be stale. The code sets capture status to `live` after enabling the CDP Network domain; that doesn’t tell the user whether the displayed requests are fresh. ([NetworkPanel.vue:131](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/network/NetworkPanel.vue:131), [useNetwork.ts:269](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/composables/useNetwork.ts:269))

_Fix direction:_ Show connection and event freshness separately, including the time of the last event.

**F04. IndexedDB absence is asserted while the WebView is paused.** In `panel-06`, “No IndexedDB databases found” appears below the paused-app notice. The empty-result branch does not distinguish “none exist” from “this target could not be read.” ([IDBExplorer.vue:716](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/storage/indexeddb/IDBExplorer.vue:716))

_Fix direction:_ Preserve last-known results with a stale marker, or say that the database list is unavailable while the target is paused.

**F05. “Flows” opens an agent prompt.** `panel-01` and `panel-10` land on “What should the agent do?” with a task-history rail. The rail route is registered as `Flows`; this first screen does not present a flow library or flow runs. ([feature-registry.ts:107](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/app/feature-registry.ts:107), [AgentWorkspace.vue:125](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/automation/AgentWorkspace.vue:125))

_Fix direction:_ Make flows and their runs the landing page. Put agent task creation and history in a separate, clearly named area.

**F06. “Device” names both a destination and a pane toggle.** The rail item opens device tooling; the title-bar “Device” control opens or closes the mirror pane. These labels point at different actions. ([feature-registry.ts:43](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/app/feature-registry.ts:43), [TitleBar.vue:182](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/components/layout/TitleBar.vue:182))

_Fix direction:_ Name the pane control “Mirror” and reserve “Device” for device management.

**F07. “App” and “Apps” describe different scopes with almost identical labels.** The rail’s `App` is the selected-app inspector; `Device > Apps` is the installed-package list. `panel-02` shows both navigation models at once. ([feature-registry.ts:54](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/app/feature-registry.ts:54), [devices/routes.ts:16](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/devices/routes.ts:16), [app/routes.ts:5](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/app/routes.ts:5))

_Fix direction:_ Put app selection in the shared device/app context and name the inspector by its job.

**F08. Installed-app counts disagree.** `panel-02` shows “84 apps” beside “75 user · 364 system” under the Third-party filter. The count and user/system breakdown come from separate calculations and can describe different package snapshots. ([DeviceAppsToolbar.vue:91](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/devices/DeviceAppsToolbar.vue:91), [DeviceApps.vue:134](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/devices/DeviceApps.vue:134))

_Fix direction:_ Derive all counts from the same package snapshot and label whether they apply to the filtered list or the whole device.

**F09. The agent composer overlaps the task-history rail.** In `panel-01` and `panel-10`, the composer starts around x=316 while the history rail ends around x=440. Its absolute footer is anchored to the outer workspace, while the main pane is not positioned; the form takes pointer events over the rail. ([AgentWorkspace.vue:122](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/automation/AgentWorkspace.vue:122), [AgentWorkspace.vue:183](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/automation/AgentWorkspace.vue:183))

_Fix direction:_ Anchor the footer to the main pane so the history rail retains its full hit area.

**F10. Settings rows look editable but are static text.** `panel-11` presents “English” and “Off” in preference rows whose descriptions say to set language and notifications. The slotted values are plain spans. ([SettingsGeneral.vue:10](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/settings/SettingsGeneral.vue:10), [SettingsGeneral.vue:18](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/settings/SettingsGeneral.vue:18))

_Fix direction:_ Implement the controls or remove the preference rows until they work.

**F11. The WebView’s native context menu appears over the app.** `panel-13-r5b-context-menu.png` shows browser actions such as Back, Refresh, Save as, Print, and Inspect over the blank app surface. These commands belong to the WebView shell, not the product’s data tools.

_Fix direction:_ Suppress the default context menu on app surfaces and expose only app-owned commands.

**F12. The website’s companion story conflicts with the stated product direction.** The hero still frames the product as an Android WebView workbench; the filesystem feature promises “No helper APK.” That conflicts with the required companion path and leaves the broader product category unstated. ([HeroSection.vue:66](C:/Users/aybin/code/ayb/capubridge/apps/website2/src/components/sections/HeroSection.vue:66), [features.ts:98](C:/Users/aybin/code/ayb/capubridge/apps/website2/src/data/features.ts:98))

_Fix direction:_ Rewrite the story around current ADB and debuggable-WebView capabilities, and describe the companion’s actual role once its scope is defined.

#### S2 — Craft, density, and missing detail

**F13. App names lose identifying information in the icon grid.** `panel-02` truncates some labels; the card template shows a name without a secondary package identifier. ([DeviceAppsList.vue:88](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/devices/DeviceAppsList.vue:88))

_Fix direction:_ Keep a readable app label, show the package as secondary text, and expose the full name on focus or hover.

**F14. Permission flags are raw and clipped.** `panel-05` shows an abbreviated flag value with no visible expansion affordance. The flags cell uses truncation and has no title. ([AppPermissionsTab.vue:205](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/app/AppPermissionsTab.vue:205))

_Fix direction:_ Display human-readable flag chips and reveal the complete value on demand.

**F15. The app overview repeats facts and leaves placeholders in the interface.** `panel-05` repeats memory, version, and SDK values across sections, while the Signals area contains placeholder-like values. The page needs a clear distinction between a missing signal and a repeated summary value.

_Fix direction:_ Keep each fact in one section and render unsupported signals as “Unavailable” with a reason.

**F16. Settings spends most of its dialog on blank space.** In `panel-11`, an 80vh by 80vw dialog contains two preference rows near the top. ([SettingsModal.vue:64](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/settings/SettingsModal.vue:64), [SettingsGeneral.vue:8](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/settings/SettingsGeneral.vue:8))

_Fix direction:_ Use a compact preferences layout until the settings content fills the modal.

**F17. Empty surfaces have different patterns, and task history has no empty state.** `panel-01` and `panel-10` leave the history rail blank. The IndexedDB sidebar, Elements panel, and Replay screen use different treatments for empty content. ([TaskHistoryRail.vue:99](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/automation/TaskHistoryRail.vue:99))

_Fix direction:_ Use one empty-state pattern with a cause and a next action; show a first-run task or flow action in history.

**F18. The SQLite grid clips headers while leaving unused width.** In `panel-13-r5b2-cladd-grid.png` and `panel-13-r5b2-grouped.png`, several column labels are shortened and the table stops well before the main pane’s right edge.

_Fix direction:_ Reallocate column widths from visible content and use the remaining space for the table or inspector.

**F19. Performance still imports retired shadcn components.** The Performance screen uses the shared Card and Chart modules even though the design rules call for retiring shadcn components where Cladd equivalents exist. ([DevicePerf.vue:16](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/devices/DevicePerf.vue:16), [DESIGN.md:89](C:/Users/aybin/code/ayb/capubridge/apps/desktop/DESIGN.md:89))

_Fix direction:_ Move the page to the shared Cladd surfaces and chart conventions.

**F20. The status bar is tiny mono prose.** Across the captures, status phrases such as mirror and CDP state are set in a 2xs monospaced style. The design guide reserves mono for data, code, and identifiers. ([StatusBar.vue:80](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/components/layout/StatusBar.vue:80), [DESIGN.md:53](C:/Users/aybin/code/ayb/capubridge/apps/desktop/DESIGN.md:53))

_Fix direction:_ Use UI typography for status phrases and reserve mono for identifiers and time values.

**F21. Files opens at the device root and renders opaque entries.** `panel-03` includes entries displayed as `?`, and the folder selector is clipped to “Current folde.” These problems make location and item identity hard to read.

_Fix direction:_ Keep the full location label visible and render unrecognised names with a safe escaped value plus a diagnostic.

**F22. Replay is an import action without a visible session library.** `panel-09-replay.png` offers “Open .capu file” and shows no session loaded. That is a valid empty state, but it leaves recent captures and their timeline absent from the product’s main recording surface.

_Fix direction:_ Add recent local sessions and link a stopped recording directly to its review.

#### S3 — Minor density

**F23. The Files grid repeats “Folder” under every folder tile.** `panel-03` labels each folder with a folder icon and an identical type line.

_Fix direction:_ Hide the redundant type line in a folder-only view.

The sweep covered layout and rhythm (F09, F16, F18); typography (F13, F14, F20); color semantics and depth (F03, F11); components (F10, F11, F17, F19); content and voice (F05, F12, F15); states and honesty (F01–F04, F10); and interaction (F09, F11).

### Scores

| Rubric dimension              | Score | Evidence                                                                                                                                                                                            |
| ----------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Positioning and narrative     |   4.5 | F12’s website story conflicts with the companion direction; F22 shows Replay without a library; F05 gives “Flows” an agent-first landing.                                                           |
| Brand identity                |   5.0 | F11 uses the recording color in the idle state; F20 styles routine status language as mono data; F22 leaves the time-based recording idea invisible.                                                |
| Information architecture      |   4.0 | F05, F06, and F07 mix flow authoring, device navigation, and app inspection under overlapping labels.                                                                                               |
| Core flows                    |   4.5 | F01 and F02 misstate device values; F04 obscures whether storage is empty or unreadable; F22 offers no recent-session path.                                                                         |
| Visual craft                  |   5.0 | F13 and F14 truncate identifiers; F16 wastes dialog area; F18 clips grid headers.                                                                                                                   |
| Component system fidelity     |   5.0 | F10 uses static settings content in preference rows; F11 exposes a native menu; F17 has no shared empty-state treatment; F19 diverges from Cladd.                                                   |
| States and honesty            |   3.5 | F01 and F02 fabricate certainty; F03 and F04 conflict with visible paused/stale state.                                                                                                              |
| Interaction quality           |   5.0 | F09 steals part of the history rail’s hit area; F10 presents inert preferences; F11 exposes shell-level actions.                                                                                    |
| Density and data presentation |   5.0 | F14 and F18 truncate data labels; F15 repeats summary facts; F23 spends space on redundant folder labels.                                                                                           |
| Differentiation               |   4.5 | Device, WebView, and storage inspection appear across `panel-02` through `panel-08`; F22 does not show those capabilities joined on a timeline; the website in F12 still leads with WebView panels. |

**Mean:** 4.55 → **4.6/10**. The lowest dimension is 3.5, which caps the overall at 5.5; the mean is already below that cap.

### Positioning and name

The honest current category is **Android app debugging workbench for developers**. A concise promise would be: _Inspect Android apps on connected devices, including debuggable WebViews; capture a session for later review._

“Flight recorder for Android apps” promises persistent, broad capture. The captures show a manual Record action and a Replay screen that opens a `.capu` file. They do not show always-on capture or a unified event timeline. SQLite recording exists in the configuration, but it is off by default. ([RecordingButton.vue:45](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/recording/RecordingButton.vue:45), [RecordingConfigModal.vue:37](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/recording/RecordingConfigModal.vue:37))

That phrase could become a future category after the product reliably captures and correlates screen, requests, logs, and data changes. It should not lead the current product. Android Studio already offers a Network Inspector with a request timeline and a Database Inspector with offline inspection after a process disconnect; Capubridge needs to prove that its cross-surface session evidence works as one task flow. [Android Studio Network Inspector](https://developer.android.com/studio/debug/network-profiler), [Android Studio Database Inspector](https://developer.android.com/studio/inspect/database)

**Yes, rename it.** “Capu” and “bridge” continue to prime the Capacitor ecosystem, which the owner wants to leave behind. Pick a runtime-neutral name before the companion’s first public release; Android treats a changed application ID as a different Play app after publication. Plan the desktop identity, settings/session migration, and MCP naming alongside the brand change. [Android application ID guidance](https://developer.android.com/build/configure-app-module)

### Information architecture

The current rail mixes object scope (`Device`, `App`), data types, protocols, outputs, and automation. It is not the right structure.

**Target:**

- Keep a persistent context header: selected device → app → process/WebView. Show ADB, CDP, and companion availability separately, with foreground state and last-update time.
- **Connect:** device inventory, pairing, installed apps, target selection.
- **Inspect:** Screen, UI tree, Console and Logcat, Network, Data, Performance, Files. Keep device-scope and app-scope visible within each lens.
- **Evidence:** capture controls, current timeline, local session library, imported sessions, Replay.
- **Automate:** manual flows, agent tasks, and run history as separate destinations.
- **Settings:** include pairing, companion permissions, and agent/MCP controls.

Keep the companion in Connect and in the context header as a first-class paired capability. Do not imply that pairing unlocks every app’s private data.

**Bold alternative — one investigation canvas:** Remove the permanent rail. The window opens to one live or recorded case: a chronological stream of screen moments, requests, logs, database changes, and automation steps, with an inspector dock for the selected event. Specialized views such as SQL and the DOM tree can expand full-screen. Build this only when timestamps and source freshness are reliable; otherwise the stream manufactures a correlation the product cannot support.

### Three changes with the largest score impact

1. **Make every state truthful.** Separate connection, target presence, capability, freshness, and collection errors. Replace false zeroes, false battery status, and ambiguous “live”/empty labels with explicit unknown or stale states.
2. **Make target context unambiguous and structurally consistent.** Keep device/app/target identity persistent; make agent overrides visible; separate Flows from Agent tasks; fix the composer/rail collision; make Replay a session library.
3. **Reposition and rename around reachable capability.** Replace the WebView-only story, publish the companion’s real boundaries, and show a session timeline only after the product can capture and correlate its contents.

## Part 2 — Cross-examination

### Findings and severities

**I missed a critical target-binding issue in the sealed pass.** `panel-01` and `panel-10` show an agent package selection that differs from the app in the global context. The orchestration code gives the selected composer package precedence over the current target. A user may have chosen that package intentionally, but the interface does not mark it as an override; a stale selection can send real actions to a different app. I agree with the red team’s S0 severity, with the fix aimed at explicit target provenance and confirmation when the composer target differs. ([06-red-team.md:51](C:/Users/aybin/code/ayb/capubridge/docs/design/critique/round-01/06-red-team.md:51), [runOrchestration.ts:124](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/automation/runOrchestration.ts:124), [AgentAppSelector.vue:31](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/automation/AgentAppSelector.vue:31))

**The composer overlap is my distinct blind finding.** The earlier reports note the empty history rail and the composer’s dead space, but I found no report calling out the clickable composer extending over the rail. `AgentWorkspace.vue:183` positions the footer against the workspace root; the form takes pointer events across part of the history rail in `panel-01` and `panel-10`. This is an S1 interaction defect.

**The performance zeros are confirmed; the red team’s pipeline diagnosis is wrong.** The report says the `error` state is never rendered. `DevicePerf.vue` has an error banner guarded by `v-if="error"` and prints the message when set. The supplied performance screenshot has no such banner, so the evidence does not establish a silent pipeline failure. It does establish the false zero problem: missing samples are presented numerically as zero. ([06-red-team.md:142](C:/Users/aybin/code/ayb/capubridge/docs/design/critique/round-01/06-red-team.md:142), [DevicePerf.vue:308](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/devices/DevicePerf.vue:308), [DevicePerf.vue:317](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/devices/DevicePerf.vue:317))

**I rate the paused Network and IndexedDB findings S1, not S0.** Both screens misuse certainty: Network’s `live` label conflicts with paused/stale context, and IndexedDB says none were found while the WebView is paused. The visible banner warns that values may be stale, and these screenshots do not prove that the app actually has IndexedDB data. The distinction is important for scoring; the fix remains explicit freshness and unavailable states. The red team’s S0 ratings overstate what the screenshots prove.

**The SQLite freshness finding needs narrower wording.** I agree that a local copy should expose when it was last refreshed. I disagree that CDP being paused proves the native SQLite rows are stale or that SQLite should be gated like IndexedDB: SQLite is read over ADB, and the screen has a per-database “app in background” marker for unreachable databases. The `1 ms` footer value is query duration (`result.durationMs`), not copy age. Add the actual last-pull time and retain the unreachable marker; don’t infer stale SQLite from a paused WebView. ([06-red-team.md:139](C:/Users/aybin/code/ayb/capubridge/docs/design/critique/round-01/06-red-team.md:139), [SQLiteExplorer.vue:1614](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/storage/sqlite/SQLiteExplorer.vue:1614), [SqliteBrowse.vue:351](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/storage/sqlite/browse/SqliteBrowse.vue:351))

**The idle red Record dot is S2, not S1.** It sits inside a button explicitly labelled “Record,” so it reads as an action affordance. The label differentiates it from an active recording indicator. The design guide’s timecode rule is still a useful consistency requirement, but this screenshot alone does not show that the user would mistake the button for an active recording. ([05-visual-craft.md:68](C:/Users/aybin/code/ayb/capubridge/docs/design/critique/round-01/05-visual-craft.md:68), [RecordingButton.vue:78](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/recording/RecordingButton.vue:78))

I also disagree with treating green HTTP `200` as a color defect. Green success status is expected. The actual color/state problem is the ambiguous green `live` pill beside a paused target, and the actual performance problem is the fabricated zero.

**Two screenshot conclusions remain unjudgeable.** The supplied mirror is redacted, so I cannot verify the red team’s mirror-streaming or privacy-leak claims. `panel-12-palette.png` is explicitly a Settings capture, so it provides no evidence of command-palette stacking. The equal `z-50` classes alone would not prove that the palette is hidden behind Settings.

**The red team found a real SQLite privacy risk.** The backend writes database copies under a host temporary directory and a device-side `/data/local/tmp` path. A failed pull can return before the device cleanup command; the host cache is removed on explicit close, but I found no caller of the close helper in the desktop source. That needs cleanup and retention rules before customer data is used. ([sqlite.rs:327](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src-tauri/src/commands/sqlite.rs:327), [sqlite.rs:349](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src-tauri/src/commands/sqlite.rs:349), [sqlite.rs:367](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src-tauri/src/commands/sqlite.rs:367))

The reports are right to flag broader website overclaims. The flagship copy promises native logs, APK installation, benchmarks, and scenario comparison; those claims need matching implementation or removal. ([06-red-team.md:63](C:/Users/aybin/code/ayb/capubridge/docs/design/critique/round-01/06-red-team.md:63), [FlagshipSection.vue:27](C:/Users/aybin/code/ayb/capubridge/apps/website2/src/components/sections/FlagshipSection.vue:27), [FlagshipSection.vue:40](C:/Users/aybin/code/ayb/capubridge/apps/website2/src/components/sections/FlagshipSection.vue:40), [FlagshipSection.vue:44](C:/Users/aybin/code/ayb/capubridge/apps/website2/src/components/sections/FlagshipSection.vue:44))

### Category, companion, and rename rulings

**Category:** I reject “flight recorder for Android apps” as the current category. The evidence shows manual session recording and file-based Replay, not continuous capture across Android apps. “Android app debugging workbench for developers” fits the product as shown. Chrome’s WebView debugging requires the app to enable WebView debugging, so the product cannot claim arbitrary WebView access. [Chrome’s WebView debugging guidance](https://developer.chrome.com/docs/devtools/remote-debugging/webviews)

The companion APK is a product requirement, with a platform boundary: Android assigns apps separate UIDs and sandboxes their private files. A generic companion cannot read another app’s private database merely by being installed. App-private capture needs an in-app debug SDK or a debuggable app accessed through the ADB/shell path. A companion can still add clearly scoped device-side capture, but its capability list must say what it actually observes. [Android application sandbox](https://developer.android.com/guide/components/fundamentals)

A field-capture design also has to account for background service limits: Android 12+ generally restricts starting foreground services from the background, with defined exceptions. Start capture from an explicit user action and make its active state and stop control visible. [Android foreground-service background-start restrictions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start)

**Rename:** Yes. Do it before the companion’s public listing. After distribution, a changed application ID is treated as a different app, so choose the new identity before publishing. ([Android app ID guidance](https://developer.android.com/build/configure-app-module)) The replacement name should be runtime-neutral; I would not approve a final name without checking its pronunciation, domain, and package migration plan.

### Scores and work order

The red team’s overall **4.7** and my **4.6** are effectively aligned. My IA score is lower (4.0 vs 5.0) because Device, the mirror pane, App, Device Apps, and Flows give overlapping scope cues. My differentiation score is lower (4.5 vs 5.0) because the cross-surface capability set is not yet visible as a reliable joined session. ([06-red-team.md:153](C:/Users/aybin/code/ayb/capubridge/docs/design/critique/round-01/06-red-team.md:153), [06-red-team.md:155](C:/Users/aybin/code/ayb/capubridge/docs/design/critique/round-01/06-red-team.md:155))

I agree with **honesty freeze first** as a release gate. Fix the false readings, paused/freshness ambiguity, agent target mismatch, and SQLite retention path before shipping claims or polishing affected flows. Keep companion feasibility work moving, but publish no broader data-access promise until its sandbox boundary is explicit.
