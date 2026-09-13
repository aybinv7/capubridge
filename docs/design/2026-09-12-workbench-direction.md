# Capubridge workbench direction

Design proposal · 12 September 2026 · Based on capabilities, not the current interface

## Position

Capubridge should feel like a dedicated place to investigate a running app. Its strongest promise is continuity: reproduce something on Android, inspect its browser and native evidence, inspect its data, and return to the same moment in a recording.

The navigation should express that continuity. A collection of equally prominent feature destinations would make the user assemble the workflow mentally. A permanent device, app, target, and data-state context lets the tools do that work together.

This is a concept and interaction specification, not an implementation or an assessment of the existing UI. No current Vue templates, styles, screenshots, or rendered application were inspected. Evidence came from the product specification, README, types, IPC contracts, Rust commands, MCP tool definitions, and CDP adapters. Existing uncommitted work was left untouched. No installation, build, or development server was run. Capability presence is not a runtime certification; see the separate inventory for evidence and maturity limits.

## Product structure

Use four application destinations, always in the same order:

| Destination | User intent                            | Contents                                                                                                                |
| ----------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Connect     | Get a device or runtime ready          | USB, wireless pairing, installed emulators, local browser/preview sources where supported, recent connections, recovery |
| Workbench   | Understand and change the selected app | Runtime, storage, native tools, optional mirror and output dock                                                         |
| Recordings  | Investigate a captured session         | Library, playback, event tracks, database snapshots, export                                                             |
| Automation  | Connect an external assistant          | MCP enablement, endpoint configuration, permission scope; future activity and review surfaces                           |

Settings and Help are utilities, not fifth and sixth work modes. The command search is always reachable by a visible control; it is an accelerator, never the only route to a feature.

Inside Workbench, use one text-labelled navigator:

- Overview: selected app identity, connection readiness, supported tools, recent work, and start recording.
- Inspect: Elements, detected Vue or React DevTools, Network, Console, Performance.
- Data: Storage, Files.
- Device: Apps, Logcat, Shell, Ports.

Mirror is an optional companion that can also expand to the main area or detach. Device information and lifecycle controls live on the selected device's detail surface in Connect and its context menu. Do not repeat reboot, root, and connection setup in every tool.

Storage owns its own resource tree. Its engines do not each become a global navigation item. Recording tracks use the same evidence vocabulary as live tools but remain inside the recording context. Experimental features enter an existing family only after their real workflow is usable.

## Persistent context

Below the application bar, a compact context strip shows:

**Pixel 8 · USB / Fieldnote · com.fieldnote.app / Main WebView · localhost / Live**

Each segment can change its own scope. Package name and target URL are available without hiding them behind icon-only tooltips. Long identifiers truncate in the middle with a copy action and full text on focus. Local browser sources replace the Android device segment with their actual source type.

Device connected, app selected, and target attached are separate states. A connected phone does not imply a debuggable WebView. Android native tools remain usable when no WebView is available.

Changing devices suspends affected live work through the existing runtime. The interface shows what stopped and preserves labelled cached results; it does not imply multiple devices remain live. Dirty edits must be resolved before their owning target changes. Each open resource retains its source identity, so an old result cannot silently inherit the new device label.

Translate runtime temperatures into user language: Active, Available with cached data, Offline. Use additional freshness text such as “Snapshot from 14:22:08.” Never display cached values with a Live badge. Device disconnect must not erase useful evidence.

## Layout system

The initial direction uses graphite application chrome, a light technical workspace, a restrained cobalt selection color, and dense, readable data. A coordinated dark workspace should follow with identical hierarchy. Theme choice should not change information architecture.

At a 1600 × 1000 design viewport:

| Region            | Proposed size and behavior                                 |
| ----------------- | ---------------------------------------------------------- |
| Application bar   | 44 px; destinations, command search, utilities             |
| Context strip     | 48 px; selected scope and actual state                     |
| Tool navigator    | 184–208 px; resizable and collapsible                      |
| Primary work area | Consumes remaining space; table, editor, tree, or timeline |
| Companion         | 280–340 px; optional Mirror or contextual detail           |
| Output dock       | 180–240 px when open; Console, Logcat, Tasks               |
| Status strip      | 24 px; transport, active collection, operation status      |

Use a maximum of one companion beside the primary task by default. A resource inspector takes precedence over a mirror when the table would become too narrow. Console and Logcat can move between the main area and dock, but represent one underlying collection, not duplicate sessions.

Provide named layout presets: Inspect, Data, Reproduce. These only arrange existing panes and explicitly requested collection. They do not secretly enable every stream. Offer Reset layout. Arbitrary IDE-style docking is a later investment, not a prerequisite for a useful workbench.

At 1280 px, collapse the companion first and open record details in a focusable overlay or replaceable pane. At roughly 1024 px, expose the navigator through a labelled Tools control and show one main pane plus optional output. At short heights, collapse output before reducing table rows to unusable fragments. Test 200% zoom; pane priority should follow available CSS space, not physical monitor assumptions. This desktop product does not need an invented phone navigation system.

## Three concept screens

These generated images are exploratory concepts with fictional Fieldnote data, not screenshots of Capubridge or an approved production specification:

- [Live debugging concept](concepts/01-live-workbench.png)
- [Storage editing concept](concepts/02-storage-workbench.png)
- [Recording investigation concept](concepts/03-recording-workbench.png)

The written interaction rules govern behavior. Image generation introduces small inconsistencies: the Storage and Replay concepts still show a macOS shortcut symbol despite the Windows setting; sample dates, app branding, and footer metadata vary; Storage shows nine illustrative rows although its pagination says 50; some icons and pane widths differ across screens. Production work must normalize these, use actual data/visible row counts, remove invented account/version chrome, and validate typography and contrast. The native screenshot dimensions are 1586 × 992 rather than the requested 1600 × 1000. No browser implementation or responsive behavior has been built or verified.

Visual review covered context visibility, navigation hierarchy, primary/detail proportions, selected/error states, edit destination, and read-only replay. The initial live concept incorrectly paired an active recording timer with Start recording; the saved revision corrects this to Stop recording. The Storage example demonstrates draft mechanics only: manually incrementing a revision is not a recommended fix for a real sync conflict.

### Live debugging

The Network work area shows a request list, selected request details, and an optional live mirror. Console occupies the lower dock when useful. The illustrative task is a failed note sync: reproduce the problem, select the HTTP 409, inspect its response, then examine the local record.

Network capture and full session recording are distinct controls and states. Use “Capturing requests” for network collection. A session recording action says “Start recording” when idle and “Stop recording · 02:17” when active. Never show an active session timer beside Start recording.

Display “WebView traffic” near Network. A missing request must not imply that native plugin traffic was captured. Bounded retention is visible through captured/retained counts and an explanation when a body has expired. Filtering a table must not pretend to search discarded payloads.

The strongest future shortcut is “Open related data,” using explicit identifiers or a user-selected search. Do not claim automatic causality from matching timestamps or guessed identifiers.

### Storage editing

One source tree groups Browser, Device databases, and Imported files. Browser expands into origin and engine. The table shows records; a selected record opens an editor with its source and write destination in view.

For live IndexedDB, use an explicit draft:

1. Edit a field in the record inspector.
2. Show the exact before/after value and “Draft · 1 field changed.”
3. Show “Writes to IndexedDB on Pixel 8.”
4. Apply to target, wait for the actual result, then refresh the confirmed value.
5. On failure, keep the draft and explain the recoverable error.

Drafts are local editor state, never invented remote truth. “Discard draft” only removes unsent edits. Do not offer Undo after a target write unless a real reversal is implemented.

SQLite needs a different action contract. The inspected native `sqlite_execute_write` opens a local path and executes SQL there. Use “Save local copy” and “Export modified database” for this path; do not imply it updated the running app. OPFS and jeep-sqlite source labels also need an adapter-specific write destination. Refreshing a source must not overwrite a dirty local copy without resolving that draft.

Shared table behavior: filter scope, row selection, typed cell editor, structured JSON viewer, pagination, selected-row actions, and export scope. Schema metadata belongs alongside records. SQL consoles remain within their source, with cancellation and a persistent execution result. Source trees must distinguish discovery in progress, empty, unavailable, and permission denied.

### Recording investigation

Recordings has its own library and a clearly read-only context strip. The selected recording combines replay, event detail, and one shared timeline across interactions, network, console, database, and performance tracks.

A selected failed request moves the common playhead. “At this moment” shows nearby events and captured database state. State the correlation window; temporal proximity is evidence for investigation, not proof of causation. Unsupported or unrecorded tracks say “Not captured.” They must never look like zero activity.

“Back to live” is explicit and restores the previous live workspace. Editing controls disappear from recorded data. Incomplete recordings show their recovered duration and missing tracks. Export previews included tracks, size, and redaction; portable artifacts should be useful without an attached phone.

The current backend already offers recording query correlation and database-at-time reads. A polished linked evidence interface is the proposal; no end-to-end frontend behavior was verified here.

## First use and expert use

First use begins with one useful prompt: “Connect a device to inspect your app.” Present USB instructions, wireless pairing, and installed emulators as clear choices. A plugged-in device becomes a selectable row immediately; unauthorized devices show the Android authorization step in place.

After selection, list running apps with debuggable targets first and provide an explicit all-apps search. An app with one target can offer one clear Inspect action; multiple targets require meaningful titles and URLs. No-target states explain the requirement to enable WebView debugging without blocking Apps, Files, Shell, or Mirror.

Once connected, Overview offers Inspect screen, Inspect data, and Record a problem, plus the normal tool list. These are launch paths into the same workbench, not a separate beginner version. Framework capability failures include the relevant requirement; a production Vue build may need its inspection flag, and React profiling has separate build requirements.

Experts receive persistent layouts, recent resources, keyboard navigation, context-aware command search, and direct selection actions. Search results include destination, scope, and unavailable reason. Dangerous actions remain discoverable but cannot execute merely because a command result was selected accidentally.

## MCP and future AI

The inspected MCP catalog contains 30 named tools spanning device discovery/control, emulator launch, WebView reads/actions, recording control, and recording queries. The product specification requires localhost-only access, authentication, default read-only behavior, and opt-in mutations.

Automation should first expose that actual capability: server state, endpoint copy, concealed credential controls, read-only/mutation mode, and supported tool groups. “Server running” must not be relabelled “Assistant connected”: the inspected status type does not provide a client-presence count.

Future work can add an auditable activity view showing caller, exact target, tool, duration, result, and affected resources. Per-action human review, stop/revoke controls, and an integrated assistant pane need explicit runtime support. The MCP caller's `confirm: true` is not human approval and must never render as “Approved by you.”

If chat is added, open it on request with a visible context attachment such as a selected request or recording interval. The evidence pane should not be permanently displaced by chat. Proposed diagnoses must link to their actual source and distinguish observations from hypotheses. New AI functions should use the same typed capability model as human actions.

## Recovery and state contract

| Condition                         | Required experience                                                               |
| --------------------------------- | --------------------------------------------------------------------------------- |
| USB unauthorized                  | Explain the device prompt; offer refresh after authorization                      |
| Device disconnected               | Keep labelled stale evidence; disable writes; offer explicit reconnect            |
| App backgrounded                  | Explain possible suspension; offer bring-to-foreground action when supported      |
| Target replaced by navigation     | Mark old target stale; rediscover on explicit intent; resolve drafts              |
| External DevTools owns connection | Show owner and deliberate handover; avoid competing attachments                   |
| Protected file/database           | Show access limitation and available paths; no endless loading                    |
| Long scan/query/export            | Show progress where measurable, elapsed state otherwise, cancel, terminal outcome |
| Capture paused or buffer full     | State what is retained and what is no longer collected                            |
| Partial recording                 | Show recovered coverage and missing data; allow supported read-only inspection    |
| Write failed                      | Keep draft, show target and error, offer retry only when outcome is known         |

Unknown write outcomes require a refresh/verification step before retrying a non-idempotent action. Repeated background failures belong in the operation view, not a flood of toasts. Errors should explain the next useful action.

## Visual and interaction rules

- Proposed tokens: chrome `#17191d`, canvas `#f7f8fa`, surface `#ffffff`, main text `#20242b`, secondary text `#596273`, selection `#4263eb`. Error, warning, and success require accessible text/icon companions; validate contrast before implementation.
- UI typography: 13 px with roughly 18 px line height; headings 16–20 px; data/code 12–13 px monospace. No oversized marketing typography inside the workbench.
- Default data rows around 30 px; comfortable density 36 px. Use 32 px controls and visible keyboard focus. Do not achieve density through tiny unreadable text.
- Use dividers to define regions. Small radii belong to controls, not a floating card around every region. Keep icons consistent and pair unfamiliar ones with labels.
- Keyboard and pointer paths must both cover selection, filtering, resizing, editing, and recovery. Escape closes transient UI and returns focus; it never silently discards a draft. Resizers need keyboard alternatives.
- Animate only state transitions and pane changes, briefly, with reduced-motion support. Do not animate every incoming log row or graph point.

## Scalability and rollout

Keep the existing Vue/Rust runtime architecture. A future shared shell should compose module public surfaces. Feature modules own their routes, data logic, UI, and locales. A capability descriptor can provide family, scope, availability reason, maturity, commands, and supported pane placements without modules importing one another's internals.

Lazy-load framework DevTools, Monaco, mirror decoders, and replay. Virtualize or paginate long lists and trees, fetch selected details on demand, bound payload retention, and batch stream updates. Collection lifetimes belong to explicit runtime leases; closing a pane must not silently stop a recording that owns the same source. Persist layout independently from operational truth.

Before Vue implementation, load the requested Vue and Pinia skills, inspect the installed shadcn-vue component catalog and shared UI package, and map semantic tokens to reusable primitives. This design pass intentionally did not inspect their current styling.

Suggested rollout:

1. Context strip, navigation, consistent recovery, and correct source/write labels.
2. Shared table/detail behavior and coherent Storage source selection.
3. Mirror/output presets with explicit capture ownership.
4. Linked replay timeline and evidence navigation.
5. MCP activity and permission review once the required runtime contracts exist.

Validate with early developers, regular hybrid-app developers, and experienced debugging users. Proposed acceptance tasks: connect and inspect the right target within 90 seconds after prerequisites; find an HTTP failure and its response without instruction; correctly identify where a SQLite edit will save; inspect a recording offline; recover from disconnect without losing a draft; identify whether MCP can mutate the device. These are targets to test, not measured results.

## Research and alternatives

VS Code documents persistent layouts, movable views, and a secondary sidebar. The useful principle here is a stable main task with optional companions and resettable layouts. Capubridge should start with fewer placement choices. [VS Code custom layout](https://code.visualstudio.com/docs/configure/custom-layout)

Chrome DevTools separates tools into panels and a drawer, supports persistent ordering, and adapts detail placement to available size. That supports a primary investigation pane with a secondary output dock. [Chrome DevTools customization](https://developer.chrome.com/docs/devtools/customize/)

DataGrip exposes draft submission, change previews, scoped reversion, and conflict handling. The applicable principle is explicit write intent and destination; its transaction guarantees cannot be assumed for every Capubridge storage adapter. [DataGrip submit and revert](https://www.jetbrains.com/help/datagrip/submitting-and-reverting-changes.html)

Sentry connects errors with replay timelines and related evidence. Capubridge can adapt that investigation pattern to local recordings and database snapshots, without assuming cloud telemetry or causal linkage. [Sentry replay/error linkage](https://sentry.io/changelog/2023-5-11-connect-session-replays-to-backend-errors/)

A device-first permanent tree makes physical inventory prominent but adds friction to cross-tool app investigation. An issue-first home is attractive but would promise automatic issue detection beyond the verified capabilities. An AI-first chat surface weakens direct control and assumes a built-in assistant not established by the inspected code. The recommended app-centered workbench fits the current product while leaving room for those later capabilities.
