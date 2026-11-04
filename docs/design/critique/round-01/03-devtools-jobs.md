# Round 01 · Devtools practitioner: job teardown

Critic: devtools-practitioner (staff mobile engineer; daily user of Android Studio, chrome://inspect,
Proxyman, HTTP Toolkit, Perfetto, scrcpy, Sentry replay).
Evidence: `panel-01` … `panel-13-*` (1920×1020, real device, inspected app backgrounded in most shots),
source on `feat/ui-ux-overhaul` at `26f17f8`, and cited external documentation.

The single test: **how fast do I get from "something is wrong on that phone" to "I know why, and I can
prove it"**, and can I trust what is on screen while I do it?

---

## 0. Verdict in five lines

1. The capability base is genuinely rare: device, WebView, every client store (including OPFS SAH-pool
   SQLite), a mirror, recording with a database track, and an MCP surface in one process. No single
   reference tool has that set.
2. The live UI still **lies in four places on the screenshots** (S0). Each one makes me open a second
   tool to check, which defeats the point of having one.
3. The best thing in the product, Replay with database state on the same clock, is **buried**. It
   lands on a file picker, it is labelled beta, and it is not reachable from a live network row or a
   live table row.
4. "One clock. One context. One truth." is **a slogan today, not a mechanism**. The mechanism exists
   (`lib/gates/link.ts`, `lib/provenance.ts`), but only a handful of surfaces use it.
5. **Non-developer jobs are impossible today**: every one needs USB, developer options, a desktop and a
   debuggable WebView. Of all the parties to those jobs, only a companion app can change that.

## 1. Scores (RUBRIC.md anchors)

| Dimension                        | Score   | Ceiling reason                                                                                                                                                                                         |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4. Core flows                    | **4.5** | Four S0s sit inside core flows (F1–F4). Console and Logcat are hidden (F8), Replay lands on a dead end (F9), and the evidence a recording needs is off by default (F10).                               |
| 9. Density and data presentation | **5.0** | DOM attributes render without spaces (F5), perf charts are drawn from fabricated zeros (F1), and grid headers are truncated beside empty space (F17). The SQLite grid itself is the strongest surface. |
| 10. Differentiation              | **5.5** | The differentiator is real (Replay plus the DB track, storage breadth, MCP), but it is not central (F9, F10), not linked from live mode, and the non-developer and field story does not exist yet.     |

Under the rubric cap rule, Core flows below 6 caps the overall at 6.5, whatever the other critics find.

---

## 2. Findings, ranked by severity

Each finding gives its evidence, then a fix direction. "Opinion:" marks judgement without hard evidence.

### S0: broken or lying

**F1. The Performance page fabricates readings.**

- Evidence: CPU and Memory show a large green **0%** over flat zero lines; the CPU card says "0 cores";
  the Per Core header says "— live" while its body says "Waiting for CPU data…". Battery reads
  **"--% Discharging"** while the mirror's status bar shows the phone at 99% and charging.
  `panel-04-device-perf.png @ x110–1490, y130–400`, `@ x1040–1490, y640–800`, `@ x1540–1890, y108–128`.
- Code: `apps/desktop/src/modules/devices/usePerfMetrics.ts:17–30` seeds every history with zeros
  (`emptyHistory(0)`), so "no data" is drawn as "measured zero". `DevicePerf.vue:662` turns an
  unknown battery into "Discharging". `DevicePerf.vue:398` prints "0 cores". `DevicePerf.vue:469`
  hard-codes "Per Core — live".
- Why it matters: "the app is slow on a low-end phone" is the first question I bring to this page, and
  it answers "0% CPU". Of all the possible failures, a confident wrong number is the worst one.
- Fix: unknown renders as a gap or "—" with a reason. Never seed zeros. Battery reads "unknown" until
  read. The "live" suffix comes from link health.

**F2. IndexedDB asserts that no data exists, when it cannot know.**

- Evidence: the yellow banner says the app is in the background and values may be stale. The sidebar
  directly beneath it states "No IndexedDB databases found".
  `panel-06-data.png @ x95–280, y220–360` against `@ x95–980, y105–125`.
- Code: `modules/storage/indexeddb/IDBExplorer.vue:716–722` renders the empty state for any empty
  result, including a CDP call against a frozen process.
- Fix: when link health is `paused`, say "Can't read while the app is in the background", show the
  last known list with its read time, and keep "Bring app to front" as the primary action.

**F3. Network shows two truths on one screen.**

- Evidence: the Network capture pill reads **"live"** (green) while the global context chip and the
  status bar both read **"paused"**. `panel-07-network.png @ x140–200, y110–130` against
  `@ x1015–1085, y15–35` and `@ x320–420, y998–1015`.
- Code: `modules/network/NetworkPanel.vue:128–139` renders `store.captureStatus`, the state of the
  capture subscription, and ignores `deriveLinkHealth`. Yet `lib/gates/link.ts:4` calls that function
  _"The one answer to 'is the selected target live?', shared by every surface."_
- Fix: one health source. Capture state becomes a secondary detail ("subscribed, target paused").

**F4. The agent acts on a different app than the one in the global context.**

- Evidence: the header context is the retail app (live). The agent composer is bound to a different
  package, a test-bed recorder app. `panel-01-device.png @ x350–640, y685–705` against
  `@ x890–1080, y15–35`; the same holds in `panel-10-flows.png`.
- Code: `modules/automation/runOrchestration.ts:124–137` puts a sticky `selectedAppPackage` ahead of
  `targetsStore.selectedTarget`. The doc comment above it describes the opposite order.
- Why it is S0: the agent takes real device actions. Running them against the app the user is not
  looking at is the textbook "wrong state" failure.
- Fix: the global context wins. Divergence must be explicit, with a visible "pinned to another app"
  chip and a one-click reset.

### S1: trust-breaking

**F5. The DOM tree prints attributes glued together.**

- Evidence: `<htmllang="en"dir="ltr"data-rail="right"class="md …"`.
  `panel-08-elements.png @ x105–1500, y185–205`.
- Code: `modules/inspect/DomTreeNode.vue:305` and `:345` use `<span class="text-muted-foreground"> </span>`.
  A whitespace-only first/last child is removed by Vue's default `whitespace: 'condense'` compilation,
  so the separator renders empty. This is the most likely cause; I did not run the app.
- Fix: emit the space as `{{ " " }}`, or space the attributes with a margin. A developer spots this
  in one second, and it is the first line of the Elements panel.

**F6. App Overview points at another Android user's sandbox.**

- Evidence: the storage shortcut and internal path show `/data/user/10/<pkg>`, while the app's own
  requests load files from `/data/user/0/<pkg>/…`.
  `panel-05-app.png @ x1060–1480, y440–505` against `panel-07-network.png @ x255–925, y345–645`.
- Code: `src-tauri/src/commands/adb.rs:1468–1469`. Every `dataDir=` line in `dumpsys package`
  overwrites the previous one, so the last user listed wins on multi-user or dual-app devices.
- Fix: resolve the user of the running process and pick that user's `dataDir`. Show the user id when
  more than one is installed.

**F7. App counts mix two snapshots.**

- Evidence: the Third-party scope says "84 apps", and next to it "75 user · 364 system".
  `panel-02-device-apps.png @ x785–985, y112–132`.
- Code: `modules/devices/DeviceApps.vue:134–146` counts from a cached "all" query, while the visible
  list is a fresh scoped query.
- Fix: derive both numbers from one snapshot, or label the cached one with its age.

**F8. Console and Logcat are hidden by default.**

- Evidence: no screenshot shows either one. The only affordance is an 11 px "console" word in the
  status bar (`panel-* @ x1830–1905, y998–1015`).
- Code: `stores/dock.store.ts:70` gives `isOpen ?? false`. Logcat lives only in the dock
  (`components/dock/tabs/LogcatTab.vue`).
- Reference: Android Studio treats Logcat as a first-class tool window, with a query language
  (`package:mine level:WARN`, negation, regex)
  ([docs](https://developer.android.com/studio/debug/logcat)).
- Fix: on the first device connection, open the dock on Console, with an error count badge on the
  rail. Logcat is one keystroke away and scoped to the context package by default.

**F9. The flagship lands on a dead end.**

- Evidence: Replay says "No session loaded / Open a .capu file", and the rail tooltip labels it
  "beta". `panel-09-replay.png @ x700–890, y415–625`, `@ x0–160, y458–482`.
- Code: `modules/recording/ReplayView.vue:200–217`. A recordings library already exists
  (`ReplaySessionPicker.vue` lists sessions) but sits behind a modal.
- Fix: Replay opens on the library: recent sessions, their tracks, duration, errors and network
  failures per session. "Open file" becomes a secondary action.

**F10. Recording defaults omit the evidence the main jobs need.**

- Code: `modules/recording/RecordingConfigModal.vue:37` sets `trackSqlite = false`, and there is no
  Logcat track anywhere in `modules/recording`. For an app whose truth lives in SQLite (the
  screenshots show a SAH-pool database of about 5.6 MB), a default recording cannot answer "when did
  the record diverge?". Native crashes are invisible in Replay.
- Fix: the SQLite change track is on by default, sending diffs rather than snapshots; add a Logcat
  track filtered to the app's pid.

**F11. Network lacks the expert baseline.**

- Evidence: there is no Copy as cURL, no HAR export, no request replay and no throttling. A grep of
  `modules/network` finds none of them.
- Reference: Chrome DevTools has all four, and Proxyman and HTTP Toolkit add breakpoints and edit-replay.
- Fix: add Copy as cURL and fetch, HAR export of the current filter, and "replay in target" through
  `Runtime.evaluate`.

**F12. "0 B" on 200 responses.**

- Evidence: images and fetches served by the local Capacitor file server show a size of 0 B.
  `panel-07-network.png @ x1270–1305, y265–645`.
- Code: `NetworkRequests.vue:299–304` prints `transferSize` and maps a missing or zero value to "0 B".
- Fix: show the decoded body size, or "local (n KB)". Reserve "0 B" for genuinely empty bodies.

**F13. Rail tooltips sit on content, and core surfaces are labelled beta.**

- Evidence: "Network beta G N" covers the next rail item and the third request row's method cell.
  `panel-07-network.png @ x0–170, y330–355`. The same happens for "App beta G A" in
  `panel-05 @ x0–140, y200–220` and "Replay beta G R" in `panel-09`.
- Fix: place the tooltip to the right with an offset that clears the content area. Drop "beta" from
  App, Network and Replay, or explain what it means.

**F14. The Files screen is unreadable at its default location.**

- Evidence: two root entries are named "?". The tree and the grid show the same listing twice. The
  controls are truncated ("Manu", "Current folde"). Browsing starts at `/`, not at the app sandbox.
  `panel-03-device-files.png @ x355–805, y160–280`, `@ x90–200, y155–180`, `@ x1150–1290, y108–132`.
- Fix: start at the context app's sandbox. Show unreadable names as "(permission denied)" instead of
  "?". Use one listing.

**F15. Customer-specific code ships in the generic tool.**

- Code: `modules/automation/AutomationWorkbench.vue:284` and `:591` show a Presalio-only acceptance
  toggle when the package equals one client's package id.
- This contradicts the owner directive to widen the category. Fix: move it to a flow template or
  plugin, out of the shell.

**F16. The WebView2 browser context menu leaks.**

- Evidence: right-clicking an empty area of the SQLite screen opens Back, Refresh, Save as, Print and
  Inspect. `panel-13-r5b-context-menu.png @ x990–1290, y520–800`.
- A guard now exists (`composables/useNativeContextMenuGuard.ts`, added in `caef153`). **I could not
  verify** whether the screenshot predates it. Keep it on the regression list: "Back" navigates the
  app shell.

### S2: polish that costs trust

- **F17.** The SQLite grid truncates every header ("exter…", "att…", "sl…", "po…") while about 700 px
  to the right is empty. The row-number column duplicates `id`.
  `panel-13-r5b2-cladd-grid.png @ x385–1200, y250–270`; the empty area is `x1200–1900`. Fix: size
  columns to fit their headers and data, and let the last column flex.
- **F18.** Database names truncate to "com.g…" and "P…". While the app is paused, the SAH-pool
  database disappears from the list with no explanation.
  `panel-13-r5b-context-menu.png @ x75–305, y175–200`. Fix: keep it as "unavailable while paused".
- **F19.** Provenance carries a label but no age: "local copy" never says _when_ it was copied.
  `panel-13-r5b-sqlite-filter2.png @ x1710–1815, y965–982`. `ProvenanceTag` is used in only three
  components (`ReplayView`, `IDBExplorer`, `SqliteBrowse`), and never in Network, Performance, App
  or Elements. Fix: every provenance tag carries `read hh:mm:ss`.
- **F20.** The mirror shows another app in the foreground, while the inspected target is not
  labelled as hidden behind it. `panel-05 … panel-09 @ x1533–1905, y100–930`. Fix: overlay a small
  "foreground: <app>" chip in the mirror chrome (outside the native view).
- **F21.** Apps default to a launcher-style 6-per-row icon grid. 84 apps need about 14 rows of
  scrolling, and labels clip on both sides. `panel-02 @ x80–1015, y150–990`. Opinion: a dense list
  with package, version, debuggable and WebView flags is the developer view; the grid is for show.
- **F22.** The Elements tree opens as one collapsed, unwrapped line that runs off the right edge, with
  no breadcrumb. `panel-08 @ x95–1510, y185–205`.

### Not judgeable from this evidence

- `panel-01-device.png` shows the Flows agent screen, not Device Overview.
- `panel-12-palette.png` shows Settings, not the Ctrl+K palette.
- There are no screenshots of the Console or Logcat dock, a loaded Replay session, the Vue panel,
  Mocking or a manual flow.
- Live latency and refresh behaviour cannot be judged from stills.

---

## 3. Eight jobs, walked

The step counts are my counts from the cited documentation and my daily use. A "context switch" is a
change of tool or window.

### J1 · Developer: a sync failed on a field device; find the request, the stored record, and the moment they diverged

| Tool                                                    | Steps                           | Switches | Where it breaks                                                                                                                                                                                                                                                                                               | Blind to                                                                              |
| ------------------------------------------------------- | ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Android Studio (Network Inspector + Database Inspector) | ~9                              | 1        | Network Inspector covers only HttpsURLConnection and OkHttp, not WebView `fetch` ([docs](https://developer.android.com/studio/debug/network-profiler)). The Database Inspector sees native SQLite and Room only, with live updates read-only ([docs](https://developer.android.com/studio/inspect/database)). | WebView traffic, IndexedDB, OPFS SQLite, and any shared clock between request and row |
| chrome://inspect + DevTools                             | ~8                              | 2        | It sees fetch and IndexedDB, but not native SQLite or OPFS SAH-pool content. It needs the WebView debug flag ([docs](https://developer.chrome.com/docs/devtools/remote-debugging/webviews)). Nothing persists after the app restarts.                                                                         | Native DBs, the device, history before you opened it                                  |
| HTTP Toolkit / Proxyman                                 | ~10 including certificate setup | 2        | It sees every HTTP, native included, but system-store trust needs root, an emulator or app config ([HTTP Toolkit](https://httptoolkit.com/docs/guides/android/), [Proxyman](https://docs.proxyman.com/debug-devices/android-device/automatic-script-for-android-emulator)).                                   | Any stored state                                                                      |

**Capubridge today:**

1. Connect.
2. Context chip.
3. Network: filter by the sync URL and open the failed request.
4. Data, then SQLite: pick the database (a SAH-pool database _is_ visible, which is unique), pick the
   table, and type a WHERE clause.
5. Look for the row by hand.

That is about 7 steps with no tool switch, which already beats everything above. It then breaks:

- There is **no link from request to row**: no "rows changed within ±2 s of this request".
- If the app is backgrounded, F2 and F3 lie to me.
- "The moment it diverged" needs Replay with the DB track, which was **off unless I predicted it**
  (F10), and Replay opens on a file picker (F9).
- If the sync uses CapacitorHttp or a native plugin, the request never reaches CDP. Capubridge is
  blind exactly like Chrome, and nothing in the UI says so (no `CapacitorHttp` handling exists in
  `src`).

**Capubridge with the fixes:** request row, then "state at this moment", then a row diff, in 3 clicks.
That is the 10× moment (§4).

### J2 · Developer: the app is slow on a low-end phone

| Tool                                            | Steps                        | Switches | Where it breaks                                                                                                                                           | Blind to                                        |
| ----------------------------------------------- | ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Perfetto (UI or `android profiler systemtrace`) | ~6 to capture, plus analysis | 1–2      | It is expert-only; reading FrameTimeline is a skill ([Android CLI](https://developer.android.com/tools/agents/android-cli/commands/profiler_systemtrace)) | JS-level cause, storage size, network waterfall |
| Chrome DevTools Performance (remote)            | ~5                           | 1        | A long trace over USB is heavy on low-end WebViews                                                                                                        | Native and system contention                    |
| Android Studio Profiler                         | ~5                           | 1        | It needs a profileable or debuggable build                                                                                                                | WebView JS internals                            |

**Capubridge today:** Device, then Performance gives **"0% CPU, 0 cores, --% Discharging"** (F1). That
is a dead end with false data. App, then Performance exists, but I could not judge it (no
screenshot). There is no frame or jank signal, and no JS long-task lane in live mode. Replay has a perf
lane (`ReplayPerformanceLane.vue`), but only inside a recording.

**Verdict:** worse than parity until F1 is fixed. Opinion: the realistic win is not to rebuild Perfetto.
It is to put **long tasks, heap and DOM nodes from CDP, plus process CPU from ADB, on one strip next to
the mirror**, with a "capture Perfetto trace" button that hands off to ui.perfetto.dev.

### J3 · Developer: a native crash or plugin error; correlate Logcat with the JS console

| Tool                                             | Steps            | Switches | Where it breaks                                                                                                                                                                               |
| ------------------------------------------------ | ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android Studio Logcat + chrome://inspect console | ~6               | 2        | Two clocks (device and host), two windows, manual alignment                                                                                                                                   |
| Sentry (Android SDK)                             | ~4 after a crash | 1 (web)  | It needs the SDK in the app. Replay is about one snapshot per second, and Logcat and Timber are captured into Console ([docs](https://docs.sentry.io/product/explore/session-replay/mobile)). |

**Capubridge today:** open the dock (hidden, F8), then the Console tab, then the Logcat tab. Same
window, but **no interleaved view**: console and Logcat are separate tabs with no merged timeline,
and Replay has no Logcat track (F10). This is where "one clock" should be most obviously true, and it
is not.

**Verdict:** parity with Android Studio plus Chrome, minus one window. It is clearly better _only_
after a merged "app timeline" exists (console, Logcat for the pid, uncaught errors and failed requests
in one list).

### J4 · Developer: a layout breaks on one specific device

| Tool                            | Steps | Switches | Blind to                                    |
| ------------------------------- | ----- | -------- | ------------------------------------------- |
| chrome://inspect + scrcpy       | ~6    | 2        | Its screencast is laggy; scrcpy is separate |
| Android Studio Layout Inspector | ~4    | 1        | WebView content (a single opaque view)      |

**Capubridge today:** Elements has the inspect picker and the mirror side by side, in one window, which
is better than both in principle. But the tree reads `<htmllang="en"dir=…` (F5) and opens as one
collapsed line (F22). Styles, Computed and Box Model exist. Safe-area insets are visible in the
`style` attribute, a hybrid-specific win.

**Verdict:** potentially better. Today it is at parity with Chrome, with an S1 rendering defect on the
first line.

### J5 · Developer: seed or inspect local state to reproduce a bug

- Android Studio's Database Inspector edits native SQLite; it is read-only during live updates and
  offline mode ([docs](https://developer.android.com/studio/inspect/database)).
- Chrome DevTools edits IndexedDB and localStorage.
- **Capubridge** covers every client store, including SAH-pool and OPFS SQLite, which **neither
  reference can read**, and adds a WHERE filter, group-by, a row inspector and export
  (`panel-13-*`). The writes it supports go through the target, as they should. It also says
  honestly "read-only · local copy" on the SQLite grid.

**Verdict: clearly better on breadth.** The gaps are no copy age (F19), truncated headers (F17), and
the database disappearing while paused (F18).

### J6 · Non-developer (QA tester): reproduce a bug and hand the developer everything

| Tool           | Steps for QA               | Needs          | Gives the developer                                                                                                                                                                                                 |
| -------------- | -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instabug       | ~3 (shake, annotate, send) | SDK in the app | Repro steps (100 max), network logs (1,000 max, with interceptor setup), screen recording ([docs](https://docs.instabug.com/docs/android-logging), [replay](https://docs.instabug.com/docs/android-session-replay)) |
| Sentry replay  | 0 (automatic)              | SDK in the app | Replay, breadcrumbs, network list ([docs](https://docs.sentry.io/product/explore/session-replay/mobile))                                                                                                            |
| Android Studio | Not realistic for QA       | —              | —                                                                                                                                                                                                                   |

**Capubridge today:** QA needs a Windows desktop, USB debugging, a debuggable WebView, the context
chip set correctly, Record pressed **before** the bug, the correct tracks ticked (SQLite off by
default, F10), Stop, then export. That is about 9 steps with three expert prerequisites. The output
(.capu with DOM, network, console, perf and DB on one clock, sanitised export via
`RecordingSanitizeOptions`) is **richer than Instabug's or Sentry's**, and it needs no SDK. The
capture path, however, is built for developers.

**Verdict:** the evidence is better, the capture path is worse, and it is not usable by the persona.

### J7 · Non-developer (support agent or field technician): "my orders didn't sync" on a customer's phone, no developer setup

- Instabug and Sentry only work if the SDK shipped in that build, and they only see what the SDK
  hooks.
- HTTP Toolkit's Android app shows that a VPN-based companion can capture device traffic and stream it
  to a desktop ([docs](https://httptoolkit.com/docs/guides/android/)), but it has no app state.

**Capubridge today: impossible.** There is no USB, no developer options and no desktop at the
customer's location.

**Verdict: missing.** This job is the strongest case for the companion app (§5).

### J8 · Non-developer (QA): re-run a regression path on a new build

| Tool           | Steps | Notes                                                                                                |
| -------------- | ----- | ---------------------------------------------------------------------------------------------------- |
| Maestro Studio | ~4    | Mirror, click to inspect hierarchy, YAML flows ([docs](https://docs.maestro.dev/cli/view-hierarchy)) |

**Capubridge today:** the Flows rail lands on an **agent chat** ("What should the agent do?",
`panel-10`), with Task history empty. Manual flows exist (`AutomationWorkbench.vue`), but only behind
`needsFlow`. The agent is bound to the wrong app (F4), and a client-specific toggle lives in the
generic UI (F15).

**Verdict:** worse than Maestro for a QA tester today. Flows should land on saved flows with "Run on
this build", and the agent should be one way to _author_ a flow, not the front door.

### Scoreboard

| Job                            | Capubridge versus the best reference                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| J5 Seed or inspect local state | **Clearly better** (storage breadth no reference has)                                   |
| J1 Sync divergence             | **Better on steps, but blocked** by the missing request-to-row link and Replay defaults |
| J4 Device-specific layout      | **Parity** (would be better without F5 and F22)                                         |
| J3 Native and JS correlation   | **Parity** (no merged timeline)                                                         |
| J2 Slow on a low-end phone     | **Worse** (F1 actively misleads)                                                        |
| J8 QA regression run           | **Worse** than Maestro Studio                                                           |
| J6 QA hand-off                 | Better evidence, **worse capture**; net worse for the persona                           |
| J7 Field or support evidence   | **Missing**                                                                             |

---

## 4. The 10× moments only Capubridge can deliver, and where the UI puts them

Capubridge is the only tool that holds **the WebView's network, the WebView's storage (all of it), the
device and the screen of the same app, on the same host clock**. Every 10× moment comes from joining
them.

1. **Request ↔ row.** On any network row: "rows changed ±N s", meaning IndexedDB, SQLite and
   localStorage diffs around that request. On any row: "requests that touched this key". Today it is
   **absent** in live mode; in Replay the parts exist (`recording_db` diffs, `query_recording`
   correlation) but there is no UI join.
2. **Database time travel.** Scrub the timeline and see the table _as it was_ at the failed request.
   The pieces exist (`read_recording_db`, `ReplaySqliteTable.vue`), but they are **buried**: the track
   is off by default (F10), and Replay opens on a file picker and is labelled beta (F9).
3. **A flight recorder that is always on.** A rolling buffer (the last N minutes of network, console,
   Logcat for the pid, and DB diffs), so "Save the last 5 minutes" works _after_ the bug. This removes
   the "press Record before the bug" problem that kills J6. It is **absent**.
4. **An AI agent that reads evidence, not pixels.** MCP `query_recording` can already answer "console
   errors within 2 s of the 500". No reference tool exposes that to an agent. In the UI it is
   **invisible**: the agent surface is a device-action chat, not an "explain this recording" action.
5. **Field capture through the companion** (J7). This is **absent** today; it is a must under the
   owner's directive. See §5.

**Placement verdict:** none of the five is at the centre. The rail order (Device, App, Data, Network,
Elements, Replay, Flows) is a list of Chrome DevTools panels plus extras. Opinion: the centre should
be a **Session** surface with the mirror, a merged timeline (requests, console, Logcat, DB changes)
and evidence panes. The current panels become drill-downs from timeline items.

---

## 5. Companion app: role and boundaries, from a debugging practitioner

The owner has decided to build it; this section designs its role and boundaries.

**What it must give that ADB plus CDP cannot:**

- **Native HTTP visibility.** Use a VpnService capture, on the HTTP Toolkit model, for CapacitorHttp,
  native plugins and native screens. Today these are invisible to Capubridge and nothing says so.
  Certificate trust for HTTPS bodies is a hard limit on non-rooted devices for apps that do not opt in
  to user CAs. Say so in the UI; do not imply decryption.
- **Field capture without USB.** A notification action or shake starts a "Save last N minutes" flight
  recording and produces a sanitised `.capu` file. The technician shares it, and the developer opens
  it in Replay. This is J7.
- **Device truth that ADB reads poorly or late.** Battery, thermal, memory pressure, network type and
  foreground app, read directly. That fixes the "--% Discharging" class of defects at the source.
- **Accessibility tree** for native screens and Flows grounding where uiautomator is slow.

**Assumption to verify:** whether the companion can reach WebView DevTools sockets on-device. Chromium
restricts the peer uid of `webview_devtools_remote` sockets, so this probably needs a shell-uid route,
such as wireless-debugging pairing on the Shizuku model. If it is not feasible, field capture of DOM
and storage requires an opt-in SDK snippet in the app under test, which changes the product promise.
Prototype this first; everything in "field capture" depends on it.

**Boundaries:**

- It is never an SDK inside the customer's app by default.
- Nothing leaves the phone without an explicit share. Redaction runs on the device before export.
- A recording indicator is always visible while capturing.
- No root requirement for the core path.
- Read-only by default. Device writes stay behind the desktop's existing confirmations.

---

## 6. Ruling on the core ideas

**"One clock."** It holds only inside Replay. In live mode:

- the network list shows durations but no timestamps (`panel-07`);
- Performance has its own axis (`panel-04`);
- Console and Logcat are separate dock tabs;
- nothing aligns them.

**"One context."** It is violated three times on the screenshots:

- the agent's app differs from the header (F4);
- Network says "live" while the header says "paused" (F3);
- App Overview's data path belongs to another Android user (F6).

**"One truth."** It is violated by F1, F2 and F7. The building blocks are right: `deriveLinkHealth` is
exactly the right abstraction, and `PROVENANCE` has the right vocabulary. But each is adopted by a
handful of surfaces, and provenance has no notion of age.

**Ruling:** today it is a slogan. It becomes a mechanism when (a) every value-rendering component
takes `health` and `provenance` (with read time) as **required props**, so that a surface which
ignores them fails type-checking, and (b) a merged live timeline exists. Until then, the thesis
over-promises in marketing exactly what the UI breaks.

**Category (from this lens).** Logcat, Files, Apps, Performance, Mirror, native SQLite and Flows already
work on _any_ Android app; only Elements, Network, Console and the web stores need a WebView. Opinion:
the honest category is "the field debugger for Android apps: device, data and WebView, on one
timeline". "Capacitor" should become a detected-runtime badge (as on `panel-05`), not the identity.
Native-only apps currently land on empty WebView surfaces with no explanation; that has to become a
first-class state.

**Cut or demote. Experts value less noise:**

1. The Device Performance page as it stands. Merge it into one honest App Performance strip (F1).
2. The Apps icon-grid default. Make the list the default (F21).
3. Files at `/` by default. Start in the app sandbox, as one listing (F14).
4. The agent-chat-first Flows landing. Land on flows; the agent becomes a way to author them (J8).
5. The client-specific acceptance toggle (F15).
6. The duplicate serial and target id in both the title bar and the status bar. Pick one. It also
   leaks identifiers into every screenshot a QA tester shares.
7. "beta" on App, Network and Replay tooltips (F13). If they are beta, explain what is missing; if
   not, remove the label.

---

## 7. The three changes that move the score most

1. **Honesty pass on every live surface (fixes F1–F3, F7, F18, F19).** Route every value through
   `deriveLinkHealth` plus provenance with a read time. Never seed zeros. "Can't know" is a state with
   a reason and an action. This removes every S0 in core flows except F4, and F4 is a one-line
   precedence fix in `runOrchestration.ts:124–137`. Estimated effect: Core flows from 4.5 to about 6.5.
2. **Make Replay the centre, with an always-on flight recorder.** The library is the landing page.
   The SQLite diff track and a pid-scoped Logcat track are on by default. Add "Save last N minutes".
   Add the request ↔ row join in both live mode and Replay. This turns the unique capability into the
   visible product. Estimated effect: Differentiation from 5.5 to 7.5 or more.
3. **Companion app phase 1: field capture plus native HTTP plus device truth.** Spike the on-device
   DevTools-socket question first (§5). It unlocks J6 and J7 for non-developers, closes the native
   HTTP blind spot, and is the one capability no reference tool combines with app-state capture.
