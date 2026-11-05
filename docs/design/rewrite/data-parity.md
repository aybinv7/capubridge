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

- [ ] Sub-navigation tabs from route `meta.label`: IndexedDB · Local storage · LocalForage · Cache · OPFS · SQLite · Graph (`StoragePanel.vue:11`, `src/components/layout/SubNavTabs.vue`)
- [ ] `/storage` redirects to `/storage/indexeddb` (`routes.ts:7`)
- [ ] Route names `storage-indexeddb`, `storage-indexeddb-snapshot`, `storage-localstorage`, `storage-localforage`, `storage-cache`, `storage-opfs`, `storage-sqlite`, `storage-graph` (`routes.ts:10-56`)
- [ ] `indexeddb/:db?/:store?` and `indexeddb-snapshot/:db?/:store?` both render `IDBExplorer.vue`; snapshot has `navigation: false` (`routes.ts:10-20`)
- [ ] Gate `requires: "target"` on IndexedDB, Local storage, LocalForage, Cache, OPFS; none on Snapshot, SQLite, Graph (they gate themselves or not at all) (`routes.ts:13,25,31,37,43,49,55`)
- [ ] Target change remounts the tab (gate subject `target:<id>`, `src/components/gate/GatedView.vue:55`, `src/lib/gates/resolve.ts:100`); a lost link after first render keeps the tab under the stale strip (`GatedView.vue:33-37`)
- [ ] App in background: gate notice strip only, no per-tab state (`src/lib/gates/resolve.ts:42-47`)
- [ ] IndexedDB change tracking runs for the whole route, on every tab (`StoragePanel.vue:6`, `changes/useIndexedDBChangesTracking.ts`) ⚠ F2
- [ ] Palette `Go to Data` / `g s` (feature registry `id: "storage"`, `commandPalette: true`)
- [ ] No screen palette provider, no route-level shortcuts (no `useCommandProvider` in the module)
- [ ] Lazy route chunks per tab (`routes.ts`, `() => import(...)`)

Inbound and outbound links that must keep working:

- [ ] App › Overview "Data" links to `storage-indexeddb`, `storage-localstorage`, `storage-sqlite`, `storage-opfs` by route name (`src/modules/app/overview/dataLinks.ts:7-12`, `AppStorage.vue`)
- [ ] Device › Files viewer opens a SQLite file in Data: `{ name: "storage-sqlite", params: { db: fileName } }` when the file is in `/data/data/<selected app>/databases/` (`src/modules/devices/files/viewer/useDatabaseRoute.ts:13-32`)
- [ ] SQLite source badge "Show in OPFS explorer" → `/storage/opfs?path=` (`sqlite/SqliteSourceBadge.vue:18-21,46-53`)
- [ ] OPFS file click → SQLite tab with the pulled copy (`opfs/OPFSExplorer.vue:174-177`, `useOpenSqliteSource.ts:89`)
- [ ] Graph inspector "Open data" → `/storage/indexeddb/:db/:store`, `/storage/sqlite/:db/:table`, `/storage/localforage` (`graph/StorageGraphInspector.vue:284-295`, `graph/StorageGraphExplorer.vue:322-324`)
- [ ] Automation reads `useIndexedDBChangesStore().lastEventAt` and the SQLite changes store (`src/composables/useAutomationSignals.ts:2-18`) ⚠ C33
- [ ] Session recorder shares `orderKeyColumns` and the SQLite pull cache (`src/composables/useSqliteRecorder.ts:4,163-168,200`) ⚠ C37

## Cross-cutting state shared by the tabs

- [ ] Selected origin per target, in memory (`stores/useStorageContextStore.ts:5-18`); written by IndexedDB, Local storage and Graph; read by change tracking (`changes/useIndexedDBChangesTracking.ts:44,241`). `clearTarget` never called
- [ ] Query defaults `retry: 1`, `refetchOnWindowFocus: false`, `staleTime` 0 → every tab refetches on mount (`src/main.ts:18-27`)
- [ ] CDP calls to a backgrounded app wait for the 30 s command timeout (`packages/cdp-protocol/src/cdp/client.ts:47`), retried once → spinners up to ~60 s
- [ ] Every device script goes through `evaluateChecked` and host data enters only as `jsLiteral` (`cdp:evaluate.ts`) — except IDB export/import (⚠ M8)
- [ ] OPFS snapshot cache in memory, keyed `targetId::path`, reused when size + lastModified match (`opfsSnapshotCache.ts:21-50`); `clearTarget` never called

## IndexedDB (`indexeddb/IDBExplorer.vue` and children)

### Sidebar (`IDBExplorer.vue`)

- [ ] Search databases and stores by name, local (`IDBExplorer.vue:83,649,272-305`); "No stores match" (`:941-946`)
- [ ] Import button (Upload) → `handleImportDatabase`: Tauri open dialog (`pickIdbExport`, `idbImportExport.ts:203`); with a live client asks to replace, otherwise opens the file as a snapshot (`IDBExplorer.vue:654-660,505-543,517-521`) ⚠ M9
- [ ] Empty state "Import JSON snapshot" → same handler (`:724-730`)
- [ ] "Back to live" in snapshot mode → `/storage/indexeddb` (`:668-673`)
- [ ] Hidden databases Show/Hide toggle, persisted (`:676-691`)
- [ ] Hidden stores Show/Hide toggle, persisted (`:694-708`)
- [ ] Click database row → expand/collapse, persisted by name (`:752`)
- [ ] Database overview icon → sets origin, pushes `/…/:db` (`:773-779,320-327`)
- [ ] Database menu: Pin/Unpin (`:792`), Hide/Unhide (`:799`)
- [ ] Database menu: Export database (JSON) → `exportDatabaseToJson` (`IndexedDB.requestDatabase` + one `Runtime.evaluate` cursor walk, `idbImportExport.ts:95-182`) → Tauri save → `save_base64_file`. Toasts `Exporting "<db>"…`, `Exported "<db>" to <path>`, "Export cancelled", `Export failed: …`, "No active CDP target" (`IDBExplorer.vue:475-503`); snapshot: re-serialises the file, `Exported to <path>` (`:477-486`) ⚠ M8 F4
- [ ] Database menu: Import database (replace) — **MUTATES**: deletes and recreates the database named in the file (`:811`, `idbImportExport.ts:223-297`) ⚠ M7 M9
- [ ] Database menu: Clear DB changes (hidden in snapshot, disabled without changes), local only (`:816-823`)
- [ ] Database menu: Delete database — confirm "Delete database" → `IDBDomain.deleteDatabase` (`indexedDB.deleteDatabase` in page, `cdp:indexeddb.ts:543-558`) — **MUTATES**; failure only `console.error`; then `/storage/indexeddb` (`IDBExplorer.vue:825-831,545-577`) ⚠ M7
- [ ] Snapshot: Remove snapshot — confirm → `snapshotStore.removeSnapshot`, `router.replace` (`:547-556`)
- [ ] Click store → sets origin, pushes `/…/:db/:store` (`:865,307-318`)
- [ ] Store menu: Pin/Unpin (`:894`), Hide/Unhide (`:901`), keyed `db::store` without origin
- [ ] Store menu: Clear changes, local (`:910-918`)
- [ ] Store menu: Clear all records — confirm "Clear all records" → `IDBDomain.clearObjectStore` (`store.clear()`, `cdp:indexeddb.ts:469-502`) — **MUTATES**; refetches records and info; failure only `console.error` (`IDBExplorer.vue:920-926,428-448`)
- [ ] Store menu: Delete table — confirm "Delete table" → `IDBDomain.deleteObjectStore` (reopen at version+1, `cdp:indexeddb.ts:504-541`) — **MUTATES the schema**; failure only `console.error` (`IDBExplorer.vue:927-933,450-473`) ⚠ M7
- [ ] Clear/delete store items and Clear changes hidden in snapshot mode (`:815,908`)
- [ ] Resizable sidebar 15 % (10–30), not persisted (`:638-639`)
- [ ] Hidden databases `localforage`, `jeepSQLiteStore`, `jeepSqliteStore` always excluded (`:292`)
- [ ] Active store auto-expands and scrolls into view (`:603-621,624-630`)

### Database overview (`indexeddb/IDBDatabaseOverview.vue`)

- [ ] Name, origin, version (`:90-104`)
- [ ] Stats Stores, Records, Indexes, Auto-increment, estimated size vs the origin's IndexedDB usage (`navigator.storage.estimate`) (`:35-42,115-165`, `cdp:indexeddb.ts:313-338`, `src/composables/useStorageSize.ts:50-87`) ⚠ C13 F16
- [ ] Top-10 bars by records and by size; click a bar → open store (`:196-280,213,252`)
- [ ] Store table: Store, Key path, Records (bar), Next key (`keyGeneratorValue`), Indexes (expandable), Auto-increment; click row → open store (`:283-419,324`)
- [ ] Index sub-rows: name, keyPath, unique, multiEntry (`:389-487`)
- [ ] Refresh / Retry → `refetchStoreInfo` (`:105-111,178-183`)
- [ ] States: loading spinner (`:170-172`), "Failed to load store information" + Retry (`:175-184`), "No store details available" (`:187-193`), "No size data yet" (`:276-278`)

### Store toolbar (`indexeddb/IDBTableToolbar.vue`)

- [ ] Change badge (+add ~update −delete) toggles "changes only", clears selection (`:55-88`, `IDBExplorer.vue:998`, `IDBTable.vue:168-173`)
- [ ] Page size 50 / 100 / 500, resets to page 0, clamped by `indexedDbProtocolPageSize` (`:34,91-105`, `idbPaging.ts:1-7`)
- [ ] Previous / next page; next disabled when `!hasMore` (`:109-129`, `IDBExplorer.vue:342-347`)
- [ ] Refresh → refetch database list and records (not store info) (`:133-141`, `IDBExplorer.vue:579-582`)

### Table actions (`indexeddb/IDBTableActions.vue`)

- [ ] "Search all columns…" — TanStack global filter, current page only (`:57-60,131-148`) ⚠ C8 C10
- [ ] Filter builder popover → `advancedFilters` (`:151-157`)
- [ ] Clear filters (×) — column, global and advanced (`:164,72-76`)
- [ ] Selection bar: Copy selected as JSON → toast "Copied to clipboard" / "N records copied" (`:181-190,85-94`)
- [ ] Selection bar: Delete selected → confirm "Delete Records" "Are you sure you want to delete N record(s)? This action cannot be undone." → sequential `idbWrites.remove` — **MUTATES** (`:192-200`, `IDBTable.vue:1052-1060,610-629`, `idbWrites.ts:46-69`) ⚠ M12
- [ ] Selection bar: Clear selection (`:202-210`)
- [ ] Column settings popover (`:215-221`)
- [ ] Layout menu: Auto-size columns (resets sizes), Fit to grid (fixed 1200 px), Reset layout (unpins all) (`:96-123`)
- [ ] Export menu: CSV (filtered), JSON (filtered), Selected (N) → `useIDBTableExport`, files `idb_<store>.csv/.json`, `_selected.json`; toasts "Exported to CSV" ("N rows exported"), "Exported to JSON", "Exported selected to JSON" (`:247-263`, `useIDBTableExport.ts:30-62`) ⚠ C8

### Filter builder (`indexeddb/FilterBuilder.vue`, `useAdvancedFilters.ts`)

- [ ] Add filter (first AND, then OR), AND/OR toggle, column combobox, operator combobox, remove, Cancel, Apply (`FilterBuilder.vue:65-92,164-302`)
- [ ] Operators: contains, equals, startsWith, endsWith, gt, gte, lt, lte, isNull, isNotNull, isTrue, isFalse, isEmpty, isNotEmpty (`useAdvancedFilters.ts:29-44`, matching `:60-97`) ⚠ C9
- [ ] Value: date picker for gt/gte/lt/lte/equals, text otherwise (`FilterBuilder.vue:259-283`) ⚠ C9

### Column settings (`indexeddb/IDBColumnSettings.vue`)

- [ ] Show/hide per column (`:172-177`)
- [ ] Group by per column (`:181-186`)
- [ ] Column type guessed from 20 samples (key, value, object, int, float, bool, date, string, array, field), primary-key and indexed marks (`:30-72,154-169`)

### Table (`indexeddb/IDBTable.vue`)

- [ ] Columns: change/selection gutter (pinned left), Key, then one Value column (first record primitive/array) or one column per field of the first 200 records (`:194-345`) ⚠ C12
- [ ] Cells: `JSON.stringify` for objects, `String` otherwise; Date/binary keys show `{"__type":…}` markers (`:299,318,340`) ⚠ C14
- [ ] Select all / row checkbox; deleted-change rows not selectable (`:223-283,440`)
- [ ] Header menu: sort asc/desc/clear (client, page, multi-sort) (`:744-773,429`) ⚠ C8
- [ ] Header menu: Filter… (adds an empty "contains" filter) (`:778-781`); Clear filter (dead, `:782-789`)
- [ ] Header menu: Group by / Ungroup (`:794-797,569-575`)
- [ ] Header menu: Pin left / right / unpin (`:800-832`); Hide column (`:835-841`)
- [ ] Column resize by drag (`:856-861`)
- [ ] Group rows: expand and group checkbox (`:875-904`)
- [ ] Single click opens row detail after 200 ms; second click within 200 ms starts inline edit (`:929`, `useIDBCellInteractions.ts:14,71-85`); footer hint says "Double-click row to view details" (`:1013`)
- [ ] Virtualised rows (`useFixedVirtualList`), 30-row skeleton while loading (`:652-659`)
- [ ] Row appearance: added / updated / deleted (75 % opacity) / selected / locally modified (`useIDBRowAppearance.ts:25-70`)
- [ ] Footer `filtered / total rows` (`:995-997`); download icon "Copy selected as JSON" that downloads a file (`:1001-1009`)
- [ ] Empty: "No records in this store" (`:662-667`), "No matching records" (`:670-675`)

### Inline cell editor (`indexeddb/IDBCellEditor.vue`, `useIDBCellInteractions.ts`)

- [ ] Commit → `idbWrites.save` → `IDBDomain.putRecord` (`cdp:indexeddb.ts:361-430`) — **MUTATES**, no confirm (`useIDBCellInteractions.ts:87-109`) ⚠ M2 M3 M6
- [ ] Key column and deleted rows not editable (`useIDBCellInteractions.ts:29-34`)
- [ ] Enter commits, Escape cancels, blur commits (`IDBCellEditor.vue:120-123,134-136,173-177,195-197`) ⚠ M6
- [ ] Numbers: ↑/↓ and ± buttons nudge (`:160-186`)
- [ ] Dates: calendar popover, double-click to type (`:103-110,137-156`) ⚠ M5
- [ ] Column treated as date when values look like dates or the name ends in "on"/"at" (`useIDBCellInteractions.ts:54-60`) ⚠ M6

### Context menu (`IDBTable.vue:950-978`, `useIDBCellInteractions.ts:124-152`)

- [ ] View record
- [ ] Edit "<column>"
- [ ] Copy cell value → toast "Copied to clipboard"
- [ ] Copy record as JSON (value only)
- [ ] Delete record → `idbWrites.remove` → `IDBDomain.deleteRecord` — **MUTATES**, no confirm (`:965-976`) ⚠ M4 C14

### Row detail dialog (`indexeddb/IDBRowDetailDialog.vue`, `useIDBRowDetail.ts`)

- [ ] Header: key, size (recomputed per keystroke), `i / total`, badge unsaved / invalid / record, read-only badge (`IDBRowDetailDialog.vue:77-105`, `useIDBRowDetail.ts:42-47`)
- [ ] Prev / Next buttons and Ctrl+↑ / Ctrl+↓; past the page fetches one record by device offset (`IDBRowDetailDialog.vue:65-76`, `useIDBRowDetail.ts:155-172`, `IDBExplorer.vue:353-374`) ⚠ C11
- [ ] JSON editor (shared `JsonEditor`); Ctrl+F focuses its filter (`useIDBRowDetail.ts:45-53`)
- [ ] Save button and Ctrl+S → `putRecord` — **MUTATES**; enabled only when unsaved; toast "Record contains invalid JSON" (`useIDBRowDetail.ts:117-134`)
- [ ] Delete button → `deleteRecord` — **MUTATES**, no confirm (`useIDBRowDetail.ts:136-146`, `IDBRowDetailDialog.vue:128-136`) ⚠ M4
- [ ] Copy → toast "Copied to clipboard" (`useIDBRowDetail.ts:148-153`)
- [ ] Diff button when the record changed or was modified locally → `IDBChangeDiffDialog` (`IDBRowDetailDialog.vue:109-118`, `IDBTable.vue:552-554,1041-1049`)
- [ ] Shortcut hint popover (`IDBRowDetailDialog.vue:145-167`)

### Change diff dialog (`indexeddb/IDBChangeDiffDialog.vue`, `JsonDiffViewer.vue`)

- [ ] Store, operation badge, key, observed at; before (normalised) vs the current editor text (`IDBChangeDiffDialog.vue:38-66`, `IDBTable.vue:548-550`)

### Write toasts (`indexeddb/idbWrites.ts`)

- [ ] "Record is read-only" (`:25`), "Record saved on the device" (`:38`), "Record was not saved" (`:41`)
- [ ] "Record deleted on the device" / "N records deleted on the device" (`:57-59`), "Record was not deleted" / "X of N deletes failed" (`:61-65`)
- [ ] Toasts fire only after the device answers (`idbWrites.ts`, tested in `__tests__/idbWrites.test.ts`)

### Change tracking (`changes/useIndexedDBChangesTracking.ts`, `indexeddbChanges.service.ts`, `useIndexedDBChangeOverlay.ts`, `stores/useIndexedDBChangesStore.ts`)

- [ ] Subscribes `Storage.trackIndexedDBForOrigin`, listens `indexedDBContentUpdated` / `indexedDBListUpdated` (`useIndexedDBChangesTracking.ts:289-298`)
- [ ] Primes a snapshot of every store of every database of the origin, sequentially (`:96-148`)
- [ ] Flush throttle 220 ms, catalog debounce 180 ms (`:221-239`)
- [ ] Bounds: 1,500 records per store (else untracked), pages of 250, 400 feed entries, 64 field diffs (`indexeddbChanges.service.ts:12-16,183-230`, `useIndexedDBChangesStore.ts:140`)
- [ ] Stale sessions dropped by `sessionVersion` (`useIndexedDBChangesTracking.ts:46,101,132,158`)
- [ ] Changed records promoted to the top of every page (`useIndexedDBChangeOverlay.ts:161-200`) ⚠ M3
- [ ] Sidebar change gradient and segment bar per database and store (`IDBExplorer.vue:736-770,844-877`, `changes/changeSummaryFormat.ts:16-39`)

### States

- [ ] No target → gate (`routes.ts:13`)
- [ ] Database list loading spinner (`IDBExplorer.vue:712-714`)
- [ ] "No IndexedDB databases found" / "No snapshots imported" (`:716-731`)
- [ ] Database list error: none, device error becomes `[]` (`cdp:indexeddb.ts:171-173`) ⚠ C34
- [ ] "Select a database from the sidebar" (`IDBExplorer.vue:958-963`)
- [ ] Records error "Failed to load records. Make sure the target supports IndexedDB inspection." (`:1001-1006`)
- [ ] Loading flag includes background refetch; page change blanks the table (no `keepPreviousData`) (`:245`)
- [ ] Paging: offset `skipCount`, `hasMore` from CDP, total from `getMetadata.entriesCount`; 10,000-record clamp in `idbPaging.ts` and the eval fallback (`cdp:indexeddb.ts:188-191,725`, `src/composables/useIDB.ts:59`) ⚠ F3
- [ ] Records read through `IndexedDB.requestData` with an eval materialiser for values CDP cannot return by value (`cdp:indexeddb.ts:590-776`) ⚠ M2 F1
- [ ] Records marked read-only when they hold a Date or binary anywhere (`cdp:indexeddb.ts:649-652`)
- [ ] After save/delete only records refetch; counts and size stay stale (`IDBExplorer.vue:395-409`)
- [ ] No polling for IndexedDB data; live changes arrive only through the change overlay

### Snapshot mode (route `storage-indexeddb-snapshot`)

- [ ] Mode chosen by route name (`IDBExplorer.vue:72-75`); `:db` is the snapshot id (`:140-141,212-216`)
- [ ] Data from computeds over the in-memory file; size by `jsonByteSize` of every record (`:142-195,151-176`)
- [ ] `ProvenanceTag kind="imported" detail="read-only"` (`:667`); live mode shows no provenance
- [ ] Writes refused: toast "Snapshot is read-only" / "Connect a CDP target to mutate this database." (`:77-81,381-385`); table `readOnly` (`:1016`, `IDBTable.vue:963,1031`)
- [ ] Snapshots in memory only, lost on reload (`useIdbSnapshotStore.ts:12-41`)
- [ ] Reachable only by URL in practice (⚠ C7); live queries still fire for the snapshot id (⚠ C6)

### Persisted preferences

- [ ] `localStorage["idb-sidebar-settings"]`: pinned/hidden databases (`origin::db`), pinned/hidden stores (`db::store`), showHiddenDbs, showHidden, expandedDbs (by name) (`stores/useSidebarSettingsStore.ts:3-63`)
- [ ] Not persisted: column visibility/sizing/pinning/sort/grouping/filters (reset per store, `IDBTable.vue:150-166`), page size, panel sizes

### URL

- [ ] `:db` and `:store` decoded with an extra `decodeURIComponent` (`IDBExplorer.vue:89-90`) ⚠ C5
- [ ] Selected database resolved by name + origin, then name only (`:212-221`); origin written back (`:592-601`)
- [ ] Page, filter and changes-only reset on database/store change (`:584-588`)
- [ ] After delete: `/storage/indexeddb[/db]` (`:466,570`)

### Import / export formats (`indexeddb/idbImportExport.ts`)

- [ ] `{ format: "capubridge-idb-export", version: 1, exportedAt, origin, database: { name, version, stores: [{ name, keyPath, autoIncrement, indexes: [{ name, keyPath, unique, multiEntry }], records: [{ key, value }] }] } }` (`:40-65`)
- [ ] File `<db>.idb.json` through Tauri save + `save_base64_file` (`:184-196`, `IDBExplorer.vue:495`)
- [ ] Import reads with `read_local_file_base64`, checks `format` only (`:203-217`)
- [ ] Table CSV / JSON / selected JSON downloads (`useIDBTableExport.ts:5-62`)

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
