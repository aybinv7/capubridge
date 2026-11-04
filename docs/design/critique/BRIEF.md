# Critic panel brief

Shared context for every Capubridge critic. Read it in full before judging anything. The rubric is in
`RUBRIC.md`, and the catalogue of craft defects is in `SLOP-CATALOG.md`.

## 1. What Capubridge is today

Capubridge is a Windows-first desktop app (Tauri 2, Vue 3, Rust) that connects to Android phones and
emulators over ADB. It debugs the apps running on them through the Chrome DevTools Protocol. Its
capability families are listed with evidence in `docs/design/2026-09-12-capability-inventory.md`:

- **Device:** devices, apps and files, plus Logcat, performance, shell and ports.
- **Mirror:** screen mirroring and input.
- **WebView:** DOM, console and network.
- **Storage:** every client store (IndexedDB, Local and session storage, Cache, OPFS, LocalForage) and
  SQLite (native, OPFS and jeep).
- **Session recording:** Replay, with DOM, network, console, performance and database tracks on a
  single clock.
- **Flows:** automation of the app under test.
- **MCP server:** a server with 30 tools that lets AI agents drive and read the device.

The current product thesis is **"One clock. One context. One truth."** It is in
`docs/design/2026-11-04-ui-ux-rewrite-study.md` §3:

- **Context:** one active device, app and target, shown everywhere.
- **Time:** every event sits on one timeline.
- **Evidence:** every value says where it came from and how fresh it is.

The visual foundation is the following:

- **Cladd (vendored as `packages/cladd`, source repo `cladd-vue`):** the components.
- **"Bench" brand:** OKLCH tokens, IBM Plex Sans and Mono, an 11 px text floor, neutral ink for primary
  actions, and green only for "live".
- **Rules:** `apps/desktop/DESIGN.md`.

## 2. Owner directives (2026-11-04), binding on the panel

1. **The owner rates the brand identity and product idea 7/10.** Their verdict is that it is "working,
   visibly better than before, but still the same". There are "lots of slop and mistakes that even
   non-professionals could spot". The panel exists to find them all, with no mercy and no compliments
   for their own sake.
2. **Stop framing Capubridge as a Capacitor/Ionic tool.** The owner considers that framing a founding
   mistake that shrinks the market. The product has grown well beyond it. The panel must find the real,
   bigger category and say what that changes in the product, the brand, the name and the information
   architecture.
3. **The Android companion app is a must, now.** It is an on-device helper that gives more data, more
   reliability, and access where ADB and CDP cannot reach. Today the website promises "no helper APK";
   that promise will change. The panel must design the companion app's role and boundaries, not debate
   whether to build it.
4. **The product serves developers first, and sometimes non-developers, through multiple flows.**
   Non-developers include QA testers, support agents, product people and field technicians.
5. **Groundbreaking changes are welcome** when they make the product stand out. Incremental polish is
   not the goal. The target is a 9.7 overall on `RUBRIC.md`.

## 3. Reference bar

- **Craft and shell:** Claude Desktop, Codex, VS Code, Linear, Raycast.
- **Domain:** Android Studio (App Inspection, Database Inspector, Network Inspector, Logcat v2), Chrome
  DevTools, chrome://inspect, Flipper, Proxyman, HTTP Toolkit (with its Android app), Charles,
  Reactotron, scrcpy, Perfetto, Sentry/LogRocket session replay, Maestro Studio.

A baseline audit scored VS Code at 8.5, Claude Desktop at 8.4 and Codex at 6.9. Capubridge scored 3.1 at
the start and about 6.9 now. Every score after the start was self-assessed by the team that built the
work, so treat those scores as unverified.

## 4. Constraints

- **Platform:** Windows 11 is primary, macOS and Linux later. Android is the device platform; iOS is not
  supported today.
- **Native webview layering:** the mirror is a native child webview, so HTML cannot draw over it.
- **Writes:** device writes always go through the real target, never as local fakes. Native Android
  databases are read-only today.
- **Privacy:** screenshots in the evidence pack show real app data. Never transcribe IP addresses,
  serial numbers, personal names, prices or customer records into a report. Describe them generically,
  for example "a private IP is shown in plain text".

## 5. Evidence

The orchestrator passes the evidence directory in your task. It contains numbered screenshots of every
screen at 1920×1020. They were taken on a real device that was mid-use: at capture time the inspected
app had been sent to the background. Treat that as a real state the product must handle, not a staging
accident.

The source is in this repository; routes and screens live in `apps/desktop/src/modules/*`.

## 6. What every critic returns

These rules apply whatever your role:

- **Separate findings from opinions.** A finding has evidence: a screenshot with its region, a
  `file:line`, or a cited source. An opinion is labelled as one.
- **Score against `RUBRIC.md` anchors**, never against "how it was before".
- **Rank by severity first.** End with the three changes that would move the score the most.
- **Say plainly what you could not judge** from the evidence.
