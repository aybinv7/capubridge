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

- [ ] _R2/R3_ Sub-navigation tabs from route `meta.label`: IndexedDB · Local storage · LocalForage · Cache · OPFS · SQLite · Graph (`StoragePanel.vue:11`, `src/components/layout/SubNavTabs.vue`) — R2a: Local storage and LocalForage are one **Key-value** tab (`/storage/keyvalue`, route `storage-keyvalue`), so the tabs read IndexedDB · Key-value · Cache · OPFS · SQLite · Graph; R2b: Cache is renamed **Cache storage** (`/storage/cache-storage`, route `storage-cache-storage`), so the tabs read IndexedDB · Key-value · Cache storage · OPFS · SQLite · Graph; R2c: OPFS keeps its name and route (`/storage/opfs`, `storage-opfs`); R3: SQLite keeps its name and route, plus the hidden opened-file route `storage-sqlite-file` (`navigation: false`, `tabPath` keeps the SQLite tab selected); the Graph merge into a Diagram view is R3b, so the tabs still end with Graph
- [x] `/storage` redirects to `/storage/indexeddb` → unchanged (`routes.ts`)
- [x] Route names `storage-indexeddb`, `storage-indexeddb-snapshot`, `storage-localstorage`, `storage-localforage`, `storage-cache`, `storage-opfs`, `storage-sqlite`, `storage-graph` → unchanged (`routes.ts`); R2a: `storage-localstorage` and `storage-localforage` (and their paths) now redirect to `storage-keyvalue` with `?source=local` / `?source=forage`, hidden from the tabs (`navigation: false`); R2b: `storage-cache` (`/storage/cache`) redirects to `storage-cache-storage` with its query kept, hidden from the tabs
- [x] `indexeddb/:db?/:store?` and `indexeddb-snapshot/:db?/:store?` both render the IndexedDB tab; snapshot has `navigation: false` → both render `indexeddb/IndexedDBView.vue`; the file route carries `meta.tabPath` so the IndexedDB tab stays selected (`SubNavTabs.vue` `activePath`, `src/router/route-meta.d.ts`)
- [x] Gate `requires: "target"` on IndexedDB, Local storage, LocalForage, Cache, OPFS; none on Snapshot, SQLite, Graph → unchanged; the opened-file route stays ungated so an export opens with no phone. Key-value keeps `requires: "target"` and owns Bring to front (`ownsBringToFront`). R2b: Cache storage keeps `requires: "target"` and owns Bring to front too. R2c: OPFS keeps `requires: "target"` and owns Bring to front too R3: SQLite requires the new `data` gate (an app target on an online device, no DevTools link needed; any other target with its link), with "Open a SQLite file…" as its secondary action; its opened-file route is ungated; Graph stays ungated until R3b
- [x] Target change remounts the tab; a lost link keeps it under the stale strip → unchanged (`GatedView.vue`)
- [x] App in background: gate notice strip only → unchanged; the change watcher now also pauses (`changes/useIndexedDBChangesTracking.ts` `paused`)
- [x] IndexedDB change tracking runs for the whole route ⚠ F2 → fixed: a lease (`useIndexedDBChangesLease`) held by the IndexedDB tab and Graph only, paused while the window is hidden or the app is in the background, one flush at a time, at most 40 stores watched plus any the person asks for ("Watch this store"), flushes spaced by max(1 s, 2 × last flush), 8 s per store read with two retries (`changes/indexeddbChangeTracker.ts`, tests in `changes/__tests__/indexeddbChanges.test.ts`). Round 1 fixes (P3): when the last holder leaves, the feed and baselines stay (reset only on target or origin change) and the watcher only listens (`indexeddbChangesLease.test.ts`); `StoragePanel.vue` no longer starts it
- [x] Palette `Go to Data` / `g s` → unchanged
- [x] No screen palette provider → IndexedDB registers `screen.storage` (group Data): Read IndexedDB again, Find rows (`mod+f`, only while the focus is in the tab and not in the record pane, P6), Show or hide the record pane (`indexeddb/useIdbCommands.ts`). "Open an IndexedDB export…" is app-wide (`useDataAppCommands.ts`, registered by `AppShell`) and the IndexedDB gate offers it beside its own actions (route meta `gateCommand`, `WorkbenchGate.vue`), landing on the ungated file route (P1). Key-value registers the same provider: Read key-value data again, Find keys (`mod+f`, same focus guard), New key, Show or hide the record pane (`keyvalue/useKvCommands.ts`). R2b: Cache storage registers the same provider: Read Cache storage again, Find cached entries (`mod+f`, same focus guard), Show or hide the record pane, Delete this cache… (`cache/useCacheCommands.ts`). R2c: OPFS registers the same provider: Read OPFS again, Find files in this folder (`mod+f`, same focus guard), Show or hide the record pane, Open the folder above, Delete this folder… (`opfs/useOpfsCommands.ts`). R3: SQLite registers the same provider: Read the database again, Find rows (`mod+f`, same focus guard), Show or hide the record pane, Save a copy of the database file…, Save the database as SQL… (`sqlite/useSqliteCommands.ts`); "Open a SQLite file…" is app-wide (`useDataAppCommands.ts`) and offered by the SQLite gate
- [x] Lazy route chunks per tab → unchanged

Inbound and outbound links that must keep working:

- [x] App › Overview "Data" links by route name → unchanged (`storage-indexeddb` still resolves); R2a: its "Local storage" link is "Key-value" (`storage-keyvalue`, `app/overview/dataLinks.ts`)
- [x] _R3_ Device › Files viewer opens a SQLite file in Data → unchanged link (`storage-sqlite` with the file name); R3: a name link is matched once to the phone database and the address bar corrected to its path (`sqlite/sqliteDatabaseRef.ts`)
- [x] _R3_ SQLite source badge "Show in OPFS explorer" → unchanged; R2c: it lands on that folder in the new OPFS tab (`?path=`); R3: "Show in OPFS" in the database's menu
- [x] _R2_ OPFS file click → SQLite tab with the pulled copy → R2c: Enter or double-click on a SQLite row, the context menu and the pane's database card, through the unchanged `useOpenSqliteSource`
- [x] Graph inspector "Open data" → `/storage/indexeddb/:db/:store` still opens the store (route shape kept); Graph now holds the change-tracking lease so its change badges keep working
- [x] Automation reads `useIndexedDBChangesStore().lastEventAt` ⚠ C33 → fixed: bumped only when a flush found changes made by the app, never for Capubridge's own writes (tagged `source: "capubridge"` through `noteOwnWrite` in `stores/useIndexedDBChangesStore.ts`) and never for empty flushes (tested). Round 1 fixes (P3): once IndexedDB or Graph has been opened, device events keep bumping it while another tab is shown (stores Capubridge wrote to in the last seconds excepted)
- [ ] _R2_ Session recorder shares `orderKeyColumns` and the SQLite pull cache ⚠ C37 → unchanged

## Cross-cutting state shared by the tabs

- [x] Selected origin per target, in memory (`stores/useStorageContextStore.ts`) → unchanged; written by `indexeddb/useIdbCatalog.ts` for live databases only, never a file id (⚠ C6), read by the change watcher
- [x] Query defaults `retry: 1`, `refetchOnWindowFocus: false`, `staleTime` 0 → unchanged; IndexedDB pages use `keepPreviousData`
- [x] _R2_ CDP calls to a backgrounded app wait for the 30 s command timeout → unchanged (the IndexedDB watcher no longer re-reads while the app is backgrounded). R2a: Key-value reads pause while the app is away and run again on its return, with 10 s read timeouts (`useDataPresence`); R2b: Cache storage does the same (catalog and entries pause while the app is away, 10 s and 15 s read timeouts, entry reads 10 s); R2c: OPFS does the same (the folder walk 15 s, a folder 10 s, the pool 10 s, a preview read 30 s, all paused while the app is away). R3: SQLite reads its open copy without the app (a phone database is read over ADB), so only its 5 s check pauses while the app is away (page databases) or the window is hidden; Graph: R3b
- [x] Every device script goes through `evaluateChecked` and host data enters only as `jsLiteral` — except IDB export/import ⚠ M8 → fixed: export and import run through `packages/cdp-protocol/src/cdp/domains/indexeddb-transfer.ts` (checked, literal)
- [x] _R2_ OPFS snapshot cache in memory, keyed `targetId::path` → unchanged; R2c: a delete in the OPFS tab forgets the copies of what went (`forget`, `forgetUnder` for a folder)

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

## Key-value (→ `keyvalue/KeyValueView.vue` on the Data frame; R2a)

Local storage and LocalForage are one tab (`data-plan.md` §3, §5.2). Paths below are relative to
`modules/storage/keyvalue/`; the device side is `cdp:keyvalue.ts` and `cdp:keyvalue-scripts.ts`.
Every write goes through `Runtime.evaluate` on the phone (Local and Session storage in the frame of
their origin: the page itself, or an isolated world of that frame; LocalForage in the page), and the
phone refuses anything the person did not see (`KeyValueWriteInput`). Device tests:
`packages/cdp-protocol/tests/keyvalue-storage.test.ts` and `keyvalue-forage.test.ts`; screen tests:
`keyvalue/__tests__/`.

### Local storage (was `localstorage/LSExplorer.vue`, removed)

- [x] Origins sidebar from `Page.getFrameTree` security origins (main page + iframes); `DOMStorage.enable` per fetch (`LSExplorer.vue:379-392`, `cdp:storage.ts:28-51`, `src/composables/useStorage.ts:26-29`) → `KeyValueDomain.discover` (page origin first, then frames; opaque `://` and `null` origins left out; `DOMStorage.enable` once per discovery), sidebar `kvSources.buildKvSections`: "This page" with its host quiet beside it, a frame by its host with "frame"
- [x] Select origin → `storageContextStore.setSelectedOrigin` (also retargets IndexedDB change tracking) (`:42-45,197-199`) → unchanged, when the open list's origin changes (`KeyValueView.vue`)
- [x] First origin auto-selected when none (`:355-359`) → `resolveSource`: the page origin, Local storage, written into the address (`?origin=&source=`) without a history entry (`useKvLocation.settle`)
- [x] Filter "Filter keys or values…", substring on key or value (`:169-176,414-418`) ⚠ F10 → "Find a key or value" (`KvRows.vue`), any case, debounced 150 ms, on lower-case text built once per read (`kvModel.searchText`); a value longer than 100,000 characters is searched in its first 100,000
- [x] Count "(N entries)" of the filtered list (`:420-422`) → status bar "N rows", or "12 of 50 rows" while find narrows; the sidebar count of the open list comes from its own read
- [x] "New Key" → create dialog (`:272-281,424-426`) → "New key" in the header, "Add a key" in an empty list, the sidebar row menu and the palette: the pane opens on a new key with the Key field in focus
- [x] "Refresh" → refetch origins and entries (`:218-221,427-429`) → "Read again" in the header (the list) and in the sidebar row menu; the palette's "Read key-value data again" reads the origins and the list
- [x] Table Key / Value / Size / actions, virtualised (`:451-454`, `useFixedVirtualList`) → `DataGrid` Key · Value · Type · Size (`kvGrid.ts`), virtualised, sortable by any column, row actions in the context menu (right-click, Shift+F10). JSON objects and lists preview as `{3}` / `[12]`
- [x] Size = UTF-8 bytes of the value (`:314-317,478`) → same meaning, counted once per read without allocating (`kvModel.utf8Length`) ⚠ F10 fixed
- [x] Double-click row, FileCode or Pencil → edit dialog (`:465,488,504`) → double-click, Enter or F2 open the pane on Edit (on the Key column: the key field, to rename); Space shows the pane; context menu "Edit the value", "Rename the key". A read-only value says why in the status bar
- [x] Row Copy (`:496`, `copyValue :223-228`) ⚠ C26 → fixed: "Copy the value as stored" copies that row's own stored value (context menu and pane header), plus "Copy the key"
- [x] Row Trash → confirm "Delete Entry" "Are you sure you want to delete `<key>`? This cannot be undone." → `DOMStorage.removeDOMStorageItem` — **MUTATES**; error only `console.error` (`:201-216,658-677`, `cdp:storage.ts:60-65`) ⚠ C28 → fixed: Delete in the pane, the context menu, the Delete key and "Delete N selected", always confirmed ("Delete “key”?" … "on the phone. This cannot be undone."); a failure is a toast with the phone's words, a key already gone is said; rows and the pane follow the key, never a position (`kvWrites.remove`, `entryIdFor`)
- [x] Save (edit/create) only by Ctrl+S → `DOMStorage.setDOMStorageItem` — **MUTATES**; JSON pretty-printed before write; inline "Failed to save: …" (`:283-312,640-644`, `cdp:storage.ts:67-73`) ⚠ C27 M11 → fixed: a visible Save ("Add key" for a new key) and Ctrl+S; the text is written exactly as typed (JSON mode checks it, "Format JSON" indents only on request); a failure is a toast with the phone's words and the edit stays. A new key that exists asks "Replace the value of “key”?"; a value the app changed since the read asks "“key” changed on the phone" before writing over it; one the app deleted asks before creating it again (`kvWrites.save`, `storageWriteScript`)
- [x] Rename (delete then set) — unreachable (`:299-302,628-634`) ⚠ C27 → fixed: the Key field in Edit; set then remove in one script on the phone, so nothing is lost when the write fails (a full phone leaves both keys as they were); a taken key asks first
- [x] Dialog: key title, original-value size, type chip json / number / date / boolean / string (`inferType`), Invalid / Unsaved badges (`:76-106,161-165,188-193,554-577`) ⚠ C29 → pane header: key, "3 of 42 · JSON object · 1.2 KB", "Not saved"; the JSON problem in words under the editor; Type column labels (`describeText`). C29 fixed: a value opens exactly as stored, so nothing looks changed on open
- [x] Dialog: Prev / Next, Copy, shortcut hint (`:537-550,581-622`) → pane Previous / Next key (Ctrl+↑/↓), Copy the value as stored, Close (Escape); the shortcuts show in each button's tooltip
- [x] Keys while the dialog is open: Ctrl+F filter, Ctrl+↑/↓ prev/next, Ctrl+S save (`:321-346`); prev/next/close discard edits without asking (`:247-270,348-353`) → Ctrl+F finds in the value (Value) or in the JSON editor (Edit), Ctrl+↑/↓, Ctrl+S. Fixed: prev/next are off while an edit is unsaved; close, hiding the pane, New key, another list and leaving the tab ask "Discard changes to “key”?"; a fresh read never replaces the draft, and the pane says "Changed on the phone after you began editing" or "Deleted on the phone after you began editing" (`useKvPane`)
- [x] States: origins spinner, "No origins found" (`:368-377`); "Select an origin from the sidebar" (`:401-406`); entries spinner (`:433-435`); "Failed to load" / "No LocalStorage entries" without error text (`:436-444`) → sidebar spinner and error with Try again; "Reading the page's key-value data"; errors with the phone's words and Try again, and a failed re-read keeps the last rows under a compact error; "Waiting for the app" with Bring to front (rows kept, writes held with the reason); "Local storage of this page is empty." with Add a key; "No key or value matches" with Clear find; a list no longer on the page says so with a way back
- [x] sessionStorage not supported (`isLocalStorage: true`, `cdp:storage.ts:55,62,69`) → Session storage per origin, read and written like Local storage (new, `data-plan.md` §9 q4)
- [x] All entries in one `getDOMStorageItems` call (`cdp:storage.ts:53-58`); no live DOMStorage events → unchanged: one call per list. Still no live events, said honestly: "on the phone · read N ago" without the live dot (U6)
- [x] No persisted preferences, import/export, sort or context menu → sort by column, a context menu, the pane shown or hidden and its width, sidebar pins and hidden entries per phone and app (`useDataSidebarSettings`, kind `keyvalue`), and the open list in the address. Import/export: still none

### LocalForage (was `localforage/LocalForageExplorer.vue`, removed)

- [x] Origins: `[location.origin]` when an IndexedDB database named `localforage` exists, else `[]` (`cdp:localforage.ts:26-44`) ⚠ C30 → fixed: every LocalForage store of the page, found by LocalForage's own blob-support store (any database name, any store name) or by the `localforage` name, listed under "This page" ("LocalForage", "LocalForage “cache” › images"); a database busy for 3 s is skipped and named under the origin
- [x] Selected origin in a local ref, not the store; has no effect on reads/writes (`LocalForageExplorer.vue:38,183-185`, `cdp:localforage.ts:46,129,133`) → stores belong to the page origin; reads and writes check it on the phone and refuse another origin
- [x] Reads: page `localforage` global (`keys()` + `getItem`) or raw IDB `localforage/keyvaluepairs` `getAll` + `getAllKeys`, everything in one `Runtime.evaluate` (`cdp:localforage.ts:63-111`) ⚠ F9 → raw IndexedDB only, opened only if it exists (never `createInstance`, never an upgrade: M10's second half), read by cursor through the IndexedDB encoder, up to 5,000 keys and 12 MiB; the status bar says "First 5,000 of N keys read". F9 partly: values still come with the keys in one read (no previews first), now capped **Round 2 correction:** this tick was false until `0a8358d8`: the Graph still read LocalForage through `LocalForageDomain` (`createInstance`, and an unguarded `indexedDB.open('localforage')` that could create the database). The Graph now uses `KeyValueDomain.readAllForage` and `LocalForageDomain` is gone (`tests/keyvalue-graph.test.ts`). Values are read 200 per short transaction after the keys (`5693707e`); previews-first is still F2's open half.
- [x] Values shown as JSON text; Date, Blob, BigInt, ArrayBuffer, Set, Map become `{__type}` placeholders (`cdp:localforage.ts:50-61`) ⚠ M10 → fixed: the IndexedDB markers, shown in words in the grid and the pane (`Date 5 Nov 2026, 14:32`, `Blob 1.2 KB · image/png`); such a value is read-only with its reason and can only be deleted, never saved back as an object
- [x] Delete → confirm → `mutate("delete")` (`removeItem` or IDB `store.delete`) — **MUTATES**; error toast `Could not delete "<key>"` with the error (`:192-202`, `cdp:localforage.ts:133-180`) → confirmed delete in one transaction on the phone (`forageWriteScript`), the same toasts as Local storage
- [x] Save by Ctrl+S → `mutate("set")` (device `JSON.parse` with string fallback, `setItem` or IDB `put`) — **MUTATES** (`:269-298`, `cdp:localforage.ts:129-175`) ⚠ C27 M10 → fixed: visible Save and Ctrl+S; Text saves a string, JSON saves the value it holds (no guessing); the stored value is compared on the phone, through the same encoder, with what was read before it is replaced; a new key that exists asks first
- [x] Rename sets new then deletes old — unreachable (`:284-288`) → the Key field in Edit, put then delete in one transaction; a taken key asks; a key that is not text cannot be renamed and says so
- [x] Empty text "No LocalForage entries" (`:419-430`) → "LocalForage of this page is empty." with Add a key
- [x] The `localforage` IndexedDB database is hidden from the IndexedDB tab (`indexeddb/IDBExplorer.vue:292`) → listed in IndexedDB since R1; its link now reads "Read as key-value pairs in Key-value" and opens that database here (`idbTreeModel.ts`)

### Not carried over, on purpose

- The LocalForage localStorage driver (`<name>/<key>` keys) is not listed as a LocalForage source: its
  keys and values are already readable and editable under Local storage, and detecting it by key
  prefix would be a guess (`data-plan.md` §5.2 asked for it).
- LocalForage databases other than `localforage` are not linked from the IndexedDB tab yet (they are
  listed there as plain databases); that is round 1's tab.

### Pending live checks (Key-value)

Seen live on the emulator (Capuchoo Testbed): the tab, the sidebar ("This page", Local storage 3,
Session storage 0) and an empty Session storage list. Not checked, because the app was in use and
checks never write on the phone:

- [ ] Local storage of a real app: JSON values previewed, sizes, find, sort, the pane's Text / Tree / Raw
- [ ] A frame origin (iframe) listed, read and written through its isolated world
- [ ] A LocalForage store of a real app (Presalio on the Redmi): found, read, Date or Blob values read-only
- [ ] Saves, renames, deletes and the "changed on the phone" question on a test key (never the app's own data)
- [ ] "Waiting for the app" and Bring to front with the app in the background; reads again on return
- [ ] The old addresses `/storage/localstorage` and `/storage/localforage` and the IndexedDB link land on the right list
- [ ] Dark and light first paint; the pane at 280 and 560 px

## Cache storage (→ `cache/CacheStorageView.vue` on the Data frame; R2b)

Was `cache/CacheExplorer.vue` (removed). Renamed **Cache storage** (`data-plan.md` §3, §5.3). Paths below
are relative to `modules/storage/cache/`; the device side is `cdp:cache-storage.ts` and
`cdp:cache-storage-scripts.ts`. Every read and delete is a script through `evaluateChecked` with host
data only as `jsLiteral`; each checks the page still shows the origin that was read and never creates a
cache (`caches.has` before `open`). The cached request/response presentation is Network's, lifted to
`src/shared/http/` (body viewers, header groups, key-value list, details section and states). Device
tests: `packages/cdp-protocol/tests/cache-storage.test.ts`; screen tests: `cache/__tests__/`.

- [x] Cache names from `caches.keys()` (`cdp:storage.ts:88-107`) → `CacheStorageDomain.catalog`: names and the entry count of each (`cache.keys()` length, never the bodies, F16); a page without `caches` (not a secure page) says so instead of failing; sidebar "This page" (host quiet beside it) with its caches and counts (`cacheSources.buildCacheSections`)
- [x] Click cache name → expand; single child "View entries" → select and load (`CacheExplorer.vue:61-71,110-136`) → one click on the cache opens it (the two-level expand for one child is gone); the page row opens an overview: caches, entries, the fullest caches, what Cache storage is (`CacheOverview.vue`). The open cache is in the address (`?cache=`, `useCacheLocation`); a link to a cache that is gone says so with a way back (`resolveCache`)
- [x] Entries from `caches.open(name).keys()` → `{ url, method, cacheName }` (`cdp:storage.ts:109-135`) → `entries`: up to 2,000 per read ("First 2,000 of N entries read"), each with status, response type, the headers that matter and the body size, within a 5 s budget (entries past it show dashes and the status bar says how many). Entries are named by method, address and their stored request headers, so Vary variants are two rows ⚠ C31 fixed
- [x] Filter in the sidebar "Filter by URL or type…" filters the entries table on URL or method (`:42-48,84-93`) → "Find an address, status or type" above the grid (no longer in the sidebar), any case, debounced 150 ms, on lower-case text built once per read; the sidebar has its own "Find a cache"
- [x] "Refresh" → names and entries (`:73-76,162-165`) → "Read again" in the header (the cache) and in the overview (the caches), the sidebar row menus, and the palette's "Read Cache storage again" (both)
- [x] Table URL / Method; count ignores the filter (`:158-160,178-179`) ⚠ C31 → `DataGrid` Name · Method · Status · Type · Size · Served · Address (`cacheGrid.ts`), name first like Network, virtualised, sortable (unknown sizes and dates last); the status bar says "N rows", or "3 of 40 rows" while find narrows ⚠ C31 fixed
- [x] Row click highlights only; no detail, headers or body (`:56-59,189`) ⚠ C31 → the pane follows the focused row by id (`useCachePane`): method, name, status, the address quiet; Headers (General: status, response type in words, size, served and how old, what the HTTP headers say about its lifetime, that Cache storage keeps it until the app deletes it; response headers; stored request headers) and Response (the body through the shared viewers: JSON, text, picture, SVG, Base64, up to 1 MiB with "Showing the first 1 MB of 4 MB.", a cut JSON shown as text). Opaque responses say the browser hides them. Copy the address; Previous / Next (Ctrl+↑/↓); Ctrl+F finds in the body; Escape closes. When the app saved a new response after the list read, the pane says so with "Read the list again"; an entry gone says so ⚠ C31 fixed **Round 2 correction:** "the app saved a new response" was also said for entries the list read never reached (no version); fixed in `dc156e0a` (`responseChanged`). The pane now settles 140 ms, reads text and pictures at once and other bodies on "Read the body", and keeps an entry 2 s (`e197bd79`). Bytes show as a hex dump too (`6800d011`). Headers and Response switch with a Segmented control, like the other panes (`267d5a2e`).
- [x] States: names spinner (`:95-97`), "No Cache API caches found" for empty and error (`:99-105`), "Select a cache from the sidebar" (`:147-152`), entries spinner (`:169-171`), empty/error → empty table (`:173`) → "Reading the page's Cache storage"; errors with the phone's words and Try again, a failed re-read keeps the last rows under a compact error; "This page has no Cache storage" (not a secure page) and "The app has saved no responses here" with what fills it; the overview instead of "Select a cache"; "The cache “x” is empty."; "No entry matches" with Clear find; "Waiting for the app" with Bring to front (rows kept, deletes wait with the reason)
- [x] Read-only today; `CacheAPIDomain.deleteCache` / `deleteEntry` exist but are not wired (`cdp:storage.ts:137-162`) → wired, both **MUTATES**, both confirmed with the cache named and what goes: "Delete entry…" in the pane, the context menu, the Delete key and "Delete N selected"; "Delete cache…" in the header, the sidebar row menu and the palette. The phone keeps an entry the app replaced since the read, and a cache that holds another number of entries than was seen, until the person agrees ("… changed on the phone"); an entry or cache already gone is said. The old `deleteEntry` opened the cache with `caches.open`, which creates a missing one: removed with `deleteCache` and `getEntries` (`cacheWrites.ts`, `useCacheWrites.ts`). Responses are not edited here; the status bar lock says so **Round 2 correction:** this tick was false in parts, fixed in `dc156e0a`: entries past the 5 s read budget were deleted unchecked (their response is now read just before the question and an unread entry is kept unless forced); the response fingerprint ignored the body (now size and first 32 KiB); a partly failed batch said "No entry was deleted" (each entry now fails on its own and is named); `cache.delete` could take a Vary sibling the person did not choose (kept and said; extra removals counted); the whole-cache check compared the count only (now the entries' fingerprint). The sidebar "Delete the cache…" did nothing unless the cache was already read (`8c0943b8`). The status bar no longer shows a "read-only" lock beside working deletes (`f172de3c`); the header delete is a named icon (`2512cd9a`).
- [x] No persisted preferences (new) → sidebar pins and hidden caches per phone and app (`useDataSidebarSettings`, kind `cache`), the pane shown or hidden and its width, the pane's tab and its folded header sections

### Not carried over, or not possible here

- When an entry was stored: the Cache API does not keep it. "Served" is the response's `Date` header and
  its age; the CDP `CacheStorage` domain's `responseTime` would give the fetch time, but it would be a
  second read path beside the scripts, so it is left for a later round.
- Editing a cached response, or adding one: not offered (the plan asks only for deletes).
- Caches of iframes on another origin: only the page's own origin is read.

### Pending live checks (Cache storage)

Not checked on a phone in this round: the emulator was in use (its screen changed between two
screenshots a minute apart), and checks never delete on the phone.

- [ ] A Workbox app (precache and runtime caches): counts, Vary variants as two rows, sizes, served dates and lifetimes
- [ ] The pane on a JSON, a script, a picture, an SVG, a 5 MB body (cut notice) and an opaque CDN font
- [ ] A cache of more than 2,000 entries (limit line) and a slow phone (entries past the 5 s budget)
- [ ] Deleting a test entry and a test cache (never the app's own), and the "changed on the phone" questions
- [ ] "Waiting for the app" and Bring to front with the app in the background; reads again on return
- [ ] `/storage/cache` redirects to Cache storage; the palette commands; first paint dark and light, the pane at 280 and 560 px

## OPFS (→ `opfs/OpfsView.vue` on the Data frame; R2c)

Was `opfs/OPFSExplorer.vue` (removed). Paths below are relative to `modules/storage/opfs/`; the device
side is `cdp:opfs-files.ts` and `cdp:opfs-files-scripts.ts` (folder walk, listing, deletes: every script
through `evaluateChecked`, host data only as `jsLiteral`), while previews, the SAH-Pool decode and the
SQLite pull keep `cdp:opfs.ts` and `OP`. Device tests: `packages/cdp-protocol/tests/opfs-files.test.ts`
(fake OPFS in `opfs-fixture.ts`); screen tests: `opfs/__tests__/`; Rust: the `opfs_pull` tests.

- [x] Start path from `?path=` once at mount (`OPFSExplorer.vue:36`) ⚠ C32 → fixed: `?path=` both ways (`useOpfsLocation`): every folder opened here is written to the address (Back and reload return to it), and a link (the SQLite source badge) lands on its folder; a folder the walk did not find says "This folder is not in OPFS" with "Open the top of OPFS" (`resolveFolder`)
- [x] Up, root "opfs:/", breadcrumb segments (`:190-212,228-245`) → "Open the folder above" (`IconAction`, palette), breadcrumbs from "OPFS" (`OpfsBreadcrumbs.vue`), and the folder tree in the sidebar: top-level folders, opened along the way to the current folder, each with its item count; "Find a folder" lists every folder (`opfsSources.visibleFolders`, frame `depth` and `ordered` options)
- [x] Raw files / Decoded DBs toggle when a SAH-Pool directory is inspectable (`:249-270`) → "Files · Databases in the pool" (`Segmented`) in the folder header, only where the pool can be decoded; back to Files in any other folder (`OpfsFolder.vue`)
- [x] Refresh → directory only (`:271-278`) → "Read again" in the header (the folder, and the pool when shown) and in the sidebar row menus; the palette's "Read OPFS again" reads the folders and the folder
- [x] Detected storage tech chips with tooltip (description, package, evidence) from `detectStorageTechs` (`:282-317`, `cdp:opfs.ts:97-236`) → quiet Cladd `Chip`s beside the breadcrumbs (`OpfsTechHints.vue`), the tooltip saying how sure (Sure / Likely / A guess), what it means, the package and what was seen. The "Unrecognised OPFS layout" guess is no longer a chip: it only pointed to child folders, which the sidebar tree now shows
- [x] Filter "Filter…" on name/kind (sidebar and table) and on logical path / opaque name (decoded view) (`:68-84,326-330`) → "Find a name or kind" above the grid (debounced 150 ms, any case, on text built once per read), "Find a folder" in the sidebar, "Find a database or slot" in the pool view; "Nothing here is named “x”" with Clear find
- [x] Click directory → navigate (`:167-173,367,482`) → Enter or double-click on a folder row, the sidebar, the context menu "Open the folder", and "Open the folder" in the pane
- [x] Click `.sqlite/.sqlite3/.db/.db3` → `openOpfsDatabase` … (`:174-177`, `useOpenSqliteSource.ts:34-97`, `OP:243-332`) → Enter or double-click on a SQLite row, the context menu "Open in Data › SQLite", and the pane's database card (any file whose bytes are SQLite); same pipeline, toasts and route (`useOpenSqliteSource.ts` unchanged). The pull now removes its partial temp file on any failure, not only on a bad header (`OP` `copy_range`)
- [x] Click decoded SAH-Pool row → open opaque file with `stripSahPool: true` (`:182-188,431`) → Enter, double-click or the context menu in "Databases in the pool" (`OpfsPoolRows.vue`); a slot in Files offers "Open in Data › SQLite" too (pane footer, context menu)
- [x] Click other file → highlight only, no preview (`:179`) ⚠ C32 → fixed: the pane previews it through the shared file viewer (`src/shared/file-viewer/`: text and code with find, JSON text or tree, pictures, video and audio, SQLite facts, bytes for anything else), read with `OPFSDomain.readFileBytes` in 8 MB chunks under each kind's budget; video and audio over 32 MB are refused before any read, with Download (`useOpfsPreview.ts`); a read that finishes after the pane moved on is dropped and a run of arrow keys reads only the file it stops on (tested). A file the app holds open (a live SQLite VFS) is listed "In use" and the pane says why instead of failing **Round 2:** chunks are now 2 MiB, encoded by the browser (`FileReader`), and a preview the pane moved away from is cancelled between chunks (`56f05ccd`).
- [x] Row Download button — no handler (`:519-526`) ⚠ C32 → fixed: "Download…" in the pane footer, the context menu and the viewer's own views: the system save dialog (it asks before replacing a file), then Rust streams the file from the phone straight to disk (`opfs_save_file`: a `.capubridge-part` file renamed only when complete, so a failed copy leaves nothing and never destroys the file it replaces), progress in the toast, "Saved “x”" with the path, a warning when the app wrote to the file during the copy, "Could not save “x”" with the reason (`useOpfsDownload.ts`) **Round 2 correction:** the rename happened even when the copy was short or the closing stat failed, replacing the destination with a truncated file; fixed in `d3a00dc8` (Rust tests in `opfs_pull`). A save can be cancelled from its toast and survives opening another folder (`6b1b9624`).
- [x] Row Delete (files) → `OPFSDomain.deleteEntry` … — **MUTATES**, no confirm, toast or catch (`:214-219,527-535`, `cdp:opfs.ts:288-320`) ⚠ M4 → fixed: files and folders, from the pane, the context menu, the Delete key, "Delete N selected", "Delete folder…" in the header, the sidebar row menu and the palette; always confirmed, naming what goes and where, with a warning for SQLite files (corruption while the app has them open), SAH-Pool slots (the database in them goes too) and folders (everything inside) (`opfsWrites.deleteQuestion`). The phone deletes only on the origin that was read, only a file whose size and date are what the person saw (otherwise "This file changed on the phone" asks first), never forces a file the app holds open, and says what was already gone; toasts after the phone answered, with the phone's words on failure; the pulled local copies of what went are forgotten (`opfsSnapshotCache.forget` / `forgetUnder`). Deletes wait, with the reason, while the folder is read or the app is away (`useOpfsWrites.ts`; tests `opfsWrites.test.ts`, `opfs-files.test.ts`) **Round 2 correction:** a folder delete checked nothing inside and warned about nothing inside, and a file with an unknown size was deleted unchecked; fixed in `c1822356`: the folder is walked before the question (files, size, SQLite databases, journals, SAH-Pool slots), refused before the question and by the phone while any file inside is held open (so a recursive delete never stops half way), and compared with what was looked at; a file the list could not measure is checked against its size read before the question. "Delete folder…" from the sidebar did nothing unless the folder was read (`8c0943b8`); the header delete is a named icon, "Delete the folder “x”…" (`2512cd9a`).
- [x] Sidebar: icon, name, size (`:358-374`); table: Name + badges sqlite/journal/wal/shm/sah-pool, Type, Size, Modified (`:122-138,466-513`) → sidebar: the folder tree with item counts; grid (`DataGrid`, virtualised, sortable, folders first): Name · Kind · Size · Modified (`opfsGrid.ts`). The badges are the Kind in words: SQLite database, Write-ahead log, Rollback journal, Shared memory, SAH-Pool slot (Empty SAH-Pool slot for a header-only slot), "JSON file", Folder (`opfsModel.ts`); sizes read "1.2 MB", dates "Today at 13:46" **Round 2 correction:** "Pin to the top" only added an icon (an ordered folder tree skipped pinned-first); a pinned folder now moves to the top (`b9f9d9b7`). Dates older than yesterday had lost their time and "Today at…" stayed as read: times now keep the time of day, follow a minute clock and show the exact time on hover (`ed2d46b7`). Columns grow, shrink to a minimum and drop out on a narrow grid (`d8a53f89`).
- [x] Decoded view: Logical path, Opaque file, Data size, Flags (hex), Modified (`:416-450`, `cdp:opfs.ts:455-507`) → "Databases in the pool": Database · Slot file · Size · Flags (`0x…`) · Modified (`opfsPoolGrid.ts`)
- [x] States: spinner, "Failed to load OPFS", "Empty directory" (sidebar only), "Decoding SAH-Pool headers…", "Failed to decode SAH-Pool…", "No live databases inside this pool (all slots empty)." (`:334-408`) → "Reading the page's OPFS"; errors with the phone's words and Try again, a failed re-read keeps the last rows under a compact error; "Waiting for the app" with Bring to front (rows kept, reads and deletes wait, the tab owns Bring to front); "The folder “x” is empty." and an empty root noted in the sidebar; "This folder is not in OPFS any more" with "Open the folder above"; "This page has no OPFS" (not a secure page); the pool grid's loading rows, "Could not decode the SAH-Pool; the folder may not be in pool format", "No live databases in this pool: every slot is empty."
- [x] `listDirectory` stats every file sequentially, no paging (`cdp:opfs.ts:254-270`) ⚠ F11 → fixed: `OPFSFilesDomain.folder` stats the files in parallel in one evaluate, up to 5,000 entries ("First 5,000 of N entries read" in the status bar); kinds are computed once per read and grid rows cached per row. The sidebar walk lists folders only (no file opened), up to 500 folders and 12 levels, and says when it stopped **Round 2:** the listing now opens 24 files at a time for up to 5 s (later files come back without size) instead of every file at once (`c1822356`); the folder walk is kept per origin (`aaac7ab1`).

### Not carried over, or deferred

- The pull pipeline work planned for R2 (`data-plan.md` §7: WAL C15, temp-file cleanup on exit C36, the
  recorder's reuse C37, F5–F7) belongs to SQLite and moves to R3 with the SQLite screen; only the OPFS
  pull's partial-file cleanup landed here, because the download shares its copy loop.
- Upload and rename: OPFS never had them, and they are not added; nothing here can overwrite a file.
- "Open on this computer" and "Choose an app…" stay Device-only: an OPFS file would first need a pull to
  a temp file. Download covers it.

### Pending live checks (OPFS)

Seen live (screenshots only, the owner was using the tab): Presalio Staging on the Redmi,
`.opfs-sahpool/.opaque` with 12 slots, the sidebar tree opened along the path, the SAH-Pool chip and the
Files · Databases in the pool switch. Not checked, because checks never write on the phone and the app
was in use:

- [ ] The pane on a JSON, a log, a picture, a SQLite file (open in SQLite from the card) and a held-open file
- [ ] "Databases in the pool" on the Presalio pool, and opening one in SQLite
- [ ] Download of a large file (progress toast, the `.capubridge-part` rename, the "changed while copied" warning)
- [ ] Deleting a test file and a test folder (never the app's own), the "changed on the phone" question, a held-open file refused
- [ ] "Waiting for the app" and Bring to front with the app in the background; reads again on return
- [ ] `?path=` from the SQLite source badge; Back and reload; a folder past the walk limit
- [ ] Dark and light first paint; the pane at 280 and 560 px; Device › Files viewer after the move

### Pending live checks (Data round 2 fixes)

Not checked on a phone: the owner was using the app, and checks never write, rename, delete or
import on the phone. Each needs a test key, entry or folder made for it, never the app's own.

- [ ] Key-value: a delete of a key the app changed since the read asks first; a batch of 1,000+
      keys shows "Deleting N of M keys"; a frame origin reads and writes the same partition
- [ ] Key-value: a value with Windows line breaks keeps them after an edit; Ctrl+F in Text edit;
      the type warning; a large JSON value (over 64 KiB) edits as plain text without a freeze
- [ ] Key-value discovery on Presalio: the app upgrading its database while the tab is open is
      not blocked; reading again does not reopen plain databases
- [ ] Cache: an entry past the 5 s budget is checked before it is deleted; the Vary-sibling
      refusal; a partly failed batch; "Read the body" on a font; the single-cache landing
- [ ] OPFS: the folder-delete question on a real folder (counts, databases, journals, slots);
      the refusal while the app holds a database open; a cancelled save leaves no part file; the
      first row takes focus after opening a folder
- [ ] OPFS reads with CDP `IO.read` (F3's first option) need checking on the emulator first;
      until then reads use 2 MiB chunks encoded by the browser
- [ ] Coming back to each Data tab from another screen lands on the place it was left
- [ ] Dark and light: the shared pane footer, the hollow "read once" dot, the hex view of a
      cached body

## SQLite (→ `sqlite/SqliteView.vue` on the Data frame; R3)

Was `sqlite/SqliteExplorer.vue` (2,052 lines, removed with `SqliteTableToolbar.vue`,
`SqliteDatabaseOverview.vue`, `stores/useSqliteSidebarSettings.ts` and the shared `VirtualDataTable.vue`).
Paths below are relative to `modules/storage/sqlite/`. The tab is behind the new `data` gate
(`src/lib/gates/resolve.ts`, tests in `gates.test.ts`): an Android app target on an online device opens it
without a DevTools link; any other target needs its link. Every read goes to one **address** per database
(`sqliteAddress.ts`): a phone file through the selected app, a page database through its pulled copy, an
opened file through itself. Tests: `__tests__/sqliteTree.test.ts`, `useSqliteTableQuery.test.ts`,
`useSqliteWrites.test.ts`, `sqliteImportExport.test.ts`, `sqliteQuery.test.ts`, `sqliteGrid.test.ts`,
`browse/__tests__/sqliteWriteAccess.test.ts`; Rust `sqlite::tests`, `sqlite_dump::tests`; protocol
`packages/cdp-protocol/tests/jeep-sqlite.test.ts`.

### Sources and opening

- [x] Native databases: `sqlite_list_databases` … when an adb target of the selected device is selected (`RS:441-500`) → unchanged command, listed under "In the app's files" (`useSqliteSources.ts`, `sqliteTree.ts`); an app with none says "The app keeps no SQLite file in its databases folder"
- [x] jeep-sqlite databases from IndexedDB `jeepSQLiteStore`/`jeepSqliteStore` → `databases`, path `jeep-sqlite:<idb>/<store>/<key>` → unchanged, under "In the page"; discovery reads only the 16-byte header of a Blob value (`cdp:jeep-sqlite.ts`)
- [x] OPFS databases: one-evaluate walk … tagged `sqlite-wasm-opfsdb`, `wa-sqlite-opfs`, `sqlite-wasm-sah-pool` → unchanged (`useOpfsSqliteDiscovery.ts`), under "In the page"
- [x] Imported file: Upload / empty-state button → Tauri open → `sqlite_save_local_bytes` temp copy, magic checked … Toasts → "Open a SQLite file…" in the sidebar tools, the empty state, the SQLite gate (secondary action) and the palette, app-wide (`openSqliteFile.ts`, `useDataAppCommands.ts`). Files open in their own store (`stores/useSqliteFilesStore.ts`), several at once, beside the phone's databases, under "Opened files", on the ungated route `storage-sqlite-file` (`/storage/sqlite-file/:file/:table?`). Toasts "Could not read the file", "Could not open “x”" (no success toast: the file opens on screen)
- [x] Lists merged with `Promise.allSettled`; failed WebView sources kept as unreachable → unchanged (`useSqliteSources.ts`, `sqliteDatabaseList.ts`); a newer scan always wins over a late older one
- [x] Rediscovery when the DevTools link comes up or the app returns → unchanged (`useSqliteRediscovery.ts`)
- [x] Native open: `sqlite_open_database` (forced pull …, `COUNT(*)` per table and view) ⚠ F5 C15 → unchanged command behind the tables query (`useSqliteCatalog.ts`); F5 and C15 stay deferred (see `data-plan.md` R3 status)
- [x] OPFS open … jeep open: `readDatabaseBytes` (whole file in one evaluate) ⚠ C35 → fixed: jeep reads go 2 MiB per evaluate with progress in the toast ("Reading “x” — 2 MB of 9 MB"), the page drops its copy afterwards (`cdp:jeep-sqlite.ts`, test with a 4 MiB database). OPFS opens through the unchanged `useOpenSqliteSource`, now routed by path. Toast "Could not read “x”"
- [x] Local session dropped and route reset when `cdpTargetId` changes → the pulled copy is let go when its page is no longer selected (`useSqliteOpening.ts`); the database stays selected and says "“x” is not read yet" with "Copy it from the page"
- [x] Columns/indexes/FKs from the live phone database through `run-as sqlite3` when present, else from the copy ⚠ C20 → fixed: always from the pulled copy the rows come from (`RS` `read_table_meta`); the on-device `sqlite3` path is gone

### Sidebar (→ `frame/DataSourceTree.vue`, `sqliteTree.ts`, `sqliteTreeActions.ts`)

- [x] Search database names/paths and tables of expanded databases ⚠ C23 → "Find a database or table"; only the open database lists its tables, so a search never shows another database's tables; expand, pins and hidden entries are keyed by the database's path (a file by its id), never the temp copy (tested)
- [x] Import `.sqlite` → the folder icon "Open a SQLite file…" beside the search
- [x] Show/Hide hidden databases and tables banners → the frame's "N hidden · Show them"
- [x] Expand/collapse database, persisted → frame chevron and ←/→, `capubridge:data-sidebar:v1` (scope `serial::package::sqlite`); the old `sqlite-sidebar-settings` seeds it once and is removed (`frame/useDataSidebarSettings.ts`, tested)
- [x] Click database → `navigateToDb` → opens it (`useSqliteOpening.ts`: a phone file or an opened file opens at once, a page database is copied first)
- [x] Database row: name, source badge with tooltip, size in KB, "app in background" label, opening spinner, change stripe ⚠ C24 → name, quiet detail "opfs · 1.2 MB" (`formatBytes`), change stripe; the source chip with its explanation (title, description, package, where it is stored) sits in the database header (`SqliteSourceBadge.vue`, Cladd `Chip` + `HintTooltip`). Unreachable: provenance `stale` and the note "The page is not answering (app in the background). Its copy is read again when it is back."; opening it uses a copy already pulled, else says it cannot be read yet, and never asks the page first (`sqliteOpenPlan.ts`, C24 fixed). The opening spinner became the toast and the "Copying “x” from the page" state
- [x] Database menu: Pin/Unpin, Hide/Unhide → "Pin to the top" / "Unpin", "Hide from the list" / "Show in the list"
- [x] Database menu: Export .sqlite file ⚠ C16 C15 → "Save a copy of the file…" (row menu, header menu, palette); C16 fixed: read at the database's own address, so OPFS, jeep (once opened) and phone databases with a copy open all work (tested); a page database not opened yet says why it cannot be saved yet. C15 (WAL) deferred
- [x] Database menu: Export SQL dump ⚠ C16 C19 → "Save as SQL…": written by Rust in one pass (`sqlite_export_dump`, `sqlite_dump.rs`), every value exact (integers in full, reals keep their fraction, BLOBs `X'…'`), AUTOINCREMENT counters, then indexes, views and triggers; a `.capubridge-part` file renamed only when complete; toast "Saved N rows of “x” to …" (Rust tests)
- [x] Database menu: Import SQL dump (replace), writable only ⚠ M13 M1 → "Replace with an SQL file…", opened files only; M13 fixed: Rust replays the dump on a `VACUUM INTO` copy after dropping triggers, views and tables, checks `quick_check`, and swaps the file only then, so a dump that fails part way changes nothing ("Nothing was changed" + the database's words) (`sqlite_import_dump`, Rust tests; a TS test proves one atomic call)
- [x] Database menu: Clear DB changes → "Forget the change marks"
- [x] Database menu: Delete database, writable only — **MUTATES** for jeep and OPFS ⚠ M1 → M1 fixed: no row offers a delete; an opened file offers "Close the file" (it never says "removes it at the source"), and every write is decided by the database it acts on (`canWriteDatabase(db)`, tested with a file open). Deleting a page database stays in OPFS, with its checks ("Show in OPFS" in the menu). It was already unreachable for jeep and OPFS before this round (`canWriteDatabase`), so nothing that worked is gone
- [x] Click table → `navigateToTable`; row: pin dot, name, row count, change stripe → frame collection row with count, pin dot, change stripe
- [x] Table menu: Pin, Hide, Clear changes → same words as the database menu
- [x] Table menu: Clear all rows, writable only — local copy; confirm …; toast → "Delete every row…", opened files only, Cladd confirm naming the table and the file "on this computer", toast "Deleted every row of “T”" (`useSqliteWrites.ts`)
- [x] Table menu: Drop table, writable only … → "Drop the table…", same rules; leaves the table if it was open; toast "Dropped “T”"
- [x] Failure toast "Action failed"; read-only guard toast "This database is read-only here" → per action ("Could not clear “T”", "Could not drop “T”", "Could not delete the rows") with the database's words; the read-only guard toast is kept
- [x] Source badge "Show in OPFS explorer" → "Show in OPFS" in the database's menu (sidebar and header), landing on its folder (`?path=`)
- [x] Empty: "No target selected" / …, "No SQLite databases found" …; error + Retry; spinner → the gate when nothing is selected; "This app has no SQLite database" with "Open a SQLite file…"; "Choose a database" with the count when nothing is open; the frame's sidebar loading and error with Try again
- [x] Resizable layout persisted `capubridge:sqlite-explorer` → `capubridge:data-layout:v2:sqlite` (sidebar 200–360 px)

### Database overview (→ `SqliteOverview.vue` on `frame/DataOverview.vue`)

- [x] Name, size, package; stats Tables, Views, Rows (tables + views), Size → the header (name, path or "opened on this computer", source chip, freshness); tiles Tables, Views, Rows (tables only now, "in tables"), Size
- [x] Top-10 "By row count" bars, click → table → "Most rows", ten bars, each opens its table
- [x] Table list with expandable CREATE SQL, click → table → "Tables and views", a chevron shows the SQL, the name opens it
- [x] Refresh → `handleRefresh(true)` → "Read again" in the header and the sidebar menu
- [x] "No tables found"; loader; error state never fed ⚠ C21 → fixed: "Could not open the database" with the error and Try again; "This database has no tables"; "Opening the database"

### Table view tabs

- [x] Browse · Structure · SQL, reset to Browse on route change → Rows · Structure · SQL (`Segmented` in the table header, `?view=` in the address, so Back returns to it); another table opens on Rows. The database itself has Overview · SQL
- [x] Table toolbar: `table · db`, `N rows`, change badges toggle changed-only, page size 50/100/500, prev/next (limit+1), refresh → header (table, "table in db"), `ChangeSummary` (changed-only), freshness; `DataPager` in the status bar (range and total, 50/100/500, prev/next); "Read again" `IconAction`

### Browse (`browse/*`, DataGrid)

- [x] SQL WHERE bar: Enter applies, Esc reverts, × clears; error under the bar → unchanged (`SqliteFilterBar.vue`); the error comes from the keyed query
- [x] Search all columns, debounced 250 ms, `CAST … LIKE … ESCAPE '!'` ⚠ F8 → unchanged search; F8 fixed: the count is its own query keyed by the filter, so it runs once per filter and not on every page (tested); pages are keyed too, so a late answer never replaces a newer page (C17, tested)
- [x] Group chip clears grouping → unchanged
- [x] Columns menu → unchanged
- [x] Export popover … toasts `Exported N rows`, "Export failed" → unchanged choices; "all rows" now reads BLOBs in full (`fullValues`) and SQL INSERT writes `X'…'`; selected rows with a BLOB read only in part are refused with the reason ("Could not export the rows")
- [x] Header menu: sort (server), Filter, Group by, Show as (persisted), Hide, Pin left/right, Autosize all, Copy name → unchanged; Show as is keyed by the database's identity, widths and pins persist per table (`layoutKey`)
- [x] Grouped view: Enter / double-click / "Show the rows in this group" drills in → unchanged
- [x] Row context menu … "Show what the device changed" …; "Copy row as INSERT" …; "Delete row(s)" writable only → unchanged items; "Show what the app changed"; INSERT copies use `sqlText.toSqliteInserts` (exact integers, `X'…'`, refusal for a part-read BLOB); "Delete row…" only on opened files; filtering on a part-read BLOB says why it cannot
- [x] Delete rows: needs a primary key …; confirm …; local copy; toast → `useSqliteWrites.deleteRows`: Cladd confirm naming the table and the file, keys written exactly (C18 tested), toast "Deleted the row" / "Deleted N rows"
- [x] Inspector (Space or status-bar button; persisted `capubridge:sqlite-inspector`): Fields / JSON …, FK link → unchanged `DataGridInspector`; Space opens it on the row; its toggle is the shared record-pane toggle (`capubridge:data-record-pane`, palette "Show or hide the record pane"); the old inspector key is not carried over
- [x] Grid keys → unchanged (`DG gridKeys.ts`)
- [x] Recently changed rows highlighted → unchanged
- [x] Status bar: x of y rows, selection, Σ/avg/min/max, nulls, groups, read-only lock, `ProvenanceTag`, query ms, inspector toggle → pager range, selection and aggregates, groups, the lock with its reason on hover (`HintTooltip`), query ms, the pane toggle; provenance moved to the header
- [x] Empty: `"T" has no rows`, "No rows loaded", "No rows match … and the search …" + "Clear filters"; skeleton → same words with curly quotes; a failed read shows "Could not read “T”" with Try again
- [x] Read-only reasons → one function of the database alone (`browse/sqliteWriteAccess.ts`): "A copy pulled from the phone: changes here would never reach the app's database, so it is read-only." / "A copy read from the page: …"; no-PK "This table has no primary key, so a row cannot be told apart."
- [ ] Cell edit and add row: not implemented (grid emits `edit`, unhandled) → still not implemented; planned for opened files only (`data-plan.md` §5.5), phased to R3b

### Structure (→ `SqliteStructure.vue`)

- [x] Columns (#, Column, Type, Not null, Default, PK n), Indexes (Name, Unique, Columns), Foreign keys (…; target opens the table), CREATE statement → Columns (#, Column, Type, Required, Default, Primary key "Yes" / "Yes, part n"); Indexes with "unique / not unique · on …" and their SQL, or why an automatic index has none; Foreign keys (target opens the table); **Triggers** (new) with their SQL; CREATE statement. Read from the copy (C20)
- [x] "Loading structure…", error box, "No columns reported." → "Reading how the table is built", `DataState` error with Try again, "The database reported no columns."

### SQL (→ `SqliteSqlPane.vue`)

- [x] Textarea seeded `SELECT * FROM "T" LIMIT 100;`, Run, "Running…", inline error, "N row(s)", results in `VirtualDataTable`, "Run a query to see results." ⚠ C25 → seeded with the last query run on this database, else the table's SELECT; Run (primary) and Ctrl+Enter; "The query did not run" with the database's words; results in `DataGrid` with its status bar (rows, ms); "Run a query to see its rows". "Earlier queries": the last 20 per database, kept across runs (`useSqliteSqlHistory.ts`). Also on the database (no table)
- [x] Only SELECT on the current table (client regex), read-only connection ⚠ C25 → fixed: the regex is gone; any read across any table runs, and the pane says plainly "Read-only: the database refuses statements that change data."

### Refresh, polling and change tracking

- [x] Refresh: native `sqlite_refresh_database` + `sqlite_export_bytes` + diff + `openDb`; OPFS hash + read + diff + overwrite + stat; jeep hash + read ⚠ F5 F7 → unchanged steps (`useSqliteSnapshotSync.ts`), then every query of the database is read again; F5/F7 deferred
- [x] Background poll every 5 s, always on … ⚠ F6 C15 → a self-scheduling 5 s check, one at a time, paused while the window is hidden and, for a page database, while the app is away (F6 in part; the stat-failure backoff and C15 deferred)
- [x] Snapshot diff with sql.js into the changes store …, change overlay and stripes → unchanged
- [x] Diff dialog: table, operation, row key, observed at, before/after → Cladd `Dialog` ("Changed in T", key, "Seen …", the JSON diff) (`SqliteChangeDiffDialog.vue`)
- [x] System change messages recorded but not shown here → unchanged

### Persisted preferences and URL

- [x] `localStorage["sqlite-sidebar-settings"]` … keyed by path → moved into `capubridge:data-sidebar:v1` (see Sidebar)
- [x] `capubridge:sqlite-explorer`, `capubridge:sqlite-inspector`, `capubridge:sqlite-show-as`, `capubridge:inspector-view` → `capubridge:data-layout:v2:sqlite`, `capubridge:data-record-pane`, `capubridge:sqlite-show-as` (keyed by database identity now), `capubridge:inspector-view`; new `capubridge:sqlite-sql-history:v1`
- [x] `:db` / `:table` carry names, decoded twice ⚠ C5 C22 → fixed: `:db` is the database's path (phone, `opfs:…`, `jeep-sqlite:…`), an opened file has its own route and id; params are used as vue-router decodes them, once; a link by name (Device › Files, old bookmarks, the Graph's "Open data") is matched once and the address bar corrected (`sqliteDatabaseRef.ts`, tested)
- [x] Deep link / reload re-opens native databases; OPFS/jeep re-pull; imported sessions are lost → unchanged; a reloaded file route says "Files opened here last only while Capubridge runs" with "Open a SQLite file…" (keeping files across runs is out of scope, `data-plan.md` §8)

### Import / export formats

- [x] Export .sqlite/.db: Tauri save + `sqlite_export_bytes` (main file only) → unchanged (WAL C15 deferred)
- [x] Export SQL dump … pages of 1,000, BLOB → NULL → Rust, one pass, BLOBs and wide integers exact (C19, F8)
- [x] Import .sql/.txt (replace): drop user tables, then replay → all or nothing on a copy, views and triggers dropped too (M13)
- [x] Browse export CSV / JSON / INSERT via `downloadText` → unchanged; INSERT through `sqlText`

### Pending live checks (Data round 3)

Not checked: Capubridge was not running during the round, and checks never write on a phone.

- [ ] The `data` gate: SQLite opens for Presalio on the Redmi with the DevTools link down; a local or
      Chrome target waits for its link; "Open a SQLite file…" on the gate with no phone
- [ ] A phone database: tables, rows, paging to the end, sort, filter, search, group; the count does not
      run again on the next page; a change on the phone shows its stripes; Structure with triggers
- [ ] Presalio's OPFS / SAH-Pool databases from the sidebar and from the OPFS tab; the app put in the
      background (stale note, the copy stays readable, "not read yet" when nothing was pulled)
- [ ] A jeep-sqlite database over 12 MB (progress toast), if a test app has one
- [ ] An opened file: delete rows, clear a table, drop a table, replace it with a dump that fails half
      way (nothing changes) and with one that works; two files open at once; close one
- [ ] Save a copy and Save as SQL for a phone, an OPFS and an opened database; open the dump again
- [ ] A wide integer key and a BLOB column: cell, inspector, filter, copy as INSERT, export
- [ ] Device › Files "Open in Data" and the Graph's "Open data" land on the database (name link corrected)
- [ ] SQL pane: Ctrl+Enter, "Earlier queries" after a restart, a query across two tables, an UPDATE refused
- [ ] Dark and light first paint of the overview, the structure and the diff dialog; the sidebar at 200 px
- [ ] Graph: zoom after a rebuild, layout kept after an app reload, Auto layout through the ELK worker,
      Vue Flow styles now loaded with the graph chunk (no flash, nodes look as before)

## Graph (`graph/StorageGraphExplorer.vue` and children)

Still the Graph tab: its move into a Diagram view of a database is **R3b** (`data-plan.md`, R3 status).
R3 fixed its bugs in place (`249811d6`), noted on the lines below; the lines stay unticked until the move.

### What it shows

- [ ] IndexedDB stores of the selected origin (except `localforage`) as nodes: key path, index paths, top-level keys of 12 sampled records (`graph/useStorageGraphQueries.ts:62-87`, `storageGraphEntityBuilders.ts:143-168`)
- [ ] LocalForage: one node per key (`useStorageGraphQueries.ts:100-109`, `storageGraphEntityBuilders.ts:170-200`)
- [ ] Native SQLite tables of every database of the package: columns, indexes, FKs (`useStorageGraphQueries.ts:113-216`, `storageGraphEntityBuilders.ts:202-249`)
- [ ] Foreign-key links (solid) from `PRAGMA foreign_key_list` (`useStorageGraphRelationships.ts:22-47`, `useStorageGraphCanvasNodes.ts:466-475`)
- [ ] Logical SQLite links (dashed): indexed non-PK `*_id` columns matched by name, checked by SQL (≥ 80 % of 40 values) (`storageGraphSqliteDiagnostics.ts:111-203`) ⚠ C2 R3: ⚠ C2 fixed in place: a column with a declared foreign key is not guessed again, and edge ids carry their kind (`storageGraphSqliteDiagnostics.test.ts`)
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
- [ ] Search on title, subtitle, container, fields, annotation (`:100-125,468-472`) R3: debounced 200 ms (F12)
- [ ] Source filter all / IndexedDB / LocalForage / SQLite (`:475-485`)
- [ ] Strategy inferred / schema (`:487-495`)
- [ ] Pan / Select mode (`StorageGraphCanvasDock.vue:19-44`)
- [ ] Add note (`StorageGraphExplorer.vue:252-265`)
- [ ] Auto layout (ELK layered, orthogonal routes), undoable (`:223-250`, `storageGraphElkLayout.ts:104-222`) ⚠ F12 R3: F12 in place: ELK loads on the first layout, in a worker in the app; the canvas no longer imports it (`storageGraphNamingFamilies.ts`)
- [ ] Toggle guessed links (`StorageGraphCanvasDock.vue:76-90`)
- [ ] Zoom −/+, % = fit view, first fit per scope, range 0.01–2 (`StorageGraphViewportToolbar.vue:28-70`, `StorageGraphExplorer.vue:369-379,432-435,541-542`) ⚠ C1 R3: ⚠ C1 fixed in place (`updateZoomPercent` returned by the interactions composable)
- [ ] Undo / Redo (80 steps) (`:349-367`, `useStorageGraphHistory.ts`)
- [ ] Click node / edge / frame selects; empty canvas clears; Shift multi-select; box select (`useStorageGraphCanvasInteractions.ts:363-382`, `StorageGraphExplorer.vue:545-561`)
- [ ] Drag nodes and frames (members follow), positions saved (`useStorageGraphCanvasInteractions.ts:230-275,384-393`) R3: positions saved in one write per drag (F12)
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
- [ ] One unreadable SQLite file fails the whole SQLite graph (`useStorageGraphQueries.ts:119-172`) R3: fixed in place: the others still show, the failures are logged; the schema is kept 60 s (F13 in part)
- [ ] `localStorage["capubridge:storage-graph:v1"]`: positions, notes, manual links, annotations, groups per scope `storage-graph:{serial}:{cdpTargetId}:{origin}:{package}` (`useStorageGraphStore.ts:12,82-88`, `useStorageGraphData.ts:80-88`) ⚠ C4 R3: ⚠ C4 fixed in place: scopes keyed `storage-graph:v2:{serial}:{origin}:{package}` (no page id), old keys migrated on load, 60 scopes at most, writes debounced, reading never writes (C3) (`stores/__tests__/useStorageGraphStore.test.ts`)
