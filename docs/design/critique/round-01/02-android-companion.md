# Round 01 · 02 · Android platform and companion app

Critic: `android-platform-architect` · Date: 2026-11-04 · Branch: `feat/ui-ux-overhaul` · Tag: [AI-assisted]

Scope: what ADB and CDP cannot reach, or where they mislead, and the design of the companion app the
owner has decided to build. Evidence comes from the screenshots in the panel evidence pack, the Rust
command layer (`apps/desktop/src-tauri/src/commands/*.rs`), the CDP package, and cited Android sources.
Anything I could not verify is marked **Assumption**. No source file was edited, and no app, build or
device command was run.

---

## 0. Verdict in five lines

1. The biggest lies in the product today are not fixed by a companion. They come from code that renders
   _unknown_ as _empty, zero or foreground_. Several have an **ADB-only** fix that the code does not use
   (`am unfreeze`, `dumpsys activity`, `exit-info`, `run-as --user`).
2. A companion app **cannot** do CDP on its own. Chromium accepts a WebView DevTools socket connection
   only from root, the `shell` user, or the app's own UID. CDP therefore stays on the shell side (ADB),
   or moves into an **in-app SDK** that runs under the app's UID. This one fact decides the architecture.
3. Capubridge already runs two unowned on-device helpers as the shell user: an AGPL `aya` dex and a
   scrcpy server downloaded as "latest" without a checksum. Neither is authenticated. "No helper APK"
   is technically true and misleading in substance.
4. The right design has four tiers, not one APK: **ADB truth fixes → one owned shell-UID agent →
   companion APK (presence, consent, cable-less capture) → optional debug SDK (native HTTP, SQLite
   write tap, own-WebView CDP relay)**.
5. The companion is where the non-developer story becomes real (QA, support, field). It must never
   drive the UI autonomously through AccessibilityService. Play policy forbids that outright, and
   Capubridge's agent ("Jev") is exactly that use case.

---

## 1. Scores (RUBRIC.md anchors; only the dimensions this role can judge)

| Dimension               | Score          | Justification (findings below)                                                                                                                                               |
| ----------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7. States and honesty   | **4.0**        | Four open S0s (F1–F4): frozen shown as empty, unknown shown as foreground, two Android users mixed under one app name, perf zeros and wrong battery state.                   |
| 4. Core flows           | **4.5**        | No non-developer flow exists without a cable and a desktop. Recovering from the background state needs guesswork (F1, F2). The SQLite timeline is polled, not observed (F5). |
| 10. Differentiation     | **6.0**        | A single-clock replay with database tracks is real and rare. Its device reach is capped by ADB and CDP, and native traffic and native writes are invisible (F5, F9).         |
| 1. Positioning (device) | **5.0**        | The website promises private-path access and "no helper" (F10). The MCP guidance tells agents something false (F2). The SDK story is Capacitor-bound (`@cavulsqa/recorder`). |
| 2, 3, 5, 6, 8, 9        | **not judged** | These are outside this role. Other critics cover them.                                                                                                                       |

By rubric rule, no judged dimension can exceed 7 while these S0 and S1 findings are open.

---

## 2. Findings: where Capubridge fails or lies today (severity first)

### S0: broken or lying

**F1 · A frozen process is rendered as "no data".**

- **Evidence:** `panel-06-data.png @ x95–285, y220–300`. The sidebar says "No IndexedDB databases found"
  under a banner that says the app is in the background. The app has databases. CDP simply cannot
  reach a frozen process.
- **Platform fact:** cached processes are frozen on Android 11+ via the cached apps freezer, and on
  Android 14 a process is frozen about 10 s after it enters the cached state
  ([AOSP: cached apps freezer](https://source.android.com/docs/core/perf/cached-apps-freezer)).
- **Fix:** a fourth state, "unreadable: process frozen", must replace the empty-state copy wherever a
  CDP read times out. Never draw "none found" from a failed read.

**F2 · The MCP tool guidance states a falsehood, which pushes agents into a disruptive workaround.**

- **Evidence:** `apps/desktop/src-tauri/src/mcp/tools/web.rs:18` says there is "no reliable way to
  query a backgrounded app", and that the only override is the device-wide `use_freezer false` plus a
  reboot. Agents are told to call `launch_app`, which steals the user's screen.
- **Platform fact:** AOSP documents per-process `adb shell am freeze <process>` and
  `am unfreeze <process>`. The shell command also accepts `--sticky`, which keeps the state until the
  shell reverses it
  ([AOSP freezer doc](https://source.android.com/docs/core/perf/cached-apps-freezer);
  [AOSP commit "Fix 'am freeze' for multiprocess apps"](https://gitlab.e.foundation/e/os/android_frameworks_base/-/commit/a301a338ccfb3eff2360ff749abb2a238efff5e4)).
  Frozen status is readable with `dumpsys activity` ("Apps frozen:").
- **Assumption:** the exact first release that ships `am unfreeze` is unverified. It is present on
  Android 14+ freezer builds. Probe at runtime and fall back.
- **Fix:** add an explicit "Keep `<app>` awake while inspecting" toggle. It runs
  `am unfreeze --sticky` on opt-in and the reverse on session end or disconnect, and the UI shows it
  as a device mutation. Rewrite the MCP text to match.

**F3 · Presence maps "unknown" to "foreground", and "no answer" to "background".**

- **Evidence:** `apps/desktop/src/lib/gates/presence.ts:24-27` sends `case "unknown"` to
  `{ presence: "foreground" }`. `target_probe.rs:35-36` documents that "unresponsive" means the
  process was frozen _or the forward died_, and `presence.ts:28-36` turns both into "background".
  The titlebar and status bar then assert "live" or "paused" (`panel-01-device.png @ x1030–1075, y24`;
  `panel-06-data.png @ x320–420, y1006`).
- **Contradiction:** `panel-07-network.png @ x145–200, y120` shows a green "live" pill under a
  "paused" context chip.
- **Fix:** derive presence from the OS, not the DevTools listing. Read the top resumed activity and
  the frozen list from `dumpsys activity` over ADB, and from the shell agent's `IActivityTaskManager`
  listener once T1 exists. Show "unknown" as unknown.

**F4 · Two Android users are mixed under one app name.**

- **Evidence:** the App page resolves the current user (`adb.rs:197`, `am get-current-user`) and shows
  the app's data under `/data/user/10/…` (`panel-05-app.png @ x1060–1480, y445–505`). SQLite discovery
  and reads hard-code `/data/data/{package}/databases` and call `run-as` with no `--user`
  (`sqlite.rs:450`, `sqlite.rs:990`, `sqlite.rs:1059`, `sqlite.rs:237`, `sqlite.rs:351`).
  `/data/data` resolves to user 0. The Network panel shows WebView URLs under `/data/user/0/…`
  (`panel-07-network.png @ rows y355–635`).
- **Result:** on a device with a secondary user, a work profile, or an OEM "second space"
  (this device is a Xiaomi build: `panel-03-device-files.png` shows `mi_ext`, `cust`), the product can
  show user-10 metadata next to user-0 databases and traffic, labelled as one app.
- **Fix:** make the Android user part of the target identity (`serial / user / package / process`),
  pass `--user` everywhere `run-as`, `pm` and `am` are called, and show the user in the context chip.
- **Assumption:** `run-as --user` availability by API level was not verified.

### S1: trust-breaking

**F5 · SQLite "evidence" is a torn, polled copy, not an observation.**

- **Torn copy:** `pull_db_bytes` copies the main file, then each of `-wal` and `-shm` in separate
  `run-as cat` round-trips with no lock (`sqlite.rs:325-333`, `sqlite.rs:342-368`). A write between
  pulls yields an inconsistent snapshot.
- **Polled, not observed:** the recorder re-reads every row of every table on a timer
  (`useSqliteRecorder.ts:200`, `useSqliteRecorder.ts:119-145`). A change's `tMs` is therefore the poll
  time, not the write time, and intermediate states between polls are lost. Cost grows linearly with
  database size. The "single clock" promise is approximate for databases and the UI does not say so.
- **Fix:**
  - **Now:** copy the db and its WAL in a single `run-as … tar` stream via `exec-out` (one process,
    smaller window), and label database lanes with "sampled every N s".
  - **Later:** an SDK write tap (§3, tier T3).

**F6 · Unknown is rendered as zero, and the battery state is wrong.**

- **Evidence:** `panel-04-device-perf.png`:
  - CPU "0%", Memory "0%" and "0 cores" appear while per-core data is still "Waiting for CPU data…"
    (`@ x115–770, y140–370`).
  - Battery shows "--% Discharging" (`@ x1057–1140, y700–760`), while the mirrored status bar shows the
    phone charging (`@ x1848–1882, y110–125`).
  - Source: `perf.rs:405-410` parses `/proc/stat`, `/proc/meminfo` and `dumpsys battery`.
- **Fix:** use "—" for no sample, never 0. The charging state must come from the same source as the
  level. The companion can supply both from the sticky `ACTION_BATTERY_CHANGED` broadcast with no
  permission ([BatteryManager](https://developer.android.com/reference/android/os/BatteryManager)).

**F7 · Unauthenticated shell-UID helpers on fixed abstract socket names.**

- **Evidence:** `adb.rs:65` (`localabstract:aya`), `adb.rs:485-500` (the dex is launched with
  `app_process` as the shell user and runs until reboot), and `mirror.rs:81` (`localabstract:scrcpy`).
- **Why it matters:**
  - Abstract-namespace sockets have no filesystem permissions. Access control is whatever the server
    checks plus SELinux.
  - Upstream scrcpy appends a random `scid` to its socket name so that instances do not collide.
    Capubridge does not, so two hosts, or a stale server, collide
    ([scrcpy develop.md](https://github.com/Genymobile/scrcpy/blob/master/doc/develop.md)).
  - **Assumption:** whether SELinux stops `untrusted_app` from connecting to a shell-domain abstract
    socket on all OEM builds was not verified. Do not rely on it.
- **Fix:** use a per-session random socket name, check `SO_PEERCRED` (accept only uid 2000) and a
  session token, and stop the server on session end.

**F8 · Supply chain: unpinned remote code executed as the shell user, plus an AGPL binary of unknown provenance.**

- **scrcpy server:** it is resolved from GitHub `releases/latest` at runtime and selected by name
  prefix only, with no digest check (`mirror.rs:91-92`, `mirror.rs:560-580`). It is then pushed and run
  as the shell user. The v4 flag-shift comment at `mirror.rs:84-87` shows that "latest" has already
  broken the protocol once.
- **Device-helper dex:** `capubridge-device-helper.dex` (529 KB, class `io.liriliri.aya.Server`) is
  embedded via `include_bytes!` (`adb.rs:66`). `resources/README.md` does not record it, and the
  project is MIT while upstream aya is AGPL-3.0 ([liriliri/aya](https://github.com/liriliri/aya)).
- **Action:** the licence question is outside technical scope and should be **escalated to the Tech
  Lead or Direction**. Technically, pin both artefacts with a SHA-256 checksum and replace them with
  one owned agent (T1).

**F9 · Native HTTP traffic is invisible, and the UI does not say so.**

- **Evidence:** `panel-07-network.png @ x95–295, y160` reads "10 requests · 80 KB transferred" as if
  that were complete. The only disclosure is buried in MCP text (`web.rs:183`). CDP's Network domain
  covers WebView traffic only.
- **Fix:** add a scope line, "WebView traffic only · native HTTP needs the SDK", and the T3 SDK
  interceptor.

**F11 · No lifecycle or crash signal, though ADB exposes one.**

- **Evidence:** the App page's "SIGNALS" cell is empty (`panel-05-app.png @ x1160–1260, y285–320`).
  There is no use of `logcat -b crash` or exit-info anywhere in `commands/` (grep).
- **Platform fact:** `ApplicationExitInfo` (API 30+) records the reason for each process death:
  crash, ANR, low memory, killed by the user, and so on. Reading another package's history needs the
  `DUMP` permission, which the shell user holds
  ([ApplicationExitInfo](https://developer.android.com/reference/android/app/ApplicationExitInfo);
  [getHistoricalProcessExitReasons](<https://developer.android.com/reference/android/app/ActivityManager#getHistoricalProcessExitReasons(java.lang.String,%20int,%20int)>)).
- **Assumption:** the `dumpsys activity exit-info <pkg>` output format must be verified per API level.
- **Fix:** add a "Process" lane (start, freeze, unfreeze, death with reason) to the timeline, fed by
  ADB now and by the agent later.

### S2: polish (platform-truth only)

**F10 · The website overclaims.** `apps/website2/src/data/features.ts:98` promises "app-private and
protected locations". `run-as` works only for debuggable apps (see `files.rs:506-507`, which says so
itself). "No helper APK, no second program" is also misleading: two shell-UID programs are pushed to
`/data/local/tmp`. **Fix:** say "app-private data of your debuggable builds" and describe the agent
honestly.

**F12 · Unstat-able root entries are drawn as folders named "?".** See
`panel-03-device-files.png @ x355–805, y160–280`. These are entries the shell user cannot `stat`
(SELinux). **Fix:** render them as "restricted entry" with a lock, not as a folder.

**F13 · The context and the agent target disagree.** In `panel-01-device.png @ x350–640, y695`, the
agent's app picker names a different package from the context chip (`@ x890–1075, y24`). The
"foreground app is guessed" problem is visible in the UI. **Fix:** one context source, fed by OS
truth (F3).

---

## 3. What each tier can reach: capability matrix

**Tiers:**

- **T0 · ADB only:** the shell user over USB or wireless debugging.
- **T1 · Shell agent:** one owned dex started via `app_process` as uid 2000. It is the scrcpy and
  Maestro-driver pattern. It needs ADB to start and dies on reboot.
- **T2 · Companion APK:** its own UID, installed, persistent, with user-facing UI.
- **T3 · Debug SDK:** an optional Android library linked into the user's app. It runs as the app's UID
  and ships as a `debugImplementation` with a no-op release variant, as Chucker and LeakCanary do.

**Hard boundary:** a WebView's DevTools socket accepts only root, `shell`, or the server's own UID
([Chromium `devtools_auth.cc`](https://chromium.googlesource.com/chromium/src/+/main/content/browser/android/devtools_auth.cc)).
So:

| Tier   | Can it do CDP?                |
| ------ | ----------------------------- |
| T0, T1 | Yes                           |
| T3     | Yes, for its own WebView only |
| T2     | **Never**                     |

**Matrix legend:**

- **Needs:** D = debuggable target · R = root · S = Shizuku or wireless self-ADB · G(x) = a user or
  ADB grant of x · — = nothing.
- **Play risk:** applies to T2 if it is listed on Play.
- **Value:** Dev / Non-dev, on a 0–3 scale.

| #   | Capability                                      | Tier    | Mechanism                                                                                                                                                                                                                                                                                                            | Needs                                                                                                                                                            | Min API                                      | Play risk                                                                                                                                                                                    | Value Dev/Non-dev |
| --- | ----------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | Keep the inspected app unfrozen                 | T0      | `am unfreeze --sticky <proc>` ([AOSP](https://source.android.com/docs/core/perf/cached-apps-freezer))                                                                                                                                                                                                                | —                                                                                                                                                                | 30 (freezer); **Assumption:** command on 34+ | n/a                                                                                                                                                                                          | 3/1               |
| 1b  | Same, via a bind                                | T2+T3   | The companion foreground service binds the SDK's protected service, so the target is no longer cached ([process lifecycle](https://developer.android.com/guide/components/activities/process-lifecycle))                                                                                                             | T3 present                                                                                                                                                       | 26                                           | Low                                                                                                                                                                                          | 3/2               |
| 2   | Frozen and foreground truth                     | T0 / T1 | `dumpsys activity` ("Apps frozen:", top resumed); T1: hidden `IActivityTaskManager` listener. API 36: `IBinder.addFrozenStateChangeCallback` (AOSP freezer doc)                                                                                                                                                      | —                                                                                                                                                                | 30                                           | n/a                                                                                                                                                                                          | 3/2               |
| 3   | Foreground app (unprivileged)                   | T2      | `UsageStatsManager` `ACTIVITY_RESUMED` events ([UsageStatsManager](https://developer.android.com/reference/android/app/usage/UsageStatsManager))                                                                                                                                                                     | G(`PACKAGE_USAGE_STATS`): a settings toggle, or `appops set` over ADB                                                                                            | 29 for `ACTIVITY_RESUMED`                    | Low (special access)                                                                                                                                                                         | 1/3               |
| 4   | Process death reason (crash, ANR, LMK)          | T0      | `ApplicationExitInfo` via shell `DUMP` ([ref](https://developer.android.com/reference/android/app/ApplicationExitInfo))                                                                                                                                                                                              | —                                                                                                                                                                | 30                                           | n/a                                                                                                                                                                                          | 3/3               |
| 5   | Crash stack in the moment                       | T3      | `Thread.setDefaultUncaughtExceptionHandler` + native signal hooks                                                                                                                                                                                                                                                    | T3                                                                                                                                                               | 21                                           | n/a                                                                                                                                                                                          | 3/3               |
| 6   | WebView CDP with no cable                       | T3      | The SDK connects to its _own_ `webview_devtools_remote_<pid>` (same UID is allowed) and relays it to the companion or desktop                                                                                                                                                                                        | T3, `setWebContentsDebuggingEnabled(true)` ([WebView](<https://developer.android.com/reference/android/webkit/WebView#setWebContentsDebuggingEnabled(boolean)>)) | 19                                           | n/a (debug builds)                                                                                                                                                                           | 3/2               |
| 7   | Native HTTP (OkHttp, HttpURLConnection, Cronet) | T3      | Interceptor or `URLStreamHandler` wrapper (the Chucker model)                                                                                                                                                                                                                                                        | T3                                                                                                                                                               | 21                                           | n/a                                                                                                                                                                                          | 3/2               |
| 7b  | Native HTTP, no SDK, debuggable                 | T0      | JVMTI agent via `cmd activity attach-agent` (the Android Studio Network Inspector model) ([ART TI](https://source.android.com/docs/core/runtime/art-ti); [Network Inspector](https://developer.android.com/studio/debug/network-profiler))                                                                           | D                                                                                                                                                                | 26                                           | n/a                                                                                                                                                                                          | 3/0               |
| 7c  | Native HTTP, no SDK, any app                    | T2      | `VpnService` + local MITM; TLS needs a CA the app trusts, and user CAs are untrusted for targetSdk 24+ unless `debug-overrides` is set ([VpnService](https://developer.android.com/reference/android/net/VpnService); [network security config](https://developer.android.com/privacy-and-security/security-config)) | G(VPN consent); R for a system CA on 14+ ([HTTP Toolkit](https://httptoolkit.com/blog/android-14-install-system-ca-certificate/))                                | 21                                           | **Medium–high:** a VPN declaration is required; "network debugging" is not a listed category ([policy](https://support.google.com/googleplay/android-developer/answer/12564964))             | 2/1               |
| 8   | SQLite write tap (row-level, write-time)        | T3      | Wrap `SupportSQLiteOpenHelper` (Room) and the Capacitor or RN SQLite plugin; `sqlite3_update_hook` in native builds                                                                                                                                                                                                  | T3                                                                                                                                                               | 21                                           | n/a                                                                                                                                                                                          | 3/2               |
| 8b  | SQLite live query, no SDK, debuggable           | T0      | JVMTI agent (the Android Studio Database Inspector model) ([Database Inspector](https://developer.android.com/studio/inspect/database))                                                                                                                                                                              | D                                                                                                                                                                | 26                                           | n/a                                                                                                                                                                                          | 3/0               |
| 9   | SQLite _writes_ back to native databases        | T3 / 8b | Execute inside the app process; never write a pulled copy back                                                                                                                                                                                                                                                       | T3 or D                                                                                                                                                          | 26                                           | n/a                                                                                                                                                                                          | 3/0               |
| 10  | Frozen-proof storage read                       | T0      | `run-as` streams files from disk (`app_webview/…` IndexedDB LevelDB, OPFS) while the process is frozen. **Assumption:** the Chromium on-disk layouts need a parser per WebView major version                                                                                                                         | D                                                                                                                                                                | 21                                           | n/a                                                                                                                                                                                          | 2/0               |
| 11  | Accessibility tree, no install                  | T1      | `UiAutomation` from the shell UID (the `uiautomator dump` path)                                                                                                                                                                                                                                                      | —                                                                                                                                                                | 18                                           | n/a                                                                                                                                                                                          | 3/1               |
| 12  | Accessibility tree, cable-less                  | T2      | `AccessibilityService` ([ref](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService))                                                                                                                                                                                            | G(Accessibility); Android 13+ restricted settings for sideloads ([help](https://support.google.com/android/answer/12623953))                                     | 21                                           | **High:** autonomous actions are "strictly prohibited"; a declaration, video and disclosure are required ([policy](https://support.google.com/googleplay/android-developer/answer/10964491)) | 2/2               |
| 13  | Input injection                                 | T1      | scrcpy-style `InputManager.injectInputEvent` as the shell user                                                                                                                                                                                                                                                       | —                                                                                                                                                                | 21                                           | n/a                                                                                                                                                                                          | 3/1               |
| 14  | Screen capture, cable-less                      | T2      | `MediaProjection`; consent on every session from API 34; foreground-service type `mediaProjection` ([14 changes](https://developer.android.com/about/versions/14/behavior-changes-14#media-projection-consent))                                                                                                      | G(per session)                                                                                                                                                   | 21                                           | Low–medium                                                                                                                                                                                   | 1/3               |
| 15  | Logcat on-device                                | T2      | `READ_LOGS` granted via `pm grant` (a development permission). **Assumption:** the Android 13+ per-access consent dialog applies                                                                                                                                                                                     | G(ADB once)                                                                                                                                                      | 16                                           | Not grantable from Play                                                                                                                                                                      | 2/2               |
| 16  | Battery, network and thermal timeline           | T2      | Sticky `ACTION_BATTERY_CHANGED`, `ConnectivityManager.NetworkCallback`, `PowerManager.getThermalHeadroom` ([BatteryManager](https://developer.android.com/reference/android/os/BatteryManager))                                                                                                                      | —                                                                                                                                                                | 21 / 30                                      | Low                                                                                                                                                                                          | 1/3               |
| 17  | Installed app list                              | T2      | `QUERY_ALL_PACKAGES` ([package visibility](https://developer.android.com/training/package-visibility))                                                                                                                                                                                                               | —                                                                                                                                                                | 30                                           | **Medium:** policy declaration                                                                                                                                                               | 1/1               |
| 18  | Cable-less shell UID (control without USB)      | T2→T1   | Wireless-debugging self-pairing, then start T1 (the Shizuku model) ([ADB Wi-Fi](https://developer.android.com/tools/adb#connect-to-a-device-over-wi-fi); [Shizuku](https://shizuku.rikka.app/guide/setup/))                                                                                                          | S; Developer options + Wi-Fi; re-pair after reboot                                                                                                               | 30                                           | Medium (Shizuku-class apps exist on Play)                                                                                                                                                    | 2/3               |
| 19  | Presence and consent UI                         | T2      | Foreground service (type `connectedDevice`) notification + Quick Settings tile ([FGS types](https://developer.android.com/develop/background-work/services/fg-service-types); [tiles](https://developer.android.com/develop/ui/views/quicksettings-tiles))                                                           | `POST_NOTIFICATIONS` (33+)                                                                                                                                       | 24                                           | Low                                                                                                                                                                                          | 2/3               |
| 20  | SharedPreferences / DataStore live view         | T3      | Listener in-process                                                                                                                                                                                                                                                                                                  | T3                                                                                                                                                               | 21                                           | n/a                                                                                                                                                                                          | 2/1               |
| 21  | Profiling a release build                       | T0      | `<profileable android:shell="true">` + Perfetto ([profileable](https://developer.android.com/guide/topics/manifest/profileable-element); [Perfetto](https://perfetto.dev/docs/))                                                                                                                                     | The app opts in                                                                                                                                                  | 29                                           | n/a                                                                                                                                                                                          | 3/0               |
| 22  | Device-policy truth                             | T2      | `UserManager.hasUserRestriction(DISALLOW_DEBUGGING_FEATURES …)` ([ref](https://developer.android.com/reference/android/os/UserManager#DISALLOW_DEBUGGING_FEATURES))                                                                                                                                                  | —                                                                                                                                                                | 18                                           | Low                                                                                                                                                                                          | 2/2               |

**What the companion alone cannot do (state it on the website):**

- CDP, DOM, console or JS evaluation of another app (Chromium auth, above).
- Read another app's private files, or `/proc/net` (restricted since Android 10:
  [privacy changes](https://developer.android.com/about/versions/10/privacy/changes#proc-net-filesystem)).
- Inject input without Accessibility or the shell UID.
- See inside a work profile from the personal profile.

---

## 4. Architecture

### 4.1 Components

```
Desktop (Tauri) ── adb ──► T0 commands (fixed: --user, unfreeze, exit-info, dumpsys truth)
       │          └─────► T1 capu-agent.dex  (app_process, uid 2000, owned, pinned, one process)
       │                      ├ presence/freezer/exit events   ├ UiAutomation tree
       │                      ├ input injection + video (scrcpy protocol, pinned version)
       │                      └ CDP socket broker (forward per target)
       ├── adb forward / LAN ──► T2 Capubridge Companion APK (own uid)
       │                      ├ session FGS + notification + QS tile ("Capture", "Mark moment")
       │                      ├ MediaProjection capture, battery/network/thermal, UsageStats
       │                      ├ local .capu store + Sharesheet export
       │                      └ binder broker for T3 (signature-protected)
       └──────────────────────► T3 capu-sdk-android (debugImplementation, in the app's uid)
                                  ├ native HTTP, SQLite write tap, prefs, lifecycle, crash
                                  ├ own-WebView CDP relay
                                  └ adapters: Capacitor, React Native, Flutter, plain WebView
```

One protocol connects all of them. The existing JS recorder (`@cavulsqa/recorder`) becomes _one
adapter_ of T3, not the SDK itself. This matters for the owner's directive to stop being a
Capacitor-only tool.

### 4.2 Transport

| Mode                   | How                                                                                                                                                                                                                                                                                                                                     | When                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| USB, desktop to device | `adb forward tcp:0 localabstract:capu_<random>` to T1 or T2 ([LocalServerSocket](https://developer.android.com/reference/android/net/LocalServerSocket)). The server verifies `LocalSocket.getPeerCredentials()` and the session token ([ref](<https://developer.android.com/reference/android/net/LocalSocket#getPeerCredentials()>)). | Default.                            |
| USB, device to desktop | `adb reverse` for streaming T3 events to the desktop without polling.                                                                                                                                                                                                                                                                   | High-rate tracks (network, SQLite). |
| LAN                    | `NsdManager` discovery ([ref](https://developer.android.com/reference/android/net/nsd/NsdManager)). A desktop QR code carries a one-time secret, then a Noise XX or TLS-PSK channel, mirroring how wireless debugging pairs.                                                                                                            | Cable-less QA and support.          |
| Offline                | No link. T2 writes `.capu` locally; the user shares it via the Sharesheet or a cable later.                                                                                                                                                                                                                                             | Field technicians.                  |

Hosted relay is **not proposed**. A prior decision rejected hosted replay and ADB-over-VPN (see the
field-recorder memory). Keep it that way unless the Direction reopens it.

### 4.3 Protocol and versioning

- Length-delimited protobuf. The repo already uses `prost` for aya (`adb.rs:463-473`).
- Package `capu.agent.v1`. The first frame is `Hello{protocol_major, protocol_minor, build, abi,
api_level, user_id, capabilities[], grants[], policy_restrictions[]}`.
- The desktop gates every feature on a **capability**, never on a version number. This is what lets
  the UI say "native HTTP: needs the SDK" instead of showing "0 requests".
- **Compatibility:**
  - The desktop speaks protocol majors N and N−1.
  - The agent and companion refuse a newer major with a typed error, and the desktop offers an
    update.
  - Every event carries a monotonic device clock (`SystemClock.elapsedRealtimeNanos`) plus a
    wall-clock offset sampled at handshake. That is how the replay's "one clock" becomes exact
    rather than poll-quantised (F5).

### 4.4 Install and update

1. **Desktop pushes over ADB (primary).** The APK and the dex are bundled in the desktop release, so
   versions always match. `adb install -r` keeps data and the signature must match. Sign with a
   dedicated key under APK Signature Scheme v3 with rotation lineage
   ([apksigner](https://developer.android.com/tools/apksigner);
   [v3](https://source.android.com/docs/security/features/apksigning/v3)). Target the current SDK,
   because Android 14 blocks installing apps with targetSdk < 23
   ([14, all apps](https://developer.android.com/about/versions/14/behavior-changes-all#minimum-target-api-level)).
2. **Developer verification.** Google is rolling out developer verification for sideloaded apps on
   certified devices: four countries from 30 Sep 2026, global in 2027. ADB installs are stated to stay
   exempt ([Google: developer verification](https://support.google.com/android-developer-console/answer/16561738)).
   Register Capubridge as a verified developer anyway, because the cable-less, non-developer path
   (§5) depends on a store or a direct download.
3. **A Play "Lite" listing** for non-developer personas, without Accessibility, VPN or
   `QUERY_ALL_PACKAGES`. The full feature set arrives through ADB install or ADB grants.
4. **OEM friction (Assumption, verify):** Xiaomi/HyperOS gates `adb install` behind "Install via USB"
   and input injection behind "USB debugging (Security settings)". The evidence device is a Xiaomi
   build. Detect the failure and show the exact toggle path.

### 4.5 Degradation when parts are absent

The desktop must render each capability as **available · needs grant · needs SDK · needs debuggable ·
unavailable on this device**, never as empty or zero.

| Situation       | What the user sees                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| No T2 installed | Everything T0 and T1 provide still works. Cable-less capture and the device timeline show one "Install companion" action. |
| No T3 linked    | The Network panel header says "WebView only". The database lane says "sampled".                                           |
| T1 killed       | Fall back to T0 polling, with a visible "degraded" provenance tag.                                                        |

---

## 5. Security and trust

**Pairing:**

- A USB session token is generated by the desktop and handed over via
  `adb shell am start-foreground-service … --es token` (shell only).
- A LAN session uses a QR one-time secret, then a pinned key.
- Each pairing is listed and revocable on both sides, and expires after 30 days idle.

**The companion must never:**

1. Perform autonomous AI-driven actions through AccessibilityService. Play prohibits it, and the AI
   agent must act only via T1 (shell injection), which requires an ADB session and therefore a
   developer.
2. Listen on a non-loopback interface without completed pairing.
3. Grant itself permissions through ADB without a visible desktop consent step that names each grant.
4. Read or upload anything outside the paired session's target package.
5. Upload anywhere by default. Data leaves only through user-initiated share or a paired desktop.
6. Keep T1 or the sticky unfreeze alive after the session ends or the cable is pulled.
7. Hide its foreground-service notification.
8. Ship T3 in release builds by default. The release artefact is a no-op unless the app owner opts
   in, with redaction.

**Visible presence:**

- A persistent notification: "Capubridge session · `<desktop name>` · `<app>` · Stop".
- A Quick Settings tile showing the state.
- The system's own MediaProjection indicator during capture.
- No overlay (`SYSTEM_ALERT_WINDOW`), because it is a policy and trust risk for little gain.

**Enterprise and MDM:**

- Detect `DISALLOW_DEBUGGING_FEATURES`, disallowed unknown sources and work-profile separation, and
  tell the user why a feature is off instead of failing silently.
- Support managed configurations so fleets can pre-set allowed desktops and disable capture
  ([managed configurations](https://developer.android.com/work/managed-configurations)).
- The personal-profile companion cannot see work-profile apps. Install it in the work profile when
  needed.

**Review risk:**

- AccessibilityService is high risk and should be kept out of the Play build.
- VpnService is medium to high risk: debugging is not a listed core use. Treat it as an ADB-installed
  extra, the way HTTP Toolkit separates its concerns.

**Existing debt to close first:** F7 (unauthenticated sockets) and F8 (unpinned and AGPL binaries).

---

## 6. Non-developer flows the companion enables (concrete)

1. **QA tester, no cable.**
   - They pull down the QS tile "Capture" and give MediaProjection consent.
   - The companion records the screen and, if the build has T3, network, SQLite writes, console and
     crashes on one clock.
   - They tap the tile again: "What went wrong?" (one line, or voice to text).
   - The `.capu` file is saved, then shared through the Sharesheet to ClickUp or chat, or sent to the
     paired desktop over LAN.
   - The developer opens it in Replay.
   - Target: about 4 taps, no laptop.
2. **Field technician, offline warehouse.**
   - T3 keeps a rolling 5-minute ring buffer (network, database changes, crashes), and T2 keeps the
     battery, connectivity and thermal lane.
   - On "Mark moment" the last 5 minutes are frozen into a `.capu`, even without signal.
   - It is exported later by cable or share. The answer to "what was the network doing when the sync
     failed" is in the file.
3. **Support agent with a tester on the phone.**
   - The tester scans the desktop's QR code to pair over LAN.
   - The agent sees the live device timeline and mirror (T1 via wireless self-ADB if enabled,
     otherwise capture only).
   - The tester sees a persistent "Being viewed by `<name>` · Stop" notification.
4. **Product or design reviewer.** They use the same tile on a release-candidate build with T3 in
   "support mode", and annotate moments. These are reviewed as a timeline, not a screen recording
   alone.
5. **Device-lab operator.** The device-health lane (battery, thermal headroom, network type, freezer
   events) across devices explains flaky automation runs.

**Ownership question (Assumption):** an environment MCP server named Capuchoo already "records
sessions on devices (screen, console, network, database) for replay". Flows 1 and 2 overlap with it.
The Direction should decide the boundary: Capubridge for debug and field, Capuchoo for production
fleets. Otherwise two SDKs will compete inside the same apps.

---

## 7. Phased plan

| Phase                                       | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Effort (rough)  | Main risks                                                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP: "Truth"** (removes the biggest lies) | **(a) T0 fixes:** add `--user` everywhere (F4); OS-derived presence and frozen state (F3); opt-in sticky unfreeze (F1, F2); exit-info and crash lane (F11); single-stream db+WAL copy and a "sampled" label (F5); unknown never shown as 0 (F6). **(b) T1:** `capu-agent.dex` replaces aya and the fetched scrcpy; pinned digests, random socket, peer-cred and token (F7, F8). **(c) T2 v0:** ADB-pushed, session FGS + tile, battery/network/thermal lane, UsageStats foreground, Hello/capabilities protocol, local `.capu` + Sharesheet. **(d)** Rewrite the website and MCP copy. | 8–10 eng-weeks  | OEM install gates (Xiaomi); `am unfreeze` availability per API level; the licence question on aya (escalate); T1 hidden-API drift across Android releases. |
| **Phase 2: "Reach"**                        | **T3** `capu-sdk-android` (debugImplementation + no-op): native HTTP interceptors, SQLite write tap (Room, androidx.sqlite, the Capacitor and RN SQLite plugins), prefs and DataStore, lifecycle and crash, own-WebView CDP relay (cable-less CDP), bind-to-keep-unfrozen. The `@cavulsqa/recorder` JS layer becomes an adapter. MediaProjection capture into `.capu`.                                                                                                                                                                                                                 | 10–12 eng-weeks | SDK adoption friction; ProGuard/R8 interplay; per-framework SQLite plugins; overlap with Capuchoo.                                                         |
| **Phase 3: "Cable-less and fleet"**         | LAN pairing (QR + Noise); wireless self-ADB to start T1 without USB; managed configurations; the Play Lite listing; developer verification; optional JVMTI inspectors for debuggable apps without the SDK (7b, 8b); optional VPN capture as an ADB-installed extra.                                                                                                                                                                                                                                                                                                                    | 12–16 eng-weeks | JVMTI is ART-version fragile; Play review (VPN, QUERY_ALL_PACKAGES); wireless debugging drops on network change and after reboot.                          |

**Exit criteria for the MVP:** on the evidence device, with the app backgrounded:

- the Data view says "frozen", offers "Keep awake", and after consent lists the real databases;
- the App page names the correct Android user;
- the battery state matches the phone's status bar;
- `grep releases/latest` returns nothing in `commands/`.

---

## 8. iOS outlook

There is no `adb shell` equivalent and no on-device companion that can inspect other apps; the
sandbox forbids it.

**What is possible:**

- **WKWebView inspection.** It works when the app sets `isInspectable = true` (iOS 16.4+)
  ([WebKit](https://webkit.org/blog/13936/enabling-the-inspection-of-web-content-in-apps/)). The
  WebKit Inspector Protocol, not CDP, is reachable from Windows and Linux through usbmuxd tooling
  (`ios_webkit_debug_proxy`, go-ios). **Assumption:** stability on Windows is unverified.
- **An in-app SDK.** It is the same T3 design: native HTTP via `URLProtocol`, SQLite via the
  plugin, crash and lifecycle.
- **User-initiated screen capture** through a ReplayKit broadcast extension.

**What is not possible:**

- Cross-app storage reads.
- Input injection or UI automation without a Mac-built XCUITest or WebDriverAgent runner.
- Frozen-app unfreezing.
- Network capture of other apps without a Network Extension entitlement.

**Conclusion:** iOS is a T3-plus-WebKit-proxy product, not a companion product. Design the `.capu`
format and the capability handshake so that an iOS SDK slots in later, and do not promise device
control.

---

## 9. Opinions (labelled)

- **Opinion: name the tiers in the product.** Show "ADB · Agent · Companion · SDK" as provenance on
  every value. This turns the thesis "every value says where it came from" from a slogan into the
  architecture, and no reference tool does it.
- **Opinion: the companion must ship branded "Capubridge Companion", framework-neutral.** The SDK's
  first-class adapters should be plain Android WebView, React Native and Flutter, with Capacitor
  treated as one adapter among them. This is the cheapest concrete step away from the Capacitor
  niche.

## 10. Could not judge

- Behaviour on Android 15 and 16 devices other than the evidence device.
- Whether the shell user's `/proc/stat` read is permitted on this OEM. The perf zeros may be a parse
  failure rather than a policy block.
- The real SELinux reachability of the abstract sockets (F7).
- The exact Chromium on-disk layouts for frozen-proof reads (row 10).
- Whether Capuchoo is the owner's product and where its scope ends.

## Top 3 changes that move the score most

1. **Stop rendering unknown as fact.** Use OS-derived presence and frozen state, an opt-in sticky
   unfreeze, `--user` everywhere, and "—" instead of 0. These are ADB-only changes that close four
   S0s and should land before any APK work.
2. **Replace the borrowed helpers with one owned, pinned, authenticated shell agent (T1).** Add the
   companion APK v0 with the capability handshake, so every panel can state what it can and cannot
   see.
3. **Build the debug SDK (T3) as the reach layer.** It provides native HTTP, the SQLite write tap and
   own-WebView CDP relay over LAN. It is what makes cable-less QA and field capture real and moves
   the product beyond the Capacitor niche.
