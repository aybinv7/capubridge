# Round 02 · Layout proposal D (Codex)

Capubridge should feel like one Android session workspace: one selected device, app, and target; one timeline shared by every tool; and one visible account of where each value came from and when it was read. Five job-based work areas—Session, Device, Inspect, Data, and Automate—organize the work, while document tabs and a selection-driven inspector keep related evidence close. The live phone mirror stays in a reserved right-hand pane because it is a native child webview; no HTML overlay is allowed to cross its rectangle.

## 1. Region map

Coordinates below use the window’s top-left corner. The left navigation rail starts below the title bar. At 1280×800, the inspector is collapsed by default to protect the working area.

| Region                    | 1920×1080                             | 1280×800                              | Range and rule                                            |
| ------------------------- | ------------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| Title bar                 | 1920×36                               | 1280×32                               | 32–36 px high                                             |
| Context bar               | x=64, y=36; 1856×48                   | x=64, y=32; 1216×44                   | 40–56 px high; compact selectors at narrower widths       |
| Navigation rail           | x=0, y=36; 64×1020                    | x=0, y=32; 64×748                     | 48–64 px wide; labels collapse to icons at 48 px          |
| Workspace document header | x=64, y=84; 1488×40                   | x=64, y=76; 936×36                    | 32–40 px high                                             |
| Main work area            | x=64–1232; 1160×816                   | x=64–1000; 936×580                    | Minimum 560 px wide                                       |
| Selection inspector       | x=1232–1552; 320×816                  | Collapsed; can open at 288×580        | 272–420 px wide; collapse below 1400 px window width      |
| Mirror pane               | x=1552–1920; 368×972                  | x=1000–1280; 280×704                  | 240–480 px wide; user-resizable                           |
| Native mirror viewport    | x=1552, y=124; 368×932                | x=1000, y=112; 280×668                | Reserved native rectangle; excluded from HTML overlays    |
| Global timeline           | x=64, y=940; 1488×116                 | x=64, y=692; 936×88                   | 64–280 px high; never hidden                              |
| Utility dock              | Closed by default; 224 px when opened | Closed by default; 176 px when opened | 160 px minimum; maximum 36% of available workspace height |
| Status bar                | y=1056; 1920×24                       | y=780; 1280×20                        | 18–24 px high                                             |

**1920×1080**

```text
x:       0–64                       64–1232       1232–1552   1552–1920
         NAV                         MAIN           INSPECTOR   MIRROR
y=0      +---------------------------------------------------------------+
         | Title bar: 1920×36                                           |
y=36     +------+--------------------------------------------------------+
         |      | Context bar: 1856×48                                   |
y=84     |      +--------------------------------------------+------------+
         |      | Document header: 1488×40                   | Mirror     |
y=124    | Rail +------------------------------+-------------| controls   |
         |64px  | Main work area                | Inspector   | 368×40     |
         |      | 1160×816                      | 320×816     +------------+
         |      |                               |             | Native     |
y=940    |      +-------------------------------+-------------| mirror     |
         |      | Global timeline: 1488×116                  | 368×932    |
y=1056   +------+--------------------------------------------+------------+
         | Status bar: 1920×24                                           |
y=1080   +---------------------------------------------------------------+
```

The work area and inspector share the left workspace. The mirror continues beside them to the status bar. The timeline spans the left workspace only; it never occupies the mirror’s rectangle.

**1280×800**

```text
x:       0–64                   64–1000                 1000–1280
         NAV                     WORKSPACE                MIRROR
y=0      +-------------------------------------------------------+
         | Title bar: 1280×32                                   |
y=32     +------+------------------------------------------------+
         |      | Context bar: 1216×44                           |
y=76     |      +------------------------------------+-----------+
         |      | Document header: 936×36            | Mirror    |
y=112    | Rail +------------------------------------| controls  |
         |64px  | Main work area: 936×580            | 280×36    |
         |      | Inspector collapsed                +-----------+
         |      |                                    | Native    |
y=692    |      +------------------------------------| mirror    |
         |      | Global timeline: 936×88            | 280×668   |
y=780    +------+------------------------------------+-----------+
         | Status bar: 1280×20                                  |
y=800    +-------------------------------------------------------+
```

When the window gets narrower, collapse the inspector first, then reduce or collapse the mirror, then collapse rail labels. Close the utility dock automatically before shrinking the main work area below 560 px. Reduce timeline height last, to 64 px; keep its ruler and at least one lane visible.

## 2. Navigation model

The rail represents **jobs**, not objects or technical layers:

- **Session** — current session, recording library, and cross-track evidence.
- **Device** — connection, Android system, apps, files, shell, ports, logs, and performance.
- **Inspect** — DOM, styles, console, network, and detected framework tools.
- **Data** — browser storage and SQLite sources.
- **Automate** — flows, runs, agent controls, and MCP.
- **Settings** — utility entry at the foot of the rail.

“Mirror” is a pane control, not a job or destination. This removes the current ambiguity between the device being inspected and the “Device” mirror toggle.

**Tabs are documents, not modes.** A tab represents a resource or investigation: a database table, request, DOM element, file, flow, or session. Opening a related resource adds or focuses a tab. Display choices such as Tree/Table remain view controls within a document.

The inspector follows the active selection and playhead. It shows the selected item’s details, provenance, freshness, and related evidence. At wide sizes it is a pinned pane; at 1280 px it is collapsed by default and opens within the HTML workspace. It never floats over the mirror.

Back and Forward traverse workspace history: documents, selections, and playhead positions. They do not switch the active device implicitly or repeat a device write. Changing between a live session and a recorded session creates a history entry.

**One primary home per inventory row.** Linked evidence may appear in the inspector or timeline, but that does not create a second destination.

| Capability inventory row         | Primary home                                                               |
| -------------------------------- | -------------------------------------------------------------------------- |
| Physical connections             | Device › Connect                                                           |
| Session management               | Global session/context selector                                            |
| Android emulators                | Device › Connect › Emulators                                               |
| Local browser/runtime            | Device › Connect › Local sources                                           |
| Device operations                | Device › System                                                            |
| Applications                     | Device › Apps                                                              |
| Targets                          | Global target selector in the context bar                                  |
| Ports                            | Device › Ports                                                             |
| Device shell                     | Device › Shell                                                             |
| Device files                     | Device › Files                                                             |
| Native logs                      | Device › Logcat                                                            |
| Native performance               | Device › Performance                                                       |
| DOM                              | Inspect › Elements                                                         |
| CSS                              | Inspect › Elements › Styles inspector                                      |
| JavaScript console               | Inspect › Console                                                          |
| Framework DevTools               | Inspect › Framework tools; shown when detected                             |
| HTTP                             | Inspect › Network › Requests                                               |
| Advanced network                 | Inspect › Network › Advanced; available only when ready                    |
| IndexedDB                        | Data › Browser › IndexedDB                                                 |
| Local and session storage        | Data › Browser › Storage                                                   |
| Cookies                          | Data › Browser › Cookies                                                   |
| Cache API                        | Data › Browser › Cache                                                     |
| OPFS                             | Data › Browser › OPFS                                                      |
| LocalForage                      | Data › Browser › LocalForage                                               |
| Native SQLite                    | Data › SQLite › Device source                                              |
| SQLite local files               | Data › SQLite › Imported files                                             |
| Browser-backed SQLite            | Data › SQLite › Browser source                                             |
| Screen interaction               | Right-hand Mirror pane controls                                            |
| Media capture                    | Right-hand Mirror pane capture actions                                     |
| Session recording                | Global Record action                                                       |
| Recording library                | Session › Recordings                                                       |
| Recorded database evidence       | Session › selected recording › Database evidence                           |
| Cross-track queries              | Session › Search tracks                                                    |
| MCP                              | Automate › MCP                                                             |
| Updates                          | Settings › Updates                                                         |
| Hybrid/Capacitor-specific panels | Inspect › Detected integrations; conditional and never a primary rail item |
| Integrated AI chat               | Automate › Explain; optional future surface                                |
| Automation history/approvals     | Automate › Runs                                                            |

The product remains a session debugger for Android apps. Framework-specific panels appear only when real target evidence supports them; they do not define the product category.

## 3. Timeline and context placement

The global timeline is a permanent strip at the bottom of the workspace, spanning the main work area and inspector but stopping before the native mirror. Its 116 px wide layout shows a time ruler, controls, and three 22 px lanes; other lanes scroll vertically or can be pinned. At 1280×800, the 88 px layout shows two lanes. Expand it to 280 px for a track-heavy investigation.

The timebase is shared by native logs, network, DOM, console, storage changes, performance, automation, and any captured screen frames. Selecting an event moves the playhead and updates the active document and inspector. Live sessions follow the right edge until the user scrubs back; an explicit **Follow live** control returns there.

For a live session, the right edge reads **LIVE · NOW** and uses Bench’s live signal. For an opened `.capu`, the header reads **RECORDED** with the session’s time range; the playhead has a fixed end and never uses the live treatment. A captured frame appears only if the recording contains one; otherwise the pane explains that no frame is available. Missing tracks are labeled unavailable, not drawn as empty data.

The context bar contains keyboard-searchable Device, App, and Target selectors, followed by the current link-health state, the acquisition tiers in use, and the latest-read age. Each value still carries its **own** source and read time: a single summary age must not stand in for per-value freshness. The tiers—ADB, shell agent, companion, and in-app SDK—are shown as available or delivering data. A value’s provenance identifies the tier that actually supplied it.

## 4. Layer stack and native mirror

HTML layers stack as follows:

| Order | Layer                                  | Mirror behavior                                                               |
| ----- | -------------------------------------- | ----------------------------------------------------------------------------- |
| z0    | Window and workspace surfaces          | The mirror rectangle is reserved outside the HTML drawing area.               |
| z10   | Work panes and document content        | Content stops at the mirror boundary.                                         |
| z20   | Sticky pane headers and timeline ruler | Remain inside their pane bounds.                                              |
| z30   | Selection inspector                    | A side-by-side pane, not an overlay.                                          |
| z40   | Popovers and tooltips                  | Flip or clamp to the HTML workspace.                                          |
| z50   | Menus                                  | Open only within the HTML workspace.                                          |
| z60   | Command palette                        | Center within the HTML workspace, never the full window.                      |
| z70   | Dialogs and backdrops                  | Dim and cover HTML workspace only; leave the mirror visible and interactive.  |
| z80   | Toasts                                 | Bottom-left of the HTML workspace, above the timeline; never over the mirror. |
| z90   | Drag ghosts                            | Stay in the HTML workspace; drops on the native viewport are rejected.        |

The native child webview is a separate compositor surface, not a DOM layer with a higher z-index. Opening a popover, palette, menu, or dialog does **not** hide or move it. Only the user’s explicit Mirror toggle or detach command changes its visibility or window. A recorded session uses the same reserved pane for a labeled captured frame or an unavailable-track state.

## 5. Docking and splitting

Workspace documents can be dragged between tabs and between at most two editor groups. Split groups horizontally or vertically; the second split is the limit. Tabs can be pinned. The inspector can be pinned, resized, or collapsed, but not detached. The utility dock hosts Console/REPL/Exceptions and Logcat panes; each pane has one instance and may move between the dock and a workspace group. The timeline stays at the bottom and cannot be detached. The Mirror pane stays right-docked or opens in a separate native window.

Persist the rail selection, open documents, tab order, two-group split, pane widths and visibility, timeline zoom and pinned lanes, dock tabs and height, and mirror width/detach preference. Restore the last device/app/target identifiers only as cached selections; re-resolve them before showing live health. Never persist a live status as if it were current.

Keep the title bar, context bar, rail, timeline position, status bar, and mirror’s right-side location fixed. Avoid arbitrary floating HTML panels, which would complicate both context and mirror geometry.

The §4 rewrite anatomy is a useful baseline, not a complete specification. Keep its context bar, labeled rail, document tabs, selection inspector, and visible timeline. Reject its proposed 6 px timeline collapse: that is not a usable shared clock. Replace ambient status-bar vitals with sourced, time-stamped values in their owning surface. VS Code documents draggable, pinnable editor groups; Chrome DevTools documents rearrangeable panes and size-aware layouts; Android Studio keeps Logcat, Database Inspector, and Device Explorer as focused tool windows. This proposal adopts those patterns while limiting detachment to the native mirror, whose reserved rectangle must remain predictable. ([VS Code layout](https://code.visualstudio.com/docs/configure/custom-layout), [Chrome DevTools customization](https://developer.chrome.com/docs/devtools/customize/), [Android Studio Database Inspector](https://developer.android.com/studio/inspect/database), [Android Studio Device Explorer](https://developer.android.com/studio/debug/device-file-explorer))

## 6. Screen templates

The six templates below use the main-work-area dimensions from the region map. The 1920 layout may show the 320 px shell inspector; the 1280 layout starts with it collapsed. The splitter is an 8 px hit area implemented with the project’s Reka resizable primitive.

### T1 · Index and selection detail

For app grids, connection sources, and the recording library.

```text
1920: main work 1160×816             shell inspector 320×816
+-------------------------------------+------------------------+
| Search and filters: 1160×40         | Selected item          |
+-------------------------------------+ Provenance and actions |
| App/source/session index: 1160×776  | 320×776                |
+-------------------------------------+------------------------+

1280: main work 936×580; shell inspector closed
+-------------------------------------------+
| Search and filters: 936×36                |
+----------------------+--------------------+
| Index/list 220×544   | Detail 708×544     |
+----------------------+--------------------+
```

### T2 · Tree and data detail

For files, DOM, framework inspection, and storage explorers.

```text
1920: main work 1160×816             shell inspector 320×816
+----------+--------------------------+------------------------+
| Tree     | Table/detail canvas      | Selected row, node,    |
| 248×816  | 904×816                  | or file: 320×816       |
+----------+--------------------------+------------------------+

1280: main work 936×580; shell inspector closed
+---------+----------------------------------+
| Tree    | Table/detail canvas              |
| 220×580 | 708×580                          |
+---------+----------------------------------+
```

### T3 · Event stream

For network requests, Console, and Logcat. Selection opens detail in the shell inspector at wide sizes; compact layouts use an inline detail view.

```text
1920: main work 1160×816             shell inspector 320×816
+-------------------------------------+------------------------+
| Filter, source, and event controls  | Selected event detail |
| 1160×40                             | 320×816                |
+-------------------------------------+                        |
| Virtualized event rows              | headers, payload,      |
| 1160×776                            | timing, provenance     |
+-------------------------------------+------------------------+

1280: main work 936×580
+-------------------------------------------+
| Filters: 936×36                           |
+-------------------------------------------+
| Event stream: 936×544                     |
+-------------------------------------------+
```

### T4 · Metrics and overview

For device/app overviews, device/app performance, and data usage. Charts use empty or unavailable states instead of fabricated zeros.

```text
1920: main work 1160×816             shell inspector 320×816
+-----------------------+-------------+------------------------+
| Primary metric        | Trend       | Selected metric detail |
| 576×392               | 576×392     | 320×816                |
+-----------------------+-------------+ source and read time   |
| Secondary metric      | Resource    |                        |
| 576×392               | 576×392     |                        |
+-----------------------+-------------+------------------------+

1280: main work 936×580
+-----------------------+----------------------+
| Metric 464×286        | Trend 464×286        |
+-----------------------+----------------------+
| Metric 464×286        | Resource 464×286     |
+-----------------------+----------------------+
```

### T5 · Session review

For recorded `.capu` playback and automation run/step review. The global timeline remains the shared clock below this template.

```text
1920: main work 1160×816             shell inspector 320×816
+----------------------------+--------+------------------------+
| Captured frame or          | Track  | Selected event detail |
| unavailable-frame state    | events | 320×816                |
| 760×816                    | 392×816|                        |
+----------------------------+--------+------------------------+

1280: main work 936×580
+----------------------------+------------------+
| Frame or unavailable state | Track events     |
| 600×580                    | 328×580          |
+----------------------------+------------------+
```

### T6 · Canvas and structured form

For Flows, storage Graph, network rules, browser preview, and Settings. A single selection inspector is repositioned within this template rather than duplicated.

```text
1920: main work 1160×816
+--------------------------------------+------------------------+
| Canvas or form                       | Inspector              |
| 832×816                              | 328×816                |
+--------------------------------------+------------------------+

Settings variant:
+-------------------+------------------------------------------+
| Section list      | Form                                     |
| 248×816           | 904×816                                  |
+-------------------+------------------------------------------+

1280: main work 936×580
+------------------------------------------------------------+
| Canvas or form; inspector closed                          |
| 936×580                                                     |
+------------------------------------------------------------+

Settings variant:
+----------------+-------------------------------------------+
| Sections       | Form                                      |
| 200×580        | 728×580                                   |
+----------------+-------------------------------------------+
```

**Current-screen assignment:** Device Overview → T4; Device Apps → T1; Device Files → T2; Device Performance → T4; App Overview → T4; App Performance and Data Usage → T4; Storage IndexedDB and snapshot, LocalForage, LocalStorage, Cache, OPFS, and SQLite → T2; Storage Graph → T6; Inspect Elements and detected Vue/React tools → T2; Network Requests → T3; Network Mocking → T6; Replay library → T1; Replay playback and recorded tracks → T5; Flow authoring → T6; automation runs and step review → T5; Browser Preview → T6; Settings General, Appearance, ADB, Chrome, Shortcuts, MCP, and Updates → T6. Console Output, Exceptions, and REPL, plus Device Logcat → T3. The live Mirror is a persistent shell pane rather than a destination; device selection and emulator launch use T1. The Settings and recording-configuration forms use T6 without becoming global modal routes.

## 7. States in the layout

All routes use the same Gate pattern: one reason, one plain-language explanation, and the next available action. Put the gate inside the affected work pane; keep the context bar, timeline, and mirror in place.

| State             | Placement and space                                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disconnected      | If no prior data exists, show the Gate in the work pane, about 160 px high, with a Connect action. If data was already displayed, retain it with a stale strip instead of replacing it. |
| Unauthorized      | Same Gate, about 160 px high, naming the authorization step and offering Retry. Do not claim the device is connected.                                                                   |
| Target paused     | Keep the screen and cached evidence. Show a 28 px stale/paused strip with the last-read time and available recovery action. The timeline edge reads Paused, not Live.                   |
| Not debuggable    | Gate only target-dependent panes, about 160 px high. Device-level functions remain usable.                                                                                              |
| Companion missing | Gate only for values that require the companion; 48–56 px compact notice or a 144 px expanded Gate with deployment action. ADB/CDP values remain available.                             |
| Empty             | Show a pane-local empty state, about 160 px high, with the source checked and a relevant action. Do not show empty charts as zero.                                                      |
| Loading           | Preserve the layout and show row/card skeletons only in the loading pane. On refresh, keep prior values marked stale until new reads arrive.                                            |
| Error             | A 48 px inline error row with Retry and details; retain prior content as stale. Do not make a toast the only record of an error.                                                        |

## 8. Personas

There is no persona mode switch. The same shell progressively reveals capability:

- **Developer at the desk:** starts in the live context, opens Inspect or Data documents, and correlates selections on the timeline. Expert tools remain reachable by keyboard and command search.
- **QA tester capturing a session:** starts recording from the global action, uses timeline marks and Automate runs, then saves and reopens the session from the library. Run actions and approvals stay visible in their context.
- **Support person opening a `.capu`:** opens the received recording from Session. The context changes to Recorded, the timeline is fixed, and the session is read-only. No connected device is implied or required.

Advanced network features, framework tools, companion-dependent values, and agent controls appear when they are supported or requested. The live/recorded selector changes the evidence source, not the person’s role.

## 9. Density and grid

Use a 4 px base unit and the existing Bench type scale. All surface colors come from Bench roles; colors never substitute for labels or provenance patterns.

| Element          | Specification                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Controls         | Cladd Button, Select, SearchField: 28 px default; 24 px nested                                            |
| Navigation       | 44 px item height; 16–17 px icon; 11/16 px label                                                          |
| Tabs             | Cladd Tabs, 32–36 px high; 12/16 px type                                                                  |
| Table rows       | Cladd Table: 22 px compact, 26 px default; 12/16 px text, IBM Plex Mono for identifiers and values        |
| List rows        | Cladd List: 26 px dense, 30 px default                                                                    |
| Timeline lanes   | 22 px lane rows; 11/16 px labels; timestamps in IBM Plex Mono                                             |
| Gutters          | 8 px between controls; 12 px between panes; 16 px page padding at wide size, 12 px at compact size        |
| Panel padding    | Cladd Surface: 16 px wide, 12 px compact; SurfaceCut for recessed inputs and code areas                   |
| Type             | IBM Plex Sans; 11/16, 12/16, 13/18, 14/20, 16/22, 18/24 px                                                |
| Radius and depth | 6 px base radius; `shadow-bevel` for raised surfaces, `shadow-cut` for wells, `shadow-float` for overlays |

Use Cladd `Surface`, `SurfaceCut`, `Button`, `Tabs`, `Toolbar`, `Table`, `List`, `InputGroup`, `Chip`, `Select`, `Dialog`, `Popover`, `Tooltip`, `Spinner`, and `Toast` where those primitives fit. Use the application’s `ProvenanceTag` patterns for live, cached, recorded, imported, local-copy, and stale values. Use Reka’s resizable primitive for splitters until Cladd provides one. Apply Bench tokens such as `bg-background`, `bg-surface-0`, `bg-surface-2`, `bg-surface-cut`, `text-foreground`, `text-muted-foreground`, and the defined signal roles; do not add a parallel palette.

## 10. Migration

Ship the shell in stages, preserving existing module routes during the transition:

1. **Truth layer:** derive one link-health state; add the shared Gate and per-value provenance/read time. Keep the current navigation.
2. **Timeline spine:** add the 10-minute live timeline strip to every work area. Add live/recorded edge treatments and the reserved mirror rectangle for overlay placement.
3. **New navigation:** introduce the five job areas and document tabs. Alias existing paths to the new homes so existing links continue to resolve.
4. **Template migration:** move one family at a time—Device and apps, then Inspect and Network, then Data, then Automate and Settings. Preserve data logic and replace only each family’s layout at first.
5. **Recorded sessions:** promote Replay into the Session library and apply read-only Recorded context across its detail panes.
6. **Tier expansion:** surface shell-agent, companion, and SDK provenance as each source becomes available. Gate only the values that depend on a missing tier.

This sequence lets the timeline and trust rules arrive before the full navigation reshuffle, while keeping each existing feature usable during migration.

## Three biggest risks and pre-build tests

1. **The mirror reservation constrains overlays and narrow layouts.** Validate a focused native-webview layering prototype at 1280×800 and 1920×1080, including high-DPI scaling. Exercise a palette, menu, popover, dialog, toast, and drag operation beside the mirror; verify the mirror stays visible and receives input only within its own rectangle.
2. **The timeline and open dock may leave too little room for dense work.** Use a clickable layout prototype for database browsing, network inspection, and Logcat at 1280×800 and 1024×720. Test with the timeline collapsed to 64 px and the dock open at its 36% limit; check whether rows, filters, and timestamps remain usable.
3. **A unified context can still show misleading freshness across tiers.** Before implementing transitions, review a state matrix covering disconnected, unauthorized, paused WebView, non-debuggable app, missing companion, partial `.capu`, and recovered live target. For each, verify the displayed gate, per-value source/time, timeline edge, and retained stale data; reject any state that can render a missing value as zero or live.
