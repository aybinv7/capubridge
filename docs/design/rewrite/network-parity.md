# Network route parity

Route `/network` (rail: Network, `g n`), children Requests (`meta.requires: "target"`) and Mocking
(`meta.maturity: "experimental"`, no gate requirement). Both render through `GatedRouterView`
(`NetworkPanel.vue`).

Written before the rewrite from the code at `ce59d68`. Paths are relative to
`apps/desktop/src/modules/network/` unless they start with `src/` or `src-tauri/`.
After the rewrite each line is ticked with where it lives now (`→`).

## Decision: Requests and Mocking stay two tabs

Mocking keeps its own tab. It has a different gate (the local mock server works without a target,
Requests needs one), it is still experimental (hidden unless experimental features are on), and its
job is authoring rules rather than reading traffic. The two are joined where the work crosses:
"Mock this response" (details header, row context menu, palette) turns a request into a rule and
opens it in Mocking; "Mocking N rules" in the Requests toolbar says when answers may be fake and
opens Mocking; a log row in Mocking opens the rule that answered it.

## Shell of the route (`NetworkPanel.vue`, `routes.ts`)

- [x] Sub-navigation tabs Requests · Mocking from route meta labels → unchanged (`NetworkPanel.vue`, `src/components/layout/SubNavTabs.vue`)
- [x] `/network` redirects to `/network/requests` → `routes.ts`
- [x] Route names `network-requests`, `network-mock` → `routes.ts` (components moved to `requests/NetworkRequests.vue`, `mock/NetworkMock.vue`; the registry test still passes)
- [x] Mocking hidden unless experimental features are enabled → unchanged route meta; links into Mocking check `router.hasRoute("network-mock")` (`requests/MockingNotice.vue`, `requests/details/useRequestActions.ts`)
- [x] Requests gate through `GatedRouterView`; Mocking has no gate → unchanged (`NetworkPanel.vue`)
- [x] Palette `Go to Network` / `g n` → unchanged (feature registry)
- [x] The requests toolbar was drawn above both tabs → now only on Requests (`requests/RequestsToolbar.vue`, `requests/RequestsFilterBar.vue`); Mocking has its own toolbar

## Palette commands (provider `screen.network`, group Network, `screen: true`)

- [x] `network.toggle-capture` "Pause capture" / "Resume capture" → `useNetworkCommands.ts` (icon follows the state)
- [x] `network.clear` "Clear requests", only with requests → `useNetworkCommands.ts`
- [x] `network.preserve` → "Keep requests across reloads" / "Stop keeping requests across reloads", keywords preserve, log (`useNetworkCommands.ts`)
- [x] `network.filter` "Filter requests" focuses and selects the filter → `useNetworkCommands.ts`; from Mocking it opens Requests and asks the store to focus the filter (`takeFilterFocus`, honoured for 5 s), so no `?focus=filter` stays in the URL when a gate shows (round 1, P3)

New commands: `screen.network-requests` (Reload the page, Copy request address, Copy request as cURL,
Copy request as fetch, Copy response, Mock this response — `requests/useRequestsCommands.ts`) and
`screen.network-mock` (New mock rule, Import a mock rule, Turn interception off / Intercept in the
WebView / Run the local mock server — `mock/useMockCommands.ts`).

## Requests toolbar (`requests/RequestsToolbar.vue`, `requests/RequestsFilterBar.vue`)

- [x] Capture toggle → `IconAction` Pause / Play, "Pause capture" / "Resume capture"
- [x] Capture status chip idle / connecting / live / error with the error as tooltip → `StatusDot` + one word (Live, Connecting, In the background, Paused, Not capturing) with the detail as tooltip (`requests/CaptureStatus.vue`, `requests/captureState.ts`); an app in the background reads "In the background", the same words as the pill and the strip, which names the app by its label (round 1, U4); since the polish pass the toolbar says only what the pill does not (Paused, Connecting, Not capturing): "Live" and "In the background" live in the title-bar pill and the app strip (`CaptureWord.echoed`)
- [x] Clear → `IconAction` "Clear requests", disabled when empty
- [x] Search scope URL / All → Cladd `Select` "In addresses" / "Also in headers and bodies", shown while a filter is typed (the old "URL / Headers" label was wrong: headers were only searched in the wide scope)
- [x] Filter field with clear (×) → Cladd `SearchField` "Filter requests" (built-in clear); same matching, applied 150 ms after the last key (round 1, F5)
- [x] Ctrl+F outside the details focuses and selects the filter → `requests/useRequestsKeyboard.ts`, `RequestsToolbar.focusFilter`; only for key presses inside Requests or with nothing focused, so the console and dialogs keep their own Ctrl+F (round 1, U9)
- [x] Type filters (same ten, same matching) → Cladd `Segmented` with plain labels and hints in Cladd tooltips (`requests/requestFilters.ts`, matching in `stores/requestMatch.ts`); the selected segment reads foreground medium (`SEGMENT_TEXT`, round 1, U7)
- [x] Method filter → Cladd `Select` "Any method" · GET … OPTIONS
- [x] Preserve toggle (default on) → `IconAction` pin "Keep requests when the page reloads", pressed while on
- [x] Stats N requests / X transferred / N shown while filtering → one quiet line at the end of the filter row (`requests/requestFilters.ts` `requestsSummary`), with a separate "Y resources" total like DevTools (round 1, P9); while filtering the count reads "3 of 12 requests" instead of a second "3 shown" (polish pass)

New: "Reload the page" (`requests/usePageReload.ts`, `Page.reload` over CDP) in the toolbar and the
empty state; "Mocking N rules" notice when interception is on (`requests/MockingNotice.vue`).

## Request list (`requests/RequestsTable.vue`)

- [x] Virtualised list → TanStack Table columns + `useFixedVirtualList`, 30 px single-line rows (polish pass, was 26), overscan 12
- [x] Column header → Name · Status · Type · Initiator · Size · Time · Waterfall, every column sortable (`SortHeader`, ascending → descending → capture order, `requests/requestSort.ts`, string keys cached per entry); the Method column became a quiet prefix in Name, shown only when not GET (round 1, U1); Type, Initiator, Size and Waterfall step aside by container width (`requests/requestColumns.ts`); Type also steps aside while the type filter keeps a single type (`columnVisibility`, polish pass); every cell shares one text size (`text-xs`, quiet parts by colour only) so all columns sit on one baseline, header and rows share one left edge per column, and a stable scrollbar gutter keeps right-aligned Size and Time under their labels
- [x] Type icon per resource type → dropped as a duplicate signal; the Type column names it in words (`typeWord`)
- [x] Method badge tinted per method → quiet mono prefix in Name when not GET (`requests/RequestNameCell.vue`)
- [x] Status tinted, `ERR`, `—` → 2xx and 3xx quiet, 4xx warning, 5xx error; words Failed, Cancelled, Blocked, Pending, and Unknown for a request still open when capture restarted (`requests/requestCells.ts` `statusCell`, round 1, U14/P8)
- [x] URL as path + query, selectable → Name: last segment + query as the main text, the host quiet after it on the same line (the app's own files carry none: their size already says "App"), a CapacitorHttp call named by the address it carries (`requests/requestNames.ts`); the folder moved to the tooltip (full URL) and the details header's address line (round 1, U1; polish pass)
- [x] Type short label → words (Fetch, XHR, Script, Image, …)
- [x] Size `…` / `—` / `(cache)` / bytes → `…`, `—`, Disk cache, Service worker, Prefetch, "transferred / size" like DevTools, "App · size" for files the app serves itself (sizes summed from `Network.dataReceived`, Content-Length as fallback); WebSockets show frames (`sizeCell`, `src/composables/networkSizes.ts`, round 1, P9/U3)
- [x] Time `…` / aborted / failed / ms / s, tinted over 1 s and 3 s → a live count while open, Open for a WebSocket, same thresholds (`timeCell`); a failed request shows how long it ran, quietly, or "—", since Status already says Failed / Cancelled / Blocked (polish pass)
- [x] Initiator `file:line` or type → same, line shown 1-based, a site root as `index.html`, mono only for `file:line` (`initiatorCell`, round 1, U10/U14)
- [x] Row signals (left edge, tints) → status and time words carry the outcome; selection uses the shared selection treatment (`src/shared/list/rowState.ts`)
- [x] Click selects; clicking the selected row closed the details → click always selects (device lesson P5); close with Esc or the close button
- [x] Ctrl/⌘+↑/↓ moves the selection → kept (`requests/useRequestsKeyboard.ts`); plain ↑/↓, PgUp/PgDn, Home/End, Enter (to the details), Esc in the focused list
- [x] Empty: waiting vs no match → `requests/RequestsEmpty.vue` + `emptyCopy`: no match (Clear filters), paused (Resume capture), could not capture, connecting, app in the background, waiting (Reload the page)

New: waterfall bars (waiting vs receiving, open requests run to the end, at least 3 px wide, axis from the last page
load with tick labels in the header, hidden while the details are open; `requests/waterfall.ts`, `WaterfallAxis.vue`),
the selected row brought into view on mount and filter change, the context menu also from the Menu key / Shift+F10
and acting on the live request, following also at the 5,000 cap (round 1),
right-click menu (`requests/RequestContextMenu.vue`), follows new requests while at the end with
nothing selected and no sort, `aria-activedescendant` listbox.

## Request details (`requests/details/`)

- [x] Resizable side pane opened by selection → Reka splitter, 42 % default (26–70 %), width remembered (`auto-save-id`), `NetworkRequests.vue`; since the polish pass the pane is its own raised Cladd `Surface` (level +1, outline bevel, 1 px line, `rounded-well`) inset 8 px from the panel edges, with an 8 px gap holding the resize handle (a hairline on hover, selection blue while dragging)
- [x] Header: method, short URL, close → `RequestDetailsHeader.vue`, the one home of the request's identity (`details/requestFacts.ts` `headerFacts`): method (always, GET included), name, status with its reason ("404 Not Found"), the full address as a quiet selectable line, then Mock this response, Copy menu, close with Esc hint
- [x] Tabs and Ctrl/⌘+←/→ → Cladd `Tabs` (`RequestDetails.vue`, `detailTabs.ts`); the open tab is remembered (`capubridge:network:details-tab`)
- [x] Ctrl+F inside the pane → opens find in the code viewer of Response or Payload (`useRequestsKeyboard.ts` → `findSignal`)
- [x] Headers › General → `HeadersTab.vue` + `details/requestFacts.ts` `generalFacts`: only what the header does not say: Type (+ MIME only when no `content-type` header says it), Started by (script address and line, or a word), Size (with its source in the same value), Frames (WebSocket), Remote address, Protocol, Error. Address, Method and Status moved to the header; Served from merged into Size (polish pass)
- [x] Headers › Response headers with count, sorted, empty text → `HeadersTab.vue` + `details/headerGroups.ts`: up to 6 headers show at once, the important ones first (content-type, length, encoding, cache, etag, location, retry-after, …); longer lists show the important ones and fold the rest behind "N more"; `set-cookie` reads "N cookies" and opens the Cookies tab; an empty section is hidden instead of described (polish pass)
- [x] Headers › Request headers with count, sorted → same, important first (content-type, accept, authorization, cache, conditional, origin); `cookie` links to the Cookies tab
- [x] Sections collapsible, open by default → `DetailsSection.vue`; the collapsed set is remembered (`capubridge:network:collapsed-header-sections`)
- [x] Payload states and views → `PayloadTab.vue` + `BodyView.vue`: query parameters (round 1, U8), no body ("No payload", the explanation sentence dropped), reading, error with Try again, JSON (Text · Tree · Raw), form fields as `name: value`, text, empty
- [x] Payload fetched only on its tab, TanStack Query `["net-post-data", target, id]`, stale 60 s, no retry, cached for search → `useRequestBodies.ts` (no longer waits for the request to finish)
- [x] Response states → `ResponseTab.vue`: WebSocket, failed ("No response: the request failed"; the error text lives once, in Headers › General › Error), waiting, reading, error with Try again, empty
- [x] Response image with Raw → `ImageBody.vue`: Picture (shared zoomable `ImageView`) · Base64 in 76-character lines; SVG as Picture · Text (`SvgBody.vue`, round 1)
- [x] Response JSON with Raw, text with MIME → shared code viewer (`src/shared/code-viewer/JsonView.vue` Text · Tree · Raw, `TextView.vue` with line numbers, wrap, find, highlighting by MIME, `bodyContent.ts`; wrap remembered apart from Files, find labelled per body (P5); lines cut at 4,000 characters with a marker (F9)); bodies over 512 KB format after the pane paints, the last 8 kept (`useBodyContent.ts`, F8); other bytes say their size and type and offer Copy as Base64 / Show as Base64 (`BinaryBody.vue`, P1)
- [x] Response fetched only on its tab, `["net-response-body", target, id]`, stale 60 s, no retry, cached for search → `useRequestBodies.ts`
- [x] Timing without CDP timing → `TimingTab.vue` facts: Started at, Total (omitted while open: the header says Pending); Size lives only in Headers › General (polish pass); "No phases reported" / "Phases appear with the response" in place of sentences
- [x] Timing phases with totals → `TimingTab.vue` + `timing.ts`: Queued, Stalled, DNS lookup, Initial connection, SSL, Request sent, Waiting for the server, Content download, laid out on one time axis like DevTools
- [x] Cookies › request cookies → `CookiesTab.vue` "Sent with the request" with its count (`cookies.ts`); hidden when empty, "No cookies" when both are
- [x] Cookies › Set-Cookie with attributes → "Set by the response", flags read "Yes"; hidden when empty

New: Copy address / as cURL / as fetch / response / response as Base64 (`copyAs.ts`, `useRequestActions.ts`, also in
the palette), Mock this response (`mock/mockFromRequest.ts`), offered only for finished Fetch/XHR/Document/Other
requests with the reason in its tooltip otherwise (round 1, P6/U6).

## Capture lifecycle (`src/composables/useNetwork.ts`, `src/components/ObservabilityBootstrap.vue`)

- [x] Captures whether or not the screen is open → unchanged; lifecycle test `src/composables/__tests__/useNetwork.test.ts`
- [x] Clears on target change → unchanged, tested (late events from the old target are ignored)
- [x] Status, retry backoff, idle without target → unchanged, tested
- [x] Main-frame navigation clears unless Preserve → unchanged, tested
- [x] Paused capture drops new requests → unchanged, tested
- [x] Redirects, responses, failures, cache, WebSocket events → unchanged
- [x] `Network.enable` buffer limits → unchanged

## Store and retention (`stores/useNetworkStore.ts`, `networkRetention.ts`)

- [x] Version counter per frame and the derived lists → unchanged; `selectedEntry` now follows the counter (bug fix below)
- [x] Caps and eviction, evicted selection cleared → unchanged (`__tests__/networkRetention.test.ts`)
- [x] Duplicate ids replace → unchanged
- [x] Filters, scope, preserve, capture state in memory only → unchanged; new `hasActiveFilters`, `clearFilters`
- [x] Automation readers → unchanged (`src/composables/useAutomationSignals.ts`)

## Mocking toolbar (`mock/MockToolbar.vue`, `mock/MockModeGuide.vue`)

- [x] Mode Off · CDP · HTTP with tooltips and active dot → Cladd `Segmented` "Off · In the WebView · Local server" with hints in Cladd tooltips and a still `StatusDot` (no pulse: only recording may pulse)
- [x] HTTP port (1024–65535, persisted, default 3001) → Cladd `NumberField`, clamped (`mockView.ts`), on a second row with the server state and its address (`mock/MockServerControls.vue`, round 1, U15)
- [x] ADB Reverse → "Connect the phone" (`mock/useMockReverse.ts`), now with a success toast and an error toast
- [x] Server running :port / stopped → `StatusDot` + "Server running" / "Server stopped"
- [x] CDP without target warning → "Waiting for an app: choose one, or use the local server."
- [x] Mode guide toggle → `IconAction` "How interception works" opening two cards with a small flow diagram each (`MockModeGuide.vue`); open state remembered
- [x] Scope label → "Rules for <app name>" or "Shared rules"; rules are kept per phone + package so they survive app restarts, and the tooltip says so (`scopeWords`, `stores/mockScope.ts`, round 1, P4)
- [x] Active rule count → "N of M rules on", or "N rules ready, interception off" with a note and "Intercept in the WebView" above list and editor (`rulesSummary`, `mock/MockInterceptionNote.vue`, round 1, U5)
- [x] Import (disabled while a transfer runs) → `IconAction` "Import a rule" with loading (`mock/useMockTransfer.ts`)
- [x] Create rule + nine templates → "New rule" split button with a Reka menu "Start from" (fixes the menu that never closed on outside click)
- [x] Transfer notice strip → toasts ("Rule imported", "Rule exported" with the path, or the error)

## Mocking rules and log (`mock/MockSidebar.vue`, `mock/MockRulesList.vue`, `mock/MockLogList.vue`)

- [x] Rules (n) · Log (n), Clear log, Reset hits → Cladd `Segmented` with counts; "Clear log"; "Reset counts" (only when a rule has matched; counts are kept in memory for this run, round 1, F1)
- [x] Rule search with clear → Cladd `SearchField` "Search by name or address"
- [x] No rules: text + Create first rule → one onboarding panel across the tab (no split) with the nine templates as starters, New empty rule and Mock a real response from Requests (`mock/MockOnboarding.vue`, round 1, U13)
- [x] Rule rows → virtualised listbox, 44 px: Cladd `Switch`, method, name (dimmed when off), pattern or "Every address", status tinted by outcome, `n×` matched with a Cladd tooltip, delete on hover (`tabindex="-1"`); ↑/↓, Home/End (also with nothing selected, P7), Space toggles, Esc clears
- [x] Log empty → "Nothing intercepted yet. Requests appear here while interception is on."
- [x] Log rows → virtualised, 40 px `div role="listitem"` rows (a button inside when the row opens a rule, U15): outcome dot, method, URL, rule name or Passed through / No rule, delay, status, clock time (relative times went stale without a tick); a matched row opens its rule
- [x] Log keeps 500 entries in memory → unchanged store

## Mocking rule editor (`mock/MockRuleEditor.vue`, `mock/MockHeadersEditor.vue`, `mock/MockBodyEditor.vue`, `mock/MockBodyDialog.vue`)

- [x] No selection → "Choose a rule on the left to edit it." (or the rules explanation when there are none)
- [x] Name; Duplicate, Export (disabled while a transfer runs), Delete → Cladd `Input`; `IconAction`s; delete now offers Undo in a toast
- [x] Match: method, pattern with per-type placeholder, match type → "Which requests": Cladd `Select`, `Input`, `Segmented` Contains · Wildcard · Regex · Exact with a hint sentence
- [x] Response: status 100–599, content type (five), delay 0–60 000 → "Answer with": `NumberField`s (clamped), content type `Select` that also keeps a custom type (from Mock this response)
- [x] Body editor and Expand dialog (JSON pretty-printed on open) → JSON editor or text area in a well (plain text above 2,000 lines or 200 KB; validation debounced; scroll kept out of render, F2); "Open larger" opens a Cladd `Dialog`; the body is never re-formatted on open, "Format JSON" does it on request (P6E); a Base64 body shows its size and type with "Write a text body instead" (`MockBinaryBody.vue`, P6F)
- [x] Response headers add / edit / remove, empty text → `MockHeadersEditor.vue`
- [x] Pass through switch → Cladd `Switch` with "Count matching requests but let them reach the real server."
- [x] HTTP mode note → info note with `http://127.0.0.1:<port>` and Connect the phone
- [x] Draft auto-saves after 300 ms, keeps the stored enabled state, JSON pretty-printed on open → `mock/useMockRuleDraft.ts` (`mockDraft.ts`; a new draft object marks a change, nothing is serialised), saved at once before export, duplicate, delete and an app change (round 1, P2/P7), lifecycle tests in `__tests__/useMockRuleDraft.test.ts`

## Mock state and engine

- [x] Rules and mode per target scope, global scope, legacy migration → rules live in IndexedDB (`stores/mockRulesDb.ts`; debounced writes of changed scopes only; failures in a toast and `saveError`), scoped by phone + package (`stores/mockScope.ts`); the first run moves localStorage rules over and removes them only after the write succeeded (`stores/mockMigration.ts`), rules saved under old page-id scopes wait per phone until that phone's app opens (`stores/useMockPersistence.ts`); tests in `__tests__/mockMigration.test.ts`; selection clears when the scope changes (round 1, F1/P4)
- [x] Rule actions → store; Undo re-inserts a deleted rule where it was, in the app it was deleted from (round 1, P7)
- [x] Matching → unchanged (`matchUrl` covered in `__tests__/mockModel.test.ts`)
- [x] CDP engine → `src/composables/useMockCdpEngine.ts` (bodies Base64-encoded once per rule version in `mockCdpAnswer.ts`; pass-through matches now counted, as the switch promises), orchestrated by `useMockServer.ts` (round 1, F3)
- [x] HTTP engine, server outlives the screen → `src/composables/useMockHttpEngine.ts`; the Rust server (`src-tauri/src/commands/mock_server.rs`, `mock_server/rules.rs`) matches absolute patterns against the received path, uses a real regex, sends the content type, decodes Base64 bodies, logs unmatched requests, swaps rules behind an `Arc` and holds no lock during a delay (round 1, P6B/F10)
- [x] MCP `upsert_mock_rule`, `set_mock_mode` → unchanged; an MCP edit to the open rule now refreshes the editor
- [x] Export/import format `capubridge-mock-rule` v1 → unchanged plus an optional `bodyEncoding`; older files read as text (`mockRuleTransfer.ts`, round trip tested in `__tests__/mockMigration.test.ts`)

## Bugs fixed (with tests)

- `NetworkMock.vue` rendered `<AlertTriangle>` without importing it → the warning is plain text now.
- The template menu's `v-click-outside` directive was never registered → Reka menu.
- ADB Reverse failures reached only the console, with the wrong text → toasts for success and failure.
- WS type filter ignored the text filter (`stores/useNetworkStore.ts`) → `__tests__/networkStore.test.ts`.
- `selectedEntry` did not follow updates, so a selected pending request stayed "pending" in the details → follows the version counter, tested.
- The rule draft saved itself every 300 ms forever (each save replaced the draft, which saved again), overwrote hit counts with stale ones, re-formatted JSON while typing, and lost edits made just before switching rules → `mock/useMockRuleDraft.ts`, tested.
- The code viewer said "1 lines" → "1 line" (`src/shared/code-viewer/TextView.vue`).

## Round 1 fixes (with tests)

- Requests still open when capture restarted stayed Pending forever → marked Unknown (`markInterrupted`), tested in `src/composables/__tests__/useNetwork.test.ts`.
- Files the app serves itself showed 0 B → sizes from `Network.dataReceived` (`packages/cdp-protocol` `onDataReceived`), tested.
- The local mock server never matched a rule made from a request, ignored the content type, treated regex as a wildcard and answered pass-through rules → fixed in Rust, `cargo test mock_server`.
- Mock rules were tied to the page's DevTools id and looked lost after an app restart → per phone + package, with a migration.
- Undo after switching apps restored into the wrong app; edits made just before an app switch, export or duplicate were lost → fixed, tested.
- "Mock this response" re-serialised JSON (big integers, `1.0`), dropped binary bodies and the real address of CapacitorHttp calls, copied 304s → fixed, tested in `__tests__/mockModel.test.ts`.
- Capture threw an unhandled rejection when no DevTools client came back → it reports the failure and retries.

## Shared code promoted (module boundaries)

So Network can use what Device built without importing another module: `src/shared/list/`
(`rowState.ts`, `keyTargets.ts`, `grid.ts`), `src/shared/components/presentation/` (`SortHeader.vue`,
`CopyAction.vue`) and `src/shared/code-viewer/` (text, JSON and image views with their helpers and
tests). Device imports were updated; `TextView`/`JsonView` take a truncation sentence and `ImageView`
a `Blob` instead of file-viewer types. `JsonView` gained an optional Raw mode.

Round 1 shared additions: `src/shared/components/presentation/HintTooltip.vue` (a Cladd tooltip for one element, in
place of `title`), `segmentText.ts` (selected-segment text), `src/lib/base64.ts` (chunked Base64 helpers, now used by
mock transfer, bodies and the CDP engine). `TextView` takes `wrapStorageKey` and `findLabel`; `JsonEditor` debounces
validation and keeps its scroll offset out of render (also used by Storage).

## Owner polish pass: one fact, one place

Driven by the owner's review (text heavy, duplicates, details not set apart, rows not on one line).
Each duplicate removed, and where its fact lives now:

| Said twice                                                              | Lives now                                                                                       |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Address in the header's host line and in General › Address              | Details header, second line (full, selectable, tooltip); the Copy menu still copies it          |
| Method in the header (non-GET only) and in General › Method             | Details header, always named                                                                    |
| Status in the header and in General › Status                            | Details header, with its reason ("404 Not Found")                                               |
| General › Served from and General › Size ("… from the app's own files") | General › Size, one value ("4.0 KB from the disk cache", "1.0 KB transferred · 4.0 KB decoded") |
| Size in Headers › General and in Timing                                 | Headers › General › Size                                                                        |
| Media type in General › Type and in the `content-type` response header  | The header list (surfaced first); Type keeps it only when no header carries it                  |
| Started by "main.js:42 · https://…/main.js" (the file named twice)      | General › Started by: the script's address and line, once                                       |
| Error text in General › Error and on the Response tab                   | Headers › General › Error; Response says "No response: the request failed"                      |
| `cookie` / `set-cookie` raw in the header lists and parsed in Cookies   | Cookies tab; the header lists link to it ("3 cookies")                                          |
| Failed / Cancelled in both Status and Time of a row                     | Status; Time shows how long it ran                                                              |
| The type word in every row while the type filter keeps one type         | The selected filter segment; the Type column steps aside                                        |
| Host and folder in every row, plus "App · size" for the app's files     | Host after the name for network requests only; the folder in the tooltip and the details header |
| "N requests … N shown" while filtering                                  | "3 of 12 requests"                                                                              |
| Toolbar "Live" / "In the background" beside the pill saying the same    | Title-bar pill (and the app strip); the toolbar names only Paused, Connecting, Not capturing    |

Less text: empty header and cookie sections hide instead of describing themselves; Payload, Response
and Timing states are short labels; long header lists fold behind "N more" with content-type, cache
and status-related headers surfaced first. Tests: `__tests__/requestsModel.test.ts` (columns, names,
time, summary, capture echo, one text size) and `__tests__/requestDetails.test.ts` (header vs General
facts, size with its source, header groups and cookies).

Not checked in the running app: the owner was using it (the selected app changed between
screenshots), so the live look of the raised details surface, row baselines and folded header lists
is pending.
