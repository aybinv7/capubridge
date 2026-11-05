# Data round 1 (frame + IndexedDB) — review

Reviewed `244b00c9` and `e13a789a`. Paths relative to `apps/desktop/src/modules/storage/` unless
they start with `packages/`, `src/` or `src-tauri/`. **Data-safety items (S) come first and are
non-negotiable; each needs a test that fails before the fix.**

## Data safety

- **S1 — edits and deletes land in the wrong store after a store switch.** `indexeddb/useIdbPage.ts:76`
  keeps previous data across stores; `IdbStoreView` is not keyed (`indexeddb/IndexedDBView.vue:280`);
  writes already target the new store (`useIdbStoreWrites.ts:28-35`); `pinnedRowId` survives the
  `layoutKey` change (`IdbRows.vue:147-158`); `RecordPane` keyed by row id only (`IdbRows.vue:499`)
  with a dirty draft. Keep previous data only for the same origin+db+store; refuse writes while
  placeholder data shows; clear the pin on layout change; key the pane by layout + row.
- **S2 — "Replace" does not really refuse lossy imports**: the only caller always passes
  `acceptLoss` behind "Replace anyway" (`useIdbDatabaseActions.ts:147-157`), only `lossy[0]` is
  shown, lenient revive writes `null` (`packages/cdp-protocol/src/cdp/domains/indexeddb-codec.ts:307-313`).
  List every lossy value; make the user type or tick an explicit acknowledgement; never write `null`
  for an unsupported value silently.
- **S3 — Replace is not atomic and hides damage**: the database is deleted first, then chunks are
  written (`indexeddb-transfer.ts:152-157`); Cancel stays live (`idbTransferToasts.ts`); import chunks
  are counted, not sized (`idbImportExport.ts:97,213-219`). Byte-cap chunks (≤ 4 MiB, split large
  Blobs), probe the whole file can be written before deleting anything (keys, out-of-line Date/binary
  keys), remove Cancel once the schema is replaced, and on failure say plainly the database is partial
  and offer to retry the remaining stores.
- **S4 — a key edit silently overwrites another record** (`indexeddb-writes.ts:58-59` put then
  delete): when the key moves, `add` (fails on collision) or check `get(nextKey)` first and ask.
  Tests for key moves, compound keys, auto-increment.
- **S5 — editing an empty cell changes its type** (`src/shared/components/data/grid/editors/cellEdit.ts:47`,
  `IdbRows.vue:452`): pick the editor from the column type when the value is null/missing.
- **S6 — unsaved edits dropped silently**: Escape from the editor's own panels closes the pane
  (`IdbRows.vue:494`); pager, sidebar and store switch drop the pin. Ignore Escape from editor
  panels; confirm "Discard changes to record X?" before close, page change, navigation.
- **S7 — writes that can create an empty database**: put/patch/delete/clear use `indexedDB.open(name)`
  (`indexeddb-writes.ts:39,84,129,188`); use the existing-only open. Add the origin guard to clear,
  delete store/database and import (`indexeddb-writes.ts:181-265`, `indexeddb-transfer.ts:134,189`).
  `importPutChunk` with `undefined` keyPath (`indexeddb-transfer.ts:208`).

## Parity and correctness

- **P1 blocker — exports cannot be opened without a phone**: "Open an IndexedDB export…" must be an
  app-level command and a secondary action on the IndexedDB gate, landing on the ungated file route.
  Closing a file / "Back to IndexedDB" with no phone must stay on the file route
  (`useIdbDatabaseActions.ts:257`, `IndexedDBView.vue:255`).
- **P2 — importing a file as a new database on the phone is gone**: "Write to the phone as a new
  database…" on an opened file (with S2/S3 safeguards).
- **P3 — change tracking lease loses history**: tab switches clear the feed and baselines; automation's
  `lastDbWrite` is null unless the tab is visible. Keep feed and baselines across tab switches (reset
  only on target/origin change), and keep a cheap signal for automation.
- **P4 — Group by does nothing** (`IdbRows.vue:214-220`); multi-column sort, AND/OR per condition,
  per-column clear filter, reset layout, overview auto-inc and sort by count, pin/hide opened files,
  collapse the open database row (`idbTreeModel.ts:234,256`): restore what is cheap, record the rest
  as deliberate with a reason.
- **P5 — a failed refresh is silent while rows show** (`IdbRows.vue:405-406`, `IdbDatabaseView.vue:113`).
- **P6 — Ctrl+F**: the global search command needs a focus guard; Ctrl+F in the JSON pane filter.
- **P7 —** one bad database blanks the whole Graph (`discoverDatabases` now throws); per-database
  errors instead. Remove the old `idb-sidebar-settings` key after migration. "missing" shown when
  the list failed (`IndexedDBView.vue:92-97`). Out-of-line key read-only reason (`useIdbStoreWrites.ts:50`).
  Restore `TZ` in `cellEdit.test.ts`.

## Performance

- **F1 — change watcher re-reads whole stores and keeps full copies** (`changes/indexeddbChangeTracker.ts`,
  `changes/indexeddbChanges.service.ts`): device returns `[key, hash, bytes]`; host keeps hashes and
  fetches full values only for changed keys; byte budget instead of a 40-store count; flush spacing
  `max(1 s, 2 × last flush)`; prime the open store first, others when idle; respect pause between
  stores and rounds (F10), retry failed snapshots, ~8 s timeouts for watcher reads.
- **F2 — export builds everything in memory ~3×** (`indexeddb/idbImportExport.ts:127-147,261-264`):
  stream to disk through a Rust append command with raw bytes, no pretty-print, byte progress.
- **F3 — import chunks sent as JS source** (`indexeddb-transfer.ts:197`): `JSON.parse` of a string
  literal, byte-capped (with S3); read files in pieces.
- **F4 — whole-store search holds one transaction up to 4 s, not cancellable**
  (`packages/cdp-protocol/src/cdp/domains/indexeddb-reads.ts:273-298`, `indexeddb/useIdbPage.ts:144-187`):
  short transactions resumed by key, cancel flag set on clear/store change, reuse probe text.
- **F5 — pages carry full values for 240-char previews** (`indexeddb-codec.ts:72,246-262`): preview
  encoding for pages, full record via `getRecord` when the pane opens or an edit starts.
- **F6 — query cache keeps every page** (`useIdbPage.ts:53-78`): short `gcTime`, drop other pages.
- **F7 — cells, find and sort serialise whole objects repeatedly** (`src/shared/components/data/grid/valueFormat.ts:163-172`,
  `DataGridRow.vue:60-68`, `idbRowPipeline.ts`): `WeakMap` cell cache with a bounded serialiser,
  cached lowercase search text, debounced find, precomputed sort values.
- **F8 — any change in any store rebuilds the grid** (`changes/useIndexedDBChangeOverlay.ts`):
  per-store version, cached row ids, stable row objects.
- **F9 — record pane expensive on big records** (`frame/RecordPane.vue:62`, `IdbRows.vue:163`,
  `frame/RecordFields.vue`, `src/shared/components/data/JsonEditor.vue`): compute lazily, size from
  the encoder, large values in a lazily loaded editor or a virtualised view.
- **F11 —** opened files: sample sizes, search in idle chunks with a cap. **F12 —** fall back to
  `requestData` only on `wrongOrigin`; counts via `IndexedDB.getMetadata`; key-based paging.

## UI/UX

- **U1 blocker — background state**: 30 s spinner then a raw timeout that stays after the app returns.
  Use presence: `DataState kind="waiting"` with Bring to front, queries disabled, re-read on return;
  short read timeouts in plain words.
- **U2 — raw markers shown** (`frame/RecordPane.vue:54-62`, copy, `valueFormat.ts` json branch): one
  marker-aware renderer (`Date 5 Nov 2026 14:32`, `Map(3)`, `Blob 1.2 KB · image/png`) for tree, previews,
  find; "Copy as stored" as an explicit option.
- **U3 — dates in raw UTC ISO while the editor is local** (`valueFormat.ts:54-56,86`): local readable
  dates via `src/shared/format`, ISO/UTC on hover and in Fields.
- **U4 — read-only reasons never shown** (`IdbRows.vue:226-241,538-541`): inline reason on Enter/F2/
  double-click, `HintTooltip` on the lock, no dead-end pointer to a read-only pane.
- **U5 — unwatched stores look unchanged** (`indexeddbChangeTracker.ts:55-66`): hollow dot "Not
  watched" in sidebar and header with "Watch this store" (with F1's byte budget).
- **U6 — "live" on one-time reads** (`ProvenanceTag.vue:30`, `IndexedDBView.vue:272`): "on the phone ·
  read N ago" without the live dot; live dot only for watched stores; pass the read time to the
  overview.
- **U7 — "Choose a database" contradicts the sidebar** (`IndexedDBView.vue:259-264`): mirror the
  sidebar's state; origin overview when databases exist; honest empty state with "Open an export…"
  and pointers to Key-value and SQLite when none.
- **U8 — percentage pane sizes** (`DataWorkbench.vue:317-323`, `IdbRows.vue:486-492`): pixel min/max
  (sidebar 200–360, pane 280–560), drawer below ~900 px container width.
- **U9 — status bar overloaded, counts twice, announces every selection** (`IdbRows.vue:527-551`,
  `DataGridStatus.vue`): one count, scope as a "This page only" chip by Find, `aria-live` only for
  search results.
- **U10 —** colours outside their roles (`RecordPane.vue:122`, `RecordFields.vue:229,280`).
- **U11 —** keyboard: sidebar row menus on Shift+F10 / Menu key / right-click; field Copy buttons out
  of the tab order with a key to copy the focused field.
- **U12 —** Cladd: `SearchField` in `RecordFields.vue:262-268`, `DataState` in `IdbStructure.vue`,
  one stores list with bars in the overview (`IdbDatabaseView.vue`).
- **U13 —** copy: "on the phone" everywhere, no toast per inline edit, distinct icons for clear vs
  forget marks, no "from a file" next to `imported`, the pane toggle's Space hint, no `v3` on every
  row, a ticking change age.

## Round 1 fixes

Commits `2612c581` (data safety, P1, P2, F2, U1), `d5ad6d8a` (parity, UI, F4, F7, F12) and
`18493d96` (watcher F1 first part, F8). Every S fix has a test that failed before it.

| Id  | Status | What changed, and the proof                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | fixed  | The store view is keyed by database and store; a page is kept on screen only while another page of the same store is read (`keepsPreviousPage`); writes wait while a previous page shows; the pane pin is cleared on layout change and the pane keyed by layout + row. `indexeddb/__tests__/useIdbPage.test.ts`                                                                                                                                   |
| S2  | fixed  | `exportLoss` lists every lossy value (store, record, field); the confirmation lists them and needs the database name typed; the device refuses an unsaved value unless `acceptLoss`; the export names each record. `idbImportPlan.test.ts`, `packages/cdp-protocol/tests/indexeddb-safety.test.ts` ("an import never writes empty values silently")                                                                                               |
| S3  | fixed  | The file goes to a scratch database on the phone first (4 MiB chunks, binary over 256 KiB in 3 MiB pieces, a record still too large refused up front); a refused record or Cancel changes nothing; Cancel goes away at the replace; a failure after it is `IdbPartialImportError` with "Finish writing" (copies the remaining stores on the phone) or "Leave it". `idbImport.test.ts`, `idbImportPlan.test.ts`, `indexeddb-staged-import.test.ts` |
| S4  | fixed  | A key moved onto a taken key throws `IdbKeyConflictError`, nothing changed; the pane asks "Replace the other record?" and only then writes with `replaceExisting`. Compound and auto-increment keys tested. `indexeddb-safety.test.ts`, `idbWrites.test.ts`                                                                                                                                                                                       |
| S5  | fixed  | An empty cell edits as its column (`editorKindFor(value, showAs, like)`), and a filled date takes the column's form (Date, epoch s/ms, ISO); patch revives a Date marker on the device. `cellEdit.test.ts`                                                                                                                                                                                                                                        |
| S6  | fixed  | Escape in the JSON filter stays in the editor; close, toggle, paging, page size, store search, Back to pages, Rows/Structure and route changes (`onBeforeRouteUpdate/Leave`) ask "Discard changes to record X?". Not covered: a row that disappears on refetch while edited (it is gone on the phone too)                                                                                                                                         |
| S7  | fixed  | `__cbOpenExisting` aborts a version-0 upgrade, so no write or read ever creates a database, even without `indexedDB.databases()`; put/patch/delete/clear use it; clear, delete store, delete database, import schema, import chunk, stage and copy check the page origin; import chunks use the store's own key path. `indexeddb-safety.test.ts`                                                                                                  |
| P1  | fixed  | App-wide "Open an IndexedDB export…" (`useDataAppCommands`), a secondary action on the IndexedDB gate (route meta `gateCommand`), Close / Back stay on the file route without a phone                                                                                                                                                                                                                                                             |
| P2  | fixed  | An opened file: "Write it to the phone as a new database…" or "Replace … on the phone with it…", through the S2/S3 path                                                                                                                                                                                                                                                                                                                           |
| P3  | fixed  | The watcher keeps feed and baselines across tab switches, keeps listening (automation signal) and compares queued stores when a screen returns; priming waits for a screen. `indexeddbChangesLease.test.ts`                                                                                                                                                                                                                                       |
| P4  | partly | Group by, pin/hide opened files, collapsible open database, overview sort by records/size/name with generated keys: fixed. Multi-column sort, per-condition AND/OR, header "Clear filter", "Reset layout": skipped, recorded as deliberate in the parity file (page-local tools; the popover already removes a condition, Autosize stays)                                                                                                         |
| P5  | fixed  | A failed read again keeps rows (and stores) under a compact error with Try again                                                                                                                                                                                                                                                                                                                                                                  |
| P6  | fixed  | Find rows takes Ctrl+F only with focus in the tab (or from the palette); Ctrl+F in the pane focuses its Fields find or JSON filter                                                                                                                                                                                                                                                                                                                |
| P7  | fixed  | One unreadable database is listed with its error; the old sidebar key is moved once and removed; out-of-line key reason; `TZ` restored in `cellEdit.test.ts`                                                                                                                                                                                                                                                                                      |
| U1  | fixed  | `useDataPresence`: reads paused while the app is away and run again on return, "Waiting for the app" with Bring to front (route owns it, no second button in the strip), writes held with the reason, 10 s read timeouts in plain words                                                                                                                                                                                                           |
| U2  | partly | Marker-aware previews (`Blob 1.2 KB · image/png`, `Map of 3`, `Date 5 Nov 2026, 14:32`), "Copy as stored (JSON)". Phased: find still matches the stored JSON, the JSON view shows the stored form by design                                                                                                                                                                                                                                       |
| U3  | fixed  | Dates (Date markers, epoch with Show as date, zoned ISO in date columns) read in local time; the UTC text shows in Fields. Grid cells have no hover (no raw `title`)                                                                                                                                                                                                                                                                              |
| U4  | fixed  | Enter/F2/double-click on a read-only cell says why in the status bar; the pane opens only when it can edit more; HintTooltip on the lock                                                                                                                                                                                                                                                                                                          |
| U5  | fixed  | Hollow "Not watched" dot in the sidebar and header, "Watch this store" (the watcher adds it past the cap). The byte budget is phased with F1                                                                                                                                                                                                                                                                                                      |
| U6  | fixed  | One-time reads: "on the phone · read N ago", no live dot; live only for watched stores; the overview gets its read time                                                                                                                                                                                                                                                                                                                           |
| U7  | fixed  | "N databases in the list" or "This page keeps nothing in IndexedDB" with Open an export…, Local storage, SQLite. A fuller origin overview is phased                                                                                                                                                                                                                                                                                               |
| U8  | partly | Sidebar 200–360 px, record pane 280–560 px (px `sizeUnit`, keys bumped to v2). Phased: the drawer below ~900 px                                                                                                                                                                                                                                                                                                                                   |
| U9  | fixed  | One count (pager range, or "12 of 50 rows" while find/filters narrow), "This page only" chip, no live region on the bar, only search results announced                                                                                                                                                                                                                                                                                            |
| U10 | fixed  | Pane state text and the key icon off the mark colour; blob values off the category colour                                                                                                                                                                                                                                                                                                                                                         |
| U11 | fixed  | Row menus on Shift+F10, Menu key, right-click; record fields are one tab stop (↑/↓, Ctrl+C), copy buttons out of the tab order                                                                                                                                                                                                                                                                                                                    |
| U12 | fixed  | Cladd `SearchField` in Fields, `DataState` in Structure, one stores list with bars in the overview                                                                                                                                                                                                                                                                                                                                                |
| U13 | fixed  | No version on every row, distinct icons for clear vs forget, no "from a file" beside `imported`, no Space hint on the pane toggle, no toast per inline edit, a ticking change age. "On the phone" wording used for the IndexedDB tab's one-time reads                                                                                                                                                                                             |
| F1  | phased | Done: 8 s per store read, two retries then a feed message, stop and keep queued while paused (between stores and rounds), flush spacing max(1 s, 2 × last), prime waits for a screen. Remains: device `[key, hash, bytes]` snapshots with full values only for changed keys, and a byte budget instead of the 40-store count                                                                                                                      |
| F2  | fixed  | New Rust `host_file_stream_begin/append/finish/discard` (raw request body, `.part` file, 4 cargo tests) and `read_local_file_bytes`; export streams per chunk, no pretty-print, byte progress; "Save a copy…" streams too. `idbExportFile.test.ts`                                                                                                                                                                                                |
| F3  | partly | Chunks travel as JSON text parsed on the phone, byte-capped (S3); the file is read as raw bytes (no base64). Remains: reading and parsing the file in pieces                                                                                                                                                                                                                                                                                      |
| F4  | fixed  | Search in short transactions (200 records or 50 ms) resumed by key, cancelled on the phone on clear, new search or leaving. `packages/cdp-protocol/tests/indexeddb-search.test.ts`                                                                                                                                                                                                                                                                |
| F5  | phased | Pages still carry full values (1 MiB per value, 12 MiB per page caps stay); preview encoding plus `getRecord` on open is next                                                                                                                                                                                                                                                                                                                     |
| F6  | fixed  | Record pages `gcTime` 15 s                                                                                                                                                                                                                                                                                                                                                                                                                        |
| F7  | partly | Bounded marker-aware preview serialiser cached per value (`WeakMap`), find text cached per row, find debounced 150 ms. Remains: precomputed sort values                                                                                                                                                                                                                                                                                           |
| F8  | partly | A store's change map is stable unless its own changes change, so other stores no longer rebuild its grid. Remains: cached row ids / stable row objects across refetches                                                                                                                                                                                                                                                                           |
| F9  | phased | The pane still sizes by `JSON.stringify` and renders Fields eagerly                                                                                                                                                                                                                                                                                                                                                                               |
| F11 | phased | Opened files still measured once per file in full and searched synchronously (capped at 500 matches)                                                                                                                                                                                                                                                                                                                                              |
| F12 | partly | `requestData` only for another frame's origin (`IdbWrongOriginError`); counts already come from `getMetadata`. Remains: key-based paging ("Go to key")                                                                                                                                                                                                                                                                                            |

Found beyond the list and fixed:

- A delete that is still queued after a blocked replace is no longer reported as "nothing changed" (it left the database deleted later); it counts as an incomplete replace.
- `useIDB().useRecords` was dead code and was removed; catalog reads time out at 10 s.
- `DataGridStatus` announced every selection (`role="status"`); it no longer does, for SQLite too.

Pending live checks are listed in `data-parity.md` (IndexedDB, last section): the owner was using the
app during the whole fix round, so nothing was checked on the phone.
