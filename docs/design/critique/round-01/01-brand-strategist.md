# Round 01 · Brand strategist

`[AI-assisted]` (pending the owner's explain-back) · 2026-11-04 · branch `feat/ui-ux-overhaul` · critic: brand-strategist

Scope: the category, the positioning, the name, the narrative and the differentiation. Pixel craft is out
of scope; I mention UI only where it carries or breaks the story.

---

## 0. Verdict in five lines

1. **Positioning and narrative: 4.5 / 10. Differentiation: 5 / 10.** The owner's 7 does not survive the
   evidence. The public story makes at least three claims the product cannot back (S0). The name says
   "Capacitor bridge". The product thesis ("One clock") does not appear on the website at all.
2. **The owner is right that the Capacitor/Ionic frame is too small, but has the diagnosis half wrong.** The
   hero already says "Android WebView", not "Capacitor". The limiting frames today are **the name** and
   **"WebView workbench"**, which is a list of ten panels with no job and no persona attached.
3. **The bigger, defensible category is evidence, not inspection.** Recommended: _the flight recorder for
   Android apps_. You inspect live, you record the moment it broke, and anyone (a developer, QA, support,
   or an AI agent) opens the same evidence on one clock. Live inspection becomes the right edge of that
   timeline, not the product's identity.
4. **Name: rename, and do it before the companion app is listed on Google Play.** A Play package name is
   permanent. "Capu" plus "bridge" is the most Capacitor-bound name possible.
5. **Do not widen the claim before you widen the reach.** Today the product sees only _debuggable
   WebViews_. "Any Android app" becomes honest only when the companion app ships native network, native
   databases and background access. Until then, the WebView storage depth is the wedge, and the category
   frame must stay honest about it.

---

## 1. Findings (ranked by severity)

Evidence formats follow `RUBRIC.md`. Private values in the screenshots are not transcribed.

| #   | Sev | Finding                                                                                                                                                                                                                                                                                     | Evidence                                                                                                                                                                                                           | Fix direction                                                                                                            |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| B1  | S0  | The website sells network **throttling**, which the product does not have. A test even asserts that no throttle route exists.                                                                                                                                                               | `apps/website2/src/data/features.ts:66-72` ("Watch it, throttle it, or fake it", metric "Throttle"); `apps/desktop/src/app/__tests__/feature-registry.test.ts:39` (`not.toContain("throttle")`)                    | Remove the claim until the feature ships, and gate the site copy on the feature registry.                                |
| B2  | S0  | The "Recorded sessions" flagship says a recording holds "native logs". The `.capu` v1 format has no logcat track.                                                                                                                                                                           | `apps/website2/src/components/sections/FlagshipSection.vue:27`; `apps/docs/reference/capu-format.md` archive table (rrweb, network, console, perf, databases only); no logcat reference in `commands/recording.rs` | Ship a logcat track, which the thesis needs anyway, or drop the words.                                                   |
| B3  | S0  | The MCP flagship says an agent can "install the build". None of the 30 MCP tools installs an APK.                                                                                                                                                                                           | `FlagshipSection.vue:40`; `apps/desktop/src-tauri/src/mcp/tools/device.rs` (only `list_packages`); `docs/design/2026-09-12-capability-inventory.md` §MCP catalog                                                   | Remove the claim or add the tool.                                                                                        |
| B4  | S1  | The hero says "See inside **any** Android WebView." CDP sees only WebViews where the app called `setWebContentsDebuggingEnabled`, so most production apps are invisible.                                                                                                                    | `apps/website2/src/components/sections/HeroSection.vue:71`; [Chrome: Remote debugging WebViews](https://developer.chrome.com/docs/devtools/remote-debugging/webviews)                                              | Say "any debuggable" now, and earn "any app" through the companion app.                                                  |
| B5  | S1  | The "Supported hybrid runtimes" marquee leads with Capacitor and Ionic, and shows the **React Native** and Cordova logos. The SPEC excludes native React Native/Hermes. This is the exact frame the owner rejects, plus an overclaim.                                                       | `apps/website2/src/components/sections/RuntimeMarquee.vue:38`; `apps/website2/src/data/runtimes.ts:9-27`; `apps/docs/SPEC.md` §Supported user                                                                      | Replace the logo wall with a statement of capability: "any debuggable Chromium WebView; native layer via companion".     |
| B6  | S1  | The name decodes as "Capacitor bridge". "Cap-" is the Capacitor ecosystem's naming prefix ([Capgo](https://capgo.app/blog/how-capacitor-bridges-web-and-native-code/), Capawesome), and "the bridge" is Capacitor's own core runtime concept ([Ionic blog](https://ionic.io/blog/?p=6378)). | Wordmark at `panel-01-device.png @ x15–130, y10–38`; `apps/desktop/src-tauri/tauri.conf.json:3`                                                                                                                    | Rename (§5).                                                                                                             |
| B7  | S1  | The product name has three casings: `capubridge` (title bar, Tauri `productName`, window title), `Capubridge` (website, README) and `CapuBridge` (SPEC title, MCP server description).                                                                                                      | `panel-01 @ x15–130, y10–38`; `tauri.conf.json:3,15`; `apps/docs/SPEC.md:1`; `README.md:1`                                                                                                                         | Pick one casing in a written brand rule, and lint it.                                                                    |
| B8  | S1  | The public promise "No helper APK, no second program on your machine" contradicts the binding directive that the companion app is a must.                                                                                                                                                   | `apps/website2/src/data/features.ts:98,100`                                                                                                                                                                        | Rewrite it as "Works over ADB alone. Add the companion for native network, background apps and field capture."           |
| B9  | S1  | There are two stories. The product thesis is "One clock. One context. One truth.", while the website's story is "Android WebView workbench, ten panels". The word "clock" appears only once on the site, inside the Performance card.                                                       | `rewrite-study.md:5`; `HeroSection.vue:66-71`; `FeaturesSection.vue:60`; `features.ts:87`                                                                                                                          | Make the site lead with the time thesis, and demote the panel inventory to proof.                                        |
| B10 | S1  | The differentiator is not visible in the product. Replay is an empty file-opener. No screen shows a timeline. Flows is a generic chat prompt that looks like every AI tool.                                                                                                                 | `panel-09-replay.png @ x700–890, y410–625`; panels 01–13 (no timeline anywhere); `panel-10-flows.png @ x590–1360, y150–250`                                                                                        | Put a global timeline strip in the shell before the next round of polish.                                                |
| B11 | S1  | Non-developer personas are promised but not served. "QA hits record" requires ADB, USB debugging and a debuggable build, and the session store is "proposed, not released".                                                                                                                 | `FlagshipSection.vue:27`; `apps/docs/reference/session-store-api.md:7`                                                                                                                                             | Label it as coming. The companion app plus the session store is the non-developer product.                               |
| B12 | S1  | The brand architecture is undefined. Three on-device recorders sit under three names: the owner's Capuchoo (described in this workspace's tooling as recording screen, console, network and database on devices), `@cavulsqa/recorder` (writes `.capu`), and the planned companion app.     | `capu-format.md:3`; the Capuchoo test-bed package in `panel-01 @ x350–610, y685–705`                                                                                                                               | One evidence format, one on-device recorder, and one written decision about which brand owns it (§6).                    |
| B13 | S2  | Inside the product, Capacitor is the only framework identity shown: a cyan "capacitor" chip sits in the App header.                                                                                                                                                                         | `panel-05-app.png @ x438–514, y163–186`; `apps/desktop/src/modules/app/AppOverviewSurface.vue:183-187`                                                                                                             | Show a neutral "Runtime" field that detects Capacitor, Cordova, a TWA, plain WebView and so on.                          |
| B14 | S2  | The headline counts are wrong or meaningless. "Four tools" sits over five rows, and "Ten panels" does not match the app's seven rail destinations.                                                                                                                                          | `ProblemSection.vue:18` versus `problems.ts` (5 entries); `FeaturesSection.vue:60` versus the rail in `panel-01 @ x0–80, y60–510`                                                                                  | Stop leading with counts. Lead with jobs.                                                                                |
| B15 | S2  | "Only here" is no longer true for MCP. Proxyman now captures on Android and connects to Claude Code over MCP. Google shipped Chrome DevTools for agents 1.0 and Android Studio Journeys.                                                                                                    | [proxyman.com/android](https://proxyman.com/android); [Chrome DevTools for agents 1.0](https://developer.chrome.com/blog/devtools-for-agents-v1); [Journeys](https://developer.android.com/studio/gemini/journeys) | Recast MCP as a proof point ("agents read the same evidence"), not as the moat.                                          |
| B16 | S2  | The trust story ("private by default", principle P10) does not match the defaults. The status bar shows the device serial and a session identifier in plain text on every screen, and two website captures are blocked for leaking a private IP and a serial.                               | `panel-01…13 @ x0–420, y995–1015`; `apps/website2/src/data/screenshots.ts` (two `needs-recapture` blockers)                                                                                                        | Mask identifiers by default and reveal them on hover. This matters more once a VPN-capable companion app asks for trust. |
| B17 | S3  | The Tauri identifier `com.capubridge.io` is reversed-domain written forwards. It looks like a domain claim nobody can verify.                                                                                                                                                               | `tauri.conf.json:5`                                                                                                                                                                                                | Fix it during the rename, together with an app-data migration.                                                           |
| B18 | S3  | The SPEC's only versioned acceptance scenario is the order flow of one specific retail app, which anchors the product definition to one vertical. _(Opinion: fine as a benchmark, wrong as the definition.)_                                                                                | `apps/docs/SPEC.md` §Automation acceptance                                                                                                                                                                         | Add generic reference scenarios.                                                                                         |

---

## 2. Market map (researched 2026-11-04)

| Product                                                                            | Category it claims                                                        | Audience                                        | Price model                                                                                                                                    | The gap it leaves for us                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Android Studio App Inspection** (Database Inspector, Network Inspector, Logcat)  | The official IDE inspector                                                | Native Android developers with the project open | Free                                                                                                                                           | Network Inspector supports only HttpsURLConnection/OkHttp, so it shows no WebView traffic ([docs](https://developer.android.com/studio/debug/network-profiler)). Database Inspector is read-only in live mode and needs a running debuggable build at API 26+ ([docs](https://developer.android.com/studio/inspect/database)). It has no recording of app state over time, and it needs the IDE and the project open. |
| **Android Studio Journeys** (2025 preview)                                         | Natural-language E2E tests run by Gemini                                  | Native Android developers                       | Free (Gemini)                                                                                                                                  | Native only, and it leaves no portable evidence. It shows Google moving into agent-driven testing ([docs](https://developer.android.com/studio/gemini/journeys)).                                                                                                                                                                                                                                                     |
| **Chrome DevTools / chrome://inspect**                                             | Browser devtools; remote WebView debugging                                | Web and hybrid developers                       | Free                                                                                                                                           | One floating window per target, no device context, nothing persists, no SQLite panel, and debugging must be enabled in the app ([docs](https://developer.chrome.com/docs/devtools/remote-debugging/webviews)).                                                                                                                                                                                                        |
| **Chrome DevTools MCP / DevTools for agents 1.0**                                  | DevTools for AI agents                                                    | Developers using AI coding agents               | Free                                                                                                                                           | Desktop Chrome only. It does not reach a phone, its storage or its screen ([announcement](https://alternativeto.net/news/2025/9/google-launches-chrome-devtools-mcp-allowing-ai-agents-to-debug-automate-and-test-in-chrome), [1.0](https://developer.chrome.com/blog/devtools-for-agents-v1)).                                                                                                                       |
| **Flipper**                                                                        | Extensible mobile debugging platform                                      | React Native and native mobile developers       | Free OSS                                                                                                                                       | Effectively retired for React Native: the last Electron release was v0.239.0 and React Native support ended there ([repo readme mirror](https://github.com/facebook/Sonar)). It needed an SDK in the app. Its old audience is now open.                                                                                                                                                                               |
| **React Native DevTools / Radon IDE**                                              | React Native debugging inside the editor                                  | React Native and Expo developers                | Free, with Radon Enterprise                                                                                                                    | Framework-locked (React Native only), and in-editor ([Radon features](https://radon.swmansion.com/features)).                                                                                                                                                                                                                                                                                                         |
| **Reactotron**                                                                     | Desktop inspector for React and React Native                              | React Native developers                         | Free OSS                                                                                                                                       | Needs a client library in the app, is React-only, and has no device layer ([infinite.red](https://infinite.red/reactotron)).                                                                                                                                                                                                                                                                                          |
| **Proxyman**                                                                       | "Web debugging proxy", now on Android, with MCP                           | Mobile and web developers                       | Perpetual license, roughly $69–89 per seat ([pricing](https://proxyman.io/pricing))                                                            | Network only: no storage, DOM or app state, and no replay ([Android](https://proxyman.com/android)).                                                                                                                                                                                                                                                                                                                  |
| **HTTP Toolkit**                                                                   | HTTP interception, with a companion Android app (VPN plus CA certificate) | Developers and security testers                 | Freemium; Pro unlocks rules and mocks ([pricing](https://httptoolkit.com/pricing))                                                             | Network only. **Its Android companion is the precedent for ours:** QR pairing, a VPN, local-only traffic ([guide](https://httptoolkit.com/docs/guides/android/)).                                                                                                                                                                                                                                                     |
| **Charles**                                                                        | Web debugging proxy                                                       | Developers                                      | $50 per seat, perpetual ([buy](https://www.charlesproxy.com/buy/))                                                                             | Network only; a dated user experience.                                                                                                                                                                                                                                                                                                                                                                                |
| **scrcpy front-ends** (Escrcpy, QtScrcpy) and **aya**                              | Android device GUI / ADB GUI                                              | Power users and developers                      | Free OSS                                                                                                                                       | A device layer with no app runtime. aya (AGPL, about 5.6k stars) covers mirror, files, apps, logcat and performance ([repo](https://github.com/liriliri/aya)). **That shows our whole "Device" family is a commodity.**                                                                                                                                                                                               |
| **Sentry / LogRocket mobile replay**                                               | Session replay and error monitoring                                       | Product and engineering teams                   | SaaS per session; LogRocket pricing is opaque and changes ([comparison](https://cubeapm.com/blog/sentry-vs-logrocket/))                        | Needs an SDK and a cloud. No local or offline evidence, and no deep storage state.                                                                                                                                                                                                                                                                                                                                    |
| **Instabug (now Luciq) / Shake**                                                   | In-app bug reporting for QA and users                                     | QA, support, product                            | SaaS, roughly $50–350 a month ([overview](https://www.trustradius.com/compare-products/luciq-vs-shake))                                        | Collects a screenshot, logs and device info, but not app data state, and has no developer-grade replay. **This is the non-developer job, done shallowly.**                                                                                                                                                                                                                                                            |
| **Maestro / Maestro Studio**                                                       | Mobile UI test automation                                                 | QA and developers                               | Studio is free; the cloud costs about $250 per device per month ([review](https://bugbug.io/blog/test-automation-tools/maestro-alternatives/)) | Flows check the UI, not the data underneath.                                                                                                                                                                                                                                                                                                                                                                          |
| **Mobile MCP servers** (mobile-mcp, mobile-device-mcp, android-remote-control-mcp) | AI control of an Android device                                           | Developers using agents                         | OSS or freemium                                                                                                                                | Screens and taps only: no runtime, storage or evidence ([directory](https://mcpservers.org/servers/saranshbamania/mobile-device-mcp), [android-remote-control-mcp](https://www.mdskills.ai/mcp-servers/android-remote-control-mcp)). This is a crowded, commoditising layer.                                                                                                                                          |

**Reading the map.** Every competitor owns **one** slice: the device (aya, scrcpy), the network (Proxyman,
HTTP Toolkit, Charles), the framework (Radon, Reactotron), the cloud replay (Sentry, LogRocket), the
reporting (Instabug, Shake), or the IDE (Android Studio). **None combines the app's data state, its
network, its UI and its screen on one clock in a local, portable file.** That combination is the only
defensible gap, and it is exactly the recording/`.capu` line the team has started. The "Device" family
(mirror, files, apps, logcat) is table stakes; free tools already do it.

_Market size, honestly:_ I found no reliable 2025–2026 figure for the share of Android apps built on WebView.
The best hard number covers one library: `react-native-webview` is in about 4.9% of Play apps
([AppBrain](https://www.appbrain.com/stats/libraries/details/react_native_webview/react-native-webview)).
`@capacitor/core` shows hundreds of thousands of weekly npm downloads
([npm](https://www.npmjs.com/package/@capacitor/core)). The WebView niche is real but bounded. That is
why the category has to be defined by a _job_ (evidence), not by a _runtime_.

---

## 3. Jobs to be done

Frequency and pain are on a 1–3 scale and are my judgement (_opinion_, from the market map and the owner's
field context). "Today" is judged against the capability inventory and the evidence screenshots.

| #   | Job (who)                                                                                      | Freq       | Pain | Today                                                                                                                                                                                       | Companion unlocks                                 |
| --- | ---------------------------------------------------------------------------------------------- | ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| J1  | "Why is the data on this phone wrong?" Read and edit local state on a real device (developer). | 3          | 3    | **Yes** for WebView stores (IndexedDB, OPFS, SQLite-WASM, Cache); native SQLite is read-only and needs a pull. Stores freeze when the app is backgrounded (`panel-06 @ x95–980, y100–130`). | Background access; native database read and write |
| J2  | Reproduce a bug someone else saw (developer receiving it).                                     | 3          | 3    | **Partial**: Replay opens `.capu` files, but capture needs ADB, CDP and a desktop.                                                                                                          | On-device capture, with no laptop                 |
| J3  | File a bug with full evidence (QA).                                                            | 3          | 3    | **No** for non-developers: the same setup barrier as J2.                                                                                                                                    | A record button on the phone                      |
| J4  | See the app's network on a real device (developer).                                            | 3          | 2    | **Yes** for WebView; **No** for native or OkHttp traffic.                                                                                                                                   | VPN capture, the HTTP Toolkit pattern             |
| J5  | Read JavaScript and native logs together (developer).                                          | 3          | 2    | **Yes** live; **No** in recordings (B2).                                                                                                                                                    | —                                                 |
| J6  | Look at the customer's device state remotely (support).                                        | 2          | 3    | **No**: the session store is not released.                                                                                                                                                  | Upload to the session store                       |
| J7  | Check device health or sync state in the field, then export it for support (field technician). | 2          | 3    | **No**                                                                                                                                                                                      | A guided capture flow on the phone                |
| J8  | Let an AI agent drive and read a real phone (developer using agents).                          | 2 (rising) | 2    | **Yes**: 30 MCP tools plus task tools.                                                                                                                                                      | Reliability in the background                     |
| J9  | Drive the device from the desk, and manage apps and files (developer).                         | 3          | 1    | **Yes**, but it is a commodity.                                                                                                                                                             | —                                                 |
| J10 | Regression flows that assert on data (QA, developer).                                          | 2          | 2    | **Partial**: Flows is beta, and assertions on data are not shown.                                                                                                                           | —                                                 |
| J11 | Mock or alter the backend to test edge cases (developer).                                      | 2          | 2    | **Partial**: a Mocking tab exists (`panel-07 @ x222–310, y60–85`); throttling does not.                                                                                                     | —                                                 |

**What the ranking says.** The three top-pain jobs (J1, J2, J3) plus J6 and J7 are all _evidence about the
app's state at a moment_. Only J1 is fully served today. The non-developer jobs (J3, J6, J7) exist only
when the companion app ships. **The companion app is not an accessory to the category; it is what makes the
category true.**

---

## 4. Candidate categories

### C1 · "The Android app inspector": SDK-free, device-side

- **Promise:** "Everything an Android app holds, on one screen, with no SDK and no IDE."
- **Primary persona and winning job:** an app developer, hybrid or native, doing J1, J4 and J5.
- **Enemy:** Android Studio App Inspection plus chrome://inspect plus `adb`.
- **Why credible:** the storage depth nobody else has (OPFS, SQLite-WASM, the SAH pool, jeep), and the
  device and WebView layers in one context. **What is missing:** native network, writable native
  databases and background access, all of which are companion territory. Until those ship, "Android app"
  is a WebView claim in disguise.
- **Risk:** a head-on fight with a free Google tool on Google's own platform. Inspection is a feature
  race the owner of the OS wins over time.
- **IA and website:** the current panel-centric rail is fine for it, but this is the "ten panels" story
  again. It makes the product broader, not different.

### C2 · "The flight recorder for Android apps" (recommended)

- **Promise:** "Record the moment it broke. Anyone can open it, live or later, on one clock."
- **Primary persona and winning job:** the developer who receives bugs (J2). The evidence is _produced_ by
  QA, support, field technicians and agents (J3, J6, J7, J8) and _consumed_ by the developer. One
  category, two sides: this is how the product serves non-developers without becoming a non-developer
  tool.
- **Enemy:** "cannot reproduce", screenshots in a chat thread, and SDK-plus-cloud replay (Sentry,
  LogRocket) that sees no data state.
- **Why credible:** the `.capu` format already exists as a cross-repository contract
  (`capu-format.md:3`), with a database track and change log (`recording_db.rs`), MCP `query_recording`
  and `read_recording_db`, and a session store API already specified. The thesis "One clock" _is_ this
  category. **What is missing:** a logcat track (B2), a global timeline in the shell (B10), redaction you
  can trust, a one-tap capture for non-developers, and the companion app as the on-device recorder.
- **Companion role:** the producer. It captures on devices that have no cable, no ADB and no laptop. It
  reaches native network and databases, survives backgrounding, and uploads to a session store the
  customer operates.
- **IA:** the timeline becomes the spine. Live is the right edge, and Replay stops being a rail
  destination: opening a `.capu` is a change of context, not a page. Panels become lenses on evidence
  (the study's §3.1, which the team wrote and has not yet shipped). Add an "Evidence inbox" for incoming
  recordings from QA and the field.
- **Website:** the hero shows a timeline scrubbing across screen, network, logs and a database row
  changing. The proof sections are: capture (live or on-device), evidence (one clock, the data), and
  hand-off (file, store, agent).

### C3 · "The device bridge for AI agents"

- **Promise:** "Give your coding agent a real phone, its data and its history."
- **Persona and job:** a developer using Claude Code, Cursor or Codex (J8).
- **Enemy:** desktop-only Chrome DevTools MCP, and mobile MCP servers that only see the screen.
- **Why credible:** 30 tools plus durable task tools, and queries over recordings. **What is missing:**
  a reason this cannot be copied in a quarter. Google, Proxyman and a dozen OSS servers are converging
  here (B15).
- **IA and website:** the agent becomes the main surface. That is wrong for daily human debugging.
- **Verdict:** a strong _channel and proof point_, a weak _category_. It commoditises fastest.

---

## 5. The name: **rename**

**Reasoning.**

| Factor           | Assessment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capacitor tie    | Maximal. "Capu" reads as Capacitor in an ecosystem where "Cap-" is the vendor prefix (Capgo, Capawesome, Capacitor itself), and "bridge" is Capacitor's core runtime concept. The name _is_ the frame the owner wants to leave (B6).                                                                                                                                                                                                                                                                                            |
| Memorability     | Medium. Two syllable clusters, and the pronunciation is ambiguous (ka-PU? CAP-you?). It works poorly across FR, EN and AR, which matters for a team and early market in Algeria. _(Opinion.)_                                                                                                                                                                                                                                                                                                                                   |
| Search collision | No exact-match results on the open web, which means it is ownable. Search engines autocorrect it towards "CapBridge", a Singapore investment platform, and "bridge" collides with GNS3 `ubridge` ([search](https://www.zoominfo.com/c/capbridge-pte-ltd/426006542)). Ownable, but invisible.                                                                                                                                                                                                                                    |
| Domain           | Not verified. The `com.capubridge.io` identifier implies `capubridge.io`, but I could not confirm the registration.                                                                                                                                                                                                                                                                                                                                                                                                             |
| Switching cost   | **Low in the market, medium in engineering.** I found no evidence of public traction. The engineering costs: the Tauri identifier (app-data path and updater continuity), the MCP server name in users' agent configurations, the `.capu` extension, `@capubridge/*` packages, the repository URL and the website. **It becomes high the day the companion app is published:** Android says the application ID should never change after publishing ([Android docs](https://developer.android.com/build/configure-app-module)). |

**Decision window:** rename before the companion app's first Play listing. After that, the name is fixed
twice: on the desktop and in the Play Store.

**Naming directions (not final names):**

1. **Time and recording instruments:** black box, flight recorder, logbook, tape, chronograph. These carry
   the C2 thesis directly, and they line up with the study's direction C, "Field Recorder".
2. **Bench instruments:** probe, scope, bench, tap. These line up with the chosen "Bench" visual brand and
   the oscilloscope metaphor. They work for C1 and C2.
3. **A short coined word** of five to seven letters, pronounceable in French, English and Arabic, with a
   .dev or .app domain available, carrying the meaning only through the tagline.

**Hard constraints:** no "Cap-" or "Capu-"; no "bridge"; nothing that leads with "Android" (Google's brand
rules allow "Android" only as a descriptor, for example "… for Android"
([brand guidelines](https://developer.android.com/distribute/marketing-tools/brand-guidelines))); no
"Droid". Rename the file format with the brand, and keep reading `.capu` files forever.

**Escalation:** trademark clearance and domain purchase are outside technical scope. They go to the Tech
Lead or Direction.

---

## 6. Recommended positioning (C2)

**Brand architecture first (B12).** One evidence format, one on-device recorder and one brand family.
The desktop is the _reader and workbench_; the companion app is the _recorder and native probe_; the
format is the contract. Capuchoo's device recording and `@cavulsqa/recorder` either converge on that
recorder or are explicitly positioned as producers of the same format. Three recorders under three names
is a portfolio problem the owner must decide, not the panel.

**Message hierarchy**

- **Category:** the flight recorder for Android apps.
- **Descriptor (honest today):** "Inspect any debuggable Android app live, or open a recording of the
  moment it broke: screen, UI, network, logs and data on one clock. Local, free and open source."
- **Promise:** "Nobody has to reproduce it again."
- **Three proof points:**
  1. **One clock.** Screen, DOM, console, network, logcat and storage writes sit on one timeline, and
     selecting anything moves the playhead. _(This needs B2 and B10 fixed before it is a claim.)_
  2. **The data, not just the traffic.** IndexedDB, SQLite (native, OPFS, wa-sqlite, jeep), OPFS and
     Cache, with before and after for every write. Proxyman, HTTP Toolkit and Sentry cannot show this.
  3. **Portable, local, agent-readable.** One file you can send and replay offline, which an AI agent can
     query over MCP. No account, no cloud.
- **Proof per persona:**
  - **Developer (WebView or hybrid):** storage depth plus the timeline, with no SDK and no build change
    beyond enabling WebView debugging.
  - **Developer (native), once the companion ships:** native network and databases through the
    companion app. Label it as "with companion".
  - **QA:** "Record, reproduce once, send one file." Measured as fewer reopened "cannot reproduce"
    tickets.
  - **Support or field technician, once the companion ships:** "Tap capture on the phone; it reaches your
    team's store." No laptop, no cable.
  - **Developer using agents:** "Your agent reads the same evidence you do, locally."

**Website promise for the companion app** (replacing B8): "Works over ADB alone. Add the companion app for
native network, apps in the background, and capture in the field. Traffic and recordings stay on your
machines." The last sentence copies HTTP Toolkit's local-only trust model, which matters because a
VPN-capable APK asks users for a great deal of trust.

**Phrases to retire**

- "Capacitor", "Ionic" and "hybrid" as framing. Keep them only as detected runtimes in docs and in the App
  panel (B13).
- "Android WebView workbench" as the category, and "See inside any Android WebView" (B4). WebView becomes
  a capability, not an identity.
- "No helper APK, no second program" (B8).
- "Supported hybrid runtimes" and the logo wall, including React Native (B5).
- "Ten panels…", "Six engines…", "Four tools…": counts lead the story nowhere (B14).
- "Throttle", "install the build" and "native logs" in recordings, until they ship (B1–B3).
- "Only here" for MCP (B15).
- "One truth" in public copy. _(Opinion: "truth" is unprovable and invites the reader to look for the lie.
  Keep "One clock. One context." and show provenance instead.)_

---

## 7. Scores (against `RUBRIC.md` anchors)

| Dimension                        | Score   | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Positioning and narrative** | **4.5** | Three open S0 overclaims (B1–B3) and six S1s (B4–B9, B11). The website copy is articulate, but the product, the website, the SPEC and the name tell four different stories: Capacitor (the name and the App chip), "WebView workbench" (the site), "One clock" (the study) and a single retail order flow (the SPEC's acceptance scenario). Reference comparison: Proxyman's "web debugging proxy" and HTTP Toolkit's "intercept, inspect and rewrite" are one sentence each and match their products. The rubric caps a dimension with an open S1 at 7; the S0s put it below the "works but generic" anchor of 5. |
| **10. Differentiation**          | **5**   | The differentiator is **real**: storage depth no competitor has, a portable `.capu` with a database track, and an agent that can read the recordings. It is not **visible**: Replay is an empty opener (B10) and no screen shows a timeline. It is not **central**: the moat sits behind beta-labelled rail items, and MCP is being commoditised (B15). The "Device" family, which takes the first rail slot, is the least differentiated part (aya, scrcpy). It is not a 7 because nothing in the evidence pack shows a thing the references cannot do.                                                           |

The owner's 7 for "brand identity and idea" may be fair for the _idea_ in the study document. It is not
fair for the _positioning as shipped_.

---

## 8. What I could not judge

- **The command palette:** `panel-12-palette.png` shows the Settings dialog, not the palette.
- **Screenshot labelling:** `panel-01-device.png` shows the Flows/agent screen, with Flows highlighted in the
  rail, not the Device screen. The evidence pack should be relabelled or recaptured.
- **Traction:** no usage, star or download data was available, so the switching-cost estimate relies on
  the absence of a web footprint.
- **Domain and trademark availability** for the current name and any new direction.
- **The "Live diff" flagship's claim of a change feed across _every_ database at once:** IndexedDB
  change-tracking code exists (`modules/storage/changes/`), but no screenshot shows the feature, so the
  cross-database claim is unverified.
- **Pricing intent:** the site says "Free, open source, no account." If a paid tier is planned, for
  example a team session store, it changes C2's go-to-market and should be decided before the rename.

---

## 9. The three changes that move the score most

1. **Make the story honest in one pass (positioning 4.5 → about 6.5).** Remove or ship B1–B5 and B8.
   Gate website copy on the feature registry, so the site can never again claim what the registry
   denies.
2. **Adopt C2, and make the timeline the visible spine of the shell (differentiation 5 → about 7.5).**
   Add a logcat track to `.capu`, put a global timeline strip in the shell, and make Replay a context
   rather than a page. Then lead the website hero with the timeline.
3. **Decide the name and the brand architecture before the companion app's first build is published
   (positioning about 6.5 → 8+).** One name, one recorder and one format across desktop, companion and
   any field SDK, and an architecture decision covering Capuchoo and `@cavulsqa/recorder`. The companion
   app's store listing is the moment the name becomes permanent.
