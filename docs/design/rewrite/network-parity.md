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
- [x] `network.filter` "Filter requests" focuses and selects the filter → `useNetworkCommands.ts`; from Mocking it opens Requests with `?focus=filter` and focuses there (`requests/NetworkRequests.vue`)

New commands: `screen.network-requests` (Reload the page, Copy request address, Copy request as cURL,
Copy request as fetch, Copy response, Mock this response — `requests/useRequestsCommands.ts`) and
`screen.network-mock` (New mock rule, Import a mock rule, Turn interception off / Intercept in the
WebView / Run the local mock server — `mock/useMockCommands.ts`).

## Requests toolbar (`requests/RequestsToolbar.vue`, `requests/RequestsFilterBar.vue`)

- [x] Capture toggle → `IconAction` Pause / Play, "Pause capture" / "Resume capture"
- [x] Capture status chip idle / connecting / live / error with the error as tooltip → `StatusDot` + one word (Live, Connecting, Waiting, Paused, Not capturing) with the detail as tooltip (`requests/CaptureStatus.vue`, `requests/captureState.ts`); an app in the background reads "Waiting", not "Live"
- [x] Clear → `IconAction` "Clear requests", disabled when empty
- [x] Search scope URL / All → Cladd `Select` "In addresses" / "Also in headers and bodies", shown while a filter is typed (the old "URL / Headers" label was wrong: headers were only searched in the wide scope)
- [x] Filter field with clear (×) → Cladd `SearchField` "Filter requests" (built-in clear); same matching
- [x] Ctrl+F outside the details focuses and selects the filter → `requests/useRequestsKeyboard.ts`, `RequestsToolbar.focusFilter`
- [x] Type filters (same ten, same matching) → Cladd `Segmented` with plain labels and hints (`requests/requestFilters.ts`)
- [x] Method filter → Cladd `Select` "Any method" · GET … OPTIONS
- [x] Preserve toggle (default on) → `IconAction` pin "Keep requests when the page reloads", pressed while on
- [x] Stats N requests / X transferred / N shown while filtering → one quiet line at the end of the filter row (`requests/requestFilters.ts` `requestsSummary`)

New: "Reload the page" (`requests/usePageReload.ts`, `Page.reload` over CDP) in the toolbar and the
empty state; "Mocking N rules" notice when interception is on (`requests/MockingNotice.vue`).

## Request list (`requests/RequestsTable.vue`)

- [x] Virtualised list → TanStack Table columns + `useFixedVirtualList`, 26 px rows, overscan 12
- [x] Column header → Method · Name · Status · Type · Initiator · Size · Time · Waterfall, every column sortable (`SortHeader`, ascending → descending → capture order, `requests/requestSort.ts`); Type, Initiator, Size and Waterfall step aside by container width (`requests/requestColumns.ts`)
- [x] Type icon per resource type → dropped as a duplicate signal; the Type column names it in words (`typeWord`)
- [x] Method badge tinted per method → quiet mono method (colour is reserved for meaning)
- [x] Status tinted, `ERR`, `—` → code tinted only for 3xx (quiet) / 4xx (warning) / 5xx (error); words Failed, Cancelled, Blocked, Pending (`requests/requestCells.ts` `statusCell`)
- [x] URL as path + query, selectable → Name (path + query, `data:` media type), full URL as tooltip and in the details
- [x] Type short label → words (Fetch, XHR, Script, Image, …)
- [x] Size `…` / `—` / `(cache)` / bytes → `…`, `—`, Disk cache, Service worker, Prefetch, bytes; WebSockets show frames (`sizeCell`)
- [x] Time `…` / aborted / failed / ms / s, tinted over 1 s and 3 s → Pending / Open / Cancelled / Failed, same thresholds (`timeCell`)
- [x] Initiator `file:line` or type → same, line shown 1-based, types in words (`initiatorWord`)
- [x] Row signals (left edge, tints) → status and time words carry the outcome; selection uses the shared selection treatment (`src/shared/list/rowState.ts`)
- [x] Click selects; clicking the selected row closed the details → click always selects (device lesson P5); close with Esc or the close button
- [x] Ctrl/⌘+↑/↓ moves the selection → kept (`requests/useRequestsKeyboard.ts`); plain ↑/↓, PgUp/PgDn, Home/End, Enter (to the details), Esc in the focused list
- [x] Empty: waiting vs no match → `requests/RequestsEmpty.vue` + `emptyCopy`: no match (Clear filters), paused (Resume capture), could not capture, connecting, app in the background, waiting (Reload the page)

New: waterfall bars (waiting vs receiving, open requests run to the end, `requests/waterfall.ts`),
right-click menu (`requests/RequestContextMenu.vue`), follows new requests while at the end with
nothing selected and no sort, `aria-activedescendant` listbox.

## Request details (`requests/details/`)

- [x] Resizable side pane opened by selection → Reka splitter, 42 % default (26–70 %), width remembered (`auto-save-id`), `NetworkRequests.vue`
- [x] Header: method, short URL, close → `RequestDetailsHeader.vue` (method, name, status, host line, Mock this response, Copy menu, close with Esc hint)
- [x] Tabs and Ctrl/⌘+←/→ → Cladd `Tabs` (`RequestDetails.vue`, `detailTabs.ts`); the open tab is remembered (`capubridge:network:details-tab`)
- [x] Ctrl+F inside the pane → opens find in the code viewer of Response or Payload (`useRequestsKeyboard.ts` → `findSignal`)
- [x] Headers › General → `HeadersTab.vue`: Address (clamped, full on hover), Method, Status, Type (+ MIME), Started by, Served from, Remote address, Protocol, Frames (WebSocket), Error
- [x] Headers › Response headers with count, sorted, empty text → `HeadersTab.vue`
- [x] Headers › Request headers with count, sorted → `HeadersTab.vue`
- [x] Sections collapsible, open by default → `DetailsSection.vue`; the collapsed set is remembered (`capubridge:network:collapsed-header-sections`)
- [x] Payload states and views → `PayloadTab.vue` + `BodyView.vue`: no body, reading, error with Try again, JSON (Text · Tree · Raw), form fields as `name: value`, text, empty
- [x] Payload fetched only on its tab, TanStack Query `["net-post-data", target, id]`, stale 60 s, no retry, cached for search → `useRequestBodies.ts` (no longer waits for the request to finish)
- [x] Response states → `ResponseTab.vue`: WebSocket, failed with the error, waiting, reading, error with Try again, empty
- [x] Response image with Raw → `ImageBody.vue`: Picture (shared zoomable `ImageView`) · Base64
- [x] Response JSON with Raw, text with MIME → shared code viewer (`src/shared/code-viewer/JsonView.vue` Text · Tree · Raw, `TextView.vue` with line numbers, wrap, find, highlighting by MIME, `bodyContent.ts`); other bytes say their size and type
- [x] Response fetched only on its tab, `["net-response-body", target, id]`, stale 60 s, no retry, cached for search → `useRequestBodies.ts`
- [x] Timing without CDP timing → `TimingTab.vue` facts: Started at, Total, Transferred, Served from, Media type, Protocol, with a sentence saying the app reported no phases
- [x] Timing phases with totals → `TimingTab.vue` + `timing.ts`: Queued, Stalled, DNS lookup, Initial connection, SSL, Request sent, Waiting for the server, Content download, laid out on one time axis like DevTools
- [x] Cookies › request cookies → `CookiesTab.vue` "Sent with the request" (`cookies.ts`)
- [x] Cookies › Set-Cookie with attributes → "Set by the response", flags read "Yes"

New: Copy address / as cURL / as fetch / response (`copyAs.ts`, `useRequestActions.ts`), Mock this
response (`mock/mockFromRequest.ts`).

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

- [x] Mode Off · CDP · HTTP with tooltips and active dot → Cladd `Segmented` "Off · In the WebView · Local server" with hints and a still `StatusDot` (no pulse: only recording may pulse)
- [x] HTTP port (1024–65535, persisted, default 3001) → Cladd `NumberField`, clamped (`mockView.ts`)
- [x] ADB Reverse → "Connect the phone" (`mock/useMockReverse.ts`), now with a success toast and an error toast
- [x] Server running :port / stopped → `StatusDot` + "Server running" / "Server stopped"
- [x] CDP without target warning → "Waiting for an app: choose one, or use the local server."
- [x] Mode guide toggle → `IconAction` "How interception works" opening two cards with a small flow diagram each (`MockModeGuide.vue`); open state remembered
- [x] Scope label → "Rules for <app name>" or "Shared rules", serial and URL in the tooltip (`scopeWords`)
- [x] Active rule count → "N of M rules on" (`rulesSummary`)
- [x] Import (disabled while a transfer runs) → `IconAction` "Import a rule" with loading (`mock/useMockTransfer.ts`)
- [x] Create rule + nine templates → "New rule" split button with a Reka menu "Start from" (fixes the menu that never closed on outside click)
- [x] Transfer notice strip → toasts ("Rule imported", "Rule exported" with the path, or the error)

## Mocking rules and log (`mock/MockSidebar.vue`, `mock/MockRulesList.vue`, `mock/MockLogList.vue`)

- [x] Rules (n) · Log (n), Clear log, Reset hits → Cladd `Segmented` with counts; "Clear log"; "Reset counts" (only when a rule has answered)
- [x] Rule search with clear → Cladd `SearchField` "Search by name or address"
- [x] No rules: text + Create first rule → "No rules yet." in the list; the editor side explains rules and offers New rule and Go to requests (one empty state, not two)
- [x] Rule rows → virtualised listbox, 44 px: Cladd `Switch`, method, name (dimmed when off), pattern or "Every address", status tinted by outcome, `n×` answered with a tooltip, delete on hover (`tabindex="-1"`); ↑/↓, Home/End, Space toggles, Esc clears
- [x] Log empty → "Nothing intercepted yet. Requests appear here while interception is on."
- [x] Log rows → virtualised, 40 px: outcome dot, method, URL, rule name or Passed through / No rule, delay, status, clock time (relative times went stale without a tick); a matched row opens its rule
- [x] Log keeps 500 entries in memory → unchanged store

## Mocking rule editor (`mock/MockRuleEditor.vue`, `mock/MockHeadersEditor.vue`, `mock/MockBodyEditor.vue`, `mock/MockBodyDialog.vue`)

- [x] No selection → "Choose a rule on the left to edit it." (or the rules explanation when there are none)
- [x] Name; Duplicate, Export (disabled while a transfer runs), Delete → Cladd `Input`; `IconAction`s; delete now offers Undo in a toast
- [x] Match: method, pattern with per-type placeholder, match type → "Which requests": Cladd `Select`, `Input`, `Segmented` Contains · Wildcard · Regex · Exact with a hint sentence
- [x] Response: status 100–599, content type (five), delay 0–60 000 → "Answer with": `NumberField`s (clamped), content type `Select` that also keeps a custom type (from Mock this response)
- [x] Body editor and Expand dialog (JSON pretty-printed on open) → JSON editor or text area in a well; "Open larger" opens a Cladd `Dialog`
- [x] Response headers add / edit / remove, empty text → `MockHeadersEditor.vue`
- [x] Pass through switch → Cladd `Switch` with "Count matching requests but let them reach the real server."
- [x] HTTP mode note → info note with `http://127.0.0.1:<port>` and Connect the phone
- [x] Draft auto-saves after 300 ms, keeps the stored enabled state, JSON pretty-printed on open → `mock/useMockRuleDraft.ts` (`mockDraft.ts`), lifecycle tests in `__tests__/useMockRuleDraft.test.ts`

## Mock state and engine

- [x] Rules and mode per target scope, global scope, legacy migration → unchanged (`stores/useMockStore.ts`); selection clears when the scope changes
- [x] Rule actions → unchanged store; Undo re-inserts a deleted rule where it was
- [x] Matching → unchanged (`matchUrl` covered in `__tests__/mockModel.test.ts`)
- [x] CDP engine → unchanged (`src/composables/useMockServer.ts`)
- [x] HTTP engine, server outlives the screen → unchanged
- [x] MCP `upsert_mock_rule`, `set_mock_mode` → unchanged; an MCP edit to the open rule now refreshes the editor
- [x] Export/import format `capubridge-mock-rule` v1 → unchanged (`mockRuleTransfer.ts`)

## Bugs fixed (with tests)

- `NetworkMock.vue` rendered `<AlertTriangle>` without importing it → the warning is plain text now.
- The template menu's `v-click-outside` directive was never registered → Reka menu.
- ADB Reverse failures reached only the console, with the wrong text → toasts for success and failure.
- WS type filter ignored the text filter (`stores/useNetworkStore.ts`) → `__tests__/networkStore.test.ts`.
- `selectedEntry` did not follow updates, so a selected pending request stayed "pending" in the details → follows the version counter, tested.
- The rule draft saved itself every 300 ms forever (each save replaced the draft, which saved again), overwrote hit counts with stale ones, re-formatted JSON while typing, and lost edits made just before switching rules → `mock/useMockRuleDraft.ts`, tested.
- The code viewer said "1 lines" → "1 line" (`src/shared/code-viewer/TextView.vue`).

## Shared code promoted (module boundaries)

So Network can use what Device built without importing another module: `src/shared/list/`
(`rowState.ts`, `keyTargets.ts`, `grid.ts`), `src/shared/components/presentation/` (`SortHeader.vue`,
`CopyAction.vue`) and `src/shared/code-viewer/` (text, JSON and image views with their helpers and
tests). Device imports were updated; `TextView`/`JsonView` take a truncation sentence and `ImageView`
a `Blob` instead of file-viewer types. `JsonView` gained an optional Raw mode.
