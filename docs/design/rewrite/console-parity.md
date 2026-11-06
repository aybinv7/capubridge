# Console dock parity

This covers the bottom console dock: Logcat, REPL, Console and Exceptions. It is opened from the
title-bar toggle, `mod+j`, the palette, the `/console/:tab?` route, or as a pop-out window.

It was written before the rewrite, from the code at `d3a00dc8` on `feat/ui-ux-overhaul`. Paths are
relative to `apps/desktop/`. After the rewrite, tick each line with where it now lives (`→`). A line
that cannot be ticked is a bug, not a decision.

Not observed with the dock open. The owner was using the app, so no keys or clicks were sent. A
passive screenshot showed the dock closed and no target selected.

## Shell of the dock

- [ ] The dock is mounted only while open: `v-if="dockStore.isOpen"`, with a 200 ms fade in and a 150 ms fade out, inside the main content column under `<main>` → `src/components/layout/AppShell.vue:253-264`
- [ ] The height is persisted. Default 320 px, minimum 120 px, maximum 70 % of the window height, re-clamped when the window is resized → `src/stores/dock.store.ts:5-7,24-34,153-155`, `src/components/layout/AppShell.vue:98-100`
- [ ] Persisted state: open or closed, active tab, height and popped-out tabs, stored under localStorage key `capubridge:dock`. The legacy tab id `output` maps to `console` → `src/stores/dock.store.ts:16-22,36-65,96-109,212-218`
- [ ] Tab order is Logcat, REPL, Console, Exceptions → `src/types/dock.types.ts:1`
- [ ] Tab labels and icons: Logcat `FileText`, REPL `Terminal`, Console `FileText`, Exceptions `AlertTriangle`. Logcat and Console share an icon → `src/components/dock/dock-meta.ts:5-27`
- [ ] Popped-out tabs are hidden from the tab bar. If the active tab is popped out, the dock falls back to the first visible tab → `src/components/dock/BottomDock.vue:21-29`, `src/stores/dock.store.ts:82-94`
- [ ] The dock closes itself when every tab is popped out → `src/stores/dock.store.ts:119-122,176-180,206-208`
- [ ] Each tab is gated through `GatedView density="compact"`. Logcat needs a device, the other three need a target → `src/components/dock/DockTabContent.vue:26-40`
- [ ] Only the active tab is mounted (`<component :is>`, no `KeepAlive`). Switching tabs unmounts the previous one → `src/components/dock/DockTabContent.vue:33,38-40`
- [ ] Tab content is wrapped in thin shells → `src/components/dock/tabs/{Logcat,Repl,Console,Exceptions}Tab.vue`

## Tab bar (`src/components/dock/DockTabBar.vue`)

- [ ] Tabs use shadcn `Tabs`/`TabsTrigger` with an icon and a label → `:36-53`
- [ ] Unread dot per tab (`bg-brand`) → `:50`. It is set by `markUnread` when the tab is not active or the dock is closed → `src/stores/dock.store.ts:198-202`
- [ ] Unread is cleared when the tab is opened, activated or popped out → `src/stores/dock.store.ts:126,173,185,195`
- [ ] The Pop out button (`ExternalLink`, title "Pop out <Tab>") acts on the active tab → `:56`, `src/components/dock/DockPopoutButton.vue:16-25`
- [ ] The Close button (`X`, title "Close <Tab>") closes the whole dock and returns focus to the main content → `:57-65`, `src/components/dock/BottomDock.vue:172-175`

## Resize and focus (`src/components/dock/BottomDock.vue`)

- [ ] Resize handle: a 16 px full-width button with a grip; drag to resize → `src/components/dock/DockResizeHandle.vue:9-17`, `BottomDock.vue:85-107`
- [ ] Double-clicking the handle toggles between the minimum and maximum height → `DockResizeHandle.vue:14`, `src/stores/dock.store.ts:146-151`
- [ ] While dragging, the body cursor and `user-select` are overridden and restored on mouseup → `BottomDock.vue:88-103`
- [ ] Focus tracking (`isFocused`) uses focusin and focusout on the dock root → `BottomDock.vue:37-48`
- [ ] Opening the dock focuses it; closing it focuses `<main>` → `src/components/layout/AppShell.vue:66-79,90-96`

## Shortcuts and commands

- [ ] `mod+j` (global) runs "Show console dock" / "Hide console dock", command `view.toggle-dock` → `src/app/useCoreCommands.ts:138-145`
- [ ] Palette commands `dock.logcat|console|repl|exceptions`: "Show Logcat", "Show Console", "Show REPL", "Show Exceptions" → `src/app/useCoreCommands.ts:37-42,154-161`
- [ ] Inside the dock, `Alt+1…4` selects the nth visible tab → `BottomDock.vue:60-67`
- [ ] Inside the dock, `Ctrl/Cmd+↑` and `Ctrl/Cmd+↓` resize by 80 px → `BottomDock.vue:73-82`
- [ ] Inside the dock, `Escape` leaves the dock and focuses `<main>`. It is handled in the capture phase, so it also fires from the inputs → `BottomDock.vue:53-58,165`
- [ ] REPL: `Enter` runs and `Shift+Enter` inserts a newline → `src/modules/console/ConsoleRepl.vue:38-45`
- [ ] Console: double-clicking a row copies its message → `src/modules/console/ConsoleOutput.vue:124-128,223`

## Title bar

- [ ] The console toggle `IconAction` shows "Show the console" / "Hide the console" with `KeyCaps` from `view.toggle-dock`. It is pressed while the dock is open → `src/components/layout/TitleBarPanelToggles.vue:31-59`
- [ ] While closed, an unread dot (`bg-signal-select`) and the hint "New messages since you last looked" appear when any tab is unread → `TitleBarPanelToggles.vue:36-39,54-58`, `src/stores/dock.store.ts:204`

## Routes that open the dock

- [ ] `/console/:tab?` opens the dock and redirects back to the previous route, or to `/devices`. `console` or `output` opens Console; `repl` and `exceptions` open their tab; anything else opens Logcat → `src/router/index.ts:10-26`
- [ ] A request made before the shell mounts is queued in sessionStorage (`capubridge:dock-open-request`) and replayed on mount → `src/lib/dock-events.ts:6-31`, `src/components/layout/AppShell.vue:135-138`
- [ ] A `capubridge:dock-open` window event opens the dock at a tab → `src/lib/dock-events.ts:4,33-43`, `src/components/layout/AppShell.vue:81-84,130-133`

## Pop-out window

- [ ] Pop out creates a `WebviewWindow` with label `dock-<tab>`, URL `/?dock=<tab>`, size 960×420 (minimum 640×220), no decorations. It reuses and focuses an existing window → `BottomDock.vue:109-133`
- [ ] When the window is destroyed, the tab returns to the dock. A window error shows the toast "Failed to open <Tab>" → `BottomDock.vue:135-148`
- [ ] The window boots `DockDetachedWindow` instead of the shell when `?dock=` holds a valid tab → `src/App.vue:13-25,41`
- [ ] Custom caption with icon, title, minimise, maximise/restore and close; the caption is a drag region → `src/components/dock/DockDetachedWindow.vue:32-90`
- [ ] Content is ungated (`gated=false`) → `DockDetachedWindow.vue:92-94`
- [ ] Known gap to keep in mind, not to preserve: Console, REPL and Exceptions never bind in this window (see `console-review.md` S1)

## Logcat (`src/modules/devices/DeviceLogcat.vue`, `src/stores/logcat.store.ts`)

- [ ] The header shows the device as "model · serial", or "No device selected" → `:160-167`
- [ ] Status line: "Android stream · N visible · M total", plus "· K buffered" in warning colour while paused → `:168-174`
- [ ] State badge: Error / Paused / Live / Idle, coloured → `:176-198`
- [ ] Pause and Resume. While paused, new lines go to a separate buffer of at most 400 lines → `:199-208`, `logcat.store.ts:15,45-53,195-221`
- [ ] Restart stops and starts the lease and clears the view → `:209-217`, `logcat.store.ts:184-193`
- [ ] Export JSON writes the filtered entries to `logcat_<serial>.json` → `:143-147,218-221`
- [ ] Export TXT writes the raw lines of the filtered entries to `logcat_<serial>.txt` → `:149-153,222-225`
- [ ] Clear (trash icon, no label or tooltip) → `:226-228`, `logcat.store.ts:55-61`
- [ ] Text filter "Filter messages, stack traces, payloads…" does a case-insensitive substring match on package, process, tag, message and raw → `:24,72-101,236-240`
- [ ] Tag filter (substring) → `:25,82-84,242-246`
- [ ] Package select lists "All packages", then the selected target's package first, then the packages seen in the buffer → `:26,46-61,247-264`
- [ ] Level chips V, D, I, W, E, F are multi-toggle, each with a count over the whole buffer → `:27,63-70,103-107,267-282`
- [ ] Level colours: E and F error, W warning, I success, D info, V muted → `:109-127,318-329`
- [ ] Row columns: level, time, pid, package (falling back to process, then "system"), tag, wrapped message → `:306-333`
- [ ] Error banner with the raw message → `:285-290`
- [ ] Empty states: "Select device first to start logcat." and "No log lines for current filters." → `:292-304`
- [ ] Buffer of 900 lines, trimmed from the head → `logcat.store.ts:14,17-21`
- [ ] The stream starts when the selected device changes and when the tab mounts, and stops (and clears) when it unmounts → `:29-43`, `logcat.store.ts:159-182`
- [ ] Rust side: polls `logcat -d -v threadtime` (the first poll reads the last 256 lines, then `-T '<last time>'`) every 900 ms, dedupes in a 1,024-id window, and resolves the package from `/proc/<pid>/cmdline` → `src-tauri/src/commands/adb.rs:949-1043`
- [ ] Lease commands `session_start_logcat_lease` / `session_stop_logcat_lease` require the device to be online and the active device → `src-tauri/src/session/live_features.rs:19-80`
- [ ] Legacy IPC `start_logcat` / `stop_logcat` with events `logcat:line|error|stopped` is still registered, but no frontend code calls it → `src-tauri/src/commands/adb.rs:1045-1067`, `src/runtime/ipc/events.ts:54-56`, `src/runtime/ipc/contracts/device.ts:51`

## Console (`src/modules/console/ConsoleOutput.vue`, `src/stores/console.store.ts`)

- [ ] Capture runs app-wide, not only in the dock: `ObservabilityBootstrap` takes a lease and follows the selected target → `src/components/ObservabilityBootstrap.vue:10-24`
- [ ] Sources: `Runtime.consoleAPICalled`, `Log.entryAdded`, `Runtime.exceptionThrown`, after `Runtime.enable` and `Log.enable` → `console.store.ts:474-489`
- [ ] Retry with backoff from 500 ms to 8 s when connect or enable fails → `console.store.ts:22-26,425-434,460-467,498-505`
- [ ] Clear button (`Ban`, title "Clear console") → `:142-150`, `console.store.ts:219-223`
- [ ] Filter (on source and message) → `:17,29-44,152-161`
- [ ] Level buttons All / Error / Warn / Info / Verbose, single choice, each with a count. Verbose means log + debug → `:18,21-27,130-136,163-178`
- [ ] Capture status badge idle / connecting / live / error → `:180-192`
- [ ] Error strip → `:195-200`
- [ ] Empty states: "Connect target first." and "No console entries." → `:202-214`
- [ ] `console.group` and `groupCollapsed` show as a tree with a chevron and 14 px indent per depth; the open state is overridden per group; a filter keeps the ancestors of a match → `:46-107,225-236`, `console.store.ts:273-303,328-330`
- [ ] Row tint and left border for error and warn; text colour by level → `:109-122`
- [ ] Arguments: `%c` CSS styling, and object previews that fetch properties lazily (`Runtime.getProperties`) when expanded → `src/components/console/ConsoleArgsView.vue:12-45`, `ConsoleObjectView.vue:57-60`, `console.store.ts:735-758`
- [ ] The source label (`file:line:col`, full URL on hover) is shown when it is not "runtime" → `:242-248`, `console.store.ts:68-114`
- [ ] Consecutive identical entries less than 250 ms apart are dropped → `console.store.ts:242-259`
- [ ] Buffer of 500 entries → `console.store.ts:22,183-186`
- [ ] Timestamps are kept (`timestampLabel`, HH:MM:SS) but not shown in rows → `console.store.ts:47-54`
- [ ] Consumers outside the dock: recording console track (`src/composables/useRecordingSession.ts:160-196`), automation signals (`src/composables/useAutomationSignals.ts:27-30`), automation console probes (`src/modules/automation/runDeps.ts:84-86`)

## Exceptions (`src/modules/console/ConsoleExceptions.vue`)

- [ ] Header "Exceptions · <target label> · N visible · M total" and an "N faults" badge → `:29-42`
- [ ] Clear (trash icon) → `:43-45`, `console.store.ts:225-228`
- [ ] Filter "Filter exceptions…" on message, source and stack → `:12-23,48-59`
- [ ] Empty states: "Connect target first to capture runtime exceptions." and "No exceptions captured yet." → `:62-74`
- [ ] Card per exception: icon, message, time, source, URL, and the stack as `fn @ file:line:col` lines → `:76-105`, `console.store.ts:372-415`
- [ ] Buffer of 160 → `console.store.ts:23,188-191`

## REPL (`src/modules/console/ConsoleRepl.vue`)

- [ ] Header "REPL · <target label> · N evaluations" and a Ready / No target badge → `:50-68`
- [ ] Clear history → `:69-71`, `console.store.ts:230-232`
- [ ] History, newest first: time, ok/error badge, expression, result → `:76-122`
- [ ] Empty state "Run expression against active CDP target." → `:77-82`
- [ ] Input `Textarea` with placeholder examples, a hint line, the inline error and a Run button with a spinner; disabled with no target, an empty expression or while running → `:16-18,124-149`
- [ ] Evaluation uses `Runtime.evaluate` with `awaitPromise`, `returnByValue`, `replMode`, `userGesture` and `generatePreview` → `console.store.ts:650-733`
- [ ] History holds at most 80 entries, in memory only, and is cleared on target change → `console.store.ts:24,213,265-267`
- [ ] Not present today, but expected by users (do not count as parity): ↑/↓ history recall, completion, expandable object results, a timeout or cancel

## Copy and export summary

- [ ] Logcat: export JSON and TXT of the filtered view (`DeviceLogcat.vue:133-153`)
- [ ] Console: copy one message by double-click; no success feedback; a failure shows a toast (`ConsoleOutput.vue:124-128`)
- [ ] Exceptions and REPL: no copy or export
