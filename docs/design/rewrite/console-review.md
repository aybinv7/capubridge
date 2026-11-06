# Console dock — review

Reviewed at `d3a00dc8` on `feat/ui-ux-overhaul`. This is a read-only audit: no code was changed.
Paths are relative to `apps/desktop/`. The parity list is in `console-parity.md`.

Within each section, items run from most to least severe. "Rate" means about 200 lines a second, the
load the owner asked about. Numbers marked "≈" are computed from the code. They are not measurements.

The dock was not observed open. The owner was using the app, so no keys or clicks were sent. A
passive screenshot showed the dock closed and no target selected.

## Performance

### How a logcat line travels today

1. **Device.** Every 900 ms, a background thread runs one adb shell: `logcat -d -v threadtime -t 256`
   the first time, then `-T '<MM-DD HH:MM:SS.mmm of the last line>'` (`src-tauri/src/commands/adb.rs:949-968,994-1030`).
2. **Rust.** It parses the dump, then for every pid it has not seen it runs one more adb shell,
   `cat /proc/<pid>/cmdline`, sequentially and inside the parse loop (`adb.rs:854-905`). It hashes each
   line into an id and dedupes against the last 1,024 ids (`adb.rs:787-798,1004-1017`).
3. **IPC.** It sends one `app.emit("capubridge:session-event", LogcatEntry)` per line
   (`src-tauri/src/session/events.rs:20-22`, `live_features.rs:46-48`). Every listener of that event,
   in every webview, receives every line: `session.store`, `logcat.store`, `usePerfMetrics` and
   `usePerfRecorder` in the main window, and the same set in any detached window that created those
   stores.
4. **Store.** It filters by serial and drops a line whose id equals the previous one. Lines are queued
   in a frame batcher (`src/lib/frame-batcher.ts`). One flush per frame runs `concat` + `slice` to 900
   (`src/stores/logcat.store.ts:45-53`). The store uses `shallowRef`, which is correct.
5. **DOM.** On every flush, the view recomputes the counts, the filter and the package list over the
   whole buffer and re-renders a `v-for` of up to 900 rows. Each row is a six-column grid with a
   wrapped `<pre>`, inside a reka `ScrollArea` with no virtualisation and no follow-tail
   (`src/modules/devices/DeviceLogcat.vue:47-101,306-333`).

The console path is shorter. CDP events arrive on the shared WebSocket, then go to
`console.store` (`shallowRef`, frame batcher, cap 500), then to a `v-for` of `visibleRows` with
`ConsoleArgsView` per row (`src/modules/console/ConsoleOutput.vue:216-252`).

### Findings

- **F1 blocker — logcat is polled, not streamed** (`adb.rs:994-1030`).
  - **Latency.** Each line is ≈0.5–1.1 s late (half the 900 ms period plus one shell exec).
  - **Bursts.** Lines arrive in bursts of ≈180 per poll, not as a stream.
  - **Device cost.** The device forks `logcat` about once a second.
  - **New pids stall the poll.** Each new pid adds a blocking adb round-trip. The first dump, with
    ≈30–40 pids, waits ≈0.5–1.5 s before any line shows.
  - **Ring wraps.** On chatty ROMs (HyperOS on the owner's Redmi), a slow poll can let the device
    ring buffer wrap and lose lines. That is an estimate: at 1,000 lines/s × 150 B, a 256 KB buffer
    holds ≈1.7 s.
  - **Fix.**
    - Hold one long-lived `logcat -v threadtime -v epoch -v uid -T 1` shell and read stdout
      incrementally on a blocking thread.
    - Reconnect with backoff from the last epoch cursor.
    - Resolve uid to package once (`pm list packages -U`), off the read loop.
- **F2 blocker — one IPC event per line on a broadcast channel** (`events.rs:20-22`).
  - At the rate, that is 200 emits a second. Each payload is ≈550 B of JSON (`raw` repeats `message`
    and the header, `adb.rs:745-760`), so ≈110 KB/s.
  - Each payload is delivered to every session-event listener in every webview.
  - **Fix.**
    - Batch in Rust: one `logcatBatch` every 50 ms or 256 lines, whichever comes first.
    - Send it on a Tauri `ipc::Channel` handed to the lease, so only the owning webview gets it.
    - Drop `raw` from the wire (rebuild it for export) and send `tsMs` as a number.
- **F3 blocker — no virtualisation in any dock list.**
  - Logcat: up to 900 rows ≈ 6,300 elements, each a wrapped `<pre>` that must be laid out
    (`DeviceLogcat.vue:306-333`).
  - Console: 500 rows with component args (`ConsoleOutput.vue:216-252`).
  - Exceptions: 160 cards (`ConsoleExceptions.vue:76-105`). REPL: 80 cards (`ConsoleRepl.vue:84-121`).
  - With F1 fixed, flushes rise from ≈1–2 to up to 60 a second, and this render becomes the bottleneck.
  - **Fix.** One shared virtual log list, built on `src/shared/composables/useFixedVirtualList.ts`.
    Use fixed 22 px single-line rows. An expanded row opens a measured detail row.
- **F4 major — the retention is too small to be useful.**
  - At the rate, logcat keeps 900 lines (≈4.5 s) and console keeps 500 (≈2.5 s)
    (`logcat.store.ts:14`, `console.store.ts:22`).
  - Over 30 minutes that is ≈360,000 lines, and 99.75 % are discarded.
  - Memory stays flat (≈1–3 MB of JS). The problem is lost evidence, not growth.
  - **Fix.**
    - Keep a Rust ring buffer per device (for example 100k lines or 32 MB, byte-capped, like the MCP
      capture's byte caps in `src-tauri/src/mcp/capture.rs:29-33,130-133`).
    - Show a window of 10–20k rows in the view and page older rows on scroll-up.
    - Raise console to about 5,000 entries once F3 is done.
- **F5 major — every flush recomputes over the whole buffer.**
  - Logcat runs 6 `filter` passes for the level counts (≈5,400 iterations) (`DeviceLogcat.vue:63-70`).
  - The text filter joins 5 fields and lowercases them per entry, per flush (`:72-101`). `raw`
    already contains the message, so the text is lowercased twice.
  - The package list is rebuilt and sorted per flush (`:47-61`).
  - Console: 4 count passes (`ConsoleOutput.vue:21-27`), a concatenated lowercased string per entry
    (`:29-44`), and a `new Set()` allocated per row in `visibleRows` (`:90`).
  - **Fix.**
    - Keep counters at ingest: add on push, subtract on trim.
    - Precompute a lowercased search string once per entry at ingest.
    - Compile the query once per change, apply it incrementally to appended batches, and debounce
      typing by 150 ms.
- **F6 major — every flush copies the whole array** (`logcat.store.ts:47,50`, `console.store.ts:184,189`).
  This is O(cap) per frame: cheap at 900, about 20k element copies per frame at a 20k window.
  - **Fix.** A ring with a head index plus a `version` counter (`triggerRef`), or chunked pages.
  - The study's "full-array copy per line" (`2026-11-04-ui-ux-rewrite-study.md` §2.3) is out of date.
    The frame batcher made it one copy per frame.
- **F7 minor — `new Intl.DateTimeFormat` per console entry and exception** (`console.store.ts:47-54`).
  Building a formatter costs tens of microseconds, so at the rate it is ≈2–10 ms of main-thread time
  a second. **Fix:** create one formatter at module scope.
- **F8 minor — the hidden-window batcher slices on every push past 900** (`frame-batcher.ts:58-63`).
  While the window is hidden and lines keep coming, every push copies 900 items (≈180k copies a second
  at the rate). **Fix:** a ring buffer plus a dropped-count.
- **F9 minor — dock resize writes the height on every mousemove** (`BottomDock.vue:91-93`). That
  relayouts the whole main column per event. **Fix:** coalesce with `requestAnimationFrame`.
- **F10 minor — small leaks and growth.**
  - The pid cache is never trimmed (`adb.rs:856,903`).
  - `onResized` is never unlistened (`DockDetachedWindow.vue:24-26`).
  - REPL `objectId`s are never released. With `returnByValue` there are none, but F-REPL below adds
    them.

## Stability of native logs

- **S1 blocker — logcat runs only while its tab is on screen.**
  - `DockTabContent` mounts only the active tab, without `KeepAlive` (`src/components/dock/DockTabContent.vue:33-40`).
    The dock itself is `v-if` (`src/components/layout/AppShell.vue:259-263`).
  - When the view unmounts, it calls `syncLease(null)`, which stops the device stream and clears the
    buffer (`DeviceLogcat.vue:41-43`, `logcat.store.ts:169-175`).
  - So closing the dock, switching to Console, or opening any screen without the dock kills logcat.
    Reopening replays only the last 256 lines (`adb.rs:960`).
  - The Logcat unread mark can never fire in practice.
  - **Fix.**
    - Own logcat at app level, like `ObservabilityBootstrap` owns console capture.
    - Keep the buffer independent of views. Views subscribe, they do not lease.
- **S2 blocker — a stale "stopped" callback marks a live stream Idle.**
  - Starting a stream always stops the previous one (`adb.rs:987`). When the old thread exits (up to
    900 ms later), it calls `on_stopped` unconditionally (`adb.rs:1032-1039`).
  - That sets the registry lease to false and emits it (`live_features.rs:52-56`).
  - After Restart, a re-select, or a second window, the badge reads Idle while lines keep flowing.
  - The next `syncLease` then sees `isStreaming` false and restarts again (`logcat.store.ts:177-181`).
  - **Fix.** Call `on_stopped` only when this session is still the registered one (the existing
    `ptr_eq` check). Carry a session generation in lease events and ignore stale ones in the store.
- **S3 blocker — the logcat lease has no holders, so owners stop each other** (`live_features.rs:67-80`).
  - Pop-out: the main window's view unmounts and stops the stream; the new window starts its own.
  - The order of the two IPC calls across webviews is not guaranteed. If the stop lands last, the
    pop-out shows nothing.
  - A future timeline feed would hit the same race.
  - **Fix.** Holder-based leases, as perf already has (`live_features.rs:116-170`,
    `src-tauri/src/session/perf_holders.rs`).
- **S4 blocker — popped-out Console, REPL and Exceptions never connect.**
  - The detached window renders without `ObservabilityBootstrap` (`src/App.vue:41-55`), so
    `leaseConsumers` stays 0 and `syncLease` returns early (`src/stores/console.store.ts:586-588`).
  - Console and Exceptions then read "Connect target first." for good, and REPL reads "No active CDP
    target". Meanwhile the main dock hides the tab.
  - **Fix.** Keep one capture owner (the main window) and stream entries to pop-outs, through a Tauri
    event or a `BroadcastChannel`. Or, at minimum, take a lease in the detached window, with S3's
    holders.
- **S5 major — one failed poll ends the stream for good** (`adb.rs:1020-1026`).
  - A transient adb error, USB re-enumeration or adb server restart produces an error and the lease
    goes false.
  - When the device returns with the same serial, the serial watch does not fire
    (`DeviceLogcat.vue:33-39`), so the user must find Restart.
  - **Fix.**
    - Retry with backoff while held, resuming from the cursor.
    - Restart on the device's offline → online transition from the registry snapshot.
    - Show "Reconnecting…" with a `StatusDot`.
- **S6 major — a device clock that goes back freezes logcat silently.**
  - The cursor is device local wall time without a year or zone (`adb.rs:959,1005`).
  - An emulator snapshot restore, an NTP correction, or a manual time or zone change makes every
    `-T` dump empty until the clock passes the old cursor. The badge says Live throughout.
  - **Fix.** Use `-v epoch`. Detect "no lines while the device's newest timestamp is behind the
    cursor" and reset. With the stream from F1, the cursor matters only for reconnects.
- **S7 major — the dedupe drops real lines.**
  - The id is a hash of the line's own content (`adb.rs:787-798`), checked against the seen set
    (`:1006-1008`) and again in the store (`logcat.store.ts:68-71`).
  - So two identical lines in the same millisecond from the same thread become one. Tight loops and
    repeated framework warnings are common cases.
  - **Fix.** Streaming needs no dedupe. On reconnect, dedupe by (epoch ms, ordinal within that ms),
    not by content.
- **S8 major — crash lines lose their app, so the package filter hides them.**
  - The package is looked up from `/proc/<pid>/cmdline` up to ≈1 s after the line (`adb.rs:871-897`).
  - A crashed or short-lived process is already gone, so the lookup caches `None` forever (`:903`).
    The `FATAL EXCEPTION` lines then show as "system" and the app's package filter drops them
    (`DeviceLogcat.vue:86-88`).
  - pids are recycled and the cache is never invalidated, so lines can be mislabelled.
  - There is no "process ended / started" marker.
  - **Fix.**
    - Use `-v uid` and map uid → package; a uid survives restarts.
    - Resolve unknown pids in one `ps -A -o PID,NAME` call per batch.
    - Emit synthetic "process started / ended" rows for the selected app when its pid changes, as
      Android Studio does.
- **S9 major — spaces inside messages are collapsed** (`adb.rs:829-835`). `split_whitespace().join(" ")`
  rebuilds the message, so aligned columns, ASCII tables and indented JSON lose their spacing.
  **Fix:** parse the fixed header fields, then slice the original line after the first `": "`.
- **S10 major — pausing drops lines while claiming to keep them.**
  - `pausedCount` adds every batch (`logcat.store.ts:48`), but the buffer keeps 400 (`:15,47`).
  - The header shows "1,200 buffered", and 800 of those are gone on resume.
  - **Fix.** Pause should freeze the view, not the buffer. Show "N new lines" and keep them in the
    ring (F4).
- **S11 major — the recording's console track stops once the console buffer is full.**
  - The recorder watches `entries.length` and slices from the last index (`src/composables/useRecordingSession.ts:170-177`).
  - At the 500 cap the length stays 500, so the watcher never fires again.
  - Before the cap, a flush that trims loses the trimmed part of the batch.
  - **Fix.** The store emits appended batches, and the recorder subscribes to them. Add a test.
- **S12 major — a failed console attach stays "connecting" forever.**
  - `syncLease` awaits `attachConsoleTargetEffect` (`console.store.ts:612-616`). That requires the
    target's device to be the active, online device (`live_features.rs:19-28,211`).
  - A rejection escapes through `void` (`src/components/ObservabilityBootstrap.vue:12,18`), so
    `bindLeasedClient` never runs.
  - The status stays "connecting" (set by `resetTargetState`, `:215`), with no error and no retry.
  - **Fix.** Catch the rejection, set the error and status, and `scheduleRetry`.
- **S13 major — duplicates after a reconnect.**
  - On a new CDP session, `Runtime.enable` replays the console messages V8 has stored.
  - The entries are not cleared for the same target (`console.store.ts:437-440`), and ids carry a
    counter (`:305-306`), so the replay is appended as new rows.
  - **Fix.** On rebind, drop replayed messages older than the bind time that match
    (timestamp, type, text, url:line).
- **S14 minor — exception ids collide** (`console.store.ts:404`). The same exception twice in one
  millisecond gives duplicate Vue keys (`ConsoleExceptions.vue:80`). Use the counter.
- **S15 minor — the REPL can hang or freeze.**
  - `awaitPromise` has no timeout (`console.store.ts:676-686`), so a pending promise keeps Run
    disabled until the target changes.
  - `returnByValue` serialises whole object graphs over CDP.
  - **Fix.** Add a timeout with "Stop waiting", use `returnByValue: false` with a preview, and
    release an `objectGroup: "repl"` on Clear.
- **S16 minor — silent catches and floating promises.**
  - Errors are only warned to the console: `logcat.store.ts:133-135`, `console.store.ts:578-580`.
  - Rejections float on `void`: `DeviceLogcat.vue:36,213`, `ObservabilityBootstrap.vue:12,18`.
  - The detached window swallows a failed window lookup, leaving dead caption buttons
    (`DockDetachedWindow.vue:27-29`).
  - **Fix.** Surface each failure in the stream's state with a Retry action. `vp run check:silent-errors`
    should cover these files.
- **S17 minor — a popped-out tab can stay hidden after a restart.**
  - `poppedOutTabs` is persisted and restored (`src/stores/dock.store.ts:48-52,80`).
  - The handler that clears it lives in the main window (`BottomDock.vue:135-137`), which is closing
    too at quit.
  - "Show Logcat" then opens another tab (`dock.store.ts:84-94`).
  - **Fix.** Do not persist it, or reconcile with `WebviewWindow.getByLabel` at startup.
- **S18 minor — `syncLease` calls are not serialised** (`logcat.store.ts:159-182`). Fast device
  switching can interleave stop and start. **Fix:** a per-store promise queue.
- **S19 minor — no buffer choice.** Only the default `main,system,crash` buffers are read, so
  `events` and `kernel` are unavailable. **Fix:** add `-b` as an option in the stream settings.
- **S20 minor — dead legacy path.** `start_logcat`/`stop_logcat` share `LOGCAT_SESSIONS` with the
  lease (`adb.rs:1045-1067`); any caller would kill the lease. **Fix:** remove them and their IPC
  contract entries.

## UI/UX

- **U1 major — the presentation wastes space and moves under the reader.**
  - Each logcat row is at least ≈36 px (`py-2` plus a wrapped `<pre>`, `DeviceLogcat.vue:311-329`),
    so a 320 px dock shows about 8 lines.
  - The full package repeats on every row as a loud identifier.
  - There is no follow-tail and no "jump to end". New lines land below the fold, and once the 900 cap
    trims, the visible text slides up under the reader.
  - **Fix.**
    - 22 px single-line rows (DESIGN.md §4), with click or Enter to expand.
    - Columns: time in mono tabular, level glyph, tag, message. pid and package go on hover, or into
      columns the user turns on.
    - Follow the end by default. Scrolling up pauses following and shows an "N new lines" pill;
      `End` returns (Android Studio "Scroll to the End").
- **U2 major — repeated lines are neither grouped nor counted.**
  - Console silently drops repeats within 250 ms (`console.store.ts:242-259`).
  - Logcat shows every repeat.
  - **Fix.** Collapse consecutive identical lines (same tag or source and message) into one row with
    a ×N count and first and last time (Chrome "Group similar").
- **U3 major — there is no filter grammar.**
  - Logcat has three controls (text, tag, package `Select`) plus chips. There is no negation, regex,
    OR, `age:`, or "my app across restarts".
  - Console has one level choice and a substring.
  - **Fix.**
    - One query field with Android Studio's grammar, autocompleted with Ctrl+Space: `tag:` `-tag:`
      `tag~:`, `package:mine`, `level:W` (meaning ≥), `message:`, `age:5m`, `is:crash`,
      `is:stacktrace`, implicit OR for the same key.
    - Console gets `level:`, `url:`, `-url:` and `/regex/` (DevTools).
    - Level chips mirror the parsed query. Keep history and named queries.
    - One parser shared by both streams.
- **U4 major — the structured fields are inert.** tag, pid, time and source are plain text.
  - **Fix.**
    - Click a field to add it as a filter, Alt-click to exclude it.
    - Add a row menu: Filter to this tag, Hide this tag, Only this process, Copy line, Show this
      moment on the timeline.
- **U5 major — JSON and stack traces are not folded.**
  - Multi-line logcat entries are joined with `\n` and wrapped in full (`adb.rs:930-937`).
  - Java `at …` frames and `Caused by:` are not folded.
  - JSON in a message is not detected.
  - Exception stacks are plain strings (`console.store.ts:381-397`).
  - **Fix.**
    - Fold stacks after the first app frames, with "N more frames".
    - Emphasise app frames (`package:mine`) over framework frames.
    - Pretty-print JSON on expand, lazily, using the shared code viewer.
- **U6 major — evidence is not linked.**
  - Console sources and stack frames are not clickable.
  - A `Log.entryAdded` network error carries `networkRequestId`, but it is dropped (`console.store.ts:333-370`).
  - WebView `console.*` calls are echoed into logcat (tag `chromium`), duplicating the Console tab.
  - **Fix.**
    - "Open request" from network-sourced entries.
    - Source link: open the app's file at the line when the URL is the app's own origin, otherwise
      copy the location.
    - A "Hide WebView console echoes" toggle in Logcat.
    - Shared selection with the timeline (see `timeline-sources.md`).
- **U7 major — four tabs where two views would do.**
  - REPL is a separate tab from the console it writes to. DevTools puts the prompt under the stream
    and interleaves the results.
  - Exceptions duplicates what an "Errors" filter of Console, grouped by message and top app frame,
    would show.
  - The owner dislikes tabs that should be one view.
  - **Fix.**
    - **Console:** the stream plus a prompt, with ↑/↓ history and completion
      (`Runtime.globalLexicalScopeNames` plus property names).
    - **Errors:** grouped and counted.
    - **Logcat** stays its own view: different source and gate.
- **U8 major — one state is said many ways, and colour breaks its meaning.**
  - Logcat says "Error / Paused / Live / Idle"; console shows lowercase "idle / connecting / live /
    error"; REPL says "Ready / No target".
  - Exceptions always shows a red "0 faults" badge (`ConsoleExceptions.vue:37-42`).
  - Logcat paints I as success green (`DeviceLogcat.vue:118-120,325-326`).
  - The unread dot is `bg-brand` in the tab bar (`DockTabBar.vue:50`) and `bg-signal-select` in the
    title bar.
  - **Fix.**
    - `StatusDot` plus one word, with `signal-live` only for live.
    - Show an error count only when it is above zero, with an icon.
    - Levels: E/F `error`, W `warning`, I foreground, D/V muted.
    - One unread treatment.
- **U9 major — screen-local gate messages.** "Select device first to start logcat."
  (`DeviceLogcat.vue:292-297`), "Connect target first." (`ConsoleOutput.vue:202-207`) and
  "Connect target first to capture runtime exceptions." (`ConsoleExceptions.vue:62-67`) break
  DESIGN.md §7. They are also the only feedback in pop-outs, which are ungated
  (`DockDetachedWindow.vue:93`). **Fix:** use `GatedView` in both hosts.
- **U10 major — empty and error states are generic.**
  - "No log lines for current filters." offers no way out.
  - Errors print raw strings with no next step, such as `device-not-active: <serial>` from
    `require_hot_session`.
  - **Fix.**
    - Empty: give the cause and an action ("No lines match `tag:Foo` · Clear the filter").
    - Say "Live since 15:12:04".
    - Errors: a plain sentence, Retry, and the raw detail on expand.
- **U11 major — the dock is not built with Cladd.**
  - Every dock file imports retiring shadcn components: Button, Badge, Input, Select, Tabs, Textarea
    (`DeviceLogcat.vue:4-14`, `ConsoleOutput.vue:5-8`, `ConsoleExceptions.vue:4-7`,
    `ConsoleRepl.vue:4-7`, `DockTabBar.vue:4-5`, `DockPopoutButton.vue:3`). reka `ScrollArea` stays
    allowed.
  - Icon buttons have no label (the trash icons, `Ban`), and tooltips use `title`.
  - Hues are hard-coded: `text-cyan-300/85` (`DeviceLogcat.vue:316`), `text-violet-300` (`ConsoleOutput.vue:120`).
  - Logcat and Console share an icon (`dock-meta.ts:8-21`).
  - **Fix.**
    - Cladd `Tabs` with solid active segments, `IconAction` for every icon button, `SearchField`.
    - Cladd `Chip` or `Segmented` for levels, `StatusDot` for states, `cat-console` for the console
      category.
    - A distinct icon per view.
- **U12 minor — the unread mark means "anything happened".** Every console batch sets it
  (`console.store.ts:234-240`), so on a chatty app it is always lit. **Fix:** unread means new warnings
  or errors since the last look, shown as a count.
- **U13 minor — time is hidden or coarse.** Console rows show no time, and the label has no
  milliseconds (`console.store.ts:47-54`). **Fix:** a time column toggle, milliseconds, and a mode
  relative to the selection (Sentry).
- **U14 minor — printf substitutions are missing.** Only `%c` is applied; `%s %d %i %f %o %O` are not
  (`src/components/console/ConsoleArgsView.vue:17-31`).
- **U15 minor — wrong level mapping.** `Log.entryAdded` "verbose" maps to info (`console.store.ts:137-139`).
- **U16 minor — copy and export are weak.**
  - Copy is a hidden double-click with no feedback that flattens objects.
  - Logcat has no per-line copy; exceptions have no "copy stack".
  - Export uses an anchor download whose blob URL is revoked immediately (`DeviceLogcat.vue:133-141`).
  - **Fix.**
    - Row selection (click, Shift-click) and Ctrl+C.
    - Export through the Tauri save dialog, with a capture-style toast that names the path.
- **U17 minor — keyboard support is thin.**
  - No row cursor, no find, no Ctrl+L to clear, no `End` to follow.
  - `Escape` is caught in the capture phase from inputs (`BottomDock.vue:53-58`), so it cannot clear a
    filter first.
  - The resize handle is mouse-only.
  - **Fix.** Add the missing keys, and make Escape clear the filter before it leaves the dock.
- **U18 minor — copy and labels.**
  - The header reads "model · serial" (`DeviceLogcat.vue:160-167`); use `deviceNames.nameOf`.
  - The pop-out has no "Return to the dock" action, and its title uses a hyphen ("Logcat - Capubridge").

## Placement: dock, route, or a drawer joined to the timeline

**Recommendation: one drawer joined to the global timeline. It replaces the dock.**

The strip is always there, slim and hideable. Expanding it, or clicking a moment, opens a drawer
under it with two stream views:

- **Logs** (Logcat).
- **Console** (stream + prompt, with an Errors filter).

The drawer can be maximised to the full work column. Pop-out keeps working (S3/S4 fixed): one
capture owner, any number of views. Logs is not a route.

- **Assumptions.**
  - Streams are cross-cutting evidence that people read beside another screen: Data, Network, the
    phone. A route forces you to leave the thing you are correlating.
  - The timeline will own "when". The drawer shows "what" for the selected moment or range.
  - Capture is app-level (S1), so hiding the drawer never stops evidence.
- **Risks.**
  - **Vertical space.** On 1080p with the screen column open, title bar 46 + strip 28 + drawer
    ≥ 200 px leaves about 700 px for the screen. Mitigation: the drawer collapses to the strip;
    `mod+j` toggles it; a maximise mode is available.
  - **The owner's own earlier call.** Round 2 (`docs/design/critique/round-02/layout-B-case.md`, §14)
    rejected "spine at the bottom" because it stacks with the drawer. The owner now asks for a bottom
    strip. Joining strip and drawer into one component, with one resize edge and one toggle, is what
    removes that stacking cost.
  - **Long searches over 100k lines** want full height. Maximise and pop-out cover that.
- **Alternatives.**
  - **Keep the dock separate from the timeline.** Cheapest, but it keeps two bottom bands with two
    toggles, and "jump to moment" has nowhere natural to land.
  - **A Logs route (lens).** Best for long investigations and big queries, but logs leave the side of
    the data. Worth adding later as a "maximised drawer" URL, not as a separate implementation.
  - **A side panel next to the screen column.** Narrow columns truncate log lines badly. Reject it
    for logs; it suits an inspector, not a stream.

## Engine round notes

Engine-only round on `feat/ui-ux-overhaul` (2026-11-06). Layout, colours and components were left
alone; the only view changes are virtualisation and the wiring the engine needs.

### Done

| Items                                            | Commit     |
| ------------------------------------------------ | ---------- |
| S20 (unregister legacy commands; `lib.rs` alone) | `fdb956c0` |
| S1, S3, S18, S20                                 | `02c85b72` |
| F1, S5, S6, S2, logcat side of S13               | `7aca3a78` |
| S7, S9, S8, S10                                  | `a65a8055` |
| F2                                               | `b034b223` |
| F4, F5, F6, F7, F8, F10, S10 (pause)             | `235d087c` |
| F3                                               | `0d86f297` |
| S4, S11, S12, S14, S15, S16, S17, S19            | `56262eba` |
| Timeline foundation, WebSocket start time        | `3aed2f03` |
| S13 (console replay on reconnect)                | `5cc945e5` |

### Where the result differs from the review, and why

- **Not checked against a real device.** The Pixel_10_Pro emulator was not running and the owner's
  phone is off limits, so the parser tests use line shapes taken from logcat's own format
  (`logprint.cpp`: `%19lld.%03ld` epoch, `%5s:`/`%5d:` uid glued to a `%5d` pid, `%-8s: ` tag), not
  captured output. First thing to verify on the emulator: one crash, one multi-line JSON log, one
  reconnect (`adb kill-server`).
- **Android 7 and newer only.** `-v epoch -v uid` does not exist before Android 7. On an older
  device the stream fails, and the store shows "Reconnecting" with logcat's own error text. There
  is no fallback parser for the old `MM-DD` format.
- **Multi-line entries.** logcat repeats the header on every line of a message, so consecutive
  lines with the same millisecond, pid, tid, level and tag are joined into one entry. Two separate
  calls with that exact header become one entry holding both texts; nothing is dropped.
- **Retention lives in the webview, not Rust (F4).** The review suggested a 100k Rust ring with
  paging. The store ring holds 50,000 lines; Rust keeps only a 5,000-line / 4 MB backlog so a
  window that joins late (a pop-out) starts with recent lines, not the main window's full ring.
- **Delivery is a Tauri channel per window (F2)**, not an event filtered by window label: Tauri's
  default `listen` receives events emitted to any window, so only a channel is truly addressed.
- **Console rows are still rebuilt per flush (F5)**, in one pass over at most 10,000 entries,
  because group trees make an incremental build complex. Measured 0.29 ms median, 2.4 ms max.
- **The 4 ms flush test asserts the 95th percentile.** Alone, the worst flush is 0.25 ms (logcat,
  500 lines into a full 50,000 ring) and 2.4 ms (console with rows). Under the full parallel test
  suite, garbage-collection pauses push single samples to 8 to 32 ms, which is not flush work.
- **Not done, UI or bigger than described.** Synthetic "process started / ended" rows (S8);
  `returnByValue: false` with previews and `objectGroup` release in the REPL (S15: only the 30 s
  timeout); a buffer picker in the UI (S19: store and Rust only); follow-tail (U1).
- **Clock.** The device offset is measured by adb on every logcat connect and every 5 minutes, and
  reused for console, exception and network times of the same device. Chrome and local-preview
  targets are taken as host time.
- **Pause changed meaning (S10).** It freezes the views; the ring keeps every new line and the
  header counts them, and past the cap says how many are gone. The old 400-line side buffer is gone.
- **Pop-out errors without a toaster.** A popped-out window has no toast host, so a failed window
  lookup there is logged, not shown (S16).
- **Source-size baseline.** `commands/adb.rs` lost the 330 logcat lines (now about 1,650); its
  2,045-line exception can be lowered.
