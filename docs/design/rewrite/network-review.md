# Network route — review round 1

Reviewed commit `585bf171`. Three independent reviews plus the orchestrator's look. Paths are
relative to `apps/desktop/src/modules/network/` unless they start with `src/`, `src-tauri/` or
`packages/`. Fix every blocker and major; fix minors unless a note says otherwise.

## Parity and correctness

- **P1 lost — binary response bodies.** The old screen showed raw Base64 for fonts, octet-stream and
  mislabelled text (`585bf171^:…/NetworkRequests.vue:370-375,753-770`); now only "This body is not
  text" (`requests/details/bodyContent.ts:79-86`, `BodyView.vue:41-45`) and "Copy response" says
  nothing to copy. Add a Base64 view and "Copy as Base64".
- **P2 broken — export and duplicate drop the last 300 ms of edits** (`mock/NetworkMock.vue:87-90`):
  call the draft's `save` first.
- **P3 — "Filter requests" leaves `?focus=filter` in the URL when the gate shows**
  (`useNetworkCommands.ts:13-20`): clear it either way.
- **P4 — rules seem to vanish after an app restart**: the scope key includes the CDP page id
  (`src/composables/useMockServer.ts:33-37`, `mockView.ts:95-107`). Scope by serial + package
  (with a migration that keeps existing rules reachable), or change the label honestly.
- **P5 — shared TextView settings leak between Files and Network** (`src/shared/code-viewer/TextView.vue:25`):
  storage key and find label as props.
- **P6 — "Mock this response" correctness** (`mock/mockFromRequest.ts`, `requests/details/useRequestActions.ts`):
  - A: the generated match drops the query; for CapacitorHttp (`_capacitor_http_interceptor_?u=…`)
    and single-address RPC endpoints (Odoo `/jsonrpc`, `/web/dataset/call_kw`) one rule answers
    every call. Keep the query when it carries the real address; warn when the request had a body.
  - B: local-server mode never matches (Rust compares the path only, `src-tauri/src/commands/mock_server.rs:54,119-124`)
    and `contentType` is dropped (`mockFromRequest.ts:11`, `useMockServer.ts:193-203`). Make it
    match or say so.
  - C: WebView interception listens only to Fetch/XHR/Document/Other (`useMockServer.ts:67-74`);
    rules from Script/Style/Image/Font/Media never fire. Widen the interception or only offer the
    action where it can work, with the reason shown when disabled.
  - D: a 304 is copied as is; map 3xx to 200.
  - E: `prettyBody` and `draftFromRule` (`mockDraft.ts:36-39`) re-serialise JSON (big integers,
    `1.0`, duplicate keys); keep the body text byte-for-byte, pretty-print only for display.
  - F: binary bodies become empty rules; store Base64 with an encoding flag (`Fetch.fulfillRequest`
    takes Base64), or refuse with a reason.
  - G: localStorage quota failures are silent (see F1).
- **P7 — editor and target change:** edits in the 300 ms before a target change are lost
  (`mock/useMockRuleDraft.ts:72-80`, `NetworkMock.vue:92-95`); undo-delete after a target change
  restores into the wrong app (`NetworkMock.vue:76-83`); Home/End with no selection
  (`MockRulesList.vue:51`).
- **P8 — requests list:** waterfall scale spans the whole retained session (`waterfall.ts:25-36`);
  in-flight requests stay Pending forever after a reconnect (`src/composables/useNetwork.ts:291-314`);
  auto-follow stops at the 5,000 cap (`requests/RequestsTable.vue:192-201`); the context menu acts on
  a frozen copy of the request (`NetworkRequests.vue:45,151`, `RequestContextMenu.vue:16`).
- **P9 — sizes are 0 B for local files (not a regression):** CDP's `encodedDataLength` is 0 for
  requests served through `shouldInterceptRequest`. Add `onDataReceived` to
  `packages/cdp-protocol/src/cdp/domains/network.ts`, sum `dataLength`, fall back to Content-Length,
  show "transferred / size" like DevTools and separate totals in the summary.

## Performance

- **F1 blocker — every mock hit and autosave serialises all rules with bodies** (`stores/useMockStore.ts:40,130-132`,
  `src/composables/useMockServer.ts:116,169,246`, `mock/useMockRuleDraft.ts:260,280-285`): hit counts
  in a separate in-memory map, persistence debounced and moved out of localStorage (IndexedDB or a
  Tauri file, with a migration and a quota error surfaced), sync to Rust only on definition changes,
  draft comparison by version counter.
- **F2 blocker — the mock body editor freezes on large JSON** (`src/shared/components/data/JsonEditor.vue`):
  fall back above ~2,000 lines/200 KB, scroll offset out of reactive render, debounced validation.
- **F3 blocker — per-request byte-by-byte Base64 in CDP mock mode** (`src/composables/useMockServer.ts:10-14,139`):
  encode once per rule version, chunked.
- **F4 major — every CDP event rebuilds and re-sorts the 5,000-row list next frame**
  (`stores/useNetworkStore.ts:49-57,72-77,216`, `src/composables/useNetwork.ts:210-223`,
  `requests/NetworkRequests.vue:47-48,65-72`, `requests/requestSort.ts:98-134`): throttle the version
  bump (4–10 Hz), WebSocket frame counts as in-place counters, sort keys cached per entry
  (`WeakMap`), running transferred total, stable `range`.
- **F5 major — body search lowercases every cached body per recompute** (`stores/useNetworkStore.ts:125-131`):
  lowercase once on cache, memoise per entry+query, debounce the filter (~150 ms).
- **F6 major — every CDP event stringifies and encodes the entry twice, app-wide**
  (`stores/useNetworkStore.ts:197,235,248`): size once, estimate from string lengths.
- **F7 major — bodies fetched per keyboard step, uncancelled, kept twice**
  (`requests/details/useRequestBodies.ts:38-48,64-76`): debounce the id, `gcTime` ~30 s, read the
  store's bounded cache first.
- **F8 major — large JSON parsed and pretty-printed synchronously on select**
  (`requests/details/bodyContent.ts:159-163`, `ResponseTab.vue`, `RequestDetails.vue:70`): lazily per
  view, idle/worker above ~512 KB with a "Formatting…" state, small LRU per request.
- **F9 major — one very long line rendered as one DOM run** (`src/shared/code-viewer/TextLinesPane.vue`,
  `textSegments.ts`, `requests/details/ImageBody.vue`): cap rendered line length with a truncation
  marker; Base64 as a summary with Copy.
- **F10 — Rust mock server clones all rules per HTTP request** (`src-tauri/src/commands/mock_server.rs:64,101`):
  `Arc` swap, `Bytes` bodies, release the lock before the delay.
- **F11 minor — rows rebuilt per frame, two forced layouts** (`requests/RequestsTable.vue:308-317,393-402`,
  `src/shared/composables/useFixedVirtualList.ts:57-67`).
- **F12 minor — `maxPostDataSize: 64 KB` inline bodies parsed and discarded**
  (`src/composables/useNetwork.ts:255-260`): lower it after confirming `getRequestPostData` still works.

## UI/UX

- **U1 major — Name hides what matters:** Name first; last path segment + query as main text, host
  and path quiet; method as a quiet prefix only when not GET; drop the Method column
  (`requests/requestCells.ts:140`, `requestColumns.ts:28`, `details/RequestDetailsHeader.vue:33`).
- **U2 major — Waterfall wastes width and shows ticks:** hide while details are open, ≥3 px bars,
  tick labels in the header, axis from the visible rows or the last page load (with P8).
- **U3 major — "0 B" everywhere** (with P9): "transferred / size", local files labelled as app files.
- **U4 major — background state said three ways** (`src/lib/gates/copy.ts:162`, `src/lib/gates/link.ts:44`,
  `requests/captureState.ts`): one wording across pill, strip and toolbar ("In the background", not
  "paused", which means user-paused capture here); the strip names the app by label, not package.
- **U5 major — rules look on while interception is Off:** a note above list and editor with a
  button to turn on "In the WebView"; summary "1 rule ready, interception off"; toast action.
- **U6 major — "Mock this response" offered for images** (with P6 C/F).
- **U7 major — segmented controls: selected barely distinguishable** (`RequestsFilterBar.vue`,
  `mock/MockToolbar.vue`, `mock/MockSidebar.vue`): unselected muted normal weight, selected
  foreground medium, like `RequestDetails.vue`. If this is the Cladd `Segmented` default, fix it in
  the app's usage first; only propose a Cladd change in the report.
- **U8 major — Payload never shows query parameters** (`requests/details/PayloadTab.vue:30-32`).
- **U9 major — Ctrl+F is captured document-wide** (`requests/useRequestsKeyboard.ts:24`): scope it
  to the Requests screen; focus the list filter when the open tab has no find.
- **U10 minor —** Initiator `localhost:10` reads as host:port (`requestCells.ts:122`): "index.html:10".
- **U11 minor —** off switches illegible (Cladd); report a cladd-vue proposal, do not edit
  `packages/cladd`.
- **U12 minor —** scroll the selected row into view on mount and filter change.
- **U13 minor —** Mocking empty state: one onboarding panel with templates as starters.
- **U14 minor —** mute 2xx codes, mono only for file:line, drop the duplicate Timing row, SVG as a
  picture with Text alternative.
- **U15 minor —** Cladd tooltips instead of `title`, log rows `div role="listitem"`, keyboard context
  menu (Shift+F10 / Menu key), Local-server controls on a second row.

## State to restore

- Mock interception mode was switched from Off to "In the WebView" during the review by someone
  other than the reviewers. Set it back to Off before handing back unless rules exist that need it.

## Round 1 fixes

Fixed on `feat/ui-ux-overhaul` after `781323fc`. Paths as above.

| Id    | Outcome                                                                                                                                                                                                                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1    | Fixed: binary bodies offer Copy as Base64 and Show as Base64 (`details/BinaryBody.vue`); the Copy menus, context menu and palette gained "Copy response as Base64".                                                                                                                                      |
| P2    | Fixed: export, duplicate and delete call the draft's `save()` first (`mock/NetworkMock.vue`), tested.                                                                                                                                                                                                    |
| P3    | Fixed: no `?focus=filter`; the store holds a 5 s filter-focus request that Requests takes on mount (`takeFilterFocus`).                                                                                                                                                                                  |
| P4    | Fixed: rules scoped by phone + package (`stores/mockScope.ts`); old page-id scopes migrate to a per-phone bucket the app claims on first open, with a toast (`useMockPersistence.ts`), tested.                                                                                                           |
| P5    | Fixed: `TextView` takes `wrapStorageKey` and `findLabel`; Network uses its own key and "Find in the response / body / Base64".                                                                                                                                                                           |
| P6 A  | Fixed: the query is kept (exact URL) when it carries the real address (CapacitorHttp `?u=`, proxies); a note warns when the request had a body (Odoo `/jsonrpc`, `call_kw`).                                                                                                                             |
| P6 B  | Fixed in Rust: absolute patterns also match the received path, real regex, content type sent, unmatched requests logged; `cargo test mock_server` (6 tests).                                                                                                                                             |
| P6 C  | Fixed by offering the action only where it can work (finished Fetch/XHR/Document/Other), the reason in its tooltip and context-menu line; widening interception to every resource type would pause every image and script.                                                                               |
| P6 D  | Fixed: 3xx (and 304) answer 200, with a note.                                                                                                                                                                                                                                                            |
| P6 E  | Fixed: bodies are kept byte for byte; no pretty-printing on open or from a request; "Format JSON" on request.                                                                                                                                                                                            |
| P6 F  | Fixed: binary bodies stored as Base64 with `bodyEncoding`, fulfilled as is over CDP, decoded in Rust, exported and imported.                                                                                                                                                                             |
| P6 G  | Fixed with F1: save failures (quota included) surface in a toast and `saveError`.                                                                                                                                                                                                                        |
| P7    | Fixed: edits saved before an app change (`onBeforeScopeChange`); Undo restores into the app it was deleted from; Home/End with no selection. Tested.                                                                                                                                                     |
| P8    | Fixed: waterfall axis from the last page load; open requests marked Unknown when capture restarts (tested); following keyed on the last row so it continues at the 5,000 cap; the context menu reads the live request by id.                                                                             |
| P9    | Fixed: `onDataReceived` in `packages/cdp-protocol` (package rebuilt with `vp pack`), sizes summed with a Content-Length fallback, "transferred / size" in the list, Headers and Timing, and a separate resources total. Tested.                                                                          |
| F1    | Fixed: rules in IndexedDB, writes debounced (400 ms) and limited to changed scopes; hit counts in an in-memory map; Rust sync only on definition changes; draft change detection by object identity. Tested, including the localStorage migration and an export/import round trip with old-format files. |
| F2    | Fixed: plain text above 2,000 lines / 200 KB; `JsonEditor` validation debounced (250 ms) and its gutter offset set without re-rendering.                                                                                                                                                                 |
| F3    | Fixed: Base64 encoded once per rule version, in chunks (`mockCdpAnswer.ts`).                                                                                                                                                                                                                             |
| F4    | Fixed: version bumps throttled to 8 Hz; WebSocket frames and received bytes as cheap counter updates; sort keys cached per entry; running totals; cells cached per entry.                                                                                                                                |
| F5    | Fixed: bodies lower-cased once when cached, body hits memoised per entry + query, filter applied 150 ms after the last key.                                                                                                                                                                              |
| F6    | Fixed: entry size estimated from string lengths, header sizes cached per headers object.                                                                                                                                                                                                                 |
| F7    | Fixed: body reads wait for the selection to rest (120 ms) and show nothing stale meanwhile, `gcTime` 30 s, the store's text cache used first. In-flight CDP reads are not cancelled (CDP has no cancel); the debounce keeps arrowing from starting them.                                                 |
| F8    | Fixed: bodies over 512 KB format after the pane paints with "Formatting…", the last 8 kept. Formatting is still on the main thread (no worker).                                                                                                                                                          |
| F9    | Fixed: rendered lines cut at 4,000 characters with a marker; Base64 shown in 76-character lines.                                                                                                                                                                                                         |
| F10   | Fixed: rules behind an `Arc` swapped on sync, `Bytes` bodies, no lock held during a delay.                                                                                                                                                                                                               |
| F11   | Fixed: row cells cached per entry; the virtual list no longer reads layout when the list only grows.                                                                                                                                                                                                     |
| F12   | Skipped: the session recorder enables `Network` on the same CDP session with `maxPostDataSize: 65536`, and the last `Network.enable` wins, so lowering it in capture would strip request bodies from recordings. Capture never parses `postData`.                                                        |
| U1    | Fixed: Name first, last segment + query, host and folder quiet, method prefix only when not GET; Method column dropped; same in the details header.                                                                                                                                                      |
| U2    | Fixed: waterfall hidden while the details are open, bars at least 3 px, tick labels in the header, axis from the last page load.                                                                                                                                                                         |
| U3    | Fixed with P9: "transferred / size", "App · size" for app files, "The app's own files" as the source.                                                                                                                                                                                                    |
| U4    | Fixed: "In the background" in the pill (`lib/gates/link.ts`), the strip (named by the app label, not the package) and the toolbar.                                                                                                                                                                       |
| U5    | Fixed: note with "Intercept in the WebView" above list and editor, "N rules ready, interception off", toast action "Intercept".                                                                                                                                                                          |
| U6    | Fixed with P6 C.                                                                                                                                                                                                                                                                                         |
| U7    | Fixed in the app's usage (`SEGMENT_TEXT` + `active-variant="solid"` on every Network segmented control and the shared JSON/picture switches). Cladd proposal below.                                                                                                                                      |
| U8    | Fixed: Payload shows query parameters.                                                                                                                                                                                                                                                                   |
| U9    | Fixed: Ctrl+F only inside Requests or with nothing focused; tabs without find focus the filter.                                                                                                                                                                                                          |
| U10   | Fixed: a site root reads `index.html:10`.                                                                                                                                                                                                                                                                |
| U11   | Skipped (Cladd): proposal below.                                                                                                                                                                                                                                                                         |
| U12   | Fixed: the selected row is revealed on mount and when filters change.                                                                                                                                                                                                                                    |
| U13   | Fixed: one onboarding panel with the templates as starters.                                                                                                                                                                                                                                              |
| U14   | Fixed: 2xx muted, mono only for `file:line`, Timing drops the rows Headers already shows (and Headers gained Size), SVG as Picture · Text.                                                                                                                                                               |
| U15   | Fixed: Cladd tooltips in Mocking and the details header (the dense request rows keep `title` to avoid a tooltip instance per cell), log rows `div role="listitem"`, keyboard context menu, local-server controls on a second row.                                                                        |
| State | Rules moved to the new per-app scope with interception Off; the old page-id scope had no rules and its "In the WebView" mode is not carried over.                                                                                                                                                        |

Found beyond the list: pass-through matches were never counted although the switch promised it; the local server answered pass-through rules and never logged unmatched requests; capture threw an unhandled rejection when no DevTools client came back. All fixed.

Cladd proposals (not edited here): `SegmentedButton` unselected text should default to muted at normal weight and the selected one to foreground medium (U7); `Switch` off state needs a visible track outline and knob contrast in Bench Dark (U11).

Not verified in the running app: only the installed release build (`%LOCALAPPDATA%\capubridge\app.exe`) was running, with no dev server, so the hot-reloading dev app could not be inspected and no screenshots were taken.
