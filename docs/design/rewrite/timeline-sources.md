# Global live timeline: sources and v1 scope

Groundwork for the owner's global live timeline: a slim strip at the bottom that can be hidden, with
coloured lanes per kind of evidence, shown on every screen. Clicking a moment previews it or jumps
there. Start simple, then grow.

Read-only audit at `d3a00dc8`. Paths are relative to `apps/desktop/`. Related documents:
`console-review.md` (placement, and the stream fixes this depends on);
`docs/design/2026-11-04-ui-ux-rewrite-study.md` §3.1, §6.1, §9.4;
`docs/design/critique/round-02/SHELL-SPEC.md` (spine modes, live, review and recorded);
`docs/design/critique/round-02/layout-B-case.md` §13 (milestones M2 "Spine v0" and M6 "Buffer").

## 1. Live event sources today

The table uses three clocks:

- **D-wall** — the device's wall clock.
- **D-mono** — the device's monotonic clock.
- **H-wall** — the host's wall clock (`Date.now()` or Rust `SystemTime`).

| Source                                         | Where it lives                                                                                                                                                                               | Timestamp and clock                                                                                                                                                                                         | Retention                                                                                                                                                        | Runs when                                                                                                                                                                              | Cost to feed a timeline                                                                                                                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Console (`consoleAPICalled`, `Log.entryAdded`) | `src/stores/console.store.ts:269-370`, app-level lease in `src/components/ObservabilityBootstrap.vue:10-24`                                                                                  | `timestamp`, D-wall epoch ms; falls back to H-wall when the value is missing or odd (`console.store.ts:31-45`)                                                                                              | 500 entries (`:22`)                                                                                                                                              | Always, while a target is selected                                                                                                                                                     | **Low.** One marker per entry in the existing batch flush (`:183-186`). Only useful once the buffer grows (`console-review.md` F4).                                                               |
| Exceptions (`Runtime.exceptionThrown`)         | `console.store.ts:372-415`                                                                                                                                                                   | `timestamp`, D-wall epoch ms                                                                                                                                                                                | 160 (`:23`)                                                                                                                                                      | Same as console                                                                                                                                                                        | **Low.** One marker each.                                                                                                                                                                         |
| Logcat                                         | `src/stores/logcat.store.ts`, `src-tauri/src/commands/adb.rs:949-1043`                                                                                                                       | `date` "MM-DD" plus `time` "HH:MM:SS.mmm" strings: D-wall in local time, no year, no zone, no number (`src/types/console.types.ts:66-79`)                                                                   | 900 lines (`logcat.store.ts:14`)                                                                                                                                 | **Only while the Logcat tab is on screen** (`console-review.md` S1)                                                                                                                    | **High until fixed.** Needs app-level capture with holders (S1, S3), streaming with `-v epoch` (F1, S6) and batched IPC (F2). After that: markers for E/F lines, per-second density for the rest. |
| Network requests                               | `src/modules/network/stores/useNetworkStore.ts`, fed app-wide by `src/composables/useNetwork.ts` (mounted by `ObservabilityBootstrap.vue:8`)                                                 | `startedAt` = `wallTime * 1000`, D-wall ms (`useNetwork.ts:100`); start, response and finish times are D-mono seconds. **Bug:** WebSocket `startedAt` is D-mono × 1000, not wall time (`useNetwork.ts:183`) | 5,000 entries / 24 MB (`src/modules/network/networkRetention.ts:1-3`); **cleared on main-frame navigation** unless "keep requests" is on (`useNetwork.ts:68-75`) | Always, while a target is selected and capture is on                                                                                                                                   | **Low.** A marker on `addEntry`, with its severity set on finish. `wallTime − timestamp` per request gives the D-mono → D-wall mapping.                                                           |
| IndexedDB writes                               | `src/modules/storage/changes/useIndexedDBChangesTracking.ts`, feed `useIndexedDBChangesStore`                                                                                                | H-wall (`Date.now`/ISO, store `:21,216-234`)                                                                                                                                                                | 400 (`indexeddbChanges.service.ts:14`)                                                                                                                           | **Only while a Data screen holds the tracker**, paused when hidden or in the background (`useIndexedDBChangesTracking.ts:45-52`); coalesced over 220 ms, at least 1 s apart (`:21-23`) | **Medium.** The lane is honest only on Data. Another agent is editing `modules/storage/**` right now, so this feed waits.                                                                         |
| SQLite writes                                  | `src/modules/storage/stores/useSqliteChangesStore.ts`                                                                                                                                        | `observedAt`, H-wall ISO (`:40,60`)                                                                                                                                                                         | 1,000 (`:10`)                                                                                                                                                    | While the SQLite view observes changes (producer not traced here: module is being edited)                                                                                              | **Medium**, same caveat.                                                                                                                                                                          |
| localStorage writes                            | `src/composables/useLocalStorageRecorder.ts:73-76`                                                                                                                                           | DOMStorage events                                                                                                                                                                                           | —                                                                                                                                                                | Only during a recording                                                                                                                                                                | **Low** to start app-wide (four CDP events), but out of v1.                                                                                                                                       |
| Navigation                                     | `Page.frameNavigated` is handled only to clear network (`useNetwork.ts:68-75`); nothing is recorded                                                                                          | No timestamp in the event; would use H-wall on receipt                                                                                                                                                      | None                                                                                                                                                             | Always (network capture)                                                                                                                                                               | **Trivial.** Add a marker on main-frame navigation.                                                                                                                                               |
| Target and device changes                      | Session registry snapshot: `updated_at`, device `last_seen_at`, H-wall ms (`src-tauri/src/session/types.rs:45-70`); `targets.store`; `targetPresence.store.ts:73` (`checkedAt`)              | H-wall                                                                                                                                                                                                      | Current state only                                                                                                                                               | Always                                                                                                                                                                                 | **Trivial.** Watch the active context; mark target switches, device offline/online and app foreground/background.                                                                                 |
| Mirror frames                                  | `src/modules/mirror/useMirrorStream.ts:37,91` counts frames only                                                                                                                             | `performance.now()` (host monotonic)                                                                                                                                                                        | None                                                                                                                                                             | While the screen column is open                                                                                                                                                        | **High.** A Screen lane needs a thumbnail ring: about 1 fps × 20–40 KB JPEG ≈ 6–12 MB per 5 minutes, encoded off the main thread. Later.                                                          |
| Screenshots                                    | `useMirrorStream.ts:290-293`, shown in a toast and saved to Downloads                                                                                                                        | None kept                                                                                                                                                                                                   | None                                                                                                                                                             | On demand                                                                                                                                                                              | **Trivial** as a marker that links to the saved file.                                                                                                                                             |
| Recordings                                     | `src/stores/recording.store.ts:25-32` (`startedAt`, H-wall); `.capu` events `t` = ms offset from `manifest.startedAt` (`src/types/replay.types.ts:37,75`)                                    | H-wall                                                                                                                                                                                                      | On disk                                                                                                                                                          | While recording                                                                                                                                                                        | **Trivial.** A range on the strip. `/replay?file=&t=` already deep-links (`src/modules/recording/replaySeek.ts`).                                                                                 |
| Automation runs                                | `src/modules/automation/runRegistry.ts` events `occurredAt` (H-wall, `:143-165,220,281`); runs `startedAt` (`:451-452`); step screenshots in the run trace (`replay.types.ts:307-313`)       | H-wall                                                                                                                                                                                                      | Run history                                                                                                                                                      | While a run is active                                                                                                                                                                  | **Low.** Subscribe to the registry (`registry.subscribe`, as `useWorkbenchRun.ts:29` does).                                                                                                       |
| Perf samples                                   | Rust 1 Hz sampler (`src-tauri/src/commands/perf/mod.rs:23,107`), `timestamp` = host epoch ms (`:66-71`); frontend ring of 60 samples (`src/modules/devices/perf/usePerfMetrics.ts:16-17,46`) | H-wall                                                                                                                                                                                                      | 60 s                                                                                                                                                             | Only while a perf holder exists (device vitals)                                                                                                                                        | **Medium.** A permanent holder costs about one shell sample per second on the device. Make it opt-in.                                                                                             |
| Mock server hits                               | `mock-server-request` event (`src/runtime/ipc/events.ts:7-14`)                                                                                                                               | `timestamp`, H-wall                                                                                                                                                                                         | None                                                                                                                                                             | While the local mock server runs                                                                                                                                                       | **Trivial.** Later.                                                                                                                                                                               |
| MCP capture (Rust)                             | `src-tauri/src/mcp/capture.rs`                                                                                                                                                               | CDP timestamps                                                                                                                                                                                              | 200 console entries / 256 KB, 200 requests / 512 KB (`:29-33`)                                                                                                   | Started on the first MCP read                                                                                                                                                          | Not a UI feed. It shows that a byte-capped Rust ring is already a working pattern here.                                                                                                           |

### Clocks must be aligned before lanes are drawn together

Three clocks are mixed:

- Console, exceptions, network wall times and logcat are on the **device** clock.
- Network durations are on the **device monotonic** clock.
- Perf, storage changes, automation, recordings and the registry are on the **host** clock.

Device clocks are often seconds off, and the emulator after a snapshot restore can be minutes off.
Without correction, "click a moment" lands on the wrong evidence. Do the following:

1. **Measure skew.** On connect, and every few minutes, measure device − host skew per device: `adb
shell date +%s%3N` with the round-trip midpoint for logcat, and `Runtime.evaluate("Date.now()")`
   for CDP sources.
2. **Store markers on the host clock.** Convert every marker to host time with the measured skew.
   Show the offset in the tooltip when it is over 1 s.
3. **Give logcat a number.** Read logcat with `-v epoch` so it has a numeric time with no timezone.
4. **Fix the WebSocket start time.** Use the request's `wallTime − timestamp` offset from the first
   HTTP request, or the time it was received (`useNetwork.ts:183`).

## 2. Can the replay timeline become `src/shared/components/timeline/`?

Partly. The scrubber idea and the clock can be shared. The current files cannot be moved as they are.

- **`ReplayTimeline.vue`.** Reasons it cannot move unchanged:
  - **A module import.** It imports `./replayTableChanges` from the recording module (`:5`). Building
    markers has to move into the adapter, so the shared component only receives `TimelineMarker[]`.
  - **A fixed-duration model.** Positions are a percentage of `durationMs` (`:38-40`). A live strip
    needs a sliding window whose right edge is now, plus follow, zoom and pan.
  - **One DOM node per marker** (`:134-171`). That is fine for hundreds of recorded markers, not for
    thousands of live markers changing every second. Use per-second density buckets drawn on one
    `<canvas>` (or one SVG path per lane), as round 2 specified ("custom canvas renderer",
    `layout-B-case.md:557`).
  - **Recording-only controls.** Play, ±5 s and the duration readout (`:180-209`) belong to the
    recording adapter.
  - **Not Cladd yet.** It uses `title` tooltips, raw buttons and hard-coded `bg-violet-400/80` (`:230`).
- **`useTimelineClock`** (`src/composables/useTimelineClock.ts`) is already shared and fine for
  playback. A live strip needs a "now" ticker at 4–10 Hz, not 60 Hz: at 1,000 px for 5 minutes,
  1 px ≈ 0.3 s.
- **`Replay*Lane.vue` are evidence lists, not time lanes.** They stay in `modules/recording` and later
  become lens adapters (`layout-B-case.md` M3). Do not reuse `ReplayConsoleLane` as it is: it filters
  and sorts every event on each playhead tick (`ReplayConsoleLane.vue:42-61`), which is O(n log n) at
  60 Hz during playback.

**Proposed split. Modules never import each other.**

| Piece                                                    | Location                                                      | Notes                                                                                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types: `TimelineMarker`, `TimelineLane`, `TimelineRange` | `src/types/timeline.types.ts`                                 | `t` in host ms, `lane`, `severity`, `ref` (`{ kind, id }`), `label` up to 80 chars                                                                                                                   |
| Marker ring and per-second buckets                       | `src/stores/timeline.store.ts` (shared store)                 | Modules write to it through `push(marker)`. Writing to a shared store is allowed.                                                                                                                    |
| Reveal registry                                          | `src/shared/timeline/revealRegistry.ts`                       | Each module registers `reveal(ref)` and `preview(ref)` handlers for its `kind` from its `public.ts`. The shell calls the registry and never imports a module. Same pattern as the command providers. |
| Track, ruler, now-edge, playhead                         | `src/shared/components/timeline/`                             | `TimelineTrack.vue` (canvas), `TimelineRuler.vue`, `useTimelineViewport.ts` (follow, zoom, pan, px ↔ ms)                                                                                             |
| Live strip                                               | `src/components/timeline/LiveTimelineStrip.vue` (shell)       | Reads `timeline.store`                                                                                                                                                                               |
| Replay scrubber                                          | `src/modules/recording/ReplayTimeline.vue` becomes an adapter | Builds markers from `.capu` events and adds the play controls                                                                                                                                        |

## 3. What "jump to that moment" can honestly do today

Live sections show only the present. A click can reveal evidence that is still in a buffer. It
cannot show a screen as it was at T.

| Section             | What a click can do                                                                                                          | What it cannot do                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Console             | Scroll to the entry and flash it, if it is still among the last 500 (≈2.5 s at 200 lines/s; longer for quiet apps)           | Anything older, until the buffer grows (F4)                                       |
| Exceptions          | Open the exception if it is among the last 160                                                                               | —                                                                                 |
| Logcat              | Scroll to the line once capture is app-level, if it is still in the buffer. Today the stream is usually off, or holds ≈4.5 s | Anything while the tab was closed (S1)                                            |
| Network             | Select the request and open its details, if it is not trimmed or cleared by a navigation. The marker outlives the entry      | Response bodies trimmed by retention                                              |
| Data (IDB / SQLite) | Show the change entry: table, key, kind, from the feeds (400 / 1,000)                                                        | The table as it was at T. There are no checkpoints; that needs a recording, or M6 |
| Elements / DOM      | Nothing at T; show "Record to keep the page"                                                                                 | Any past DOM: rrweb runs only while recording                                     |
| Screen              | Nothing at T                                                                                                                 | No frame history exists                                                           |
| Device performance  | Values at T for the last 60 s, while a holder is active                                                                      | Older values                                                                      |
| Automation          | Open the run at the step, with its screenshot                                                                                | —                                                                                 |
| Recording           | If T falls inside a saved recording, open `/replay?file=…&t=…` at T. This is the only true "state at T" today                | —                                                                                 |

The preview popover should say plainly when an item has aged out: "No longer kept: Console keeps the
last 500 messages."

## 4. Minimal v1

- **Place.**
  - A 28 px strip at the bottom of the main content column, joined to the console drawer (see the
    placement recommendation in `console-review.md`).
  - Hidden with one toggle and a shortcut; the choice persists. Visible on every route, including
    Replay, where it shows the recording's markers.
- **Window.**
  - The last 5 minutes. Zoom 1, 5 or 15 minutes.
  - Right edge: a 1 px `signal-live` now-edge that moves only while events arrive.
  - Left edge: "since 15:12:04" when evidence starts later, so it never implies older data.
- **Lanes (four, colour plus shape, DESIGN.md §2).**
  - **Errors:** exceptions, `console.error`, and logcat E/F once capture is app-level. Tick plus icon,
    `error` hue.
  - **Network:** request starts as ticks in `cat-network`; failed requests (≥ 400 or failed) as
    error-hued ticks with a distinct shape.
  - **Console:** per-second density bars in `cat-console`.
  - **Logcat:** per-second density in `cat-device`. While logcat capture is not app-level, draw the
    lane dashed with "Logcat is off · Turn on". Never show an empty lane as "nothing happened".
  - **Overlays** (no lane of their own): recording ranges (`signal-rec` hairline), navigation and
    target-switch hairlines.
  - The strip shows Errors and Network marks over a combined density. Expanding to 64 px shows the
    four lanes.
- **Buffer.**
  - Markers only, not evidence. Hold 20,000 markers or 10 minutes, whichever comes first, in a ring
    of typed arrays plus a label array. At ≈150–250 B per marker that is ≤ 5 MB.
  - Per-lane 1 s buckets are updated as markers arrive.
  - Repaint at most 10 times a second, and never while the window is hidden.
  - Evidence stays in the source stores, under their own caps.
- **Click behaviour.**
  - **Hover:** a Cladd tooltip with the bucket's counts per lane and the clock offset when it is
    over 1 s.
  - **Click:** a popover listing up to 20 items in that second (time, lane icon, label). Items still
    kept come live from their store; aged-out items are labelled as such.
  - **Click an item:** navigate to its section and reveal it through the reveal registry (select the
    request, scroll to and flash the console row or log line).
  - **Click a recording range:** open the replay at T.
  - v1 has no review mode and no playhead: live sections cannot show the past, so the strip does not
    pretend they can.
- **Prerequisites,** from `console-review.md`: S1 (app-level logcat), S3 (holders), F1/F2 (stream
  and batch), S6 (`-v epoch`), and clock skew measurement. Without them, ship v1 with the Errors,
  Network and Console lanes, and the Logcat lane dashed.
- **Not in v1.** Data lane (storage module mid-rewrite; tracker only on Data), Screen keyframes, the
  perf sparkline, marks and A/B compare, range selection, recording pre-roll, the M6 live ring
  buffer of evidence.

## 5. Research: how the best tools present logs and timelines

Only the links marked "read" were opened in this session. The others are cited from prior knowledge
and should be checked before quoting.

- **Android Studio Logcat** ([read](https://developer.android.com/studio/debug/logcat)).
  - Key-value queries: `tag:`, `package:mine`, `level:` (≥), `age:5m`, `is:crash`, `is:stacktrace`.
    `-` negates and `~` makes a regex. `&`, `|` and parentheses work; the same key is implicitly OR'd.
  - Ctrl+Space suggestions, query history and named favourites.
  - "PROCESS ENDED / STARTED" lines across app restarts; split panes, each with its own query.
  - Soft-wrap off by default. "Scroll to the End" turns off when you scroll up.
  - **Adopt:** the grammar as is, process markers, follow-tail semantics, wrap off.
- **Chrome DevTools Console** ([read](https://developer.chrome.com/docs/devtools/console/reference)).
  - "Group similar" is on by default. Level menu, sidebar by source, `url:` / `-url:` / `/regex/`.
  - Preserve log. Expandable stacks with "Caused by" chains and third-party frames hidden. Errors
    link to Sources and Network.
  - **Adopt:** group similar with counts, stacks folded with the app's own frames first, links from
    an error to its request.
- **Chrome DevTools Performance** ([reference](https://developer.chrome.com/docs/devtools/performance/reference),
  not re-read).
  - An overview strip above detailed tracks; drag to select a range; a screenshot filmstrip on hover;
    one track per kind.
  - **Adopt:** overview strip plus expandable lanes, and later hover thumbnails for the Screen lane.
- **Sentry breadcrumbs** ([read](https://docs.sentry.io/product/issues/issue-details/breadcrumbs/)).
  - Typed crumbs, each with its own colour and icon. Levels fatal…debug; newest or oldest first.
  - Absolute time, or time relative to the first crumb; search across type, category, message and
    data.
  - **Adopt:** typed icons per lane, and "relative to selection" time in the preview popover.
- **Flipper Logs plugin** ([docs](https://fbflipper.com/docs/features/logs-plugin/), not re-read).
  - Logcat in columns, plus "watchers" that count lines matching an expression.
  - Flipper is no longer the React Native default debugger, so learn from it but do not follow it.
  - **Adopt:** watcher counters as a later timeline lane ("lines matching X per second").
- **Reactotron** ([docs](https://docs.infinite.red/reactotron/), not re-read).
  - One mixed, typed event stream: log, API and state, each expandable.
  - **Adopt:** the preview popover lists mixed evidence types in one ordered list.
- **Replay.io** ([docs](https://docs.replay.io/), not re-read).
  - Console messages as markers on the timeline; clicking one moves time there; print statements
    add markers at every hit.
  - **Adopt:** "Show this moment on the timeline" from any log row, which is the reverse of the strip
    click.
- **rrweb** ([repo](https://github.com/rrweb-io/rrweb), not re-read).
  - Full snapshots plus incremental events; the player skips inactive stretches and shows activity
    on its progress bar.
  - **Adopt:** activity density on the bar, and keyframe-plus-delta for any future "state at T".
- **Proxyman** ([docs](https://docs.proxyman.com/), not re-read).
  - Dense flow list, pinned domains, colour and highlight rules set by the user.
  - **Adopt:** user highlight rules that can mark matches on the timeline, with the mark colour
    `signal-mark`, never a new hue.
- **Raycast** ([manual](https://manual.raycast.com/), not re-read).
  - Keyboard first: one search field and an actions panel (`⌘K`) on the selected item.
  - **Adopt:** an actions menu on a selected log row or marker (Filter to tag, Open request, Copy,
    Show on timeline), reachable from the keyboard.

**What not to copy.**

- A bottom spine stacked over a separate dock. Round 2 rejected this for good reason; join the two
  instead.
- Per-tag rainbow colours, as in Android Studio. They break "colour is meaning" (DESIGN.md §1).
- A timeline that implies "state at T" for live sections that cannot provide it.
