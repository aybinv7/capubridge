# Round 02 · Layout proposal A (Instrument bench)

2026-11-04 · Designer: principal product designer, density-first angle · `[AI-assisted]`

Reads: `LAYOUT-BRIEF.md`, `BRIEF.md`, `RUBRIC.md`, `round-01/00`, `04`, `05`, the capability inventory,
`apps/desktop/DESIGN.md`, `packages/cladd/src/components`, `apps/desktop/src/components/layout`,
`apps/desktop/src/app`, and the evidence pack. No source was edited, nothing was built or run.

All sizes are **CSS px**. Windows scaling matters here: the evidence was captured at 125 %, so the
owner's daily 1920×1080 monitor is a **1536×864 CSS** canvas. This proposal is drawn at the two
sizes the brief asks for (1920×1080 and 1280×800 CSS) and gives the 1536 numbers wherever they
differ, because 1536 is the size this tool will actually be judged at.

---

## 0. Thesis

Capubridge is a bench, not a website: **one context, one clock, many probes.** The window is a
fixed frame whose regions never change their job. The context bar says _what_ you are attached to and
_how well_. The timeline strip under it says _when_: it spans the whole workspace, it is always
there, and it is the only time control. Lenses (Session, Data, Network, Elements, Performance) open
as **documents** in VS Code-grade tab groups, and every document is a view over the same context at
the same playhead. The **inspector** always shows the one thing you selected, with its source, its
tier and its read time. Streams (Logcat, Console, Shell, Agent) live in the **bottom panel**. The
phone lives in a **device pane** that is a full-height column, never shared with anything. Every
action has a key. Live and recorded are the same shell; only the right edge of the clock and the
provenance pattern change.

**What I deliberately sacrifice:**

- First-glance friendliness. The default shell is dense. Non-developers get a story-first Session
  document and a Start page, not a simpler shell.
- The mirror as hero. The phone is an instrument window in a 360 px column, not the centre of the
  screen. A "Screen" document exists for the cases where it must be large.
- 28 px of height, permanently, for the timeline. It cannot be hidden.
- Floating panels and free layout. Regions dock in fixed slots. Only editor groups split.
- Auto-adapting chrome. The rail never changes mode by itself, and status is never repeated.

---

## 1. Finding that changes the layer stack (read this first)

The brief says the mirror is a native child webview. **For Android devices it is not.**

- `apps/desktop/src/modules/mirror/MirrorStream.vue:292` draws scrcpy frames into an HTML
  `<canvas>`. Frames arrive over a Tauri `Channel` and are decoded in JS
  (`modules/mirror/mirrorDecoder.ts:1-17`).
- The **only** native child webview is the _local preview_ target:
  `modules/mirror/LocalWebviewHost.vue` → `src-tauri/src/commands/local_webview.rs`. It occupies the
  same pane slot when the selected target's source is `local` (`MirrorPanel.vue:50`).
- "SC" (`MirrorTopBar.vue:107-114`) launches scrcpy as a separate OS window, outside the shell.
- `useOverlayGuard.ts` holds a guard on the **local webview store** only.

Consequence for this design: HTML _can_ draw over an Android mirror today, and the V-38 defect (the
phone stays bright under the Settings scrim) is a plain CSS miss, not a platform limit.

I still design the device pane as a **native-capable zone** with one rule for every target kind,
for three reasons:

1. local preview targets are native now;
2. a GPU or native-surface mirror is the obvious performance upgrade;
3. one rule is cheaper to reason about than two.

I do not hide the canvas when it is not needed: a freeze-frame swap happens only for native surfaces.

---

## 2. The full shell

### 2.1 1920×1080 (L breakpoint), all regions docked

```
x→ 0   56        304                                              1236         1556              1920
y0 ┌───┬──────────────────────────────────────────────────────────────────────────────────────────────┐
   │ ◧ │ ‹ › │ ▯ Pixel-class phone ▾ › ⬢ Retail app ▾ › ◫ main WebView ▾ │● live · 38 ms│A●S○C○K○│ ⏺ Record │⌕ Go to anything…  Ctrl K│▥▤▣│ — ▢ ✕ │
y36├───┼──────────────────────────────────────────────────────────────────────────────────────────────┤ context bar 36
   │   │ All evidence ▾│▁▂▁▃█▂▁▁▂▁▁▅▁▁▂▁▃▁▁▁▂▁▁▁▁▁▂▁▁▃▂▁▁▁▁▂▁▁▁▁▁▁▂▁▁▁▁▂▁▁▁▁▃▁▁▁┃● now│−5:00 ⤓Keep  ⇥│ timeline 28
y64├───┼──────────┬──────────────────────────────────────────────────┬──────────────┬───────────────┤
   │ ▣ │ DATA   ⋯ │ orders ×│ POST /sync ×│ ⌗ query 1 ×│            ⫽ ⋯│ ROW 412    📌⋯│ ◫ ⟳ ⌖ ⏺ ⋯   │ tabs 32 │ pane tb 32
   │Ses│ ⌕ Filter │──────────────────────────────────────────────────│──────────────│───────────────│
   │   │ ▾ Retail │ ⌕ WHERE…        Segm: Rows│Schema│SQL  via ADB·12s│ via ADB pull │ ┌───────────┐ │ doc tb 32
   │ ▤ │   ▸ IDB  │──────────────────────────────────────────────────│ read 14:02:11│ │           │ │
   │Data   ▾ SQLite│ # │ id │ status  │ total │ updated_at       │…  │──────────────│ │  phone    │ │
   │   │    orders│───┼────┼─────────┼───────┼──────────────────┼── │▾ Details     │ │  frame    │ │
   │ ◎ │    lines │ 1 │ 410│ pending │  12.0 │ 14:01:58         │   │ status  failed│ │  344×764  │ │
   │Net│   ▸ LS   │ 2 │ 411│ synced  │   8.5 │ 14:02:01         │   │ total   …     │ │           │ │
   │   │   ▸ Cache│▶3 │ 412│ failed  │  31.0 │ 14:02:11 ◆       │   │▾ Related ±2 s│ │           │ │
   │ ⌖ │   ▸ OPFS │ … 24 px rows, 28 visible with panel open     │ POST /sync 500│ │           │ │
   │Elm│ ▾ Imports│                                              │ log  SyncErr  │ │           │ │
   │   │          │                                              │▾ Write history│ └───────────┘ │
   │ ∿ │          │                                              │▾ Actions      │ ◁  ○  ▢   ⏻   │ keys 32
   │Prf│          ├──────────────────────────────────────────────┴──────────────┤ frame 0.1 s · 58 fps │ 20
   │   │          │ Logcat │ Console │ REPL │ Exceptions │ Shell │ Agent    ⌄ ⤢ │               │ panel hdr 28
   │ ✓ │          │ ⌕ level:error tag:sync                         ● tail      │               │ query 32
   │Chk│          │ 14:02:11.204 E SyncWorker  POST /sync failed: 500          │               │ rows 20
   │ ▯ │          │ 14:02:11.207 W Room        txn rolled back                 │               │
   │Dev│          │ … panel 240 total                                          │               │
   │ ⌁ │          │                                                            │               │
   │ ⚙ │          │                                                            │               │
y1056├─┴──────────┴────────────────────────────────────────────────────────────┴───────────────┤
   │ ⟳ Pulling PresalioStore 42 % │ Buffer 4:12/5:00 · 38 MB │      3 rows · sum 51.5 │ 2 mocks │ MCP read │ status 24
y1080└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

Horizontal budget at 1920: rail **56** · navigator **248** · editor **≈928** (after three 1 px
dividers) · inspector **320** · device pane **360**.

Vertical budget at 1920: context **36** · timeline **28** · tabs **32** · document toolbar **32** ·
grid header **24**, then the rows, then the panel **240** and the status bar **24**. The first data row
starts at y=152: **14 % chrome** before data, against 27 % today (`05-visual-craft.md` §4). With the
panel closed, the editor shows **38 rows** at 24 px; with it open, it shows **28**.

The panel spans the navigator's right edge to the inspector's right edge. The navigator, rail and
device pane run the full height, because a phone frame at 344 px wide needs about 764 px of height
(a 20:9 ratio).

### 2.2 1280×800 (S breakpoint)

```
x→ 0   56                                              716          996          1280
y0 ┌───┬──────────────────────────────────────────────────────────────────────────┐
   │ ◧ │‹ ›│▯ Pixel-cl… ▾›⬢ Retail ▾›◫ main ▾│■ paused 1:12│A●S○C○K○│⏺│⌕ Ctrl K│▥▤▣│—▢✕│ 36
y36├───┼──────────────────────────────────────────────────────────────────────────┤
   │   │All ▾│▁▂▁▃█▂▁▁▂▁▁▅▁▁▂▁▃▁▁▁▂▁▁▁▁▁▂▁▁▃▂▁▁▁▁┃▨▨▨ paused ▨▨│−5:00 ⇥│ 28
y64├───┼──────────────────────────────────────────────────────────────────────────┤
   │   │ ▨ App in background · WebView paused 14:02:11 · SQLite & Logcat still live │ notice 28
   │   │                                   [Bring to front  Ctrl Shift F]          │ (only when present)
y92├───┼──────────────────────────────────────────┬──────────────┬─────────────────┤
   │ ▣ │ orders ×│ POST /sync ×│            ⋯     │ ROW 412   📌 │ ◫ ⟳ ⌖ ⏺ ⋯       │ 32
   │ ▤ │ ⌕ WHERE…      Rows│Schema│SQL  ADB·12s │ via ADB pull │ ┌─────────────┐ │ 32
   │ ◎ │ # │ id │ status  │ total │ updated…  │ 3 s ago      │ │   frame     │ │
   │ ⌖ │ … editor 660 wide, 18 rows with panel │▾ Details     │ │   264×587   │ │
   │ ∿ │                                       │▾ Related ±2 s│ │             │ │
   │ ✓ │                                       │              │ └─────────────┘ │
   │ ▯ ├───────────────────────────────────────┴──────────────┤ ◁  ○  ▢  ⏻      │
   │ ⌁ │ Logcat │ Console │ REPL │ Exceptions │ Shell │ Agent │ frame 0.1 s     │
   │ ⚙ │ … panel 200                                           │                 │
y776├──┴────────────────────────────────────────────────────────┴─────────────────┤
   │ Buffer 4:12/5:00 │                               3 rows · sum 51.5 │ MCP read │ 24
y800└───────────────────────────────────────────────────────────────────────────────┘
```

At 1280, the navigator is an **overlay drawer**, 248 px wide, opened with `Ctrl B` or by clicking the
active rail item. It slides over the editor from the left edge, and never over the device pane. The
editor is **≈660** px wide, the inspector **280**, the device pane **280** (a 264 px frame).

At **1536×864** (the owner's 125 % screen), the shell gets rail 56 · editor **≈880** · inspector 300 ·
device 300, with the navigator as a drawer.

### 2.3 Breakpoints and collapse order

| Width (CSS)   | Navigator                  | Inspector                                  | Device pane                                                   | Rail      |
| ------------- | -------------------------- | ------------------------------------------ | ------------------------------------------------------------- | --------- |
| ≥ 1680 (L)    | docked 248                 | docked 320                                 | 360                                                           | 56, label |
| 1360–1679 (M) | **drawer** (collapses 1st) | docked 300                                 | 300                                                           | 56, label |
| 1180–1359 (S) | drawer                     | docked 280                                 | 280 (shrinks 2nd)                                             | 56, label |
| 1024–1179     | drawer                     | **drawer** (3rd), right edge of the editor | 240                                                           | 56, label |
| < 1024 (XS)   | drawer                     | drawer                                     | **48 px filmstrip** (4th): a frame thumbnail and play/inspect | 56, label |

The editor's minimum width is **560**, and the breakpoints are chosen to keep it there. The rail
labels **never** collapse automatically, which fixes F-22 and V-66 (two rail modes in one session).
A user toggle (`View › Compact rail`, 40 px icons only) persists, and the tooltip then opens to the
right.

---

## 3. Answers to the ten questions

### Q1 · Region map

| Region             | Job (one only)                                           | 1920×1080          | 1280×800   | Min / max            | Collapses                                                                                  |
| ------------------ | -------------------------------------------------------- | ------------------ | ---------- | -------------------- | ------------------------------------------------------------------------------------------ |
| **Context bar**    | What you are attached to, and the link's health          | h 36               | h 36       | fixed                | Segments truncate middle-out: target, then app, then device name. Tiers fold to four pips. |
| **Timeline strip** | When: the playhead, the now-edge, density, marks         | h 28 (92 expanded) | h 28       | 28 / 92; **never 0** | Never hides. The lane picker folds to an icon below 1280.                                  |
| **Context notice** | One non-blocking context condition                       | h 28 when present  | h 28       | 0 / 28               | Not collapsible. It is present only while the condition is true.                           |
| **Rail**           | Pick a lens (what the navigator shows)                   | w 56               | w 56       | 40 (user) / 56       | Never automatically.                                                                       |
| **Navigator**      | Pick an object inside the lens                           | w 248 docked       | drawer 248 | 200 / 400            | 1st: becomes a drawer below 1680.                                                          |
| **Editor groups**  | Documents (lens views over the context)                  | ≈ 928              | ≈ 660      | **560** / —          | Never. Groups merge into one below 1180.                                                   |
| **Inspector**      | The one selected thing: source, tier, time, actions      | w 320              | w 280      | 280 / 480            | 3rd: becomes a drawer below 1180.                                                          |
| **Device pane**    | The phone (live frames or recorded frames)               | w 360              | w 280      | 240 / 560            | 2nd: shrinks to 240. 4th: 48 px filmstrip below 1024.                                      |
| **Panel**          | Streams: Logcat, Console, REPL, Exceptions, Shell, Agent | h 240              | h 200      | 120 / 60 % of height | Closes with `Ctrl J`, maximises with `Ctrl Shift J`.                                       |
| **Status bar**     | Ambient instrument facts, never link state               | h 24               | h 24       | fixed                | The right items drop by priority.                                                          |

**The status bar no longer shows link state, the serial or the model.** The context bar owns link
state. This removes the four-way disagreement in F-01, F-03, V-04 and V-34 by construction: there is
one place to look, and it reads `activeContext.link`.

### Q2 · Navigation model

**The rail represents lenses: kinds of view over the current context.** It is not a list of places.

| Rail item (go key)      | Navigator shows                                                                                   | Default document                        |
| ----------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Session** (`g s`)     | The live session (pinned on top), then the recording library (recent, search, device/app filters) | Session overview (story + lanes)        |
| **Data** (`g d`)        | A tree: origin › engine › database › table/store, plus _Imports & snapshots_, plus _Saved views_  | The last table, or the database summary |
| **Network** (`g n`)     | Saved filters, hosts, Mocks, WebSockets (behind a flag until ready)                               | The request list                        |
| **Elements** (`g e`)    | Frames, shadow roots, detected framework tools (Vue/React components)                             | DOM tree                                |
| **Performance** (`g p`) | Presets: app process, device, network I/O                                                         | Lanes view                              |
| **Checks** (`g c`)      | The flow library (manual first), runs, drafts                                                     | The last flow, or the library           |
| **Device** (`g v`)      | Devices and emulators, Apps, Files, Ports, Device info                                            | The current app's App document          |
| — bottom — **Agents**   | MCP server, clients, scopes, approvals                                                            | Agents document                         |
| — bottom — **Settings** | Settings sections                                                                                 | Settings document (not a modal)         |

- The rail item order follows the frequency of the developer's loop, with Session first: it is the
  home for every persona.
- **Removed from the rail:** App (merged into Device › Apps › the App document), Replay (it becomes
  the _recorded context_, not a place), and Flows as an agent landing (now Checks, a library).
- **Logs are not a lens.** Streams live in the panel, and `Ctrl Shift J` maximises the panel when
  logs are the main job. **Screen is not a rail item:** `Ctrl Shift M` moves the device pane into the
  editor as a _Screen_ document. It is the same instance with a different dock, so the capability is
  not duplicated.

**Tabs are documents, not modes.** A document is a typed, addressable view:

> `table:orders` · `store:idb/app/cart` · `query:<id>` · `request:<id>` · `requests:<filter>` ·
> `element:<nodeId>` · `perf:<preset>` · `session:<capu|live>` · `flow:<id>` · `run:<id>` ·
> `app:<package>` · `files:<path>` · `ports` · `device` · `compare:<A>..<B>` · `settings:<section>` ·
> `agents`

- **Preview tabs** (VS Code): a single click in the navigator opens an italic preview tab that the
  next single click replaces. A double-click, or an edit, pins it. This stops the tab explosion that
  sinks most tab UIs.
- **Documents bind to the context, not to a device.** Switching the device, app or recording rebinds
  every open document; the tab set survives. A document can be **locked to a context** (lock icon on
  the tab, plus a 16 px context chip). Lock the left group to a recording and leave the right group
  live, and you have a live-against-recorded comparison with no extra feature.
- Every document's state lives in its URL (`/doc/table:orders?where=…&t=…`), so the palette, MCP and
  back/forward can address it (study §4.3, kept).

**The inspector follows one global selection.** There is one selection bus (`selection.store`),
holding `{kind, id, source, tier, readAt, contextId}`.

- The last _focused_ selection in the active group wins.
- Selecting a timeline event selects the evidence it points to. If a document for it is open, the
  document scrolls to it; if not, nothing opens, and the inspector shows it.
- The pin (📌) freezes the inspector on a selection. `Ctrl Enter` turns the inspector into a document
  tab, so two things can be inspected side by side.
- The inspector **never opens a dialog**. Its actions are listed with their shortcuts (the Raycast
  pattern), and `Ctrl .` runs them from the keyboard.

**Back and forward walk evidence history, not routes.** Each entry is `(document, selection,
playhead)`. The keys are `Alt ←` / `Alt →` and mouse buttons 4/5. The two 24 px arrows stay at the
left of the context bar, because mouse users need them. Changing the context pushes an entry, so
"back" after opening a `.capu` returns to the live session where you were.

**Keyboard map** (each region is a focus region; `F6` / `Shift F6` cycles them, as Windows apps do):

| Key                           | Action                                                                                       | Key                       | Action                                |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------- |
| `Ctrl K`                      | Palette: `@` context, `#` table, `/` request, `<` element, `t:` time, `>` command, `!` check | `Ctrl .`                  | Action panel for the selection        |
| `Ctrl B`                      | Navigator                                                                                    | `Ctrl Alt B`              | Inspector                             |
| `Ctrl J` / `Ctrl Shift J`     | Panel / maximise panel                                                                       | `Ctrl Shift M`            | Device pane: docked ↔ Screen document |
| `Ctrl \` (alias `Ctrl Alt S`) | Split the editor                                                                             | `Ctrl 1–3`                | Focus a group                         |
| `Ctrl Tab`                    | Most-recent tab                                                                              | `Ctrl W` / `Ctrl Shift T` | Close / reopen a tab                  |
| `Ctrl ;` (alias `Ctrl Alt T`) | Focus the timeline                                                                           | `End` (in the timeline)   | Follow live                           |
| `← →` / `Shift ← →`           | Previous/next event / ±1 s                                                                   | `M`, `[`, `]`             | Mark, set A, set B                    |
| `Ctrl Shift R`                | Record start/stop                                                                            | `Ctrl Shift S`            | Keep the last 5 minutes as a `.capu`  |
| `Alt ← →`                     | Evidence back/forward                                                                        | `g` + letter              | Go to a lens                          |

Punctuation bindings are matched by `KeyboardEvent.code`, and every punctuation chord has a letter
alias. On a French AZERTY layout (the owner's), `\`, `;` and `.` arrive with modifiers and would
otherwise be dead keys. `Ctrl R` and `F5` are captured so they never reload the WebView (F-10, V-06).

**Every capability has a home:** see §4.

### Q3 · Timeline and context placement

**The global timeline lives directly under the context bar** and spans everything right of the rail,
including the device pane column.

Why the top and not above the dock, as in study §4.1:

- _where_ and _when_ read as one header, as in Perfetto and the Chrome Performance panel, which put
  the overview at the top and details below
  ([Perfetto UI](https://perfetto.dev/docs/visualization/perfetto-ui),
  [Chrome Performance reference](https://developer.chrome.com/docs/devtools/performance/reference));
- the strip does not move when the panel resizes;
- the study's bottom stack (timeline, dock, status) puts three horizontal strips together, and the
  eye cannot tell them apart.

**The strip, collapsed (28 px):**

```
┌ 120 ───────────┬ flexible track (cut well, shadow-cut) ──────────────────────────┬ 168 ─────────────┐
│ All evidence ▾ │ ▁▂▁▃█▂▁▁▂▁▁▅▁▁▂ ◆ ▁▃▁▁▁▂▁▁▁▁▁▂▁▁▃▂▁▁▁▁ │A        │B  ┃● now │ −5:00  ⤓ Keep  ⇥ │
└────────────────┴─────────────────────────────────────────────────────────────────┴──────────────────┘
```

- Density bars are 1 s bins, 12 px tall, in the muted ink of the text.
- Errors are a danger tick with a 4 px triangle, so the shape carries the meaning as well as the
  colour.
- Marks use `signal-mark`. A and B are 1 px marks with 11 px labels.
- The playhead is 2 px ink with a 6 px cap.
- **Expanded (92 px, `Ctrl Alt T` then `E`):** the summary row plus four pinned lanes of 16 px each,
  chosen by the user (Network · Storage writes · Logs/Errors · Steps). The full lane stack is a
  **document** (`session:` overview, §Q6 T4), not a taller strip. The workspace never loses more than
  92 px to time.

**Live against recorded:**

| Cue            | Live (the right edge is now)                                                             | Recorded (an opened `.capu`)                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Right edge     | A 2 px `signal-live` now-edge with "● now". It moves only while frames or events arrive. | A 2 px ink **end bar** labelled "end 03:12.4". It never moves.                                                                                              |
| Strip border   | A solid top border                                                                       | A **perforated** top and bottom border (`prov-recorded`), the tape edge                                                                                     |
| Paused / stale | The segment after the pause point is **hatched** (`prov-stale`), with "paused 1:12"      | —                                                                                                                                                           |
| Context bar    | Switchers: device ▾ › app ▾ › target ▾                                                   | A read-only **Recorded** chip with a perforated edge: `◼ checkout-bug.capu · captured on Pixel-class phone · 3 Nov` ▾, plus `Return to live (Ctrl Shift L)` |
| Playhead       | Following (`End`) or scrubbed back: "−0:12.4 · buffered"                                 | "@ 01:47.2 · recorded"                                                                                                                                      |
| Write actions  | Enabled through the real target                                                          | Absent, with the reason "Recorded session: read-only"                                                                                                       |

DESIGN.md §2 gives the playhead to `signal-live`. **I propose an amendment:** the playhead is ink,
and lime is reserved for the now-edge and live link dots. Otherwise a lime playhead in a recording
says "live" about something that is not.

**Scrubbing back while live** filters every time-aware document to T, with the label "@ −0:12.4 ·
buffered". Documents that cannot answer at T, such as the live DOM, say so in a notice ("Live DOM:
not available at T. Record to capture the DOM."). They never silently show "now" while the
playhead says the past. That is the honesty rule applied to time.

**The context bar at 1920** (h 36, from left):

```
◧ 32 │ ‹ › 2×24 │ [▯ device ▾] › [⬢ app ▾] › [◫ target ▾]  (≤ 560, middle-truncate) │ ● live · 38 ms (≤ 140) │ A● S○ C○ K○ (112) │ ⏺ Record (96) │ ⌕ palette (320) │ ▥▤▣ 3×28 │ caption 3×46
```

- **Device:** a nickname (the model's marketing name, or a user alias), never the serial. The serial
  appears in the link popover behind "Reveal" (V-34, F-29).
- **Link state:** one derived word and glyph, the only one in the app: `● live · 38 ms`,
  `■ paused 1:12`, `○ disconnected 0:08`, `⚠ unauthorised`, `◌ connecting`, `— not debuggable`. The
  age is the time spent in that state. Clicking it opens the link popover (`Cladd Popover`): the chain
  USB › ADB › target › DevTools (`GateChain.vue`, already built) and the tier table.
- **Tiers:** four pips (**A**DB, **S**hell agent, **C**ompanion, in-app **K**it/SDK). Filled means
  connected, ring means absent, and a slash means failing. The tooltip and the popover say what each
  tier unlocks, for example "Companion: not installed. No native network, no exit reasons. Install
  over ADB."
- **Freshness per value** has one fixed slot per document: the right end of the document toolbar
  holds a `ProvenanceTag` with tier and age (`via ADB pull · 12 s ago ↻`). The inspector repeats it
  per selected value, with the exact read time.

### Q4 · Layer stack (base to top)

The **native-capable zone** is the device pane's _screen rectangle_: the frame only, not its 32 px
toolbar or key bar, which are HTML. **Freeze-frame** means: hide the native surface and show an
`<img>` of its last frame, taken with CDP `Page.captureScreenshot` for local previews, with a 20 px
"Frozen while … is open" caption. Today's `useOverlayGuard` already hides it; it gains the capture.

| z   | Layer                                                          | Coexistence with the native zone                                                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Shell base (`bg-background`)                                   | —                                                                                                                                                                                                                                                                                                                                                                   |
| 1   | Regions and panes (`surface-0`)                                | The device pane is a region like any other, so no overlap is possible.                                                                                                                                                                                                                                                                                              |
| 2   | Sticky headers (grid headers, tab strips, gutters)             | Inside their pane. Opaque background and 1 px border (V-54).                                                                                                                                                                                                                                                                                                        |
| 3   | Splitter handles (6 px hit area over a 1 px line)              | The device pane's left splitter lies outside the frame rect, so dragging it causes no conflict. During the resize the native surface follows by `ResizeObserver` plus `transitionend` (study §9.3).                                                                                                                                                                 |
| 4   | Drawers (navigator or inspector below their breakpoints)       | They slide over the **editor only**. Their anchor edges are the rail's right edge and the device pane's left edge, so they never touch the zone.                                                                                                                                                                                                                    |
| 5   | Tooltips                                                       | The collision boundary is the _window minus the zone_. Tooltips on the device pane toolbar open left or down, outside the frame.                                                                                                                                                                                                                                    |
| 6   | Popovers, selects, menus, context menus                        | The same boundary, through Reka/Cladd `collisionBoundary` and `avoidCollisions` ([Reka Popover](https://reka-ui.com/docs/components/popover)). A menu opened from the device pane toolbar flips left. There is **no freeze**.                                                                                                                                       |
| 7   | Command palette                                                | 640 wide, top-anchored 12 px below the timeline, centred **in the window minus the zone**. At 1280, x = 56…996, centred at 526. It never needs a freeze. Settings is not a modal any more, so F-08 and V-07 (palette under a modal) cannot happen: nothing can be above the palette except a dialog, and opening the palette dismisses a dialog-less popover first. |
| 8   | Dialogs (rare: destructive confirm, pairing, export redaction) | A full scrim. The zone **freezes**: frozen and dimmed under the scrim for native surfaces; the canvas just takes the scrim (this fixes V-38). There is one dialog at a time, and the palette refuses to open over a dialog.                                                                                                                                         |
| 9   | Toasts                                                         | **Bottom-left of the editor area**, 12 px above the status bar, never bottom-right, where the phone sits. 360 wide, at most 3, and only for action results. Read failures are gates, never toasts.                                                                                                                                                                  |
| 10  | Drag ghosts and drop zones (tab or region drag)                | The zone **freezes** for the drag's duration, because the device pane is itself a drop target (dock left/right, or into the editor as Screen).                                                                                                                                                                                                                      |

The rule in one line: **only dialogs and drags may intersect the screen rectangle, and only those two
freeze it.** Everything transient is laid out around it.

### Q5 · Docking and splitting

| Element       | Split                                                                       | Drag                                                        | Pin                                           | Detach                                                   |
| ------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| Editor groups | Right or down, up to **3 columns × 2 rows**, minimum 560×240 each           | Tabs between groups; drop on an edge to split               | Tabs (pinned tabs sit left, 40 px, icon only) | No. A second window costs too much for v1.               |
| Device pane   | No                                                                          | Dock left or right, or into the editor as a Screen document | —                                             | **Yes**: the existing `MirrorWindow` / `mirror-detached` |
| Inspector     | No (one); a pinned selection becomes a tab                                  | No                                                          | 📌 freezes it on a selection                  | No                                                       |
| Panel         | No; one tab at a time, and Logcat can be opened in the editor as a document | Panel tabs can be reordered                                 | —                                             | **Yes**: the existing `DockDetachedWindow`               |
| Navigator     | No                                                                          | No                                                          | Docked or drawer (user override)              | No                                                       |

**Persisted across relaunches** (per workspace, keyed by package name, so each app under test gets its
own bench): the tab sets and group layout; every region size and visibility; each document's filters,
queries and sort; the device pane dock and its source; the panel tab and its query; the rail lens;
the timeline height and its pinned lanes.

**Not persisted, on purpose:**

- the selection;
- the playhead (relaunch is always _live, following_);
- the recorded context (relaunch offers "Reopen checkout-bug.capu" on the Start page instead of
  silently reopening a file the user may have shared away).

**Fixed on purpose:**

- the order of regions;
- the context bar, the timeline strip and the status bar;
- one inspector;
- no floating panels. Figma's UI3 floating panels were rolled back
  ([analysis](https://uxdesign.cc/figma-scrapes-ui3s-floating-panels-44303803c1ad)), and docked slots
  are what make the native-zone rule provable.

### Q6 · Screen templates

The measurements are inside the editor area at 1920 (928 × 696, panel open). Each template uses the
document toolbar (32 px, Cladd `Toolbar`, `size="sm"` 24 px controls) and ends in the provenance slot.

**T1 · Grid + inspector** (lists and tables; the inspector is the shell's, not the template's)

```
┌ 928 ──────────────────────────────────────────────────────────────────────────────┐
│ ⌕ Filter / WHERE… (flex)   [Rows|Schema|SQL] Segmented   Columns  Export │ADB·12s↻│ 32 toolbar
├───┬──────┬──────────────┬─────────┬──────────────────────────────────────────────┤
│ # │ id ⚿ │ status ▾     │ total # │ updated_at                          (fill)   │ 24 header, 11/16 500
├───┼──────┼──────────────┼─────────┼──────────────────────────────────────────────┤
│ 1 │  410 │ pending      │   12.0  │ 14:01:58                                     │ 24 rows (20 / 28 by density)
│ … │      │              │         │                                              │ virtualised rows and columns
├───┴──────┴──────────────┴─────────┴──────────────────────────────────────────────┤
│ 50 of 165 · page 1/4 ‹ ›                                   (provenance in toolbar) │ 24 footer, inside the well
└────────────────────────────────────────────────────────────────────────────────────┘
```

Columns are sized to max(header, p95 of the content), capped at 320, and the last text column takes
the rest (V-12). Numbers are right-aligned under right-aligned headers (V-13). The row-number gutter
hides when the first column is an integer PK (V-58).

**T2 · Tree + detail** (hierarchies)

```
┌ 928 ────────────────────────────────────────────────────────────────────────────┐
│ ⌕ Search DOM / path…            ⌖ pick on screen   ⟳          │ CDP · live      │ 32
├─────────────────────────────────────────────────┬───────────────────────────────┤
│ ▾ <html lang="en">                              │ breadcrumb / selected node    │ 24 rows, 12 px indent
│   ▾ <body class="…">                            │ attributes, box, a11y         │ tree ≥ 420, detail ≥ 320,
│     ▸ <div id="app">   (24 px rows, mono 12)    │ (when the inspector is docked,│ split 55/45
│                                                 │  the detail column folds into │
│                                                 │  the inspector: one pane less)│
└─────────────────────────────────────────────────┴───────────────────────────────┘
```

**T3 · Stream** (panel tabs, or maximised in the editor)

```
┌ full panel width ─────────────────────────────────────────────────────────────────┐
│ Logcat │ Console │ REPL │ Exceptions │ Shell │ Agent                      ⌄ ⤢ ⧉ │ 28 tab header
│ ⌕ level:error tag:sync & pid:app        [V D I W E] Segmented   ● tail   ⤓ clear  │ 32 query bar
├──────────────┬───┬──────────────┬──────────────────────────────────────────────────┤
│ 14:02:11.204 │ E │ SyncWorker   │ POST /sync failed: 500   ↗ request             │ 20 rows, mono 12/16
│ (88 mono)    │16 │ (120, ellip.)│ (fill; wraps on demand with ⏎)                  │ xterm or virtual list
└──────────────┴───┴──────────────┴──────────────────────────────────────────────────┘
```

The time column is clickable: it moves the playhead. Lines carry their tier in the tooltip
(`via ADB logcat` against `via Companion`).

**T4 · Timeline player** (Session overview, Performance, Compare A→B)

```
┌ 928 ──────────────────────────────────────────────────────────────────────────────┐
│ ◼ Recorded · 03:12 · 2 errors · 1 failed request · 41 writes   Export ▾  Redact  │ 32 toolbar
├──────────┬─────────────────────────────────────────────────────────────────────────┤
│ ruler    │ 0:00        0:30        1:00        1:30   ┃     2:00        2:30       │ 20
│ Steps    │  ◆ tap        ◆ tap  ◆ input              ┃◆ tap "Validate order"       │ 20 per lane
│ Network  │  ▬ ▬▬   ▬        ▬▬ ▬                     ┃▬▬ 500                       │ lane label 120,
│ Writes   │      ·  ·  ··        ·                    ┃·· orders#412                │ 11 px, sentence case
│ Logs     │           ▲                               ┃▲ SyncError                  │
│ Perf CPU │ ▁▂▂▃▂▁▁▂▃▅▃▂▁▁▂▂▁▁▂▂▃▂▁▁▁▂▂▁▁▂▃▅▇▅▃▂▁▁▂▂▁▁▂▂▃▂▁▁▁▂▂▁▁▂▂▃▅▃▂▁▁▂▂▁▁▂     │ 40 for charts
├──────────┴─────────────────────────────────────────────────────────────────────────┤
│ Evidence story (T3 rows, 24 px, Sans for words, mono for values)                   │ fills the rest
│ 01:47.2  Tap      "Validate order"                                                 │ one row per event
│ 01:47.3  Request  POST /sync → 500 (212 ms)                                ↗       │ selecting → inspector
│ 01:47.4  Write    orders #412 status pending → failed                     ↗       │ and the playhead
└────────────────────────────────────────────────────────────────────────────────────┘
```

Lane semantics use shape and colour (tick, bar, dot, triangle). The `cat-*` hues are used **only**
here and in evidence chips.

**T5 · Step editor** (Checks: a flow, a run)

```
┌ 928 ──────────────────────────────────────────────────────────────────────────────┐
│ Flow: Checkout happy path   ▶ Run (Ctrl Enter)  ✎ Draft with agent   Last run ✓ 2 h │ 32
├──────────────────────────────────────┬─────────────────────────────────────────────┤
│ 1  Launch app                    ✓   │ Step 4 · Assert data                         │ steps 360, rows 28
│ 2  Tap "Products"                ✓   │ table orders: +1 row where status=pending    │ (two lines: verb +
│ 3  Tap "Add to cart"             ✓   │ timeout 5 s                                  │  target)
│ 4  Assert data ◆                 ✗   │ (the step inspector is the shell inspector   │
│ + Add step  (A)                      │  when docked; this column is the run log)    │
├──────────────────────────────────────┴─────────────────────────────────────────────┤
│ Agent composer (collapsed to 32; 120 open). Only when "Draft with agent" is used.  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**T6 · Form / facts** (App, Device, Agents, Settings, Connect)

```
┌ 928 (content column max 720, gutter 16) ──────────────────────────────────────────┐
│ ⬢ Retail app  1.4.2 · user · debuggable      Open ▶  Stop  ⋯ (Clear data in ⋯)    │ 32
├────────────────────┬───────────────────────────────────────────────────────────────┤
│ Section nav 180    │ Section title 15/20 500                                       │ 24 gap
│ Overview           │ Label (subtle 11)           Value (13, mono for ids)          │ KV rows 28, one pattern
│ Storage & files    │ Label                       Value · ProvenanceTag             │ (V-19)
│ Permissions        │                                                               │
│ Activity           │ Cladd Field / Switch / Select for settings (V-05)            │
└────────────────────┴───────────────────────────────────────────────────────────────┘
```

**Every current screen, assigned:**

| Today (route)                                                    | New home                                                                                                                                       | Template |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Device › Overview                                                | Device lens › `device` document                                                                                                                | T6       |
| Device › Apps                                                    | Device lens › Apps (navigator list + `apps` document)                                                                                          | T1       |
| Device › Files                                                   | Device lens › Files: the tree in the navigator, the folder in the document; it opens on the **app's** folders when an app is in context (F-15) | T2       |
| Device › Performance, App › Performance                          | Performance lens (one, merged)                                                                                                                 | T4       |
| Device › Logcat (`DeviceLogcat.vue`), dock Logcat                | Panel › Logcat                                                                                                                                 | T3       |
| App › Overview, App › Data usage                                 | `app:<package>` document (Overview, Storage & files)                                                                                           | T6       |
| Data › IndexedDB, LocalForage, LocalStorage, Cache, OPFS, SQLite | Data lens; the navigator tree replaces the storage-type tab row and the in-content DB sidebar                                                  | T1       |
| Data › Graph                                                     | A view toggle on the Data document (`Rows │ Schema │ SQL │ Graph`), not a store (V-49)                                                         | T1 view  |
| Network › Requests                                               | Network lens                                                                                                                                   | T1       |
| Network › Mocking                                                | Network lens › Mocks (rules list), behind the flag                                                                                             | T1       |
| Elements › Elements, Vue                                         | Elements lens; framework tools in the navigator                                                                                                | T2       |
| Replay (`ReplayView.vue`)                                        | **Recorded context** + Session overview document                                                                                               | T4       |
| Flows (`AutomationWorkbench.vue`)                                | Checks lens: library → flow (T5); the agent becomes "Draft with agent"                                                                         | T5       |
| Settings (route-modal)                                           | Settings document                                                                                                                              | T6       |
| Preview (`/preview`, orphan)                                     | A device pane source (local target) from the context bar's target switcher                                                                     | —        |
| Dock › Console, REPL, Exceptions                                 | Panel tabs                                                                                                                                     | T3       |
| (new) Session overview / live                                    | Session lens                                                                                                                                   | T4       |
| (new) Agents (MCP)                                               | Agents document + Panel › Agent                                                                                                                | T6 + T3  |
| (new) Start page                                                 | Shown when there is no context                                                                                                                 | T6       |

### Q7 · States in the layout

There is **one Gate component** (`GatedView`, already built) and **one rule of placement**: a state
lives at the _scope_ it belongs to. A link state belongs to the context, a capability state to a
feature, and a data state to a document.

| State                          | Scope              | Where it shows                                                                                                                                                                                                                                                                                                                                                                                                 | Space taken                                                                                                                   |
| ------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Disconnected**               | Context            | The context bar link word (`○ disconnected 0:08`). Documents that had rendered stay mounted under a **stale band** (hatched, "Disconnected 0:08 · showing the last read at 14:02:11 · Reconnect F5"). Documents that never rendered show the Gate in their content rect.                                                                                                                                       | Band 24 px under the document toolbar. The Gate takes the content rect; the toolbar stays, disabled, so orientation survives. |
| **Unauthorised**               | Context            | The context bar (`⚠ unauthorised`) plus the Gate in every device-scoped document, with the steps "Unlock the phone, then tap Allow" and the chain (`GateChain`).                                                                                                                                                                                                                                               | Content rect                                                                                                                  |
| **Target paused** (background) | Context            | The **context notice row** under the timeline, once, for the whole window, naming what is frozen _and what is not_: "App in background · WebView paused at 14:02:11. Network, Elements and IndexedDB are frozen; SQLite and Logcat are still live. Bring to front (Ctrl Shift F)". CDP-fed values get the hatch; ADB-fed values do not (round-01 ruling on SQLite). The timeline hatches from the pause point. | 28 px row. It replaces the per-panel banners and fixes F-30 / V-35 (two placements).                                          |
| **Not debuggable**             | Context            | The target segment shows `— not debuggable`. CDP lenses (Network, Elements, browser storage) show the Gate: "This build isn't debuggable. CDP lenses need a debuggable build or the in-app SDK" + Learn how. ADB lenses (Device, native SQLite where `run-as` allows, Logcat) work.                                                                                                                            | Content rect, only in CDP documents                                                                                           |
| **Companion missing**          | Capability         | **Never a blocking gate.** The tier pip is a ring. Features that need it show an inline 20 px `Chip` "Needs companion · Install over ADB" where the feature would be (for example a Native traffic row in the Network navigator, or exit reasons in the App document).                                                                                                                                         | Inline, 20 px                                                                                                                 |
| **Empty**                      | Document           | A Cladd `EmptyState` in the content rect, top-aligned at 25 % height, max 480 wide: icon 16, title 13/500, a cause, one or two actions. A grid with no matching rows keeps its header and says "No rows match `WHERE …`" in the first row. **Empty is only said after a successful read** (F-06).                                                                                                              | Content rect, or one row                                                                                                      |
| **Loading**                    | Document           | Nothing for 150 ms. Then the provenance slot shows `◌ reading via ADB…` and the grid shows skeleton rows (no shimmer). **No zeros, no seeded series** (F-07, V-01). Charts draw nothing before the first sample, and the lane says "waiting for the first sample · 3 s".                                                                                                                                       | Inside the existing layout, so nothing jumps                                                                                  |
| **Error**                      | Document or action | Read errors use the Gate in the content rect, with copyable detail and Retry. Action errors use a toast (z 9) with the verb used on the button (F-19).                                                                                                                                                                                                                                                         | Content rect / toast                                                                                                          |

Precedence when several are true is **context › capability › document**. The Gate shows the first
broken link (`lib/gates/resolve.ts` already does this). There is never more than one status element
per scope on screen.

### Q8 · Personas

**Progressive disclosure, no mode switch.** A mode would fork documentation, screenshots and support,
and the people who need "simple" are exactly the ones who cannot tell which mode they are in. Instead,
the same shell has three front doors and one rule: _story first, lenses on demand_.

| Persona                                | Front door                                                                                                                       | Path (steps)                                                                                                                                                                                                                                                    | What they never see unless they go looking |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Developer at the desk**              | Last workspace restored, live, following                                                                                         | Everything is one key away. Typical loop: `Ctrl K #orders` → row → inspector "Related ±2 s" → request → `Alt ←`. 4 steps, one clock (W1 was 6–9 steps over three unlinked lenses).                                                                              | —                                          |
| **QA capturing a session**             | The Start page "Capture a session", or `⏺ Record` at any time, or **`⤓ Keep` the last 5 minutes** after the bug already happened | 1) Reproduce. 2) `Ctrl Shift S` (keep) or Stop. 3) The Session overview opens on the new `.capu` with an auto summary; `Export ▾` offers `.capu`, a redacted `.capu` and a "Copy summary for the ticket". 3 steps (W3 dead-ended at step 2).                    | Ports, Shell, REPL, Schema                 |
| **Support opening a received `.capu`** | A file association, or "Open a session" on the Start page                                                                        | The app opens **in the recorded context, on the Session overview**. The device pane shows recorded frames. Developer-authored **Saved views** sit in the Session navigator ("Stock for one SKU"), one click each. Writes are absent, not disabled-and-tempting. | Device lens, Checks, write actions         |

- **Start page** (no context): three 280×120 actions (Connect a device, Capture a session, Open a
  session), then recent sessions and recent devices. It is T6, not a splash.
- **Session overview is the first document for every new context**, so a non-developer's first
  screen is a readable story, not a root filesystem (F-15) or a chat box (F-05).
- **Density** has one preference (Compact 20 / Default 24 / Comfortable 28 rows). It is a
  preference, not a mode.
- _Field technician:_ the companion app only. The desktop shell is not their tool.

**What this costs:** support staff at 1280 still face a dense shell. I accept a learning cost on the
first day in exchange for one shell to document and test. Risk 3 tests whether that bet holds.

### Q9 · Density and grid

Base unit **4 px**. The spacing scale is `4 · 8 · 12 · 16 · 24 · 32`. Cladd control heights are
`2xs 16 · xs 20 · sm 24 · md 28 · lg 32` (`packages/cladd/src/shared/sizeClasses.ts`). Type uses
Bench (`DESIGN.md` §3) with Cladd type clamped to the 11 px floor (`cladd-bridge.css`).

**I propose aligning DESIGN.md row heights to Cladd:** 20 / 24 / 28, replacing 22 / 26 / 30. That
gives one size ladder for controls and rows, and a 24 px row equals an `sm` control.

| Region           | Height / width | Row / control                                                 | Padding                   | Type                                                                | Cladd / Bench pieces                                                                         |
| ---------------- | -------------- | ------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Context bar      | 36             | Segments `Button sm` 24, transparent                          | 8 x, 8 between groups     | 13/18 UI; device name 500; latency mono 12                          | `Button`, `Popover`, `Chip` (tiers, 2xs), `Shortcut`, `SearchField sm`                       |
| Timeline strip   | 28 / 92        | Lanes 16; labels 11/16                                        | 8 x                       | 11/16, mono for timecodes                                           | `SurfaceCut` well (`shadow-cut`); canvas track; `Segmented xs` for the lane picker           |
| Context notice   | 28             | `Button xs` 20                                                | 12 x                      | 13/18                                                               | `GateStrip.vue` with a `prov-stale` hatch                                                    |
| Rail             | 56 wide        | Items 48 tall, icon 16, label 11/14                           | 4 between items           | 11/14 500 active, 400 rest                                          | `ToggleButton`; the active bar is a 2 px `signal-select` inset 4 px from the edge (V-66)     |
| Navigator        | 248            | Header 32, search 32 (field 24), rows 24, indent 12           | 8 x                       | 13/18 rows, 11/16 500 section titles, sentence case (no caps, V-32) | `List`, `ListItem`, `ListTitle`, `SearchField sm`, `CollapsiblePanel`                        |
| Tab strip        | 32             | Tab 32, max 200, min 80; close 16                             | 12 x per tab              | 13/18; a preview tab is italic                                      | **New `DocumentTab` in cladd-vue** (closable, draggable; Cladd `Tab` has neither), Reka drag |
| Document toolbar | 32             | Controls `sm` 24, gap 8                                       | 12 x                      | 13/18                                                               | `Toolbar`, `ToolbarButton`, `Segmented`, `SearchField`, `ProvenanceTag`                      |
| Grid             | —              | Header 24, rows 20/24/28, cell pad 8 x                        | 0                         | 12/16 data: mono for numbers, ids and JSON; Sans for text (V-59)    | The existing DataGrid on Cladd `Table`                                                       |
| Inspector        | 320            | Header 32, provenance row 24, section title 24, KV rows 24    | 12 x, 8 between sections  | 13/18; labels 11/16 subtle                                          | `CollapsiblePanel`, `Chip`, `ProvenanceTag`, `Shortcut`                                      |
| Panel            | 240            | Tab header 28, query 32, stream rows 20                       | 8 x                       | 12/16 mono                                                          | `Tabs`, `Segmented xs`, `SearchField`, xterm / virtual list                                  |
| Device pane      | 360            | Toolbar 32 (`ToolbarButton sm`), keys bar 32, frame status 20 | Frame inset 8             | 11/16 status, mono for fps and age                                  | `Toolbar`, `Tooltip` (opens left)                                                            |
| Status bar       | 24             | Items 20                                                      | 8 x, 16 between items     | 11/16; words in Sans, values in mono (V-33)                         | `Button 2xs` transparent                                                                     |
| T6 forms         | —              | KV rows 28; fields `md` 28                                    | gutter 16, section gap 24 | Section title 15/20 500                                             | `Field*`, `Switch`, `Select`, `Surface`                                                      |

- Dividers between regions are **1 px** `border` with no gaps. There is one depth cue per edge (V's
  surface spec).
- Text uses only the three text tokens; no alpha (V-24).
- `signal-select` marks selection, focus and the active rail bar. Lime marks the now-edge and live
  dots only.

**Count check at 1920:** a request list at 24 px shows **28 rows** with the panel open and **38**
closed. Chrome DevTools shows about 40 at 21 px; Compact (20 px) reaches **45**.

### Q10 · Migration

Each step ships alone behind no long-lived branch, and keeps every route working. Steps 1–2 overlap
with round-01's _Truth_ track; 3–4 with _Spine_.

| #   | Step (ships as)                                                                                                                                                                                                                                                                                                                           | Touches                                                                | Visible result                                                          | Effort |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| 1   | **Region skeleton**: `AppShell` becomes a CSS-grid `ShellLayout` with named regions and Reka splitters (resizable stays on Reka per DESIGN §5); sizes persisted; **layer boundary** provider (collision boundary = window minus zone), toasts move bottom-left, freeze-frame capture in `useOverlayGuard`; native context menu suppressed | `AppShell.vue`, `useOverlayGuard.ts`, toast config                     | Nothing moves yet, except toasts and menus no longer touching the phone | S      |
| 2   | **Context bar v2 and status bar diet**: one link word, tier pips, nickname, link popover; the status bar loses link, serial and "mirror streaming"; the device pane gets the frame-age status line                                                                                                                                        | `TitleBar.vue` → `ContextBar.vue`, `StatusBar.vue`, `MirrorTopBar.vue` | F-01, F-03, F-11, V-34, F-29 closed                                     | M      |
| 3   | **Timeline strip v1** (28 px): a live ring-buffer summary from the existing console, network and logcat streams; the playhead seeks only in recorded mode at first                                                                                                                                                                        | New `TimelineStrip` (canvas), `recording` store                        | The spine is visible on every screen                                    | M      |
| 4   | **Recorded context**: opening a `.capu` sets the context; Replay's lanes become the Session overview (T4); the Session lens navigator gets the library                                                                                                                                                                                    | `ReplayView.vue`, `ReplaySessionPicker.vue`, `activeContext.store`     | Replay stops being a file picker (F-04 class, W3 fixed)                 | M      |
| 5   | **Inspector region**: the SQLite row inspector, App inspector, step inspector and Styles move into it; the selection bus                                                                                                                                                                                                                  | `selection.store` (new), the existing inspectors                       | One place for detail; the Data screen loses a column                    | M      |
| 6   | **Navigator region**: the Data DB sidebar, Files tree, Session library and Checks library move in; the storage-type tab row goes                                                                                                                                                                                                          | `IDBExplorer.vue`, `SqliteExplorer.vue`, `DeviceFiles.vue`             | Fixes 27 % → 14 % chrome on Data                                        | M      |
| 7   | **Documents, one group**: `SubNavTabs` is replaced by `DocumentTab` strips, routes become `/doc/:kind/:id`, preview tabs, evidence history                                                                                                                                                                                                | `SubNavTabs.vue`, router, `feature-registry.ts`                        | Tabs are documents                                                      | L      |
| 8   | **Rail swap**: Session · Data · Network · Elements · Performance · Checks · Device · Agents · Settings; App merges into Device; Flows → Checks; Settings → document                                                                                                                                                                       | `Sidebar.vue`, `feature-registry.ts`, `AutomationWorkbench.vue`        | F-05, F-11, F-20 closed                                                 | M      |
| 9   | **Split groups and context locks**                                                                                                                                                                                                                                                                                                        | Editor group store                                                     | Live against recorded side by side                                      | M      |
| 10  | **Panel**: the dock becomes the panel (Shell and Agent tabs added); the fake `/console/:tab` route is removed                                                                                                                                                                                                                             | `BottomDock.vue`, dock routes                                          | Streams have one home                                                   | S      |

Each step has a release gate: no S0 open in the regions it touches, and `check:cladd-adoption` does
not go up.

---

## 4. Capability to home

**The rule:** a capability's _home_ is where it is **operated**. Timeline lanes, palette results and
inspector "Related" entries are **projections** of evidence, not homes, so they are not duplicates.

| Inventory capability                                        | Home (operated in)                                                                                                        | Projections                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Physical connections                                        | Device lens › navigator _Devices_ (pair over Wi-Fi, connect TCP, disconnect); Start page "Connect"                        | Context bar device switcher lists them                            |
| Session management                                          | Context bar (active device › app › target); status bar for background tasks, queues, leases                               | Link popover                                                      |
| Android emulators                                           | Device lens › navigator _Emulators_ (list, launch)                                                                        | Device switcher "Start emulator…"                                 |
| Local browser/runtime                                       | Context bar target switcher › _Local sources_ (Chrome, local WebView URL); shown in the device pane as the native preview | —                                                                 |
| Device operations                                           | `device` document (T6): reboot modes, root, restart ADB, TCP mode                                                         | Palette `>`                                                       |
| Applications                                                | Device lens › Apps (T1) and the `app:<package>` document (T6): launch, stop, clear, uninstall, with typed confirmation    | Context bar app switcher                                          |
| Targets                                                     | Context bar target segment; "Open in Chrome DevTools" in the link popover                                                 | —                                                                 |
| Ports                                                       | Device lens › Ports (T1)                                                                                                  | Link popover shows the CDP forward                                |
| Device shell                                                | Panel › Shell (T3)                                                                                                        | Timeline Logs lane (commands as events)                           |
| Device files                                                | Device lens › Files (T2); "App folders" entry from the App document                                                       | —                                                                 |
| Native logs                                                 | Panel › Logcat (T3)                                                                                                       | Timeline Logs lane; Related ±2 s                                  |
| Native performance                                          | Performance lens (T4)                                                                                                     | Timeline Perf lane; Session overview                              |
| DOM                                                         | Elements lens (T2)                                                                                                        | Device pane inspect pick; Steps lane                              |
| CSS                                                         | Inspector, when an element is selected                                                                                    | —                                                                 |
| JavaScript console                                          | Panel › Console and REPL                                                                                                  | Timeline Logs lane                                                |
| Framework DevTools                                          | Elements lens › navigator _Components_ (only when detected)                                                               | —                                                                 |
| HTTP                                                        | Network lens (T1) + inspector                                                                                             | Network lane; Related                                             |
| Advanced network (WebSocket, interception, mock server)     | Network lens › _WebSockets_, _Mocks_ — behind the experimental flag until the workflows are complete (SPEC)               | Mocks count in the status bar; mocked requests marked on the lane |
| IndexedDB                                                   | Data lens                                                                                                                 | Writes lane (when recorded)                                       |
| Local and session storage                                   | Data lens (per origin)                                                                                                    | Writes lane                                                       |
| Cookies                                                     | Data lens › origin › Cookies                                                                                              | —                                                                 |
| Cache API                                                   | Data lens                                                                                                                 | —                                                                 |
| OPFS                                                        | Data lens (OPFS as a file tree under the origin)                                                                          | —                                                                 |
| LocalForage                                                 | Data lens                                                                                                                 | —                                                                 |
| Native SQLite                                               | Data lens › _Device databases_                                                                                            | Writes lane                                                       |
| SQLite local files                                          | Data lens › _Imports & snapshots_, with the `prov-local` dashed edge                                                      | —                                                                 |
| Browser-backed SQLite                                       | Data lens, with the engine as secondary text ("OPFS · SAH pool"), not a caps badge (V-56)                                 | —                                                                 |
| Screen interaction                                          | Device pane                                                                                                               | Screen document (same instance)                                   |
| Media capture                                               | Device pane toolbar (screenshot, screen video)                                                                            | Attachments in the Session overview                               |
| Session recording                                           | Context bar `⏺ Record`; timeline `⤓ Keep`                                                                                 | Status bar timecode while recording                               |
| Recording library                                           | Session lens › navigator                                                                                                  | Palette `@` and Start page recents                                |
| Recorded database evidence                                  | Data lens in the recorded context (@ T); inspector › _Write history_                                                      | Writes lane                                                       |
| Cross-track queries                                         | Session overview query bar (T4 story)                                                                                     | Palette `t:`; inspector _Related ±2 s_                            |
| MCP (56 tools in code, per round-01)                        | Agents document (T6): server, token, scopes, mutation mode, clients, approvals                                            | Panel › Agent (call log); Agent lane                              |
| Updates                                                     | Settings › Updates                                                                                                        | Status bar "Update ready"                                         |
| Hybrid/Capacitor-specific panels                            | **No home**, deliberately (owner decision 1; not real per SPEC)                                                           | —                                                                 |
| Integrated AI chat                                          | **No home now** (Proposed). If built: Checks › "Draft with agent", not a destination                                      | —                                                                 |
| Automation history/approvals                                | Checks lens › Runs (history); Agents document › Approvals                                                                 | Steps lane                                                        |
| _(code, not in inventory)_ Manual flows and the flow runner | Checks lens (T5)                                                                                                          | Steps lane                                                        |
| _(new)_ Companion and SDK tiers                             | Settings › Companion (pairing, version, granted permissions); install from the tier popover                               | Tier pips; per-value tier in `ProvenanceTag`                      |

Nothing is orphaned: Preview, Mocking and Graph, today's three orphans, have homes above. Nothing has
two homes: Performance and Overview each had two, and now have one.

---

## 5. Against the prior art (study §4.1)

| Study §4.1 element                                                            | Verdict             | Reason                                                                                                                                                 |
| ----------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Context bar with three switchers                                              | **Keep**, fixed     | Add tier pips and a single link word. Remove the serial.                                                                                               |
| Labelled rail                                                                 | **Keep**, changed   | It now picks a lens _and its navigator_. Sessions → Session (the home), Flows → Checks, Agents added. Rail auto-collapse removed.                      |
| Document tabs                                                                 | **Keep**            | Add preview tabs, context locks and evidence history.                                                                                                  |
| Device pane **stacked with the inspector** in one column                      | **Reject**          | A 20:9 phone at 344 px wide needs about 764 px of height. Sharing the column halves the phone or starves the inspector. Two columns, both full height. |
| Timeline **above the dock**                                                   | **Reject**          | Three bottom strips (timeline, dock, status) blur together, and the strip moves on every dock resize. It goes to the top, with the context.            |
| Status bar repeating `adb ✓ · cdp ✓`                                          | **Reject**          | That is the four-way-disagreement defect (V-34) designed in. The status bar holds instrument facts only.                                               |
| _(missing)_ where object lists go                                             | **Add a navigator** | Without one, every lens re-invents an in-content sidebar (the Data DB list today), which is the nested-sidebar pattern behind the 27 % chrome.         |
| "Local webview targets rendered as captured frames while any overlay is open" | **Narrow it**       | Freezing on _every_ overlay flickers the preview on every tooltip. Lay transient layers out _around_ the zone, and freeze only for dialogs and drags.  |

---

## 6. The three biggest risks, and how to test each before building

**Risk 1 · The horizontal budget fails on the screens people actually have.** Five columns (rail,
navigator, editor, inspector, device) are drawn for 1920 CSS, but a 1920 monitor at 125 % is
1536 CSS, and a 1366 laptop is 1366. If the editor drops under 560, the grid becomes useless and
users close the inspector, which is where provenance lives.

- _Test (1 day, no product code):_ a static HTML mock of the regions at the real sizes (the §2.3
  breakpoint table), at 1366×768, 1536×864, 1920×1080 and 2560×1440, holding a real 12-column table
  screenshot. Three developers do W1 (row → request → log) at each size.
- _Pass:_ the editor is ≥ 560 at every size, nobody closes the inspector to finish, and W1 takes 4
  steps or fewer.
- _If it fails:_ the device pane becomes a tab of the right column at M (inspector │ device
  switchable). That is the fallback, and it is costly for QA.

**Risk 2 · A permanent timeline is noise or a performance tax.** A 28 px strip redrawing a live ring
buffer on every event can cost frames across the whole shell. If users do not use it, it is chrome
that disproves the thesis.

- _Test (2 days):_ build `TimelineStrip` in isolation against a recorded `.capu` replayed at 1× and
  at 20× speed (about 50 k events), rendering on canvas with per-frame batching.
  - _Budget:_ ≤ 2 ms per frame on the strip, and no main-thread task over 16 ms.
  - Then a 5-person test: "What happened about 10 seconds before the error?" with the strip, against
    the same evidence with Replay's current lanes.
- _Pass:_ the budget holds, and median time-to-answer is at least 2× faster with the strip.

**Risk 3 · Documents-over-context and live/recorded confusion.** Rebinding open tabs when the
context changes is powerful, but a support person may not realise that a tab now shows the
_recording_, not the phone in their hand. Acting on stale data is the S0 class this product exists
to kill.

- _Test (1 day):_ a 5-second test with 8 people (4 non-developers). Show 10 screenshots of mocks:
  live, paused, disconnected, recorded, and a locked-context split. Ask "Is this showing the phone
  right now? Can you change data from here?"
- _Pass:_ ≥ 90 % correct, and 100 % on the recorded cases.
- _If it fails:_ strengthen the recorded treatment before building (a full-height perforated
  left edge on every recorded document, and the window title prefixed "Recorded ·"). Do not add
  colour.

---

## 7. What I could not judge

- The palette's real behaviour, the dock, and Replay with a loaded session: none of them was captured
  (as in round 01).
- Whether `.capu` and the live buffer can feed one event index at interactive speed. This is the
  study's §5.2 feasibility gate, and Risk 2 tests part of it.
- Real window-size data for the user base. The breakpoints assume common Windows laptop and desktop
  sizes, not telemetry.

## References

- VS Code user interface (activity bar, side bar, editor groups, panel, secondary side bar):
  https://code.visualstudio.com/docs/getstarted/userinterface
- VS Code UX guidelines (views, panel, status bar roles): https://code.visualstudio.com/api/ux-guidelines/overview
- Android Studio tool windows and Running Devices:
  https://developer.android.com/studio/intro/user-interface ·
  https://developer.android.com/studio/run/device
- Android Studio Logcat query grammar: https://developer.android.com/studio/debug/logcat
- Chrome DevTools Performance panel (overview on top, details below):
  https://developer.chrome.com/docs/devtools/performance/reference
- Chrome DevTools layout and drawer: https://developer.chrome.com/docs/devtools/customize
- Perfetto UI: https://perfetto.dev/docs/visualization/perfetto-ui
- Linear UI redesign (restraint, density): https://linear.app/blog/how-we-redesigned-the-linear-ui
- Windows title bar and caption buttons: https://learn.microsoft.com/en-us/windows/apps/design/basics/titlebar-design
- Reka UI popover collision props: https://reka-ui.com/docs/components/popover
- Figma UI3 floating-panel rollback: https://uxdesign.cc/figma-scrapes-ui3s-floating-panels-44303803c1ad

Status: `[AI-assisted]`. This needs an owner "explain it back" before it is acted on.
