# Round 01 · 04 — Product design critique (IA, flows, states, interaction)

Critic: product-design-critic. Evidence: the 17 screenshots in the round-01 evidence pack (1920×1020,
real device, inspected app backgrounded for most captures), plus the source on `feat/ui-ux-overhaul`.
Scored against `RUBRIC.md` anchors only. The team's earlier self-score (~6.9) was not used as a baseline.

Screenshot names are shortened: `p01` = `panel-01-device.png`, `p13-grid` = `panel-13-r5b2-cladd-grid.png`,
`p13-hdr` = `panel-13-r5b2-header-menu.png`, `p13-grp` = `panel-13-r5b2-grouped.png`,
`p13-ctx` = `panel-13-r5b-context-menu.png`, `p13-flt` = `panel-13-r5b-sqlite-filter2.png`.

---

## 0. Verdict in five lines

1. **The shell tells three different truths at once.** The context bar says `paused`, the Network toolbar
   says a green `live`, the status bar says `mirror streaming` over a black or white phone, and the
   Performance page says `Discharging` next to a mirror that shows the charging bolt. In this product,
   that is the worst defect class possible, because "One truth" is the thesis.
2. **The rail is organised by protocol, not by job.** Device, App, Data, Network, Elements, Replay and
   Flows are seven peers. Two of them are not destinations at all: Replay is a file picker and Flows is
   an AI chat box. The rail name "Device" is also reused for the mirror toggle.
3. **The non-developer personas have no entry point.** QA, support, product and field staff land on a
   developer's root filesystem, a raw package grid or a chat prompt. None of the four non-developer
   walkthroughs below reaches its goal without knowledge that the UI never teaches.
4. **The command palette searches commands, not evidence.** The study's `#table`, `/request`, `<element`
   and `t:` grammar does not exist (`CommandPalette.vue:66-82`). The keyboard is a launcher, not a way to
   move through data.
5. **What works:** the background banner with "Bring app to front" (`p05`, `p06`, `p07`, `p08`) is the
   best state design in the app. The SQLite grid now has filter, group-by and an inspector (`p13-*`).
   These are islands; the honesty system around them is not yet built.

## 1. Scores (this critic's dimensions)

| Dimension                        | Score   | Why (cap rule applied)                                                                                                                                                                                                                                                                    |
| -------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3 · Information architecture** | **4.5** | The rail mixes nouns of different kinds (things, protocols, files, a chat box). "Device" names two different things. Flows opens an agent, not flows. Replay has no library. The palette and the rail disagree on scope. Two S0 and six S1 are open (F-03, F-04, F-05, F-07, F-11, F-12). |
| **4 · Core flows**               | **4.0** | Developer flows succeed with detours. Every non-developer flow dead-ends (§4). The three steps that matter most are not shortcuts: "app went to background", "save what just happened" and "send this to a dev".                                                                          |
| **7 · States and honesty**       | **3.5** | There are at least four S0 lies on screen at once: F-01, F-02, F-06 and F-08. Empty states blame nothing (F-09). Placeholders ship as content (F-16). The banner is the only honest state pattern, and three surfaces ignore it.                                                          |
| **8 · Interaction quality**      | **5.0** | The go-keys exist but are taught only in hover tooltips that cover the rail (F-13). The native WebView context menu leaks (F-10). The palette is commands-only (F-12). Verbs differ between buttons and dialogs (F-19). The keyboard path for grid editing could not be judged.           |

These four dimensions average **4.25**. With any dimension under 6, the overall score would be capped
at 5.5 even if the other six dimensions scored perfectly. The 9.7 target needs a structural change, not
polish.

---

## 2. The actual information architecture (as built, not as intended)

```
Title bar
├─ logo "capubridge" (lowercase wordmark)
├─ ‹ ›  history (route history, not evidence history)
├─ Context pill: [raw model code] › [app icon + name] [● live | ■ paused] ▾
├─ ● Record                      ← action with no destination (Replay is elsewhere)
├─ Search or run…  CTRL K        ← commands only
├─ >_ (terminal/dock toggle, unread dot)
├─ [▭ Device ●]                  ← MIRROR toggle, labelled "Device"  ✗ collides with rail "Device"
└─ window controls

Rail (labels; collapses to icons with no labels on Data screens: p13-*)   ✗ two rail modes in one session
├─ Device      /devices   → Overview · Apps · Files · Performance
├─ App         /app       → Overview · Performance · Data Usage        ✗ second "Performance", second "Overview"
├─ Data        /storage   → IndexedDB · LocalForage · LocalStorage · Cache · OPFS · SQLite · Graph
│                          (route id "storage", label "Data", palette group "Data")
├─ Network     /network   → Requests · Mocking (experimental, still routed)
├─ Elements    /inspect   → Elements · Vue (plugin route)              ✗ route "inspect", label "Elements"
├─ Replay      /replay    → empty "Open .capu file" picker             ✗ no library; Record lives in title bar
├─ Flows       /automation→ AGENT chat ("What should the agent do?")   ✗ manual flows hidden behind a policy picker
│                          + its own app picker                         ✗ second app context
└─ ⚙ Settings  /settings  → route-MODAL: General · Appearance · ADB · Chrome · Shortcuts · AI/MCP · Updates
   (Preview /preview: experimental, palette-only, orphaned)

Right pane: Mirror (native child webview) + its own toolbar (icons + "SC" glyph label)
Dock: /console/:tab → Logcat · Console · REPL · Exceptions (route-hijack: redirects back)
Status bar: adb ● [model] · [serial] · cdp ●/■ state … mirror streaming · ● console
```

**Duplicates.** There are two "Device" items: the rail item and the mirror toggle (`p01 @ x1640–1745,
y8–42` against `x8–72, y60–120`). There are two "Performance" pages: Device and App. There are two
"Overview" pages. There are two app contexts: the context pill and the Flows app picker (`p01 @
x350–640, y685–705`). The device identity is shown three times: the context pill, the status bar, and
the mirror's "1 device" chip. Link state is shown four times, and the four disagree: the context pill,
the status bar `cdp`, the Network pill, and the status bar `mirror streaming`.

**Orphans.** The Record button has no library to land in. Preview is reachable only through the palette.
Mocking is marked experimental but stays in the tab strip. Graph (Data) has no entry point from rows.
MCP, which is the AI-agent surface with 30 tools, is buried as a Settings tab. Logcat, the most used
Android debugging stream, lives in a dock reached by a fake route.

**Naming drift.** The same areas carry different names across surfaces: storage/Data, inspect/Elements,
automation/Flows/agent/Task history, Replay/session/recording/.capu, Device/devices/mirror, and
target/app/package. The study (§4.2) already renamed some of these. The code, routes, palette groups
and page titles were only half migrated.

---

## 3. Findings (severity-ranked)

Format: **ID · Severity · Evidence · Finding · Fix direction.** "Opinion" marks a judgement without
hard evidence.

### S0: broken or lying

**F-01 · S0 · `p07 @ x105–200, y108–132`; `NetworkPanel.vue:128-140`**
The Network toolbar shows a green `live` pill. Twenty pixels below it, the banner says the WebView is
paused, and the context pill says `paused`. The pill renders `store.captureStatus`, a raw enum that
knows nothing about whether the app is in the foreground. It also uses `success` green, a second
"live" colour, not `signal-live`.
→ _Fix:_ delete the per-panel status pill. Every panel reads the single derived link state (study §6.5).

**F-02 · S0 · `p04 @ x1057–1140, y740–760`; `DevicePerf.vue:662`**
The battery card shows `--%` and `Discharging` while the mirror shows a charging bolt at 99%.
`battery?.charging ? "Charging" : "Discharging"` turns _unknown_ into _discharging_. Replay already
has the correct pattern (`replayPerfSeries.ts:139-141`, "State not recorded").
→ _Fix:_ use a tri-state label everywhere, unknown reads "Not reported", and add a lint rule against
binary labels on nullable data.

**F-03 · S0 · `p02`–`p10` status bar `x1680–1812, y1006`; `StatusBar.vue:39-42`**
The status bar says `mirror streaming` while the mirror is black (`p02`), blank white (`p04`) or shows
the launcher (`p10`). The label tracks whether the socket is open, not whether frames are arriving.
→ _Fix:_ derive it from the frame cadence ("no frames for 4 s", "screen off") and show the age of the
last frame.

**F-04 · S0 · `p01`, `p10 @ x350–640, y685–705` against the context pill `x885–1100, y14–36`; `runOrchestration.ts:124-134`**
Flows keeps its own app selection: a test-bed recorder package. The global context names a different
app. An agent run will act on an app the context bar does not show. This is a P2 violation ("one
active device › app › target").
→ _Fix:_ Flows inherits the context and only overrides it explicitly. If it overrides, it shows the
override as a visible fork chip ("running on X, not the context app").

**F-05 · S0 (IA) · `p10` whole canvas; `AutomationWorkbench.vue:83`**
The rail label is "Flows". The page is an AI agent composer with a "Task history" column. Manual flows,
which the program memory calls the core of CB-M3, appear only if the user changes the _policy_ in the
composer settings (`needsFlow = selectedPolicyId === "rules"`). A user who clicks Flows to record a
repeatable test never finds the step editor.
→ _Fix:_ Flows opens a flow library (manual first). The agent becomes one way to _author_ a flow, not
the landing state.

**F-06 · S0 · `p06 @ x95–280, y220–290`; `IDBExplorer.vue:722`**
The page says "No IndexedDB databases found" while the banner above it says the WebView is paused and
"values may be stale". The UI cannot know there are none. It asserts an empty truth from a failed read.
The main pane then says "Select a database from the sidebar" for a sidebar that is empty.
→ _Fix:_ the gate takes priority over the empty state. Show "Can't read IndexedDB while the app is in
the background. Bring app to front", and never claim "none".

**F-07 · S0 · `p04 @ x116–270, y355–375` and `x116–260, y435–455`**
The Performance page shows `0 cores · avg across all`, CPU `0%`, Memory `0%` and a "Per Core — live"
card that says "Waiting for CPU data…". Zeros are drawn as real data, and the word "live" sits on a
card with no data in it.
→ _Fix:_ no series is drawn before the first sample. Each chart shows its own gate, with what it is
waiting for and since when.

**F-08 · S0 · `p12` (Ctrl+K over Settings)**
Pressing Ctrl+K while Settings is open adds a second scrim: the background visibly darkens between
`p11` and `p12`. No palette appears. Either the palette renders under the modal, or the scrim leaks
without the dialog. _Verdict: plausible, not confirmed in source._
→ _Fix:_ Settings stops being a modal (study §4.2). The palette is the top layer and always wins.

### S1: trust-breaking

**F-09 · S1 · `p06`, `p09`, `p13-ctx @ x340–1910, y95–990`; `IDBExplorer.vue:960-962`, `SqliteExplorer.vue:1829-1832`**
Empty states are written at `text-muted-foreground/30–/50`, which is below AA and below the 11 px floor
rule's intent. They offer no action ("Select a database from the sidebar"). `p13-ctx` shows a whole
empty canvas with no message at all.
→ _Fix:_ one Gate component for every route, with a reason, a next action and a shortcut. Ban
`/30`–`/50` text opacity on informational copy.

**F-10 · S1 · `p13-ctx @ x990–1292, y522–800`**
Right-clicking the Data canvas opens the native WebView menu: Back, Refresh (Ctrl+R reloads the whole
app), Save as, Print, Inspect. Even a non-professional sees this as "a web page in a box".
→ _Fix:_ suppress the default context menu app-wide. Every right-click target gets a Cladd menu that
mirrors the selection action panel.

**F-11 · S1 · `p01 @ x1640–1745, y8–42`**
The mirror toggle is labelled "Device" with a green dot. The rail's first item is also "Device". The
green dot breaks the "green only for live" rule while the app is paused (`p02`–`p10`).
→ _Fix:_ rename it "Mirror" or "Screen". Its dot follows the frame state (F-03), not the socket.

**F-12 · S1 · `CommandPalette.vue:26-37, 66-82`**
The palette has four scopes (all, `>` commands, `@` context, `:` screen). It cannot find a table, a
request, an element, a recording, a flow or a log line. The study (§4.3, §6.4) promised `#`, `/`, `<`
and `t:`. For an expert data tool, a palette that cannot reach data is a launcher.
→ _Fix:_ add an evidence index provider per lens (tables and rows, requests, recordings, flows). Ship
`#` and `/` first.

**F-13 · S1 · `p01 @ x0–118, y130–160`, `p05 @ x0–135, y198–222`, `p07 @ x0–170, y328–352`, `p09 @ x0–160, y458–482`**
The rail tooltips ("App beta G A") render over the next rail label and over table rows. They repeat a
label that is already visible, and they are the _only_ place the go-keys and maturity are shown.
Maturity ("beta") was supposed to move to Settings (study §4.1).
→ _Fix:_ show the tooltip only when the rail is collapsed, and place it to the right of the rail. Teach
go-keys in the palette rows (the Raycast pattern) and in a `?` sheet.

**F-14 · S1 · `p02 @ x790–985, y112–132`; `DeviceApps.vue:140-147`**
The Apps page says "84 apps" next to "75 user · 364 system". The numbers come from three sources: the
live query, the cache and the current page. No total adds up.
→ _Fix:_ use one count source. If a value is cached, label it with its age.

**F-15 · S1 · `p03` whole page**
Files opens at the device root `/`. Two folders are named `?`. The tree and the grid show the same
listing twice. The mode dropdown is truncated ("Manı") and so is "Current folde". For every persona
except a platform engineer, the right default is the _app's_ private and external data folder, which
the App page already knows (`p05 @ x1060–1480, y445–505`).
→ _Fix:_ when an app is in context, open Files on its folders. Make "/" an explicit choice. Show
unreadable entries as "no permission", not "?".

**F-16 · S1 · `p05 @ x461–592, y302–318`, `x1160–1215, y302–318`; `AppOverviewSurface.vue:240, 262`**
Placeholders ship as content: "— threads" and "— · fg —". Runtime memory and Memory both show the
same 234 MB. The version appears twice, SDK appears twice, and the FLAGS column is truncated with no
tooltip ("USER*SEN…").
→ \_Fix:* hide fields that are unknown, or say why they are unknown. Remove the duplicated facts.

**F-17 · S1 · `p08 @ x105–1500, y186–204`**
The DOM tree prints `<htmllang="en"dir="ltr"data-rail=…`. The whitespace between the tag and its
attributes has collapsed. It is the first line of the Elements panel.
→ _Fix:_ render attributes as separate tokens with spacing in CSS, not as joined text.

**F-18 · S1 · `p13-grid @ x385–1200, y250–272` and the dead area `x1200–1900`**
Column headers truncate to 2–4 characters ("exter…", "att…", "sl…", "\_.", "\_write…"). Meanwhile 40% of
the grid width sits empty. Column widths are neither content-aware nor fill-aware.
→ _Fix:_ size columns from the header and a sample of rows, give the remaining width to the last text
column, and show the full name on header hover.

**F-19 · S1 · `p05 @ x1208–1482, y168–204`; `AppInspectorPanel.vue:72,119`**
The button says "Stop" and its confirmation dialog says "Force Stop". The button says "Clear" and its
dialog says "Clear Data". The destructive Clear button is a filled red block, louder than the primary
"Open".
→ _Fix:_ use the same verb on the button, the dialog and the palette. Destructive actions get an
outline style and a confirmation that types out the package name, not a hero colour.

**F-20 · S1 · `p11` and `p12`**
Settings is a route-modal with two settings on its General tab. Behind it, the mirror region keeps its
full brightness in `p11`, and the scrim only half-covers it.
→ _Fix:_ make Settings a full page (already decided in study §4.2).

**F-21 · S1 (opinion backed by source) · `AutomationWorkbench.vue:591-600`**
A customer-specific acceptance toggle (`presalio-order-v1`, shown only for one client package) ships in
the general product UI. It contradicts the "bigger category" directive and leaks client work into the
product.
→ _Fix:_ move it to a fixture or plugin, out of the shipped UI.

### S2: polish (trained eye)

- **F-22 · `p13-grid` against `p13-hdr` against `p01`.** The rail has labels on six screens and shows
  icons only on the Data screens. In one session it looks like two products. → _Fix:_ persist one rail
  mode and change it only on the user's toggle.
- **F-23 · `p13-grid @ x120–200, y203–222`, `p13-flt @ x155–245, y217–237`.** Storage engine jargon
  ships as primary badges: `SAH-POOL`, and `NATIVE` in green. Database names truncate to "com.g…" and
  "P…". → _Fix:_ use plain names ("OPFS (SAH pool)") in a tooltip and the engine as secondary text.
  Widen the database column or wrap the names.
- **F-24 · `p13-hdr @ x385–1117` against `x1880`.** In the group-by view the label column is 730 px wide
  and the counts sit 770 px away at the far right edge. → _Fix:_ place the count next to the label.
- **F-25 · `p13-grp @ x383–480, y285–925`.** The first column's values are clipped on the left edge, so
  the id strings lose their first characters. → _Fix:_ left-align ids or clip with a leading ellipsis.
- **F-26 · `p13-flt` against `p13-grid`.** Cell text is monospace in one build and proportional in the
  other. → _Fix:_ use proportional type for text and monospace only for ids, numbers and JSON.
- **F-27 · `p02 @ x80–235, y410–430`, `x695–865, y562–582`.** App names are clipped on _both_ sides
  ("ıc Viewer (Powered by"), with no tooltip. Several icons are blank. → _Fix:_ clip on one side only,
  add a tooltip, and give apps without an icon a fallback glyph.
- **F-28 · `p01`–`p10` mirror toolbar `x1785–1805, y62–78`.** The label "SC" is an unexplained
  two-letter glyph. → _Fix:_ use an icon with a tooltip, or a word.
- **F-29 · Status bar, every shot.** The device serial and a raw model code are shown in plain text on
  every screen. The SLOP catalogue flags a sensitive value shown by default. → _Fix:_ show a nickname by
  default and reveal the serial on hover.
- **F-30 · `p07 @ x85–1500, y178–212`.** On Network the background banner sits _inside_ the table,
  under the summary. On every other page it sits at the top. → _Fix:_ one placement, directly under the
  tab strip.
- **F-31 · `p03` folder icons.** Large orange folders turn a file browser into decoration and break P8
  ("colour encodes one thing"). → _Fix:_ use neutral glyphs, and colour only the meaningful entries
  (the app's own folders).

---

## 4. Walkthroughs (six tasks; four non-developer personas)

Legend: **Knows** = what the user must already know. **Trap** = where they go wrong. **UI says / truth.**

### W1 · Developer: "Why did my order not sync?" (dev, ~expert)

1. The developer opens the app and lands on `/devices/overview` (route default). **Trap:** in `p01` the
   capture actually shows the Flows agent page. The landing page is not their app.
2. The context pill already names the app, so they go to Data → SQLite and pick the table (`p13-grid`).
   It works. **Knows:** that SQLite sits under "Data", that the database is "PresalioStore.sqlite3", and
   that `SAH-POOL` means OPFS.
3. They want the network request that wrote the row. They go to Network and filter by URL. **Truth:**
   no link exists from the row to the request (no provenance). **UI says:** `live` while paused (F-01).
4. They want the Logcat line around the failure. The dock has its own filter, with no shared time
   cursor.

**Result:** the developer succeeds in about 6–9 steps across three lenses with no shared clock. The
thesis "one clock" is not visible on any live screen. Only Replay has a timeline.

### W2 · Developer: "The app went to background mid-session" (state handling)

1. They switch to another app on the phone. Pages with the banner (`p05`–`p08`) handle it well, with
   "Bring app to front".
2. Device → Performance shows zeros and "Discharging" (F-02, F-07). Network says `live` (F-01). Data
   says "none found" (F-06).

**Result:** half the surfaces are honest and half lie. A developer cannot tell which numbers to trust,
so they will trust none of them.

### W3 · QA tester: "Reproduce bug #123 and attach evidence to the ticket"

**Knows:** nothing about ADB, CDP or `.capu`.

1. The tester looks for a "Record" or "Report" entry and finds `● Record` in the title bar. It is
   unclear _what_ gets recorded (screen? data?). The config modal exists but is not visible here.
2. They reproduce the bug and stop. **Trap:** where did the recording go? Replay (`p09`) says "No
   session loaded — Open a .capu file". There is no library, no recent list and no "just recorded" item.
3. They want to attach it to a ticket. There is no export, share or "copy link" in the evidence, and no
   redaction preview.

**Result:** dead-end at step 2. The tester needs to know the file system path of a `.capu`.

### W4 · Support agent: "Customer says their stock numbers are wrong" (remote, possibly no laptop at customer)

**Knows:** the customer's phone model and the app version, nothing technical.

1. The phone is not in the room. Capubridge requires USB or Wi-Fi ADB to the agent's machine, so the
   job is impossible today. The companion app is the only route: a customer-side capture sent back as a
   `.capu`.
2. If the phone is present, the agent opens App (`p05`). They see permissions, sizes and a red "Clear"
   button that looks like the main action. **Trap:** the most dangerous action is the most prominent
   one.
3. They need "what does the app think the stock is?". The answer is Data → SQLite → the right table,
   behind three unexplained names. There is no "saved view" a developer could prepare for support.

**Result:** dead-end at step 1 remotely. With the phone present, the agent faces high risk (F-19) and
needs knowledge they do not have.

### W5 · Product manager: "Is the new onboarding live in build 0.1.10, and does it work?"

1. App → Overview shows the version (twice). There is no feature-flag, remote-config or "what changed"
   view.
2. They try Flows to run the onboarding happy path and get a blank agent prompt ("Describe what you
   want the agent to do"). It names an internal model (`Jev · jev-1.13`). **Trap:** the send button is
   disabled with no reason (`p01 @ x1210–1255, y905–948`) and needs a data-notice acknowledgement
   (`agentPanelState.ts:38`) that the UI does not surface here.
3. There are no saved flows to run with one click.

**Result:** dead-end. Product people need a "Run checks" library of named flows with pass/fail, not a
blank chat box.

### W6 · Field technician: "Device in a warehouse misbehaves; capture it for HQ"

**Knows:** how to unlock the phone. No laptop, or a laptop with no admin rights.

1. Nothing in the desktop product addresses this. The capture has to happen on the phone.
2. The memory notes a field-recorder program (`@cavulsqa/recorder` emits `.capu`), but it is an SDK in
   the app, so it only covers apps the team builds.

**Result:** impossible today. This persona is the strongest argument for the companion app: a
"Capture" button on the phone that records the screen, logcat and the target app's storage diff, then
uploads or shares a `.capu`. Desktop opens it as a case.

---

## 5. State audit (every state in the evidence)

| State                             | Where                                                      | Honest?                                | Actionable?                                              | Consistent?                                                                                  |
| --------------------------------- | ---------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Live                              | `p01`, `p11`, `p13-grid` context pill                      | Yes                                    | —                                                        | Two greens: `signal-live` against `success` (F-01, F-11)                                     |
| Background / paused               | Banner on `p05`–`p08`                                      | **Yes**, with the best copy in the app | **Yes**: "Bring app to front"                            | **No**: missing on Device pages, Replay and Flows. Placed inside the table on Network (F-30) |
| Paused, but panel claims live     | `p07` Network pill                                         | **No** (F-01)                          | No                                                       | No                                                                                           |
| Unknown shown as a value          | `p04` battery, CPU, memory                                 | **No** (F-02, F-07)                    | No                                                       | No (Replay does it correctly)                                                                |
| Mirror "streaming" with no frames | Status bar `p02`–`p10`                                     | **No** (F-03)                          | No                                                       | No                                                                                           |
| Empty (no data read)              | `p06` IDB                                                  | **No**: claims "none" (F-06)           | Offers "Import JSON snapshot", which is the wrong action | No                                                                                           |
| Empty (nothing selected)          | `p02` package inspector, `p08` styles, `p13-flt` inspector | Yes                                    | Weakly: text only, monospace prose in `p08`              | Three different typographic treatments                                                       |
| Empty (no session)                | `p09` Replay                                               | Honest                                 | Only "Open file": no library, no "Record now"            | —                                                                                            |
| Empty (no history)                | `p01` Task history column                                  | Silent: a blank 360 px column          | No                                                       | No                                                                                           |
| Disabled                          | `p01` agent send button                                    | No reason given                        | No                                                       | No                                                                                           |
| Read-only / local copy            | `p13-*` footer                                             | Yes, a good provenance hint            | Partly: why read-only?                                   | It is the only surface with a provenance hint                                                |
| Experimental                      | Mocking tab, Flows, Preview                                | Shown only in tooltips                 | —                                                        | Mocking is routed although experimental                                                      |

The background banner proves the team can do this right. The defect is architectural: each panel owns
its own status. Until state is derived from one store and rendered by one Gate component, every new
panel will invent a new lie.

---

## 6. Interaction audit

- **Command palette:** commands, context (`@`) and screen actions (`:`) only (F-12). There is no data
  index, no recent evidence and no action panel (`Ctrl+.`) in the evidence. The keyboard footer could
  not be verified because the palette never rendered (F-08).
- **Keyboard reach:** go-keys exist (`feature-registry.ts`: `g d`, `g a`, `g s`, `g n`, `g e`, `g r`,
  `g f`) but are taught only in hover tooltips (F-13). Settings and Preview have no go-key. Grid
  keyboard editing could not be judged: no capture shows editing.
- **Hover- or right-click-only actions:** the native context menu leaks (F-10). Row actions in the grid
  are right-click (`p13-*` name) with no visible equivalent in the toolbar. The header menu (`p13-hdr`)
  is reachable only through a `…` that appears on hover (`x1100, y261`).
- **Verbs:** Stop/Force Stop, Clear/Clear Data (F-19), Record/Replay/session/.capu, and Flows/agent/task.
- **Two navigations that disagree:** ‹ › in the title bar walk _route_ history, not evidence history
  (study §4.3). Opinion: a back button that skips the table and row you were on feels broken in a data
  tool.
- **Focus rings:** a visible cell focus ring is present in the grid (`p13-grid @ x456–576, y315–343`). It
  is a full white rectangle, heavier than the selection. Opinion: it reads as an input box, not a
  cursor.

---

## 7. Category: where I disagree with the brief, and where I agree

**I agree** that "Capacitor/Ionic tool" is too small. The UI already mostly dropped it: one `capacitor`
badge (`p05 @ x438–512, y165–184`). The website hero already says "Android WebView workbench". The
remaining problem is the **website runtime marquee**, which lists Capacitor, Ionic and Cordova, plus
React Native, which is not a WebView runtime (`apps/website2/src/data/runtimes.ts`). That claim is
misleading today.

**I disagree that "WebView" is the right replacement.** It is the same mistake one level up. Look at
what the product actually does in the evidence: device and app management (`p02`, `p05`), filesystem
(`p03`), vitals (`p04`), native SQLite (`p13` `NATIVE`), session recording, automation, and an MCP
server for agents. None of these is WebView-specific. Once the companion app exists, native apps
(SharedPreferences, Room, native network through a VPN service, the accessibility tree) become
reachable too.

**The category, in my view:** _the evidence workbench for Android apps on real devices._ It captures,
inspects, reproduces and hands off what an app did on a real phone, for developers and the people
around them. The nearest competitors are not Chrome DevTools. They are Android Studio's App Inspection
(developer only), Sentry and LogRocket (cloud, no device control) and HTTP Toolkit (network only).
None of them joins **device control, app data, network and session evidence on one clock and lets a
non-developer capture it.** That join is the category.

Consequences for IA: the primary object becomes **the case** (a live or recorded session about one app
on one device), not the protocol. The name question belongs to the brand critic. Opinion: "capubridge"
carries "Capacitor" in its first syllable and will keep reintroducing the old framing.

---

## 8. Target information architecture (companion app as a given)

### 8.1 Principles for the rail

1. **The rail is made of jobs, not protocols.** A user should never need to know that IndexedDB and
   SQLite are different technologies to find "the app's data".
2. **One context, three link sources.** The context bar shows `device › app › target` and a link
   cluster `adb · cdp · companion`. Each part says what it unlocks. Example: "companion off: no native
   network, no prefs".
3. **Live and recorded are the same lenses.** A case is the context. Replay stops being a rail item.

### 8.2 The target rail

| Rail             | Contains                                                                                                                                                    | Replaces                                                            | Companion app role                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Cases** (home) | The live case for the current context, a recent-cases library (recordings, imports from the phone), a "New capture" button, export and share with redaction | Replay, the Record button's destination, the empty landing          | Receives captures made on the phone (W4, W6)                                                  |
| **Screen**       | Mirror, inspect lens, Elements (DOM and native accessibility tree), components                                                                              | Elements, the mirror toggle "Device"                                | Native a11y tree and reliable input when the WebView is paused                                |
| **Data**         | One workbench: SQLite (native, OPFS, jeep), IDB, LS, LF, Cache, OPFS, SharedPreferences, Files (app folders first)                                          | Storage tabs and App → Data Usage; Device → Files for the app scope | `run-as`-free reads of native prefs and databases, and change notifications for "watch table" |
| **Network**      | Requests (WebView and native), Mocks, Throttle, WebSockets                                                                                                  | Network                                                             | VPN-service capture for native traffic (the HTTP Toolkit model)                               |
| **Checks**       | A flow library (manual first), runs with pass/fail, the agent as an _author_ of checks                                                                      | Flows / agent landing                                               | On-device runner, so checks run without a laptop                                              |
| **Device**       | Fleet (multiple phones), vitals, all apps, the full filesystem, shell, ports                                                                                | Device and App overview merged                                      | Battery, thermal and screen state as _reported_ truth (fixes F-02, F-03)                      |
| ⚙ **Settings**   | Full page; Agents and MCP get their own section                                                                                                             | Settings modal                                                      | Pairing, permissions granted, companion version                                               |

The status bar keeps ambient truth only, and each item appears once: links, frame age, the recording
indicator, active mocks. The timeline strip sits under the workspace on every lens, live and recorded
(study §6.1). Without it, "one clock" is a slogan.

### 8.3 Persona entry points (same IA, different front doors)

- **Developer:** Cases → the live case → any lens. The keyboard does the rest.
- **QA:** "New capture", then reproduce, then "Stop and file". The case opens with an auto summary
  (errors, failed requests, data writes) and export goes straight to the ticket.
- **Support:** "Open capture" from a customer link, or a case prepared by a developer with **saved
  views** ("Stock for SKU", one click). Those views are read-only by role.
- **Field technician:** uses the companion app only (Capture → Send). They never see the desktop app.
- **Product:** Checks → named flows → Run → pass/fail with evidence links.

### 8.4 Bold alternative IA: "The case is the app" (no rail)

Remove the rail entirely. The window _is_ one case, which can be live or recorded:

```
┌ Case: [device › app]  ● live  · companion ✓ · adb ✓ · cdp ■ paused        ⌘K  Share ┐
│ ┌ Screen (mirror / frame at T) ┐ ┌ Evidence stream (one list, typed rows) ──────────┐ │
│ │                              │ │ 15:16:21  tap  "Validate order"                  │ │
│ │                              │ │ 15:16:21  POST /sync  500  ▸                     │ │
│ │                              │ │ 15:16:22  SQLite orders  row 412  status→failed  │ │
│ │                              │ │ 15:16:22  console.error  SyncError …             │ │
│ └──────────────────────────────┘ └──────────────────────────────────────────────────┘ │
│ ┌ Inspector: the selected evidence, full detail, related evidence, actions ─────────┐ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│ Timeline ◀━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━▶ now     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- The main surface is **one merged evidence stream**: taps, requests, row writes, logs, errors and agent
  steps, filtered with one query grammar (`type:request status:5xx`, `table:orders`). The specialised
  lenses (grid, request detail, DOM tree, flame chart) open _as inspector expansions or tabs_ from a
  piece of evidence, never as top-level destinations.
- Developers keep full power through tabs and `⌘K` (`#orders`, `/sync`, `t:15:16:21`).
  Non-developers see the same screen as a readable story, top to bottom.
- Live and recorded are identical except for the right edge of the timeline. The companion app fills
  the stream when ADB or CDP cannot (native network, screen state, prefs).
- **Why it beats the references:** Chrome DevTools and Android Studio split everything into
  protocol-shaped panels. Sentry and LogRocket have a stream but no live device and no data. Nobody
  merges _control_ and _evidence_ in one stream. This is the differentiation dimension made visible on
  the first screen.
- **Risk:** density for heavy single-lens work, such as hours in the SQL grid. Mitigation: a lens can
  be "maximised" into a full tab, so the stream is the home, not a cage.
- **Assumption:** `.capu` and the live buffer can feed one typed event index at interactive speed. This
  is a feasibility gate that is the same as study §5.2.

My recommendation: **ship 8.2 now, and prototype 8.4 as the Cases home screen.** If testers and
support finish W3 and W4 in under two minutes there, promote it to the default and demote the rail to
tabs.

---

## 9. What I could not judge

- The palette UI, its keyboard footer and its focus behaviour: it never rendered in the evidence (F-08).
- The Logcat, Console, REPL and Exceptions dock: not captured.
- The Replay player with a loaded session, the recording config modal, the Flow step editor and the
  Mocking tab: none captured.
- Grid editing, the changeset and commit flow (study P3): not captured. The footer says "read-only"
  on every `p13-*` shot.
- Light theme, window widths under 1920, and multi-device behaviour.
- Device Overview: `p01` was meant to show it but captured the Flows page with a rail tooltip
  instead. That may be a capture accident, or a sign that the rail click did not navigate.

---

## 10. The three changes that would move the score most

1. **One derived state, one Gate component, zero panel-owned status.** This deletes F-01, F-02, F-03,
   F-06, F-07 and F-09 in one architectural move. Every lens renders `Gate(reason, next action,
shortcut)` before content, and no nullable value gets a binary label. _Impact:_ States and honesty
   go from 3.5 to about 7.
2. **Rebuild the rail around jobs (§8.2), with Cases as the home and Checks replacing the agent
   landing.** This fixes F-04, F-05, F-11, F-15 and F-20, gives QA, support and product a front door,
   and makes the companion app a visible link source instead of a hidden helper. _Impact:_ IA from 4.5
   to about 7, Core flows from 4.0 to about 6.5.
3. **Turn the palette into an evidence finder (`#`, `/`, `<`, `t:`, cases, checks) and kill the native
   context menu.** This fixes F-10, F-12 and F-13. It is the cheapest way to make the tool feel expert
   and the first visible piece of "one clock". _Impact:_ Interaction from 5.0 to about 7.

Status: [AI-assisted]. These findings need an owner "explain it back" before they are acted on.
