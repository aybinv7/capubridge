# Console dock parity

This covers the bottom console dock: Logcat, REPL, Console and Exceptions. It is opened from the
title-bar toggle, `mod+j`, the palette, the `/console/:tab?` route, or as a pop-out window.

It was written before the rewrite, from the code at `d3a00dc8` on `feat/ui-ux-overhaul`. Paths are
relative to `apps/desktop/`. After the rewrite, tick each line with where it now lives (`→`). A line
that cannot be ticked is a bug, not a decision.

Not observed with the dock open. The owner was using the app, so no keys or clicks were sent. A
passive screenshot showed the dock closed and no target selected.

## Shell of the dock

- [x] The dock is mounted only while open: `v-if="dockStore.isOpen"`, with a 200 ms fade in and a 150 ms fade out, inside the main content column under `<main>` → `src/components/layout/AppShell.vue:253-264` — **now**: drawer `v-if`, grows out of the tray with a clip-path spring (300 ms in, 200 ms out) → `components/drawer/WorkColumnFoot.vue`
- [x] The height is persisted. Default 320 px, minimum 120 px, maximum 70 % of the window height, re-clamped when the window is resized → `src/stores/dock.store.ts:5-7,24-34,153-155`, `src/components/layout/AppShell.vue:98-100` — **now**: `stores/drawer.store.ts`, `lib/drawer/drawerPersist.ts`; re-clamped from `AppShell.vue` `onResize`
- [x] Persisted state: open or closed, active tab, height and popped-out tabs, stored under localStorage key `capubridge:dock`. The legacy tab id `output` maps to `console` → `src/stores/dock.store.ts:16-22,36-65,96-109,212-218` — **now**: key `capubridge:drawer` (open, view, height, maximised); the old `capubridge:dock` is read once, `output`/`console`/`repl`/`exceptions` land on Console → `lib/drawer/drawerPersist.ts`. Pop-outs are no longer persisted (S17)
- [x] Tab order is Logcat, REPL, Console, Exceptions → `src/types/dock.types.ts:1` — **now**: changed: two views, Logs then Console → `types/drawer.types.ts`; REPL is the Console prompt, Exceptions is the Console Errors mode
- [x] Tab labels and icons: Logcat `FileText`, REPL `Terminal`, Console `FileText`, Exceptions `AlertTriangle`. Logcat and Console share an icon → `src/components/dock/dock-meta.ts:5-27` — **now**: Logs `ScrollText`, Console `SquareTerminal`, the timeline lanes' icons, no longer shared → `components/drawer/drawerViews.ts`
- [x] Popped-out tabs are hidden from the tab bar. If the active tab is popped out, the dock falls back to the first visible tab → `src/components/dock/BottomDock.vue:21-29`, `src/stores/dock.store.ts:82-94` — **now**: `drawer.store.ts` `docked` / `currentView`
- [x] The dock closes itself when every tab is popped out → `src/stores/dock.store.ts:119-122,176-180,206-208` — **now**: `drawer.store.ts` `setPoppedOut`
- [x] Each tab is gated through `GatedView density="compact"`. Logcat needs a device, the other three need a target → `src/components/dock/DockTabContent.vue:26-40` — **now**: one `GatedView density="compact"` per view (Logs: device, Console: target) → `components/drawer/DrawerBody.vue`
- [x] Only the active tab is mounted (`<component :is>`, no `KeepAlive`). Switching tabs unmounts the previous one → `src/components/dock/DockTabContent.vue:33,38-40` — **now**: changed: a view mounts the first time it is shown and stays, so switching keeps its query, scroll and opened rows → `DrawerBody.vue`
- [x] Tab content is wrapped in thin shells → `src/components/dock/tabs/{Logcat,Repl,Console,Exceptions}Tab.vue` — **now**: shells removed; the views are `modules/console/logcat/LogsView.vue` and `modules/console/stream/ConsoleView.vue`

## Tab bar (`src/components/dock/DockTabBar.vue`)

- [x] Tabs use shadcn `Tabs`/`TabsTrigger` with an icon and a label → `:36-53` — **now**: Cladd `Tabs`/`TabsList`/`Tab` with icon and label → `components/drawer/DrawerViewSwitch.vue`
- [x] Unread dot per tab (`bg-brand`) → `:50`. It is set by `markUnread` when the tab is not active or the dock is closed → `src/stores/dock.store.ts:198-202` — **now**: changed: a count of new warnings and errors while the view was out of sight → `DrawerViewSwitch.vue`, `drawer.store.ts` `noteArrivals` (U12)
- [x] Unread is cleared when the tab is opened, activated or popped out → `src/stores/dock.store.ts:126,173,185,195` — **now**: `drawer.store.ts` `clearUnread` on open, switch and pop-out
- [x] The Pop out button (`ExternalLink`, title "Pop out <Tab>") acts on the active tab → `:56`, `src/components/dock/DockPopoutButton.vue:16-25` — **now**: `IconAction` "Open Logs in its own window" → `components/drawer/DrawerWindowActions.vue`
- [x] The Close button (`X`, title "Close <Tab>") closes the whole dock and returns focus to the main content → `:57-65`, `src/components/dock/BottomDock.vue:172-175` — **now**: `IconAction` "Hide the console" with the Ctrl+J `KeyCaps`; focus returns to `<main>` → `ConsoleDrawer.vue` `hide`

## Resize and focus (`src/components/dock/BottomDock.vue`)

- [x] Resize handle: a 16 px full-width button with a grip; drag to resize → `src/components/dock/DockResizeHandle.vue:9-17`, `BottomDock.vue:85-107` — **now**: one top edge, drag applied once per frame (F9) → `components/drawer/DrawerResizeEdge.vue`
- [x] Double-clicking the handle toggles between the minimum and maximum height → `DockResizeHandle.vue:14`, `src/stores/dock.store.ts:146-151` — **now**: `DrawerResizeEdge.vue` → `drawer.store.ts` `toggleHeightPreset`
- [x] While dragging, the body cursor and `user-select` are overridden and restored on mouseup → `BottomDock.vue:88-103` — **now**: pointer capture, `user-select` restored on release → `DrawerResizeEdge.vue`
- [x] Focus tracking (`isFocused`) uses focusin and focusout on the dock root → `BottomDock.vue:37-48` — **now**: `ConsoleDrawer.vue` focusin/focusout → `drawer.setFocused`
- [x] Opening the dock focuses it; closing it focuses `<main>` → `src/components/layout/AppShell.vue:66-79,90-96` — **now**: `AppShell.vue` watch → `WorkColumnFoot.focusDrawer` (the list gets focus); closing focuses `<main>`

## Shortcuts and commands

- [x] `mod+j` (global) runs "Show console dock" / "Hide console dock", command `view.toggle-dock` → `src/app/useCoreCommands.ts:138-145` — **now**: `useCoreCommands.ts` `view.toggle-dock`, now "Show the console" / "Hide the console"
- [x] Palette commands `dock.logcat|console|repl|exceptions`: "Show Logcat", "Show Console", "Show REPL", "Show Exceptions" → `src/app/useCoreCommands.ts:37-42,154-161` — **now**: same ids: "Show Logs", "Show Console", "Run JavaScript in the console" (puts the caret in the prompt), "Show errors, grouped" → `useCoreCommands.ts`
- [x] Inside the dock, `Alt+1…4` selects the nth visible tab → `BottomDock.vue:60-67` — **now**: Alt+1…2 → `ConsoleDrawer.vue`
- [x] Inside the dock, `Ctrl/Cmd+↑` and `Ctrl/Cmd+↓` resize by 80 px → `BottomDock.vue:73-82` — **now**: `ConsoleDrawer.vue` (80 px); also ↑/↓ on the focused edge, 24 px or 80 px with Shift (U17)
- [x] Inside the dock, `Escape` leaves the dock and focuses `<main>`. It is handled in the capture phase, so it also fires from the inputs → `BottomDock.vue:53-58,165` — **now**: changed (U17): handled in the bubble phase, so the query field clears first, then the list selection, then the view's query, and only then focus leaves to `<main>` → `ConsoleDrawer.vue`
- [x] REPL: `Enter` runs and `Shift+Enter` inserts a newline → `src/modules/console/ConsoleRepl.vue:38-45` — **now**: `modules/console/stream/ConsolePrompt.vue`
- [x] Console: double-clicking a row copies its message → `src/modules/console/ConsoleOutput.vue:124-128,223` — **now**: double-click copies the row in both views, with a toast → `list/StreamList.vue`; also Ctrl+C on the selection and "Copy" in the row menu

## Title bar

- [x] The console toggle `IconAction` shows "Show the console" / "Hide the console" with `KeyCaps` from `view.toggle-dock`. It is pressed while the dock is open → `src/components/layout/TitleBarPanelToggles.vue:31-59` — **now**: `TitleBarPanelToggles.vue`, pressed while open
- [x] While closed, an unread dot (`bg-signal-select`) and the hint "New messages since you last looked" appear when any tab is unread → `TitleBarPanelToggles.vue:36-39,54-58`, `src/stores/dock.store.ts:204` — **now**: changed: a count beside the toggle and a hint that says how many (U12) → `TitleBarPanelToggles.vue`. The strip has a second toggle, without a count

## Routes that open the dock

- [x] `/console/:tab?` opens the dock and redirects back to the previous route, or to `/devices`. `console` or `output` opens Console; `repl` and `exceptions` open their tab; anything else opens Logcat → `src/router/index.ts:10-26` — **now**: `router/index.ts` + `lib/drawer/drawerEvents.ts` `drawerRequestFor`: `console`/`output`/`repl` → Console, `exceptions` → Console Errors, anything else → Logs
- [x] A request made before the shell mounts is queued in sessionStorage (`capubridge:dock-open-request`) and replayed on mount → `src/lib/dock-events.ts:6-31`, `src/components/layout/AppShell.vue:135-138` — **now**: sessionStorage `capubridge:drawer-open-request` → `drawerEvents.ts`, replayed in `AppShell.vue` `onMounted`
- [x] A `capubridge:dock-open` window event opens the dock at a tab → `src/lib/dock-events.ts:4,33-43`, `src/components/layout/AppShell.vue:81-84,130-133` — **now**: `capubridge:drawer-open` → `drawerEvents.ts`, `AppShell.vue` `handleDrawerOpenRequest`

## Pop-out window

- [x] Pop out creates a `WebviewWindow` with label `dock-<tab>`, URL `/?dock=<tab>`, size 960×420 (minimum 640×220), no decorations. It reuses and focuses an existing window → `BottomDock.vue:109-133` — **now**: label `drawer-<view>`, URL `/?drawer=<view>`, same sizes, no decorations, reuse and focus → `components/drawer/useDrawerPopout.ts`
- [x] When the window is destroyed, the tab returns to the dock. A window error shows the toast "Failed to open <Tab>" → `BottomDock.vue:135-148` — **now**: `useDrawerPopout.ts` (toast "Could not open Logs in its own window"); new: "Put Logs back in the drawer" (`capubridge:drawer-return`)
- [x] The window boots `DockDetachedWindow` instead of the shell when `?dock=` holds a valid tab → `src/App.vue:13-25,41` — **now**: `App.vue` (`?drawer=`, the old `?dock=` still accepted) → `components/drawer/DrawerWindow.vue`
- [x] Custom caption with icon, title, minimise, maximise/restore and close; the caption is a drag region → `src/components/dock/DockDetachedWindow.vue:32-90` — **now**: `DrawerWindow.vue`: icon, title, the view's controls, back to the drawer, minimise, maximise/restore, close (`IconAction`s); the caption is a drag region (U18)
- [x] Content is ungated (`gated=false`) → `DockDetachedWindow.vue:92-94` — **now**: changed: gated like the drawer (U9) → `DrawerBody.vue`, after the window reads the device registry → `composables/useDrawerWindowCapture.ts`
- [x] Known gap to keep in mind, not to preserve: Console, REPL and Exceptions never bind in this window (see `console-review.md` S1) — **now**: fixed in the engine round (S4); the window follows the relayed target → `useDrawerWindowCapture.ts`, `useDrawerTargetRelay.ts`

## Logcat (`src/modules/devices/DeviceLogcat.vue`, `src/stores/logcat.store.ts`)

- [x] The header shows the device as "model · serial", or "No device selected" → `:160-167` — **now**: the device is named with `deviceNames.nameOf` (empty states, export file name) → `LogsView.vue` (U18)
- [x] Status line: "Android stream · N visible · M total", plus "· K buffered" in warning colour while paused → `:168-174` — **now**: "N of M lines" beside the state → `logcat/LogsToolbar.vue`; lines that came while not following → the pill (`list/NewLinesPill.vue`), which says when the oldest are no longer kept
- [x] State badge: Error / Paused / Live / Idle, coloured → `:176-198` — **now**: `StatusDot` + one word: "Live since HH:MM:SS", "Connecting", "Reconnecting · attempt N", "Stopped" → `logcat/logsStatus.ts` (U8, U10)
- [x] Pause and Resume. While paused, new lines go to a separate buffer of at most 400 lines → `:199-208`, `logcat.store.ts:15,45-53,195-221` — **now**: follow toggle → `LogsToolbar.vue`; scrolling up stops following, End or the pill resumes; the ring keeps every line (S10, U1)
- [x] Restart stops and starts the lease and clears the view → `:209-217`, `logcat.store.ts:184-193` — **now**: `IconAction` "Start the capture again" → `LogsToolbar.vue`
- [x] Export JSON writes the filtered entries to `logcat_<serial>.json` → `:143-147,218-221` — **now**: through the save dialog; the toast names the path and offers "Show in folder" → `logcat/logsExport.ts` (U16)
- [x] Export TXT writes the raw lines of the filtered entries to `logcat_<serial>.txt` → `:149-153,222-225` — **now**: same, in `adb logcat -v threadtime` layout → `logsExport.ts`
- [x] Clear (trash icon, no label or tooltip) → `:226-228`, `logcat.store.ts:55-61` — **now**: `IconAction` "Clear the log" and Ctrl+L → `LogsToolbar.vue`, `LogsView.vue`
- [x] Text filter "Filter messages, stack traces, payloads…" does a case-insensitive substring match on package, process, tag, message and raw → `:24,72-101,236-240` — **now**: free text in the query searches package, process, tag and message → `lib/logcat/logcatQuery.ts`
- [x] Tag filter (substring) → `:25,82-84,242-246` — **now**: `tag:` (also `-tag:`, `tag~:` regex, `tag=:` exact), clicking a tag, the row menu → `logcatQuery.ts`, `LogsRow.vue`
- [x] Package select lists "All packages", then the selected target's package first, then the packages seen in the buffer → `:26,46-61,247-264` — **now**: `package:` with Ctrl+Space suggestions, `mine` first, then the packages seen → `logcat/logsSuggest.ts`
- [x] Level chips V, D, I, W, E, F are multi-toggle, each with a count over the whole buffer → `:27,63-70,103-107,267-282` — **now**: changed (U3): chips set the query's floor (`level:W` = W and above) and show each level's count → `list/LevelSegment.vue`; any set of levels stays reachable with `level:` and `-level:`
- [x] Level colours: E and F error, W warning, I success, D info, V muted → `:109-127,318-329` — **now**: changed (U8): E/F error, W warning, I foreground, D/V muted → `logcat/logsTone.ts`
- [x] Row columns: level, time, pid, package (falling back to process, then "system"), tag, wrapped message → `:306-333` — **now**: changed (U1): time, level, tag, message; pid and package on hover or in the process column (Log options) → `logcat/LogsRow.vue`
- [x] Error banner with the raw message → `:285-290` — **now**: a notice line above the list while rows exist; otherwise the empty state with the raw detail → `LogsView.vue`
- [x] Empty states: "Select device first to start logcat." and "No log lines for current filters." → `:292-304` — **now**: no device → the gate; "No lines match …" with Clear the filter; "Waiting for the first line from <device>"; "stopped answering" with Start the capture again (U10)
- [x] Buffer of 900 lines, trimmed from the head → `logcat.store.ts:14,17-21` — **now**: 50,000 lines (engine round)
- [x] The stream starts when the selected device changes and when the tab mounts, and stops (and clears) when it unmounts → `:29-43`, `logcat.store.ts:159-182` — **now**: app level (engine round, `useLogcatCapture.ts`)
- [x] Rust side: polls `logcat -d -v threadtime` (the first poll reads the last 256 lines, then `-T '<last time>'`) every 900 ms, dedupes in a 1,024-id window, and resolves the package from `/proc/<pid>/cmdline` → `src-tauri/src/commands/adb.rs:949-1043` — **now**: replaced in the engine round (one stream per device, epoch and uid)
- [x] Lease commands `session_start_logcat_lease` / `session_stop_logcat_lease` require the device to be online and the active device → `src-tauri/src/session/live_features.rs:19-80` — **now**: engine round, holder-based
- [x] Legacy IPC `start_logcat` / `stop_logcat` with events `logcat:line|error|stopped` is still registered, but no frontend code calls it → `src-tauri/src/commands/adb.rs:1045-1067`, `src/runtime/ipc/events.ts:54-56`, `src/runtime/ipc/contracts/device.ts:51` — **now**: removed in the engine round (S20)

## Console (`src/modules/console/ConsoleOutput.vue`, `src/stores/console.store.ts`)

- [x] Capture runs app-wide, not only in the dock: `ObservabilityBootstrap` takes a lease and follows the selected target → `src/components/ObservabilityBootstrap.vue:10-24` — **now**: unchanged → `ObservabilityBootstrap.vue`
- [x] Sources: `Runtime.consoleAPICalled`, `Log.entryAdded`, `Runtime.exceptionThrown`, after `Runtime.enable` and `Log.enable` → `console.store.ts:474-489` — **now**: unchanged → `console.store.ts`
- [x] Retry with backoff from 500 ms to 8 s when connect or enable fails → `console.store.ts:22-26,425-434,460-467,498-505` — **now**: unchanged; "Retry now" in the error empty state → `ConsoleView.vue`
- [x] Clear button (`Ban`, title "Clear console") → `:142-150`, `console.store.ts:219-223` — **now**: `IconAction` "Clear the console" and Ctrl+L; clears messages, exceptions and prompt results → `stream/ConsoleToolbar.vue`, `ConsoleView.vue`
- [x] Filter (on source and message) → `:17,29-44,152-161` — **now**: the query: `url:`, `-url:`, `source:`, `message:`, `/regex/`, free text → `lib/console/consoleQuery.ts` (U3)
- [x] Level buttons All / Error / Warn / Info / Verbose, single choice, each with a count. Verbose means log + debug → `:18,21-27,130-136,163-178` — **now**: changed: chips V I W E set the floor (Verbose = log + debug) with counts → `stream/ConsoleToolbar.vue`; one exact level with `level:` and `-level:`
- [x] Capture status badge idle / connecting / live / error → `:180-192` — **now**: `StatusDot` + word → `stream/consoleStatus.ts`
- [x] Error strip → `:195-200` — **now**: notice line above the list; error empty state with Retry now and the raw detail → `ConsoleView.vue`
- [x] Empty states: "Connect target first." and "No console entries." → `:202-214` — **now**: no target → the gate; "Nothing logged yet", "Nothing matches …" with Clear the filter → `ConsoleView.vue`
- [x] `console.group` and `groupCollapsed` show as a tree with a chevron and 14 px indent per depth; the open state is overridden per group; a filter keeps the ancestors of a match → `:46-107,225-236`, `console.store.ts:273-303,328-330` — **now**: chevron and 14 px per depth → `stream/ConsoleRow.vue`; overrides → `stream/useConsoleRows.ts`; ancestors kept → `lib/console/consoleRows.ts`
- [x] Row tint and left border for error and warn; text colour by level → `:109-122` — **now**: changed: calm rows, colour on the level glyph and text only → `stream/consoleTone.ts`
- [x] Arguments: `%c` CSS styling, and object previews that fetch properties lazily (`Runtime.getProperties`) when expanded → `src/components/console/ConsoleArgsView.vue:12-45`, `ConsoleObjectView.vue:57-60`, `console.store.ts:735-758` — **now**: in the opened row → `ConsoleRowDetail.vue` (`ConsoleArgsView`); the line reads as DevTools prints it (`%c` dropped, `%s %d %i %f %o` substituted) → `lib/console/consoleText.ts` (U14)
- [x] The source label (`file:line:col`, full URL on hover) is shown when it is not "runtime" → `:242-248`, `console.store.ts:68-114` — **now**: source column, full URL on hover; click keeps only that script, Alt+click hides it; "Copy the location" → `ConsoleRow.vue`, `useConsoleActions.ts`
- [x] Consecutive identical entries less than 250 ms apart are dropped → `console.store.ts:242-259` — **now**: changed (U2): repeats are kept and folded into one row with ×N, first and last time → `lib/console/consoleStream.ts`
- [x] Buffer of 500 entries → `console.store.ts:22,183-186` — **now**: 10,000 (engine round)
- [x] Timestamps are kept (`timestampLabel`, HH:MM:SS) but not shown in rows → `console.store.ts:47-54` — **now**: changed (U13): every row shows time with milliseconds → `ConsoleRow.vue`
- [x] Consumers outside the dock: recording console track (`src/composables/useRecordingSession.ts:160-196`), automation signals (`src/composables/useAutomationSignals.ts:27-30`), automation console probes (`src/modules/automation/runDeps.ts:84-86`) — **now**: unchanged

## Exceptions (`src/modules/console/ConsoleExceptions.vue`)

- [x] Header "Exceptions · <target label> · N visible · M total" and an "N faults" badge → `:29-42` — **now**: Errors mode with its count, shown only above zero → `ConsoleToolbar.vue` (U8)
- [x] Clear (trash icon) → `:43-45`, `console.store.ts:225-228` — **now**: "Clear the console" clears exceptions too
- [x] Filter "Filter exceptions…" on message, source and stack → `:12-23,48-59` — **now**: the query applies in Errors mode (message, source, stack) → `lib/console/consoleErrors.ts`
- [x] Empty states: "Connect target first to capture runtime exceptions." and "No exceptions captured yet." → `:62-74` — **now**: "No errors so far", "No errors match the filter" → `ConsoleView.vue`
- [x] Card per exception: icon, message, time, source, URL, and the stack as `fn @ file:line:col` lines → `:76-105`, `console.store.ts:372-415` — **now**: changed (U7): grouped by first line and top app frame: count, message, frame, last time; opening shows the newest one with its folded stack → `stream/ConsoleErrorsList.vue`
- [x] Buffer of 160 → `console.store.ts:23,188-191` — **now**: 1,000 (engine round)

## REPL (`src/modules/console/ConsoleRepl.vue`)

- [x] Header "REPL · <target label> · N evaluations" and a Ready / No target badge → `:50-68` — **now**: the prompt names the target; no target → the gate → `ConsolePrompt.vue`
- [x] Clear history → `:69-71`, `console.store.ts:230-232` — **now**: "Clear the console"
- [x] History, newest first: time, ok/error badge, expression, result → `:76-122` — **now**: changed (U7): results sit in the stream between the messages they caused (`›` input, `‹` result, errors red) → `lib/console/consoleStream.ts`
- [x] Empty state "Run expression against active CDP target." → `:77-82` — **now**: "Run something in the prompt below" → `ConsoleView.vue`
- [x] Input `Textarea` with placeholder examples, a hint line, the inline error and a Run button with a spinner; disabled with no target, an empty expression or while running → `:16-18,124-149` — **now**: Cladd `Textarea` prompt; Enter runs, Shift+Enter adds a line, a spinner while running; no Run button → `ConsolePrompt.vue`
- [x] Evaluation uses `Runtime.evaluate` with `awaitPromise`, `returnByValue`, `replMode`, `userGesture` and `generatePreview` → `console.store.ts:650-733` — **now**: unchanged; object results read as JSON (opened rows lay it out), an exception is recorded once (it was twice) → `console.store.ts`, `lib/console/replResult.ts`
- [x] History holds at most 80 entries, in memory only, and is cleared on target change → `console.store.ts:24,213,265-267` — **now**: unchanged (80 results, cleared on target change); what was typed is kept apart, 100 entries, persisted → `stream/usePromptHistory.ts`
- [x] Not present today, but expected by users (do not count as parity): ↑/↓ history recall, completion, expandable object results, a timeout or cancel — **now**: now present: ↑/↓ recall, completion (Tab, Ctrl+Space), JSON results, the 30 s timeout (engine round)

## Copy and export summary

- [x] Logcat: export JSON and TXT of the filtered view (`DeviceLogcat.vue:133-153`) — **now**: save dialog → `logcat/logsExport.ts`
- [x] Console: copy one message by double-click; no success feedback; a failure shows a toast (`ConsoleOutput.vue:124-128`) — **now**: double-click, Ctrl+C on the selection and the row menu; a toast on success and on failure → `list/copyText.ts`
- [x] Exceptions and REPL: no copy or export — **now**: changed: both copy through the selection and the row menu
