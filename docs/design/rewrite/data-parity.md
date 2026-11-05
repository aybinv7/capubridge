# Data route parity

Route `/storage` (rail: Data, `g s`, `src/app/feature-registry.ts:68-78`), children IndexedDB, IndexedDB
Snapshot (hidden), Local storage, LocalForage, Cache, OPFS, SQLite, Graph. All render through
`GatedRouterView` (`StoragePanel.vue`).

Written before the rewrite from the code at `1399987d`. Paths are relative to
`apps/desktop/src/modules/storage/` unless they start with `src/`, `src-tauri/` or `packages/`
(`cdp:` = `packages/cdp-protocol/src/cdp/domains/`, `RS` = `src-tauri/src/commands/sqlite.rs`,
`OP` = `src-tauri/src/commands/opfs_pull.rs`, `DG` = `src/shared/components/data/grid/`).
After the rewrite each line is ticked with where it lives now (`→`). **MUTATES** marks an action that
writes to the phone. `⚠ Xn` points at a known bug in `data-plan.md` §6: the line is ticked when the
capability survives _and_ the bug is fixed or explicitly deferred there.

Tab merges and renames are decided in `data-plan.md` §3. A line of a merged tab is ticked with its new
home (e.g. "→ Key-value, LocalForage source").

## Shell of the route (`StoragePanel.vue`, `routes.ts`)

Round 1 owns the IndexedDB lines, the change-tracking line and the links into IndexedDB. Lines owned by
R2/R3 are unchanged and still work on today's code paths (marked _R2_ / _R3_).

- [ ] _R2/R3_ Sub-navigation tabs from route `meta.label`: IndexedDB · Local storage · LocalForage · Cache · OPFS · SQLite · Graph (`StoragePanel.vue:11`, `src/components/layout/SubNavTabs.vue`) — unchanged in R1; the merges land in R2/R3
- [x] `/storage` redirects to `/storage/indexeddb` → unchanged (`routes.ts`)
- [x] Route names `storage-indexeddb`, `storage-indexeddb-snapshot`, `storage-localstorage`, `storage-localforage`, `storage-cache`, `storage-opfs`, `storage-sqlite`, `storage-graph` → unchanged (`routes.ts`)
- [x] `indexeddb/:db?/:store?` and `indexeddb-snapshot/:db?/:store?` both render the IndexedDB tab; snapshot has `navigation: false` → both render `indexeddb/IndexedDBView.vue`; the file route carries `meta.tabPath` so the IndexedDB tab stays selected (`SubNavTabs.vue` `activePath`, `src/router/route-meta.d.ts`)
- [x] Gate `requires: "target"` on IndexedDB, Local storage, LocalForage, Cache, OPFS; none on Snapshot, SQLite, Graph → unchanged; the opened-file route stays ungated so an export opens with no phone
- [x] Target change remounts the tab; a lost link keeps it under the stale strip → unchanged (`GatedView.vue`)
- [x] App in background: gate notice strip only → unchanged; the change watcher now also pauses (`changes/useIndexedDBChangesTracking.ts` `paused`)
- [x] IndexedDB change tracking runs for the whole route ⚠ F2 → fixed: a lease (`useIndexedDBChangesLease`) held by the IndexedDB tab and Graph only, paused while the window is hidden or the app is in the background, one flush at a time, at most 40 stores watched plus any the person asks for ("Watch this store"), flushes spaced by max(1 s, 2 × last flush), 8 s per store read with two retries (`changes/indexeddbChangeTracker.ts`, tests in `changes/__tests__/indexeddbChanges.test.ts`). Round 1 fixes (P3): when the last holder leaves, the feed and baselines stay (reset only on target or origin change) and the watcher only listens (`indexeddbChangesLease.test.ts`); `StoragePanel.vue` no longer starts it
- [x] Palette `Go to Data` / `g s` → unchanged
- [x] No screen palette provider → IndexedDB registers `screen.storage` (group Data): Read IndexedDB again, Find rows (`mod+f`, only while the focus is in the tab and not in the record pane, P6), Show or hide the record pane (`indexeddb/useIdbCommands.ts`). "Open an IndexedDB export…" is app-wide (`useDataAppCommands.ts`, registered by `AppShell`) and the IndexedDB gate offers it beside its own actions (route meta `gateCommand`, `WorkbenchGate.vue`), landing on the ungated file route (P1). Other tabs: none yet (R2/R3)
- [x] Lazy route chunks per tab → unchanged

Inbound and outbound links that must keep working:

- [x] App › Overview "Data" links by route name → unchanged (`storage-indexeddb` still resolves)
- [ ] _R3_ Device › Files viewer opens a SQLite file in Data → unchanged
- [ ] _R3_ SQLite source badge "Show in OPFS explorer" → unchanged
- [ ] _R2_ OPFS file click → SQLite tab with the pulled copy → unchanged
- [x] Graph inspector "Open data" → `/storage/indexeddb/:db/:store` still opens the store (route shape kept); Graph now holds the change-tracking lease so its change badges keep working
- [x] Automation reads `useIndexedDBChangesStore().lastEventAt` ⚠ C33 → fixed: bumped only when a flush found changes made by the app, never for Capubridge's own writes (tagged `source: "capubridge"` through `noteOwnWrite` in `stores/useIndexedDBChangesStore.ts`) and never for empty flushes (tested). Round 1 fixes (P3): once IndexedDB or Graph has been opened, device events keep bumping it while another tab is shown (stores Capubridge wrote to in the last seconds excepted)
- [ ] _R2_ Session recorder shares `orderKeyColumns` and the SQLite pull cache ⚠ C37 → unchanged

## Cross-cutting state shared by the tabs

- [x] Selected origin per target, in memory (`stores/useStorageContextStore.ts`) → unchanged; written by `indexeddb/useIdbCatalog.ts` for live databases only, never a file id (⚠ C6), read by the change watcher
- [x] Query defaults `retry: 1`, `refetchOnWindowFocus: false`, `staleTime` 0 → unchanged; IndexedDB pages use `keepPreviousData`
- [ ] _R2_ CDP calls to a backgrounded app wait for the 30 s command timeout → unchanged (the IndexedDB watcher no longer re-reads while the app is backgrounded)
- [x] Every device script goes through `evaluateChecked` and host data enters only as `jsLiteral` — except IDB export/import ⚠ M8 → fixed: export and import run through `packages/cdp-protocol/src/cdp/domains/indexeddb-transfer.ts` (checked, literal)
- [ ] _R2_ OPFS snapshot cache in memory, keyed `targetId::path` → unchanged

## IndexedDB (→ `indexeddb/IndexedDBView.vue` on the Data frame `modules/storage/frame/`)

Not verified on the phone in this round: the Presalio app was closed and in the background, so the tab
stayed behind its gate. The pending live checks are listed at the end of this section.

### Sidebar (→ `frame/DataSourceTree.vue`, `indexeddb/idbTreeModel.ts`, `indexeddb/idbTreeActions.ts`)

- [x] Search databases and stores by name; "No stores match" → "Find a database or store"; matching stores open their database; "Nothing is named …" when nothing matches (`frame/dataTreeModel.ts`, tested)
- [x] Import button ⚠ M9 → split into honest actions (an opened file adds "Write it to the phone as a new database…" or "Replace … on the phone with it…", P2): the folder button "Open an IndexedDB export…" always opens the file read-only under "Opened files" (`useIdbDatabaseActions.openExport`); replacing is "Replace it from an export…" on a database's menu and replaces **that** database (M9 fixed)
- [x] Empty state "Import JSON snapshot" → the empty sidebar says why and offers "Open an export…"
- [x] "Back to live" in snapshot mode → both groups live in one sidebar ("On the phone", "Opened files"); clicking a live database leaves the file
- [x] Hidden databases Show/Hide toggle, persisted → one footer "N hidden · Show them / Hide them" for databases and stores, persisted per phone and app (`useDataSidebarSettings.showHidden`)
- [x] Hidden stores Show/Hide toggle, persisted → the same footer
- [x] Click database row → expand/collapse, persisted → the chevron expands and collapses (persisted); clicking the row opens the overview and expands it; ← / → on the keyboard
- [x] Database overview icon → clicking the database row opens its overview
- [x] Database menu: Pin/Unpin, Hide/Unhide → "Pin to the top" / "Hide from the list"
- [x] Database menu: Export database (JSON) ⚠ M8 F4 → "Export the database…": asks where first, then streams store by store to disk through `host_file_stream_*` (Rust, raw bytes, `<file>.part` renamed on finish and removed on cancel or failure), no pretty-print, progress in records and bytes, Cancel (F2, `idbExportFile.ts`); lossless (dates, binary, Blobs, Maps, Sets, BigInt as markers in a version 2 file); toasts `Exporting "<db>"`, `Exported "<db>"`, Cancelled, `Could not export "<db>"` (`useIdbDatabaseActions.exportLive`, `idbTransferToasts.ts`); an opened file offers "Save a copy…"
- [x] Database menu: Import database (replace) — **MUTATES** ⚠ M7 M9 → "Replace it from an export…": the confirmation names the chosen database, the file and its counts; the chosen database is replaced (not the one named in the file); Round 1 fixes: the file is written to a scratch database on the phone first (4 MiB chunks, large binary values in pieces), so a bad record or a cancel changes nothing (S3); only then is the database replaced and filled on the phone, Cancel goes away, and a failure says the database is incomplete with "Finish writing" / "Leave it". A lossy file lists every value it would not restore and needs the database name typed (S2). Blocked by the app → nothing deleted, a warning (`idbImport.ts`, `idbImportPlan.ts`; tests `indexeddb/__tests__/idbImport.test.ts`, `idbImportPlan.test.ts`, `packages/cdp-protocol/tests/indexeddb-staged-import.test.ts`, `indexeddb-safety.test.ts`)
- [x] Database menu: Clear DB changes → "Forget the change marks" (disabled with a reason when none)
- [x] Database menu: Delete database — **MUTATES** ⚠ M7 → "Delete the database…", confirmed; blocked by the app → a warning that the phone deletes it once the app lets go and that this cannot be cancelled; errors in a toast, never only the console (M7 fixed)
- [x] Snapshot: Remove snapshot → "Close the file" (asks; the file on disk is untouched)
- [x] Click store → opens it (`useIdbLocation.open`, named route params)
- [x] Store menu: Pin/Unpin, Hide/Unhide, keyed `db::store` without origin → keyed per phone, app and `origin::db` (`frame/useDataSidebarSettings.ts`); the old settings are read as a seed (tested)
- [x] Store menu: Clear changes → "Forget the change marks"
- [x] Store menu: Clear all records — **MUTATES** → confirmed; records and store details read again; errors in a toast
- [x] Store menu: Delete table — **MUTATES the schema** ⚠ M7 → "Delete the store…", confirmed (says the version goes up); blocked → nothing changed, a warning
- [x] Clear/delete store items and Clear changes hidden in snapshot mode → opened files only offer Save a copy and Close
- [x] Resizable sidebar 15 % (10–30), not persisted → 260 px (200–360 px), persisted per tab (`frame/DataWorkbench.vue`, U8)
- [x] Hidden databases `localforage`, `jeepSQLiteStore`, `jeepSqliteStore` always excluded → listed with their stores and a link row ("Read as key-value pairs in LocalForage", "Used by SQLite (jeep) · open in SQLite"), so no data is invisible
- [x] Active store auto-expands and scrolls into view → the open database is always expanded; the selected row is revealed (`DataSourceTree` `reveal`)
- New: virtualised rows, one tab stop with `aria-activedescendant`, row menus out of the tab order and opened by Shift+F10, the Menu key or a right-click (U11), a hollow "Not watched" dot on stores the watcher skips (U5), a database that cannot be opened listed with its error (P7), opened files pinnable and hideable, the open database collapsible (P4), change stripe with words on hover, record counts for the open database's stores

### Database overview (→ `indexeddb/IdbDatabaseView.vue` on `frame/DataOverview.vue`)

- [x] Name, origin, version → header title, identity line `origin · version N`, `live` provenance
- [x] Stats ⚠ C13 F16 → tiles Stores, Records, Indexes, "Size, estimated … of X used by IndexedDB" (only `navigator.storage.estimate`, F16 fixed); the size sample measures the encoded value (C13 fixed in the protocol); auto-increment per store in the list and in Structure
- [x] Top-10 bars by records and by size; click a bar → open store → one "Stores" list with a bar per store, sorted by records, size or name (`indexeddb/IdbStoresList.vue`, U12, P4)
- [x] Store table: Store, Key path, Records, Next key, Indexes, Auto-increment; click → open store → the "Stores" list
- [x] Index sub-rows → the store's Structure view (`indexeddb/IdbStructure.vue`): name, field, unique, one entry per list item
- [x] Refresh / Retry → "Read again" in the header; "Try again" on error
- [x] States → `DataState` loading, error with the device's words, "This database has no stores", "No size measured yet"

### Store toolbar (→ `indexeddb/IdbStoreView.vue` header, `frame/DataPager.vue`)

- [x] Change badge toggles "changes only" → `frame/ChangeSummary.vue` in the header (+ ~ − with words on hover)
- [x] Page size 50 / 100 / 500, clamped → `DataPager` "N a page"
- [x] Previous / next page → `DataPager`; range "51–100 of 1,234"; far pages are flagged as slow (⚠ F3, see the plan)
- [x] Refresh → "Read again" (page) and the palette's "Read IndexedDB again" (databases, store details, page)

### Table actions (→ `indexeddb/IdbRowsToolbar.vue`)

- [x] "Search all columns…", current page only ⚠ C8 C10 → "Find on this page" searches every column, objects included (C10 fixed); the status bar says find, filters and sort cover the rows of this page; "Search the whole store" runs a bounded scan on the phone (500 matches, 50,000 records, 4 s) and says what it covered (C8 fixed)
- [x] Filter builder popover → "Filter" opens `src/shared/components/data/filter/DataFilterPopover.vue`
- [x] Clear filters → "Clear filters" in the popover and "Clear find and filters" in the empty grid
- [x] Copy selected as JSON → grid context menu "Copy as JSON" on the selection (`DataGrid`)
- [x] Delete selected — **MUTATES** ⚠ M12 → "Delete N selected" (asks), only shown when the store can be written (M12 fixed)
- [x] Clear selection → Escape in the grid
- [x] Column settings → `DataGridColumnsMenu`
- [x] Layout menu: Auto-size, Fit to grid, Reset layout → header menu "Autosize all"; the grid fills its width; unpin per column; pins and widths now persist per store (`useGridColumns` `layoutKey`)
- [x] Export menu ⚠ C8 → "Rows shown, as CSV…", "Rows shown, as JSON…", "N selected, as JSON…" through the save dialog (`idbRowsExport.ts`, `saveFileAs` in `src/lib/download.ts`); file names `<db>_<store>_page2.csv`

### Filter builder (→ `src/shared/components/data/filter/`)

- [x] Add filter, AND/OR, column, operator, remove, Cancel, Apply → the same, edited as a draft: closing drops it (C9 fixed). One AND/OR for all conditions, and a column's filter is cleared by removing its condition in the popover (deliberate, P4: it filters one page)
- [x] Operators ⚠ C9 → the same 14 plus "is not", offered by column type; numbers and dates compare as such (`predicates.ts`, tested)
- [x] Value: date picker for gt/gte/lt/lte/equals ⚠ C9 → the value field follows the column type (date, number, text); text and number equality work

### Column settings (→ grid header menu, `DataGridColumnsMenu`)

- [x] Show/hide per column → columns menu and header "Hide"
- [x] Group by per column → header "Group by", page-local (`idbRowPipeline.groupRows`, tested); a group row opens with Enter or double-click
- [x] Column type guessed, primary-key and indexed marks → type from up to 50 values per field (`idbGridModel.ts`), key marked, indexed fields labelled

### Table (→ `DataGrid` in `indexeddb/IdbRows.vue`, model `indexeddb/idbGridModel.ts`)

- [x] Columns ⚠ C12 → union of fields over the page (C12 fixed, tested); a separate key column only when the key is not one top-level field
- [x] Cells ⚠ C14 → markers shown as what they are ("Map of 3", "Blob 1.2 KB", dates as dates; `valueFormat.describeMarker`); row ids from the serialised key (C14 fixed, tested)
- [x] Select all / row checkbox; deleted rows not selectable → gutter selection, Shift/Ctrl, Ctrl+A; deleted rows are never deleted again
- [x] Header menu sort ⚠ C8 → page-local sort, said by a "This page only" chip in the status bar (U9); numbers and dates by value. Multi-column sort is not restored: sort covers one page of 50–500 rows (deliberate, P4)
- [x] Header menu: Filter… → opens the filter popover on that column
- [x] Header menu: Group by → page-local grouping
- [x] Header menu: Pin / Hide → `DataGrid`
- [x] Column resize by drag → `DataGrid`
- [x] Group rows → rows per value with counts; "Show the rows in this group" adds the filter
- [x] Single click opens row detail after 200 ms … → the record pane follows the focused row (no dialog, no click timing); Enter, F2 or double-click edits the cell, and on a read-only cell says why in the status bar (U4)
- [x] Virtualised rows, skeleton → `DataGrid`
- [x] Row appearance → `added` / `updated` / `deleted` row states with a bar (`GridRowState`)
- [x] Footer `filtered / total rows`; "Copy selected as JSON" icon that downloaded → status bar count and pager range; the misnamed icon is gone (Export menu)
- [x] Empty → "“store” has no records", "No row on this page matches", "Nothing in “store” matches"

### Inline cell editor (→ `src/shared/components/data/grid/editors/`, `IdbRows.vue`, `useIdbStoreWrites.ts`)

- [x] Commit — **MUTATES** ⚠ M2 M3 M6 → a cell edit changes that one field on the phone (`patchRecord`), so dates or binary data elsewhere in the record are kept; only primitive cells edit inline (objects in the pane); an empty cell edits as its column (number, boolean, a date in the column's own form, S5); no toast per inline edit (U13); writes wait while a previous page is on screen (S1) or the app is away (U1)
- [x] Key column and deleted rows not editable → the same, and the pane says why
- [x] Enter commits, Escape cancels, blur commits ⚠ M6 → blur commits only a real change; an unchanged value writes nothing; typed text keeps its type (M6 fixed, tested)
- [x] Numbers: ↑/↓ and ± buttons → ↑/↓ in the editor (the ± buttons are gone)
- [x] Dates ⚠ M5 → native date field on the local calendar; time of day, unit and format kept (M5 fixed, tested in Africa/Algiers)
- [x] Column treated as date by name ⚠ M6 → by value only (ISO text), or a number column shown as dates with "Show values as"

### Context menu (→ `IdbRows.contextActions`, `DataGrid` built-ins)

- [x] View record → "Show in the record pane"
- [x] Edit "<column>" → the same
- [x] Copy cell value → "Copy"
- [x] Copy record as JSON → "Copy the record as JSON"
- [x] Delete record — **MUTATES** ⚠ M4 C14 → "Delete the record…", asks first (M4 fixed); date and binary keys reach the phone as real keys (C14 fixed in the protocol, tested)

### Row detail dialog (→ `frame/RecordPane.vue`, `indexeddb/useIdbRecordPane.ts`)

- [x] Header: key, size, i / total, badges → key, "i of n · size", "Not saved", invalid JSON, read-only reason with a lock
- [x] Prev / Next and Ctrl+↑ / Ctrl+↓ ⚠ C11 → follow the order shown; at a page edge they turn the page (C11 fixed)
- [x] JSON editor; Ctrl+F → `JsonEditor` under "Edit" / "JSON"; the tab's Ctrl+F leaves the pane alone
- [x] Save and Ctrl+S — **MUTATES** → Save and Ctrl+S, only for a valid change; a read-only record never saves (M2); a key moved onto another record's key asks before replacing it (S4, `IdbKeyConflictError`)
- [x] Delete — **MUTATES** ⚠ M4 → Delete asks first (M4 fixed)
- [x] Copy → "Copy the record as JSON"
- [x] Diff button → "Changes" view
- [x] Shortcut hint popover → tooltips with key caps on each control
- New: while an edit is unsaved the pane stays on that record; closing it, paging, page size, store search, Rows/Structure and leaving the store ask "Discard changes to record X?"; Escape in the JSON filter clears it and stays in the editor; Ctrl+F in the pane finds in its Fields or JSON (S6, P6)

### Change diff dialog (→ "Changes" view in `RecordPane`, `src/shared/code-viewer/JsonDiff.vue`)

- [x] Store, operation, key, observed at; before vs current → the pane's state line ("Changed on the device 12 s ago" or "by Capubridge") and the before/after diff; `JsonDiff` moved to `src/shared/code-viewer/` and SQLite imports it from there (no cross-tab import)

### Write toasts (`indexeddb/idbWrites.ts`)

- [x] "Record is read-only", "Record saved on the device", "Record was not saved" → unchanged, also for cell edits
- [x] Delete toasts → unchanged
- [x] Toasts fire only after the device answers → unchanged, tested

### Change tracking (→ `changes/useIndexedDBChangesTracking.ts` lease, `changes/indexeddbChangeTracker.ts`)

- [x] Subscribes `Storage.trackIndexedDBForOrigin`, listens for updates → unchanged
- [x] Primes every store sequentially ⚠ F2 → at most 40 stores primed; the rest are marked "Not watched"
- [x] Flush throttle 220 ms, catalog debounce 180 ms → unchanged; one flush in flight, a request during a flush runs once after it (tested)
- [x] Bounds 1,500 / 250 / 400 / 64 → unchanged
- [x] Stale sessions dropped → one tracker per session, stopped when the target or origin changes
- [x] Changed records promoted ⚠ M3 → promoted rows keep the live record (primary key, read-only flag); off-page and deleted ones are read-only (M3 fixed, `overlayRecordChanges`, tested)
- [x] Sidebar change gradient and segment bar → `frame/ChangeStripe.vue`, with words

### States

- [x] No target → gate
- [x] Database list loading → `DataState` in the sidebar
- [x] "No IndexedDB databases found" / "No snapshots imported" → "This page has no IndexedDB databases." / "No export is open.", with "Open an export…"
- [x] Database list error ⚠ C34 → shown with the device's words and Try again (C34 fixed: the protocol throws); one database that cannot be opened no longer fails the list (P7)
- [x] "Select a database from the sidebar" → "N databases in the list" when there are some, "This page keeps nothing in IndexedDB" with Open an export…, Local storage and SQLite when there are none (U7); a missing database or closed file says so, with a way back that stays on the file route without a phone (P1)
- [x] Records error → `DataState` error with the device's words and Try again; a failed read again while rows show keeps them under a compact error (P5); app in the background → "Waiting for the app" with Bring to front, reads paused and run again on return, 10 s read timeouts in plain words (U1)
- [x] Page change blanks the table → the previous page of the same store stays while the next is read, never another store's (S1, `keepsPreviousPage`, `__tests__/useIdbPage.test.ts`), a quiet spinner in the header
- [x] Paging ⚠ F3 → offset paging unchanged; far pages say they are slow; "Go to key" deferred (plan §6.3 F3)
- [x] Records read through `requestData` ⚠ M2 F1 → one `Runtime.evaluate` per page (F1 fixed, tested), `requestData` with one batched encode as the fallback; non-JSON values are read-only with a reason (M2 fixed, tested)
- [x] Read-only when a Date or binary is anywhere → any marker in the value makes whole-record saves read-only, naming the type and field; Date and binary keys stay editable; cell edits still work on plain fields
- [x] After save/delete only records refetch → records and store details are read again
- [x] No polling → unchanged

### Snapshot mode (→ "Opened files" in the same tab, route `storage-indexeddb-snapshot`)

- [x] Mode chosen by route name; `:db` is the file id → unchanged (`useIdbLocation`)
- [x] Data from the file; sizes by `jsonByteSize` of every record ⚠ F15 → measured once per file (`fileStoreInfo`), file kept raw in a `shallowRef` store (F15 fixed)
- [x] `ProvenanceTag kind="imported"`; live shows none → `imported` on every opened database and store; a watched store shows `live · read N s ago`, a one-time read `on the phone · read N s ago` without the live dot (U6)
- [x] Writes refused → nothing writable is offered on a file (no edit, no delete, read-only lock "Opened from a file")
- [x] In memory only → unchanged (persisting is out of scope, plan §8)
- [x] Reachable only by URL ⚠ C7; live queries for the snapshot id ⚠ C6 → "Opened files" group, the folder button and the palette's "Open an IndexedDB export…" (C7 fixed); live queries run for live databases only (C6 fixed)

### Persisted preferences

- [x] `localStorage["idb-sidebar-settings"]` → `capubridge:data-sidebar:v1` keyed `serial::package::indexeddb::origin::db`; the old key is moved under the new one once and removed (P7, tested); `useSidebarSettingsStore.ts` is gone. SQLite keeps `sqlite-sidebar-settings` until R3
- [x] Not persisted → column pins and widths per store (`capubridge:grid-layout:*`), "Show values as" (`capubridge:data-show-as:v1`), panel sizes in pixels (`capubridge:data-layout:v2:indexeddb`, `capubridge:data-record-pane-size:v2`), pane open (`capubridge:data-record-pane`), Fields/JSON (`capubridge:inspector-view`); sort, filters and page size stay per visit

### URL

- [x] Extra `decodeURIComponent` ⚠ C5 → params used as vue-router decodes them; navigation by named route (C5 fixed for IndexedDB; SQLite in R3)
- [x] Selected database by name + origin, then name; origin written back → unchanged (`useIdbCatalog`)
- [x] Page, filter and changes-only reset on database/store change → unchanged
- [x] After delete → a deleted database goes back to `/storage/indexeddb`; a deleted store to its database's overview

### Import / export formats (→ `indexeddb/idbImportExport.ts` on `indexeddb-transfer.ts`)

- [x] Format → version 2 adds `encoding: "capubridge-markers-v1"` and `lossy`; version 1 files still open, and a replace from them asks to accept the loss
- [x] File `<db>.idb.json` through the save dialog → unchanged
- [x] Import checks `format` only → checks format and version and reports what a replace would lose
- [x] Table CSV / JSON / selected JSON → the save dialog (`saveFileAs`)

### Pending live checks (IndexedDB, Presalio on the Redmi)

- [ ] A Dexie database with Date fields: dates shown as dates, the record read-only with its reason, a plain field edited inline keeps the Date
- [ ] A 10k+ store paged to the end; whole-store search caps
- [ ] Deleting a store while the app holds the connection (blocked: nothing changed)
- [ ] Grid pinning and group drill-in by keyboard (left unverified by `26f17f88`)
- [ ] Row and header menus (inside the tooltip wrapper) open by click and by keyboard
- [ ] First paint of the frame: sidebar, header, pane widths, empty states, dark and light
- [ ] Round 1 fixes, not checked live (the owner was using the app during the fix round): pixel pane sizes, "Waiting for the app" and Bring to front, the gate's "Open an IndexedDB export…", a streamed export of a real database opened back, a replace through the scratch database on the phone (with a test database, never the app's), "Not watched" / "Watch this store", Shift+F10 row menus, the discard question on paging, local dates in cells

## Local storage (`localstorage/LSExplorer.vue`)

- [ ] Origins sidebar from `Page.getFrameTree` security origins (main page + iframes); `DOMStorage.enable` per fetch (`LSExplorer.vue:379-392`, `cdp:storage.ts:28-51`, `src/composables/useStorage.ts:26-29`)
- [ ] Select origin → `storageContextStore.setSelectedOrigin` (also retargets IndexedDB change tracking) (`:42-45,197-199`)
- [ ] First origin auto-selected when none (`:355-359`)
- [ ] Filter "Filter keys or values…", substring on key or value (`:169-176,414-418`) ⚠ F10
- [ ] Count "(N entries)" of the filtered list (`:420-422`)
- [ ] "New Key" → create dialog (`:272-281,424-426`)
- [ ] "Refresh" → refetch origins and entries (`:218-221,427-429`)
- [ ] Table Key / Value / Size / actions, virtualised (`:451-454`, `useFixedVirtualList`)
- [ ] Size = UTF-8 bytes of the value (`:314-317,478`)
- [ ] Double-click row, FileCode or Pencil → edit dialog (`:465,488,504`)
- [ ] Row Copy (`:496`, `copyValue :223-228`) ⚠ C26
- [ ] Row Trash → confirm "Delete Entry" "Are you sure you want to delete `<key>`? This cannot be undone." → `DOMStorage.removeDOMStorageItem` — **MUTATES**; error only `console.error` (`:201-216,658-677`, `cdp:storage.ts:60-65`) ⚠ C28
- [ ] Save (edit/create) only by Ctrl+S → `DOMStorage.setDOMStorageItem` — **MUTATES**; JSON pretty-printed before write; inline "Failed to save: …" (`:283-312,640-644`, `cdp:storage.ts:67-73`) ⚠ C27 M11
- [ ] Rename (delete then set) — unreachable (`:299-302,628-634`) ⚠ C27
- [ ] Dialog: key title, original-value size, type chip json / number / date / boolean / string (`inferType`), Invalid / Unsaved badges (`:76-106,161-165,188-193,554-577`) ⚠ C29
- [ ] Dialog: Prev / Next, Copy, shortcut hint (`:537-550,581-622`)
- [ ] Keys while the dialog is open: Ctrl+F filter, Ctrl+↑/↓ prev/next, Ctrl+S save (`:321-346`); prev/next/close discard edits without asking (`:247-270,348-353`)
- [ ] States: origins spinner, "No origins found" (`:368-377`); "Select an origin from the sidebar" (`:401-406`); entries spinner (`:433-435`); "Failed to load" / "No LocalStorage entries" without error text (`:436-444`)
- [ ] sessionStorage not supported (`isLocalStorage: true`, `cdp:storage.ts:55,62,69`)
- [ ] All entries in one `getDOMStorageItems` call (`cdp:storage.ts:53-58`); no live DOMStorage events
- [ ] No persisted preferences, import/export, sort or context menu

## LocalForage (`localforage/LocalForageExplorer.vue`)

Same screen as Local storage (about 600 of 668 lines duplicated, `data-plan.md` §2.3). Differences:

- [ ] Origins: `[location.origin]` when an IndexedDB database named `localforage` exists, else `[]` (`cdp:localforage.ts:26-44`) ⚠ C30
- [ ] Selected origin in a local ref, not the store; has no effect on reads/writes (`LocalForageExplorer.vue:38,183-185`, `cdp:localforage.ts:46,129,133`)
- [ ] Reads: page `localforage` global (`keys()` + `getItem`) or raw IDB `localforage/keyvaluepairs` `getAll` + `getAllKeys`, everything in one `Runtime.evaluate` (`cdp:localforage.ts:63-111`) ⚠ F9
- [ ] Values shown as JSON text; Date, Blob, BigInt, ArrayBuffer, Set, Map become `{__type}` placeholders (`cdp:localforage.ts:50-61`) ⚠ M10
- [ ] Delete → confirm → `mutate("delete")` (`removeItem` or IDB `store.delete`) — **MUTATES**; error toast `Could not delete "<key>"` with the error (`:192-202`, `cdp:localforage.ts:133-180`)
- [ ] Save by Ctrl+S → `mutate("set")` (device `JSON.parse` with string fallback, `setItem` or IDB `put`) — **MUTATES** (`:269-298`, `cdp:localforage.ts:129-175`) ⚠ C27 M10
- [ ] Rename sets new then deletes old — unreachable (`:284-288`)
- [ ] Empty text "No LocalForage entries" (`:419-430`)
- [ ] The `localforage` IndexedDB database is hidden from the IndexedDB tab (`indexeddb/IDBExplorer.vue:292`)

## Cache (`cache/CacheExplorer.vue`)

- [ ] Cache names from `caches.keys()` (`cdp:storage.ts:88-107`)
- [ ] Click cache name → expand; single child "View entries" → select and load (`CacheExplorer.vue:61-71,110-136`)
- [ ] Entries from `caches.open(name).keys()` → `{ url, method, cacheName }` (`cdp:storage.ts:109-135`)
- [ ] Filter in the sidebar "Filter by URL or type…" filters the entries table on URL or method (`:42-48,84-93`)
- [ ] "Refresh" → names and entries (`:73-76,162-165`)
- [ ] Table URL / Method; count ignores the filter (`:158-160,178-179`) ⚠ C31
- [ ] Row click highlights only; no detail, headers or body (`:56-59,189`) ⚠ C31
- [ ] States: names spinner (`:95-97`), "No Cache API caches found" for empty and error (`:99-105`), "Select a cache from the sidebar" (`:147-152`), entries spinner (`:169-171`), empty/error → empty table (`:173`)
- [ ] Read-only today; `CacheAPIDomain.deleteCache` / `deleteEntry` exist but are not wired (`cdp:storage.ts:137-162`)

## OPFS (`opfs/OPFSExplorer.vue`, `opfsSnapshotCache.ts`, `useOpenSqliteSource.ts`)

- [ ] Start path from `?path=` once at mount (`OPFSExplorer.vue:36`) ⚠ C32
- [ ] Up, root "opfs:/", breadcrumb segments (`:190-212,228-245`)
- [ ] Raw files / Decoded DBs toggle when a SAH-Pool directory is inspectable (`:249-270`)
- [ ] Refresh → directory only (`:271-278`)
- [ ] Detected storage tech chips with tooltip (description, package, evidence) from `detectStorageTechs` (`:282-317`, `cdp:opfs.ts:97-236`)
- [ ] Filter "Filter…" on name/kind (sidebar and table) and on logical path / opaque name (decoded view) (`:68-84,326-330`)
- [ ] Click directory → navigate (`:167-173,367,482`)
- [ ] Click `.sqlite/.sqlite3/.db/.db3` → `openOpfsDatabase`: `opfs_stat_file`, cache hit or `opfs_pull_sqlite` (Rust, 8 MiB base64 chunks over its own WebSocket into `%TEMP%`), `adoptLocalSession`, push `/storage/sqlite/<file>`. Toasts `Opening "<label>"…`, `Reading "<label>" — X of Y` (event `capubridge:opfs-pull-progress`), `Opened "<label>" in SQL Explorer`, "Failed to open in SQL Explorer" (`:174-177`, `useOpenSqliteSource.ts:34-97`, `OP:243-332`)
- [ ] Click decoded SAH-Pool row → open opaque file with `stripSahPool: true` (`:182-188,431`)
- [ ] Click other file → highlight only, no preview (`:179`) ⚠ C32
- [ ] Row Download button — no handler (`:519-526`) ⚠ C32
- [ ] Row Delete (files) → `OPFSDomain.deleteEntry` (`removeEntry(name, { recursive: true })`) — **MUTATES**, no confirm, toast or catch (`:214-219,527-535`, `cdp:opfs.ts:288-320`) ⚠ M4
- [ ] Sidebar: icon, name, size (`:358-374`); table: Name + badges sqlite/journal/wal/shm/sah-pool, Type, Size, Modified (`:122-138,466-513`)
- [ ] Decoded view: Logical path, Opaque file, Data size, Flags (hex), Modified (`:416-450`, `cdp:opfs.ts:455-507`)
- [ ] States: spinner (`:334-336`), "Failed to load OPFS" (`:338-344`), "Empty directory" (sidebar only, `:346-351`), "Decoding SAH-Pool headers…", "Failed to decode SAH-Pool. The directory may not be in pool format.", "No live databases inside this pool (all slots empty)." (`:389-408`)
- [ ] `listDirectory` stats every file sequentially, no paging (`cdp:opfs.ts:254-270`) ⚠ F11

## SQLite (`sqlite/SqliteExplorer.vue` and children)

### Sources and opening

- [ ] Native databases: `sqlite_list_databases` (`run-as <pkg> ls -la /data/data/<pkg>/databases`, skips -wal/-shm/-journal) when an adb target of the selected device is selected (`RS:441-500`, `SqliteExplorer.vue:132-143,426-430`)
- [ ] jeep-sqlite databases from IndexedDB `jeepSQLiteStore`/`jeepSqliteStore` → `databases`, path `jeep-sqlite:<idb>/<store>/<key>` (`cdp:jeep-sqlite.ts:22-117`, `SqliteExplorer.vue:389-409`)
- [ ] OPFS databases: one-evaluate walk (5,000 entries, depth 8), tagged `sqlite-wasm-opfsdb`, `wa-sqlite-opfs`, `sqlite-wasm-sah-pool` (`cdp:opfs-sqlite-discovery.ts:22-139`, `sqlite/useOpfsSqliteDiscovery.ts:15-35`)
- [ ] Imported file: Upload / empty-state button → Tauri open (sqlite, db, db3, sqlite3) → `sqlite_save_local_bytes` temp copy, magic checked (`sqlite/sqliteImportExport.ts:138-149`, `src/stores/sqlSession.store.ts:45-85`, `RS:1074-1114`). Toasts "Could not read file", `Opened "X" as a local session`, "Import failed"
- [ ] Lists merged with `Promise.allSettled`; failed WebView sources kept as unreachable (`SqliteExplorer.vue:427-433`, `sqlite/sqliteDatabaseList.ts:43-81`)
- [ ] Rediscovery when the DevTools link comes up or the app returns to the foreground (`sqlite/useSqliteRediscovery.ts:24-46`)
- [ ] Native open: `sqlite_open_database` (forced pull via `run-as cat` → `/data/local/tmp` → `adb pull` → `rm`, -wal/-shm best effort, read-only connection, `COUNT(*)` per table and view) (`RS:296-383,504-562`) ⚠ F5 C15
- [ ] OPFS open: see OPFS tab; jeep open: `readDatabaseBytes` (whole file in one evaluate) → `startLocalSession` (`cdp:jeep-sqlite.ts:259-349`, `SqliteExplorer.vue:536-558`) ⚠ C35. Toast "Failed to open jeep-sqlite database"
- [ ] Local session dropped and route reset when `cdpTargetId` changes (`SqliteExplorer.vue:379-387,412-420,851-858,1460-1470`)
- [ ] Columns/indexes/FKs from the live phone database through `run-as sqlite3` when present, else from the copy (`RS:575-795`) ⚠ C20

### Sidebar

- [ ] Search database names/paths and tables of expanded databases (`SqliteExplorer.vue:1490,597-630`) ⚠ C23
- [ ] Import `.sqlite` (`:1495-1501,1571-1577,1200-1219`)
- [ ] Show/Hide hidden databases and tables banners (`:1504-1534`)
- [ ] Expand/collapse database, persisted (`:1603-1611`)
- [ ] Click database → `navigateToDb` (`:1612-1619,560-577`)
- [ ] Database row: name, source badge (native / opfs / sah-pool / wa-sqlite / jeep / file) with tooltip (title, description, npm package, OPFS path, jeep store), size in KB, "app in background" label, opening spinner, change stripe (`:1591-1641`, `sqlite/sqliteSources.ts:3-49`, `SqliteSourceBadge.vue:24-58`) ⚠ C24
- [ ] Database menu: Pin/Unpin, Hide/Unhide (`:1656-1669`)
- [ ] Database menu: Export .sqlite file (`:1671-1674`) ⚠ C16 C15
- [ ] Database menu: Export SQL dump (`:1675-1678`) ⚠ C16 C19
- [ ] Database menu: Import SQL dump (replace), writable only — local copy (`:1679-1685,1221-1260`) ⚠ M13 M1
- [ ] Database menu: Clear DB changes (`:1687-1695`)
- [ ] Database menu: Delete database, writable only — **MUTATES** for jeep (IDB delete) and OPFS (`removeEntry`, then SAH-Pool header release, then `about:blank` force-release of the local WebView) (`:1697-1704,1262-1292,1075-1154`, `cdp:jeep-sqlite.ts:120-176`, `cdp:opfs.ts:288-320,568-615`) ⚠ M1. Confirm `Permanently delete <source>? This removes it at the source and cannot be undone.`; toasts "Delete failed", `Deleted "X"`, "Released SAH-Pool slot — …", "Cleared SAH-Pool header via writable handle — …", "Force-released via about:blank — source webview restored.", "Failed to restore source webview"
- [ ] Click table → `navigateToTable` (`:1736-1739,579-581`); row: pin dot, name, row count, change stripe (`:1724-1753`)
- [ ] Table menu: Pin, Hide, Clear changes (`:1766-1794`)
- [ ] Table menu: Clear all rows, writable only — `DELETE FROM` on the local copy; confirm `Delete every row in "T"? This cannot be undone.`; toast `Cleared "T"` (`:1796-1803,998-1016`)
- [ ] Table menu: Drop table, writable only — local copy; confirm `Permanently drop the table "T" and all its data? …`; toast `Dropped "T"` (`:1804-1811,1018-1039`)
- [ ] Failure toast for confirmed actions "Action failed" (`:969-977`); read-only guard toast "This database is read-only here" (`sqlite/browse/sqliteWriteAccess.ts:34-38`)
- [ ] Source badge "Show in OPFS explorer" (`SqliteSourceBadge.vue:46-53`)
- [ ] Empty: "No target selected" / "Pick a debuggable app target — or import a .sqlite file to explore", "No SQLite databases found" / "The selected target package does not expose databases/" (`:1556-1578`); error + Retry (`:1542-1554`); spinner (`:1538-1540`)
- [ ] Resizable layout persisted `capubridge:sqlite-explorer` (`:1477`)

### Database overview (`sqlite/SqliteDatabaseOverview.vue`)

- [ ] Name, size, package; stats Tables, Views, Rows (tables + views), Size (`:22-28,93-120`)
- [ ] Top-10 "By row count" bars, click → table (`:157-161`)
- [ ] Table list with expandable CREATE SQL, click → table (`:212-227,268-284`)
- [ ] Refresh → `handleRefresh(true)` (`:83-89`)
- [ ] "No tables found" (`:142-148`); loader (`:125-127`); error state never fed (⚠ C21)

### Table view tabs

- [ ] Browse · Structure · SQL, reset to Browse on route change (`SqliteExplorer.vue:1857-1897,1360`)
- [ ] Table toolbar: `table · db`, `N rows`, change badges toggle changed-only, page size 50/100/500, prev/next (limit+1), refresh (`sqlite/SqliteTableToolbar.vue:37-138`, `SqliteExplorer.vue:513-521`)

### Browse (`sqlite/browse/*`, DataGrid)

- [ ] SQL WHERE bar: Enter applies, Esc reverts, × clears; error under the bar (`SqliteFilterBar.vue:22-76`)
- [ ] Search all columns, debounced 250 ms, `CAST(col AS TEXT) LIKE … ESCAPE '!'` (`SqliteBrowseToolbar.vue:23-30`, `sqliteQuery.ts:122-127`) ⚠ F8
- [ ] Group chip clears grouping (`SqliteBrowseToolbar.vue:65-76`)
- [ ] Columns menu (`:77`)
- [ ] Export popover: all / rows matching the filter / selected × CSV / JSON / SQL INSERT; toasts `Exported N rows`, "Export failed" (`:78-119`, `useSqliteTableQuery.ts:157-184`, `SqliteBrowse.vue:223-237`)
- [ ] Header menu: sort asc → desc → none (server), Filter (11 operators + preview, `SqliteColumnFilter.vue:14-59`), Group by (server `GROUP BY … COUNT(*)`), Show as (persisted), Hide, Pin left/right, Autosize all, Copy name ("Copied column name") (`DG DataGridHeaderCell.vue`, `useSqliteTableQuery.ts:107-147`, `SqliteBrowse.vue:131-137`)
- [ ] Grouped view: Enter / double-click / "Show the rows in this group" drills in (`SqliteBrowse.vue:163-166,215-217`)
- [ ] Row context menu: Copy, Copy with header, Copy as JSON; Filter equals / not this value / is NULL / is not NULL; "Show what the device changed" (diff dialog); "Copy row as INSERT" / "Copy N rows as INSERT" (toasts "Copied INSERT", "Copied N INSERT statements", "Could not copy"); "Delete row(s)" writable only (`SqliteBrowse.vue:163-213`, `DG DataGrid.vue:478-484`)
- [ ] Delete rows: needs a primary key ("Cannot delete" / "Table has no primary key."); confirm `Permanently delete N row(s)? …`; local copy; toast `N row(s) deleted` (`SqliteExplorer.vue:1306-1352`)
- [ ] Inspector (Space or status-bar button; persisted `capubridge:sqlite-inspector`): Fields / JSON (persisted `capubridge:inspector-view`), field search, copy field ("Copied value"), copy row ("Copied row as JSON"), FK link (`SqliteBrowse.vue:239-259,352-363`, `DG DataGridInspector.vue`)
- [ ] Grid keys: arrows, PageUp/Down, Home/End, Tab, Ctrl+arrows, Shift range, Space inspect, Delete, Esc, Ctrl+A, Ctrl+C, Ctrl+Shift+C; gutter Shift/Ctrl (`DG gridKeys.ts:27-51`, `DataGrid.vue:195-207`)
- [ ] Recently changed rows highlighted (`SqliteBrowse.vue:85-92`)
- [ ] Status bar: x of y rows, selection, Σ/avg/min/max, nulls, groups, read-only lock, `ProvenanceTag`, query ms, inspector toggle (`SqliteBrowse.vue:344-364`)
- [ ] Empty: `"T" has no rows`, "No rows loaded", "No rows match … and the search …" + "Clear filters" (`SqliteBrowse.vue:307-330`); skeleton (`DG DataGrid.vue:462-469`)
- [ ] Read-only reasons: native "Native Android databases are read-only: they are pulled to this computer as a copy."; others "Read-only for now: this is a copy pulled from the device, and edits are not written back to it yet."; no-PK "This table has no primary key, so rows cannot be addressed." (`sqliteWriteAccess.ts:13-22`, `SqliteBrowse.vue:100-109`)
- [ ] Cell edit and add row: not implemented (grid emits `edit`, unhandled)

### Structure

- [ ] Columns (#, Column, Type, Not null, Default, PK n), Indexes (Name, Unique, Columns), Foreign keys (From, →, To, On update, On delete; target opens the table), CREATE statement (`SqliteExplorer.vue:1943-2112,308-336`)
- [ ] "Loading structure…", error box, "No columns reported." (`:1946-1959,2019`)

### SQL

- [ ] Textarea seeded `SELECT * FROM "T" LIMIT 100;`, Run, "Running…", inline error, "N row(s)", results in `VirtualDataTable`, "Run a query to see results." (`SqliteExplorer.vue:2114-2157,338-373,1368`) ⚠ C25
- [ ] Only SELECT on the current table (client regex), read-only connection (`:343-357`)

### Refresh, polling and change tracking

- [ ] Refresh: native `sqlite_refresh_database` + `sqlite_export_bytes` + diff + `openDb`; OPFS hash + read + diff + overwrite + stat; jeep hash + read (`SqliteExplorer.vue:848-947`) ⚠ F5 F7
- [ ] Background poll every 5 s, always on: native `sqlite_stat_database`, OPFS `opfs_stat_file`, compare and refresh when changed (`:952,740-816`, `RS:410-439`) ⚠ F6 C15
- [ ] Snapshot diff with sql.js into the changes store (1,000 cap), change overlay and stripes (`sqlite/diffSqliteSnapshots.ts`, `stores/useSqliteChangesStore.ts:10`, `changes/useSqliteChangeOverlay.ts`)
- [ ] Diff dialog: table, operation, row key, observed at, before/after (`sqlite/SqliteChangeDiffDialog.vue`)
- [ ] System change messages ("Snapshot diff truncated", "Change tracking unavailable … no primary key", Cleared/Dropped/Deleted) recorded but not shown here

### Persisted preferences and URL

- [ ] `localStorage["sqlite-sidebar-settings"]`: pinned/hidden databases and tables, showHidden flags, expanded databases, keyed by path (`stores/useSqliteSidebarSettings.ts:3,50-69`)
- [ ] `capubridge:sqlite-explorer`, `capubridge:sqlite-inspector`, `capubridge:sqlite-show-as` (`"<db>/<table>"`), `capubridge:inspector-view`
- [ ] `:db` / `:table` carry names, decoded twice (`SqliteExplorer.vue:170-174`) ⚠ C5 C22
- [ ] Deep link / reload re-opens native databases; OPFS/jeep re-pull; imported sessions are lost (`:1395-1458,466-468`)

### Import / export formats

- [ ] Export .sqlite/.db: Tauri save + `sqlite_export_bytes` (main file only) (`sqliteImportExport.ts:42-58`, `RS:1157-1158`)
- [ ] Export SQL dump: `PRAGMA foreign_keys=OFF; BEGIN; DDL; INSERT…; COMMIT;`, pages of 1,000, BLOB → NULL (`sqliteImportExport.ts:14,60-130`)
- [ ] Import .sql/.txt (replace): drop user tables, then replay (`:176-193`)
- [ ] Browse export CSV / JSON / INSERT via `downloadText` (`DG exportFormats.ts`, `src/lib/download.ts:2-9`)

## Graph (`graph/StorageGraphExplorer.vue` and children)

### What it shows

- [ ] IndexedDB stores of the selected origin (except `localforage`) as nodes: key path, index paths, top-level keys of 12 sampled records (`graph/useStorageGraphQueries.ts:62-87`, `storageGraphEntityBuilders.ts:143-168`)
- [ ] LocalForage: one node per key (`useStorageGraphQueries.ts:100-109`, `storageGraphEntityBuilders.ts:170-200`)
- [ ] Native SQLite tables of every database of the package: columns, indexes, FKs (`useStorageGraphQueries.ts:113-216`, `storageGraphEntityBuilders.ts:202-249`)
- [ ] Foreign-key links (solid) from `PRAGMA foreign_key_list` (`useStorageGraphRelationships.ts:22-47`, `useStorageGraphCanvasNodes.ts:466-475`)
- [ ] Logical SQLite links (dashed): indexed non-PK `*_id` columns matched by name, checked by SQL (≥ 80 % of 40 values) (`storageGraphSqliteDiagnostics.ts:111-203`) ⚠ C2
- [ ] Guessed field-match links with confidence, ≤ 180 total, ≤ 6 per node (`storageGraph.utils.ts:10-309`)
- [ ] Manual links (`useStorageGraphRelationships.ts:59-77`)
- [ ] Strategies inferred (all links, petal layout, clusters ≤ 9) and schema (explicit + manual, ranked grid per database) (`StorageGraphExplorer.vue:65,93-98`, `storageGraph.utils.ts:311-540`)
- [ ] Frames: naming families (inferred), database container and FK components (schema), manual groups (`useStorageGraphCanvasNodes.ts:142-413`, `storageGraphElkLayout.ts:54-102`)
- [ ] Notes (title, body, accent) (`StorageGraphNoteNode.vue`, `stores/useStorageGraphStore.ts:126-175`)
- [ ] Annotations (alias + note) per entity or cluster; alias on the card (`useStorageGraphStore.ts:216-232`, `StorageGraphEntityNode.vue:9`)
- [ ] IndexedDB change count badge per store (`useStorageGraphData.ts:106-119`, `StorageGraphEntityNode.vue:55-60`)
- [ ] Field table (name, type, PK, IX, FK, jump to referenced table) (`StorageGraphFieldSettings.vue`)

### Actions (none writes to the phone; loads read IndexedDB, LocalForage and pull native SQLite)

- [ ] Origin select (shared storage-context store), first auto-picked (`StorageGraphExplorer.vue:381-389,448-463`)
- [ ] Search on title, subtitle, container, fields, annotation (`:100-125,468-472`)
- [ ] Source filter all / IndexedDB / LocalForage / SQLite (`:475-485`)
- [ ] Strategy inferred / schema (`:487-495`)
- [ ] Pan / Select mode (`StorageGraphCanvasDock.vue:19-44`)
- [ ] Add note (`StorageGraphExplorer.vue:252-265`)
- [ ] Auto layout (ELK layered, orthogonal routes), undoable (`:223-250`, `storageGraphElkLayout.ts:104-222`) ⚠ F12
- [ ] Toggle guessed links (`StorageGraphCanvasDock.vue:76-90`)
- [ ] Zoom −/+, % = fit view, first fit per scope, range 0.01–2 (`StorageGraphViewportToolbar.vue:28-70`, `StorageGraphExplorer.vue:369-379,432-435,541-542`) ⚠ C1
- [ ] Undo / Redo (80 steps) (`:349-367`, `useStorageGraphHistory.ts`)
- [ ] Click node / edge / frame selects; empty canvas clears; Shift multi-select; box select (`useStorageGraphCanvasInteractions.ts:363-382`, `StorageGraphExplorer.vue:545-561`)
- [ ] Drag nodes and frames (members follow), positions saved (`useStorageGraphCanvasInteractions.ts:230-275,384-393`)
- [ ] Connect handles → manual link; duplicate refused with a toast (`:324-361`)
- [ ] Backspace deletes selected notes and manual links (`:277-322`)
- [ ] Selection toolbar (≥ 2 nodes): group, ungroup, pack, align ×6, distribute ×2 (`StorageGraphSelectionToolbar.vue:27-43`, `useStorageGraphCanvasInteractions.ts:399-453`)
- [ ] Inspector, cluster: name, description, Save, members focus (`StorageGraphInspector.vue:139-201`)
- [ ] Inspector, entity: Open data, Edit metadata dialog (alias, note), field map, related tables (`:284-354,440-478`)
- [ ] Inspector, note: title, body, accent, Save, Delete (`:239-280`)
- [ ] Inspector, edge: label; Save/Delete for manual links (`:358-426`)

### States and persistence

- [ ] No gate; queries disabled without target/origin or adb package → "No graphable schema for current origin or package." (`StorageGraphExplorer.vue:527-532`)
- [ ] First error string in a banner, no retry (`useStorageGraphData.ts:193-197`, `StorageGraphExplorer.vue:501-506`)
- [ ] One unreadable SQLite file fails the whole SQLite graph (`useStorageGraphQueries.ts:119-172`)
- [ ] `localStorage["capubridge:storage-graph:v1"]`: positions, notes, manual links, annotations, groups per scope `storage-graph:{serial}:{cdpTargetId}:{origin}:{package}` (`useStorageGraphStore.ts:12,82-88`, `useStorageGraphData.ts:80-88`) ⚠ C4
