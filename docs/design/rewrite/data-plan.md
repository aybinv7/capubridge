# Data route rewrite plan

Companion to `data-parity.md` (the checklist) and `BRIEF.md` (the rules). Written from the code at
`1399987d`. Path conventions are the same as the parity file: relative to `apps/desktop/src/modules/storage/`
unless they start with `src/`, `src-tauri/` or `packages/` (`cdp:` = `packages/cdp-protocol/src/cdp/domains/`,
`RS` = `src-tauri/src/commands/sqlite.rs`, `OP` = `src-tauri/src/commands/opfs_pull.rs`,
`DG` = `src/shared/components/data/grid/`).

## 1. Decisions in one screen

1. **One Data frame for every tab.** It has a sidebar of sources and collections, a header, one grid,
   a record pane that follows the selection, an overview and the shared states. It is built on what
   `src/shared` already has: `DataGrid`, `DataGridInspector`, `DataGridStatus`, `JsonEditor`,
   code-viewer `JsonView`, `ConfirmDialog`, `CopyAction`, `FactList` and `useFixedVirtualList`.
   Today there are five table implementations, three JSON surfaces, two overviews, two
   sidebar-settings stores, two change toolbars and two diff dialogs.
2. **Tabs go from 7 visible + 1 hidden to 5.**
   - Local storage and LocalForage become one **Key-value** tab.
   - IndexedDB Snapshot becomes a provenance of the IndexedDB tab: an "Opened files" group in its
     sidebar.
   - Graph becomes a **Diagram** view of a database inside IndexedDB and SQLite.
   - Cache is renamed **Cache storage**.
   - OPFS and SQLite keep their names.
3. **SQLite gets a real gate** (new requirement, §4.6). Opened files get ungated routes and palette
   commands, so they stay reachable without a phone.
4. **Phone writes are made honest before anything else is made pretty.** Fourteen mutation or
   data-loss bugs are listed in §6.1. Each round fixes the ones in its tabs, with a test, before
   its UI work counts as done.
5. **Rounds** (§7):
   - R1 = frame + IndexedDB.
   - R2 = Key-value + Cache storage + OPFS + the pull pipeline (Rust copies, WAL, temp files).
   - R3 = SQLite + Diagram.

   The brief's grouping, with LS/LF in R1, would make R1 about 2.5× the size of R2. It would also
   force the frame to be designed around the two simplest sources. IndexedDB is the frame's
   heaviest consumer and has the worst bugs, so it shapes the frame. R2 inherits a frame that is
   already proven.

## 2. What exists today

### 2.1 Already shared and worth keeping

| Piece                                                                                                                          | Where                                       | Used by today                         |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------- |
| `DataGrid` + `DataGridRow` / `HeaderCell` / `Inspector` / `ColumnsMenu` / `Status`                                             | `DG`                                        | SQLite Browse only                    |
| Row and column virtualisation, ARIA grid, selection, TSV/JSON copy, aggregates, `rowStates` overlay, context menu, header menu | `DG DataGrid.vue:41-498`                    | SQLite Browse                         |
| `toCsv`, `toSqlInserts`                                                                                                        | `DG exportFormats.ts`                       | SQLite Browse                         |
| `JsonEditor`                                                                                                                   | `src/shared/components/data/JsonEditor.vue` | IDB row detail, LS, LF, Network mocks |
| `JsonView` / `JsonTreeView` / `TextView` / `ImageView`                                                                         | `src/shared/code-viewer/`                   | Network, Device Files                 |
| `ConfirmDialog` + `confirm.ts`, `CopyAction`, `IconAction`, `SortHeader`, `HintTooltip`                                        | `src/shared/components/presentation/`       | Device, App, Network                  |
| `FactList`                                                                                                                     | `src/shared/facts/`                         | Device, App                           |
| `formatBytes`, dates, `compareText` collator                                                                                   | `src/shared/format/`                        | Device, App, Network                  |
| `useFixedVirtualList`                                                                                                          | `src/shared/composables/`                   | LS, LF, Cache, OPFS, IDB              |
| `ProvenanceTag`, `prov-*` utilities                                                                                            | `src/components/gate/ProvenanceTag.vue`     | IDB snapshot, SQLite                  |
| `downloadText`, `fileStem`                                                                                                     | `src/lib/download.ts`                       | SQLite Browse                         |

Caution: `26f17f88` left the DataGrid's Cladd table language "paused for a top-level review". Group
drill-in by keyboard and pinning were never verified live. R1 verifies both before building on them.

### 2.2 Duplicated implementations to unify

| Concern                                                | Variants today                                                                                                                                                                                                                                                                                                 | Becomes                                                                                                                                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Record table                                           | `IDBTable.vue` (TanStack + own virtual list, 1,062 lines); hand `<table>` in `LSExplorer.vue`, `LocalForageExplorer.vue`, `CacheExplorer.vue`, `OPFSExplorer.vue`; `VirtualDataTable` in the SQLite SQL tab (`SqliteExplorer.vue:37,2150`); hand tables in Structure, both overviews and the Graph field table | `DataGrid` everywhere a list can exceed ~50 rows; a small static `DataList` row for short fixed lists (overview, structure)                                                                                          |
| Column settings and header menu                        | `IDBColumnSettings.vue`, `IDBTable.vue:716-843`, `IDBTableActions.vue` layout menu                                                                                                                                                                                                                             | `DataGridColumnsMenu` + `DataGridHeaderCell`                                                                                                                                                                         |
| Filters                                                | `FilterBuilder.vue` + `useAdvancedFilters.ts` (client, IDB); `SqliteColumnFilter.vue` + `sqliteQuery.ts` (server, SQLite)                                                                                                                                                                                      | One `DataFilterPopover` (operators + value editor by column type) emitting a predicate list. Each source evaluates it: SQL `WHERE` for SQLite, a device-side cursor scan for IDB (§5.1), in memory for key-value     |
| Cell editors                                           | `IDBCellEditor.vue` (text, number, date)                                                                                                                                                                                                                                                                       | `DG editors/` wired to the grid's existing `edit` emit (today unhandled, `SqliteBrowse.vue:283-306`)                                                                                                                 |
| Record view and edit                                   | `IDBRowDetailDialog.vue` + `useIDBRowDetail.ts` (modal), LS/LF edit dialogs (modal, duplicated), `DataGridInspector` (pane)                                                                                                                                                                                    | One `RecordPane` that follows the selection: Fields / JSON view; Edit switches to `JsonEditor`; Save / Delete / Copy / Prev-Next. The modal goes away (Device review: "overlays where a layout change was expected") |
| JSON read-only                                         | `src/shared/components/data/JsonViewer.vue` (Replay), `src/shared/code-viewer/JsonView.vue` + `JsonTreeView.vue`, `DataGridInspector` JSON view                                                                                                                                                                | Code-viewer `JsonView` (tree, text, find, line cap). `JsonViewer.vue` is left for Replay to migrate later                                                                                                            |
| JSON diff                                              | `indexeddb/JsonDiffViewer.vue`, imported across tabs by `sqlite/SqliteChangeDiffDialog.vue:6`                                                                                                                                                                                                                  | `src/shared/code-viewer/JsonDiff.vue`                                                                                                                                                                                |
| Change diff dialog                                     | `IDBChangeDiffDialog.vue`, `SqliteChangeDiffDialog.vue`                                                                                                                                                                                                                                                        | One `ChangeDiff` section inside `RecordPane` (no dialog)                                                                                                                                                             |
| Change summary badges                                  | `IDBTableToolbar.vue:55-88`, `SqliteTableToolbar.vue:55-88`                                                                                                                                                                                                                                                    | `ChangeSummary.vue` in the collection header                                                                                                                                                                         |
| Pager                                                  | `IDBTableToolbar.vue:91-129`, `SqliteTableToolbar.vue:90-128`                                                                                                                                                                                                                                                  | `DataPager.vue` in the `DataGridStatus` slot                                                                                                                                                                         |
| Overview                                               | `IDBDatabaseOverview.vue` (494), `SqliteDatabaseOverview.vue` (291)                                                                                                                                                                                                                                            | `DataOverview.vue` (stats via `FactList`/tiles, top-N bars, collection list) fed by a per-source metrics model                                                                                                       |
| Sidebar settings                                       | `stores/useSidebarSettingsStore.ts` (IDB, `idb-sidebar-settings`), `stores/useSqliteSidebarSettings.ts` (`sqlite-sidebar-settings`)                                                                                                                                                                            | One `useDataSidebarSettings` store, namespaced by kind and scoped by phone + app (§4.3), with a migration of both keys                                                                                               |
| Confirm                                                | shadcn `confirm-dialog` (IDB, SQLite), hand dialogs (LS, LF), none (OPFS)                                                                                                                                                                                                                                      | Shared Cladd `ConfirmDialog` + `confirm.ts` through one `useDataConfirm()`                                                                                                                                           |
| Downloads and saves                                    | `useIDBTableExport.ts:5-13` own anchor; `lib/download.ts`; Tauri save + `save_base64_file` (IDB export, SQLite export)                                                                                                                                                                                         | `lib/download.ts` gains `saveFileAs(bytes or text, suggestedName, filters)` (Tauri dialog). Every export uses one of the two helpers                                                                                 |
| Formatters                                             | `IDBDatabaseOverview.vue:72-84`, `OPFSExplorer.vue:109-120`, `useOpenSqliteSource.ts:9-14`, LS/LF size helpers                                                                                                                                                                                                 | `src/shared/format`                                                                                                                                                                                                  |
| SQL quoting                                            | `sqliteImportExport.ts:6-17`, `diffSqliteSnapshots.ts:31-37`, `browse/sqliteQuery.ts:5-17`, `DG exportFormats.ts:15-25` (they disagree on BLOBs)                                                                                                                                                               | One `sqlite/sqlText.ts` (`quoteIdent`, `sqlLiteral`), tested                                                                                                                                                         |
| `getDomain()` / "No active CDP connection" boilerplate | `src/composables/useStorage.ts:17-130` (×4), `useLocalForage.ts:12-16`, `useStorageSize.ts:26-48`                                                                                                                                                                                                              | One `useCdpDomain(factory)` helper (logic-neutral)                                                                                                                                                                   |
| OPFS read scripts                                      | TS `cdp:opfs.ts:338-440` vs Rust `OP:155-216`, `escape_js_string` vs `singleQuotedContent`                                                                                                                                                                                                                     | Keep both transports. Pin the scripts with one shared fixture test each (R2)                                                                                                                                         |
| File preview                                           | `src/modules/devices/files/viewer/*` (viewer body, sniffing, read plans, SQLite header)                                                                                                                                                                                                                        | Lift the transport-agnostic part to `src/shared/file-viewer/` (R2). Device and OPFS both consume it                                                                                                                  |

### 2.3 Local storage vs LocalForage: one screen twice

About 600 of the 668–678 lines are the same (state refs, `inferType`, validation, filter, virtual
list, dialog, keyboard, template). The real differences are only:

- the domain calls,
- where the origin lives (store vs local ref),
- delete error handling (`console.error` vs toast),
- rename order (delete-then-set vs set-then-delete),
- two button heights.

Line ranges are in the R2 inventory: `LSExplorer.vue:46-359` vs `LocalForageExplorer.vue:39-345`.

## 3. Tabs: merge, rename, keep

The user is a developer debugging an offline-first Capacitor app (Odoo-style: Dexie over
IndexedDB for business data, Capacitor SQLite for bulk tables, localStorage for session and
settings). The question each change answers is "where is my data and is it what the app wrote?".

| Today                                 | After                                                                                                                                      | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IndexedDB + hidden IndexedDB Snapshot | **IndexedDB**, with an "Opened files" group in the sidebar                                                                                 | The snapshot is a JSON export of an IndexedDB database. Same data, different provenance. Today it is reachable only by typing its URL: import opens it only when no client exists, and the live route is gated without one (`IDBExplorer.vue:517`, `routes.ts:19`). The `storage-indexeddb-snapshot` route stays, ungated, so an opened export can be read with no phone. The palette gains "Open an IndexedDB export…"                                                                                                                                                                                                                             |
| Local storage + LocalForage           | **Key-value** (route name `storage-localstorage` kept for `dataLinks.ts`; `/storage/localforage` redirects with `?source=localforage`)     | Both are key → value lists with the same editor and the same screen code. LocalForage today shows "No origins found" unless the default instance on the IndexedDB driver is used (`cdp:localforage.ts:26-44`). In one tab the sidebar lists every key-value source the page has: Local storage per origin, Session storage (new, one flag in `cdp:storage.ts:55,62,69`), and each LocalForage instance detected by name, store and driver. The `localforage` IndexedDB database is no longer silently hidden in IndexedDB (`IDBExplorer.vue:292`): it is listed with an "Opened as key-value" link, so no data is invisible                         |
| Cache                                 | **Cache storage**                                                                                                                          | "Cache" reads as the HTTP cache. Cache Storage is the API name that DevTools uses, and it is service-worker data. It stays a tab: it holds responses (status, headers, body), not records or files                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| OPFS                                  | **OPFS**                                                                                                                                   | A file tree, not records. "Files" would collide with Device › Files. Developers who use OPFS know the word; the tooltip spells it out                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| SQLite                                | **SQLite**                                                                                                                                 | Unchanged scope (native, OPFS, jeep, opened files)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Graph                                 | **Diagram** view of a database in IndexedDB and SQLite (beside Overview), with "Include the app's other data" to keep the cross-source map | The schema strategy is almost entirely SQLite. IndexedDB and LocalForage only get guessed links (`graph/storageGraph.utils.ts:253-278`). Graph covers native SQLite only, while the SQLite tab also covers OPFS and jeep. It re-pulls every database of the package on each visit, and one bad file fails all of them (`graph/useStorageGraphQueries.ts:119-172`). Scoped to one database it needs one pull, no all-or-nothing failure, and the open session (so OPFS and jeep work). The cross-source toggle keeps the only capability that is unique to the tab, so nothing is dropped. `/storage/graph` redirects to the last database's diagram |

Final sub-navigation: **IndexedDB · Key-value · Cache storage · OPFS · SQLite**.

Rejected options:

- **Merging IndexedDB with LocalForage.** LocalForage users think in keys, not stores.
- **Merging Cache storage into Network.** It is persistent storage the service worker reads offline,
  and it belongs with the app's data.
- **Merging OPFS into SQLite.** OPFS also holds images, JSON and logs.

## 4. The shared Data frame

### 4.1 Where it lives

- `modules/storage/frame/` holds the Data-specific pieces that only Data tabs use. These are
  imports inside one module, so `check:modules` allows them.
- Generic pieces go to `src/shared/`:
  - `JsonDiff`
  - grid cell editors
  - `DataFilterPopover` (predicate model only)
  - `file-viewer`
  - `saveFileAs`
- The cross-tab import `sqlite/SqliteChangeDiffDialog.vue:6` → `indexeddb/JsonDiffViewer.vue`
  disappears.

### 4.2 Layout (one component tree for every tab)

```
DataWorkbench (resizable: sidebar | main, sizes persisted per tab, container queries)
├─ DataSourceTree         sources → collections, search, sections, pin/hide/expand, change stripe,
│                         provenance mark, unreachable state, row menu, virtualised, aria-activedescendant
└─ main
   ├─ DataCollectionHeader  name, quiet identity line, ProvenanceTag + "read 12 s ago", ChangeSummary, actions
   ├─ view switch           Overview · Rows · Structure · SQL · Diagram (per source capability)
   ├─ DataGrid              + DataGridStatus (counts, aggregates, DataPager, read-only lock)
   └─ RecordPane            follows the selection; Fields/JSON · Edit · Changes (diff); collapses to 0 when empty
```

### 4.3 Contracts the tabs implement

These are presentation adapters over existing composables and domains. No CDP or IPC logic moves.

```ts
export type DataKind = "indexeddb" | "keyvalue" | "cache" | "opfs" | "sqlite";
export type DataProvenance = "live" | "local-copy" | "imported" | "stale";

export interface DataCollectionRef {
  sourceId: string;
  collectionId: string;
}

export interface DataSourceNode {
  id: string;
  kind: DataKind;
  label: string;
  detail?: string;
  provenance: DataProvenance;
  reachable: boolean;
  collections: readonly DataCollectionNode[];
}

export interface DataCollectionNode {
  id: string;
  label: string;
  count?: number;
  changes?: ChangeSummary;
}

export interface DataPageRequest {
  offset: number;
  limit: number;
  sort?: GridSort;
  predicates?: readonly DataPredicate[];
  search?: string;
}

export interface DataPage {
  rows: readonly GridRow[];
  hasMore: boolean;
  total?: number;
  scope: "store" | "page";
}

export interface DataRecordWriter {
  readOnlyReason(row: GridRow): string | null;
  save(row: GridRow, value: unknown): Promise<void>;
  remove(rows: readonly GridRow[]): Promise<void>;
}
```

- `DataPage.scope` is what lets the UI say honestly whether search, sort and filter covered the whole
  store or only the loaded page (⚠ C8).
- `GridRow.id` is a serialised key, never an index (⚠ C14, `IDBTable.vue:444`).

### 4.4 States (one component each, used by every tab)

- **No subject:** the gate (never a screen-local "connect" message).
- **Loading:**
  - first load: skeleton rows;
  - refetch: keep the previous page with a quiet spinner in the header (`placeholderData: keepPreviousData`);
  - a page change never blanks the grid.
- **Empty:**
  - no sources: plain sentence plus the one useful action, such as "Open an export…";
  - empty collection: the grid's `#empty` slot with the collection name;
  - no match: the filter summary plus "Clear filters".
- **Error:** inline in the pane that failed, with the device error text and Retry. Never silent: fixes
  `cdp:indexeddb.ts:171-173`, `CacheExplorer.vue:99-105,173`, LS/LF `:436-444`, and SQLite overview
  ⚠ C21.
- **App in background:**
  - CDP calls fail fast with `withTimeout` and a "Waiting for the app to come back" state per pane;
  - pollers pause on presence `background`/`view-hidden` and on `document.hidden`;
  - the frame reads `activeContext` presence and does not re-implement the gate strip;
  - SQLite rows already pulled stay readable under `stale`.
- **Read-only:** a lock in the status bar with the reason, plus disabled Edit with the same reason as its tooltip.
- **Provenance:**
  - live IndexedDB / key-value / cache: `live` with "read N s ago";
  - pulled SQLite and OPFS: `local copy` with "pulled N min ago";
  - opened files: `imported`;
  - after a lost link: `stale`.

  Today live data has no tag at all (`IDBExplorer.vue:667` only tags snapshots).

### 4.5 Keyboard, palette, persistence

**Keyboard**

- Grid keys come from `DG gridKeys.ts`. Enter / F2 edits the focused cell (wired now).
- Space opens the record pane on the current row (today it toggles, `SqliteBrowse.vue:256-259`).
- Delete asks for confirmation, then deletes.
- Ctrl+F focuses the frame's search only when focus is inside Data or nowhere (the Network U9 rule).
- Ctrl+S saves the pane.
- Ctrl+↑ / Ctrl+↓ move the pane to the previous / next row.

**Palette:** provider `screen.storage`, group "Data", `screen: true`

- Refresh
- Search rows
- Export rows…
- Open an IndexedDB export…
- Open a SQLite file…
- Show the record pane
- Clear store / Delete database. Only when allowed; always confirmed.
- Go to <tab>

**Persistence:** one key per concern, versioned, try/catch on write, pruned.

- **Sidebar settings:** `capubridge:data-sidebar:v1`, keyed `serial::package::kind::sourceId`.
  - It migrates `idb-sidebar-settings` and `sqlite-sidebar-settings`.
  - The old IDB store keys stores without origin and the SQLite one by path, so both collide across apps
    (`useSidebarSettingsStore.ts:5-13`, `useSqliteSidebarSettings.ts:50-69`).
- **Column state per collection:** visibility, widths, pins, show-as.
  - Replaces `capubridge:sqlite-show-as`.
  - Pins and widths are memory-only today (`DG useGridColumns.ts:39-41`).
- **Panel sizes per tab.**
- **The pane's Fields/JSON choice:** `capubridge:inspector-view` stays.

### 4.6 Gating

| Tab                                       | Requirement                                                                                                                                                                                                   | Note                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IndexedDB, Key-value, Cache storage, OPFS | `target` (unchanged)                                                                                                                                                                                          |                                                                                                                                                                                                                                                                                                                                                   |
| IndexedDB opened export                   | `none` (route `storage-indexeddb-snapshot`)                                                                                                                                                                   | Its live queries must stay idle (⚠ C6)                                                                                                                                                                                                                                                                                                            |
| SQLite                                    | new `"data"` requirement in `src/lib/gates`: open when an adb app target with a package is selected and the device is online, **or** when any target has a connected DevTools link. Subject key `target:<id>` | `app-target` would block local WebView targets, which SQLite supports today (`SqliteExplorer.vue:1075-1099` uses the local WebView store). `target` would block native databases whenever the DevTools link is down, though `run-as` does not need it. When the link is down, WebView sources show as unreachable rows, never as a screen message |
| SQLite opened file                        | `none`, new route `storage-sqlite-file/:session/:table?`                                                                                                                                                      | Imported sessions currently die on reload and share the name-keyed route (⚠ C22)                                                                                                                                                                                                                                                                  |

R3 adds the gate requirement, with resolver tests (`src/lib/gates`). That ends SQLite and Graph
"gating themselves" (`docs/design/rewrite-progress.md`, R4 open items).

## 5. Per-tab target design (what each round builds on the frame)

### 5.1 IndexedDB (R1)

**Sidebar**

- Databases of the origin, then stores. Each database row shows its version.
- The `localforage` database appears with a link to Key-value. jeep stores show "Used by SQLite (jeep)"
  and link to SQLite instead of being hidden.
- "Opened files" group for exports.

**Overview**

- `DataOverview` with the same metrics as today.
- Index details move into the Structure view: key path, auto-increment, indexes with
  unique/multiEntry. This is the IDB counterpart of SQLite's Structure.

**Rows**

- `DataGrid` with inferred columns. The union of fields over the sampled page replaces "first record
  decides" (⚠ C12).
- Keys are formatted readably (Date, binary, compound).
- Each value type gets a glyph. Placeholder types (Map, Set, Blob, typed arrays) are shown as such and
  are read-only with a reason (⚠ M2).

**Search, sort, filter**

- Page-scoped by default, and the status bar says so: "Searched the 50 rows on this page".
- One action "Search the whole store" runs a bounded device-side cursor scan. It is capped by record
  count and time, and reports progress and the cap.
- Sort on the key path or an index uses an index cursor. Sort on any other field is labelled
  page-only.
- This replaces the silent page scope (⚠ C8 C9 C10).

**Paging**

- Offset paging stays (CDP `skipCount`) up to the 10,000-record call limit.
- Deep pages say "jumping far is slow on large stores".
- A key-range "Go to key" is added for big stores (⚠ F3).

**Editing**

- Inline editing for primitives through grid editors.
- Edit in the pane for objects.
- Commit only on change (⚠ M6).
- The date editor writes local-calendar dates (⚠ M5).
- Confirm every delete (⚠ M4).

**Change overlay**

- Rendered as `rowStates`.
- Promoted rows keep `primaryKey`, `editable` and `readOnlyReason` (⚠ M3).

**Change tracking**

- A lease held by IndexedDB (and Diagram) while visible, not by `StoragePanel`.
- Paused in the background.
- One flush at a time.
- Capped at N stores (⚠ F2).

### 5.2 Key-value (R2)

- Sidebar sources: Local storage and Session storage per origin, plus the LocalForage instances found
  by `indexedDB.databases()` and by the localStorage-driver key prefix.
- Grid columns: Key, Value preview, Type, Size.
- The pane edits with `JsonEditor` for JSON, or a plain text editor for strings. A plain string is no
  longer flagged as invalid JSON (`JsonEditor.vue:34-63`).
- Visible Save button and Ctrl+S.
- Create and rename are reachable.
- The stored format is kept byte for byte, with "Format JSON" on request (⚠ M11; the Network P6 E
  lesson).
- Creating a key that already exists asks first.

### 5.3 Cache storage (R2)

- Sidebar: caches.
- Grid: URL (name-first, like Network U1), Method, Status, Type, Size, Date.
- The pane shows Headers (`FactList`) and Body (shared file-viewer: JSON, text, image, hex).
- Delete entry and delete cache, both confirmed and both **MUTATES**. They use the existing
  `cdp:storage.ts:137-162` functions.
- Fixes ⚠ C31.

### 5.4 OPFS (R2)

- Sidebar: the folder tree, with breadcrumbs in the header.
- Grid: Name + badges, Kind, Size, Modified.
- The pane previews files through the shared file-viewer. It reads with `opfs.readFileBytes` under a
  low cap; larger files go through a Rust pull, the same pipeline as `opfs_pull_sqlite`.
- Download works, through `saveFileAs`.
- Delete is confirmed. It warns when the file is a live database or SAH-Pool slot, and calls
  `snapshotCache.forget`.
- `?path=` is two-way.
- SQLite files open in SQLite as today.
- Fixes ⚠ M4 C32 F11.

### 5.5 SQLite (R3)

`SqliteExplorer.vue` is split along the seams found in the inventory:

| New unit                | Takes lines                |
| ----------------------- | -------------------------- |
| `useSqliteSources`      | `:130-167,375-475,536-577` |
| `useSqliteSnapshotSync` | `:659-952`                 |
| `useSqliteRouteState`   | `:169-237,1354-1470`       |
| `useSqliteMutations`    | `:979-1154,1262-1352`      |
| `useSqliteFileTransfer` | `:1156-1260`               |
| `SqliteStructurePane`   | —                          |
| `SqliteSqlPane`         | —                          |

- The sidebar runs on `DataSourceTree`.
- The SQL pane:
  - results go into `DataGrid`;
  - Ctrl+Enter runs;
  - per-database history;
  - "Read-only query" said plainly, since the connection is read-only (⚠ C25).
- Structure:
  - shows index SQL, which is fetched but never rendered today;
  - lists triggers.
- Cell editing and row insert apply to opened files only, and are labelled as such. Write-back to the
  phone stays out of scope (§8).

### 5.6 Diagram (R3)

- The Graph composables and pure utilities move unchanged into `modules/storage/diagram/`.
- The canvas is mounted lazily as a database view.
- ELK is loaded by dynamic import inside a worker. Vue Flow CSS moves from `main.css:9-10` into the
  lazy chunk.
- Scope key `serial::package::kind::databasePath`, with a migration of `capubridge:storage-graph:v1`
  that maps old target-id scopes by serial + origin + package (⚠ C4).
- Fixes ⚠ C1 C2 C3 F12 F13.

## 6. Known bugs, risks and traps

Ids are cited by the parity file. Each one is fixed in the round that owns its tab (column R). Every
fix comes with a test.

### 6.1 Phone mutation and data loss

| Id  | R   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | 3   | "Delete database" and "Import SQL dump" in every database row are gated on the **open** database's `readOnlyReason`, not the row's (`SqliteExplorer.vue:1680-1700`). With an imported file open, every OPFS or jeep row offers Delete, and confirming it deletes the database on the phone (`:1107-1150`). For an imported file, "delete" only closes the session, yet the copy says "removes it at the source" (`:1103-1105,1265`) |
| M2  | 1   | Map, Set, typed arrays other than Uint8Array, and Blob (eval path) come back as `{}` or index objects but stay `editable` (`cdp:indexeddb.ts:653-661,710-721,766-776`). One save overwrites the real value                                                                                                                                                                                                                          |
| M3  | 1   | Overlay-promoted rows are rebuilt as `{ key, value }` and lose `primaryKey`, `editable` and `readOnlyReason`. Off-page rows carry the normalised `afterValue` (sorted keys, `{__type}` markers), which a save writes back (`changes/useIndexedDBChangeOverlay.ts:176-187`)                                                                                                                                                          |
| M4  | 1/2 | Deletes with no confirmation: IDB context menu (`IDBTable.vue:962-976`), row detail Delete (`IDBRowDetailDialog.vue:128-136`), OPFS row Delete, which also has no toast and no catch (`OPFSExplorer.vue:214-219,527-535`)                                                                                                                                                                                                           |
| M5  | 1   | The date picker writes the previous day in UTC+ zones, Algeria included: `toDate(localTZ).toISOString().slice(0,10)` (`IDBCellEditor.vue:96-98`)                                                                                                                                                                                                                                                                                    |
| M6  | 1   | Blur always commits: a no-op `putRecord`, a "Record saved" toast and a locally-modified mark (`IDBCellEditor.vue:120-123`). `JSON.parse` turns the text "123", "true" and "null" into other types (`:89-93`). Numeric columns whose name ends in "on"/"at" are treated as dates (`useIDBCellInteractions.ts:54-60`)                                                                                                                 |
| M7  | 1   | `deleteDatabase` and `deleteObjectStore` have no `onblocked`. The UI times out after 30 s, the delete still runs later, and failures go only to `console.error` (`cdp:indexeddb.ts:504-558`, `IDBExplorer.vue:444,469,573`). Import-replace has the same problem (`idbImportExport.ts:237`)                                                                                                                                         |
| M8  | 1   | Export is lossy: Dates become strings, Blob/Map/ArrayBuffer become `{}`, BigInt aborts the export. It uses raw `Runtime.evaluate`, not `evaluateChecked` (`idbImportExport.ts:107-148,144,289`). Re-importing with "replace" writes the loss back to the phone                                                                                                                                                                      |
| M9  | 1   | "Import database (replace)" on a database's menu replaces the database **named in the file**, not the one clicked. In snapshot mode it just adds a snapshot (`IDBExplorer.vue:811,505-543`)                                                                                                                                                                                                                                         |
| M10 | 2   | LocalForage `safeSerialize` placeholders for Date, Blob, BigInt, ArrayBuffer, Set and Map are saved back as objects (`cdp:localforage.ts:50-61,144`). `createInstance({ name: "localforage", storeName: "keyvaluepairs" })` on every read could upgrade the app's database when it uses another store name (`:65-68`). Not verified; R2 checks it against fake-indexeddb                                                            |
| M11 | 2   | Local storage save pretty-prints JSON, which rewrites the stored format (`LSExplorer.vue:286-292`). Create silently overwrites an existing key (`:296-297`)                                                                                                                                                                                                                                                                         |
| M12 | 1   | Bulk delete is offered on a read-only snapshot (`IDBTableActions.vue:192-200`). It ends at the read-only toast, but the action should not be shown                                                                                                                                                                                                                                                                                  |
| M13 | 3   | Import SQL dump is not atomic: the wipe and the replay are two `execute_batch` calls, and the comment claims a transaction (`sqliteImportExport.ts:174-193`, `RS:1185`). Views are not dropped, so the replay can fail after the wipe. This touches the local copy only                                                                                                                                                             |

### 6.2 Correctness

| Id  | R   | Finding                                                                                                                                                                                                                                                                                                                     |
| --- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 3   | `updateZoomPercent()` is called in the main watcher but not destructured from the interactions composable. Every rebuild after the first fit throws a ReferenceError (`graph/StorageGraphExplorer.vue:438`, `useStorageGraphCanvasInteractions.ts:159,455-477`)                                                             |
| C2  | 3   | Duplicate edge ids when an indexed `*_id` column also has a declared FK. The logical search does not skip declared FKs, and the edge id omits the kind (`storageGraphSqliteDiagnostics.ts:166-178`, `useStorageGraphRelationships.ts:32,87`, `storageGraphEntityBuilders.ts:216-234`)                                       |
| C3  | 3   | A computed writes to the store: `persistedGroups` → `getScope` → `ensureScope` assigns `scopes`, so viewing a scope writes localStorage (`StorageGraphExplorer.vue:147`, `useStorageGraphStore.ts:90-106`)                                                                                                                  |
| C4  | 3   | Graph layouts are keyed by `cdpTargetId`, so they are lost when the page id changes. Scopes are never pruned (`useStorageGraphData.ts:80-88`, `useStorageGraphStore.ts:286`)                                                                                                                                                |
| C5  | 1/3 | `decodeURIComponent` runs on route params vue-router has already decoded, so a name with `%` throws a URIError (`IDBExplorer.vue:89-90`, `SqliteExplorer.vue:170-171`)                                                                                                                                                      |
| C6  | 1   | Snapshot mode writes the snapshot id into the live origin, which restarts change tracking on a bogus origin (`IDBExplorer.vue:609`). The active-store match never succeeds (`:335`). Live queries fire for the snapshot id (`:124-138,225-232`)                                                                             |
| C7  | 1   | The snapshot route is unreachable without typing its URL (`routes.ts:19`, `IDBExplorer.vue:517`)                                                                                                                                                                                                                            |
| C8  | 1   | Sort, search, filters, grouping and export cover only the current page (50–500 rows), presented as if they covered the store (`useAdvancedFilters.ts:103-134`, `IDBTable.vue:352-445`, `useIDBTableExport.ts`)                                                                                                              |
| C9  | 1   | FilterBuilder forces a calendar for gt/gte/lt/lte/equals, so number and text equality cannot be entered. Cancel does not revert field edits (shallow copy) (`FilterBuilder.vue:37-45,102-105`). `Number()` comparison never matches date strings (`useAdvancedFilters.ts:74-81`)                                            |
| C10 | 1   | Global search skips object and value columns (TanStack `getColumnCanGlobalFilter` on the first value) (`IDBTable.vue:302,321,343`)                                                                                                                                                                                          |
| C11 | 1   | Row-detail navigation steps through the pre-sort order. Past the page it fetches by raw device offset, ignoring filters, sort and overlay (`useIDBRowDetail.ts:75-115`, `IDBExplorer.vue:353-374`)                                                                                                                          |
| C12 | 1   | The column shape comes from the first record and the fields of the first 200 (`IDBTable.vue:194-218`)                                                                                                                                                                                                                       |
| C13 | 1   | The store size sample measures the description "Object" instead of the value (`cdp:indexeddb.ts:247-251`). Its sample remote objects may not be released (`:233-244`; to verify)                                                                                                                                            |
| C14 | 1   | Date and binary keys travel as marker objects: `deleteRecord` sends `JSON.stringify(marker)` and gets a DataError (`cdp:indexeddb.ts:449`). Row ids become `"[object Object]-i"` (`IDBTable.vue:444`)                                                                                                                       |
| C15 | 2   | WAL blind spots in the pull pipeline: the poll stats only the main file (`RS:418-421`); export and the diff baseline use the main file only (`RS:1157-1158`); a stale `-wal` survives a re-pull (`RS:328-339`); main/WAL/SHM are pulled at different moments; OPFS `wa-sqlite-opfs` pulls only the main file (`OP:275-332`) |
| C16 | 3   | Export .sqlite, SQL dump and Import dump call with serial `__local__` and the discovered path, so they fail for every OPFS and jeep database, and for native ones while a session is open (`SqliteExplorer.vue:1159-1198,1243`)                                                                                             |
| C17 | 3   | Page, filter and sort fetches have no sequencing, so a slow reply overwrites a newer one (`SqliteExplorer.vue:498-534`, `browse/useSqliteTableQuery.ts:74-95`)                                                                                                                                                              |
| C18 | 3   | Integers above 2^53 lose precision on the way to JS, so `DELETE … WHERE pk=` and filters can hit the wrong row (`RS:388`, `browse/sqliteQuery.ts:12`, `SqliteExplorer.vue:1325`). Fix: send integers outside the safe range as text with a type tag                                                                         |
| C19 | 3   | BLOBs become the text `"[BLOB nB] hex…"`. INSERT export writes it as a string, the dump writes NULL, and the display `slice(1,-1)` drops a character (`RS:393-401`, `DG exportFormats.ts:24`, `DG valueFormat.ts:93-94`)                                                                                                    |
| C20 | 3   | Structure is read from the live phone database (`run-as sqlite3`) while rows come from the copy, so they disagree after a schema change (`RS:592-606` vs `:811`)                                                                                                                                                            |
| C21 | 3   | The overview's `isError` is never passed, so an open failure reads "No tables found" (`SqliteExplorer.vue:1837-1851`)                                                                                                                                                                                                       |
| C22 | 3   | `:db` is a name, not an identity, so two databases with the same name collide. An OPFS deep link drops `:table` (`SqliteExplorer.vue:170-174`, `useOpenSqliteSource.ts:89`)                                                                                                                                                 |
| C23 | 3   | The sidebar uses the resolved snapshot path for expand and hidden counts, and search matches the active database's tables under every expanded database (`SqliteExplorer.vue:1445,636,604-605`)                                                                                                                             |
| C24 | 3   | An unreachable entry promises "showing the last copy", but opening it stats the phone first and fails (`SqliteExplorer.vue:1614-1636`, `useOpenSqliteSource.ts:47`)                                                                                                                                                         |
| C25 | 3   | The SQL tab's "SELECT on this table only" regex is cosmetic. The connection is read-only, so it is safe, but the message is misleading (`SqliteExplorer.vue:343-357`)                                                                                                                                                       |
| C26 | 2   | Row Copy copies the dialog buffer, not the row (`LSExplorer.vue:223-228,496`, `LocalForageExplorer.vue:209-214,482`)                                                                                                                                                                                                        |
| C27 | 2   | Save exists only as Ctrl+S, because the button is commented out. Create mode has no visible save, and rename is unreachable (`LSExplorer.vue:590-599,628-634`, `LocalForageExplorer.vue:575-589,618-624`)                                                                                                                   |
| C28 | 2   | Local storage delete errors are swallowed and the dialog closes anyway (`LSExplorer.vue:211-215`). The dialog is indexed by position, so it can jump to another entry after a refetch (`:184-186,305`)                                                                                                                      |
| C29 | 2   | Minified JSON is pretty-printed on open, so the dialog shows "Unsaved" immediately (`LSExplorer.vue:238-242,150-153`)                                                                                                                                                                                                       |
| C30 | 2   | LocalForage supports only the default instance on the IndexedDB driver. The origin is ignored (`cdp:localforage.ts:26-44,46,129`). In the raw-IDB fallback, the filter throws on non-string values (`LocalForageExplorer.vue:160`)                                                                                          |
| C31 | 2   | Cache storage has no detail pane. `selectedEntry` is never rendered, the count ignores the filter, `:key=url` collides for Vary variants, and `CacheEntry.status/headers` are declared but never filled (`CacheExplorer.vue:56-59,158-160,188`, `cdp:storage.ts:14-20,117-121`)                                             |
| C32 | 2   | OPFS Download has no handler and its click bubbles to the row. `?path=` is read once. Files cannot be previewed (`OPFSExplorer.vue:36,179,519-526`)                                                                                                                                                                         |
| C33 | 1   | Every IDB change is tagged `external`, including Capubridge's own writes (`src/types/storageChanges.types.ts`). The automation signal `lastEventAt` is bumped on flushes that found nothing (`useIndexedDBChangesTracking.ts:218`)                                                                                          |
| C34 | 1   | The database list error is swallowed into `[]`, which looks like "no databases" (`cdp:indexeddb.ts:171-173`)                                                                                                                                                                                                                |
| C35 | 3   | jeep `readDatabaseBytes` returns the whole file in one evaluate, which breaks above about 12 MB. Discovery reads every jeep database fully (`cdp:jeep-sqlite.ts:85-96,259-349`)                                                                                                                                             |
| C36 | 2   | Temp files are never removed: `%TEMP%/capubridge-sqlite/*`, `%TEMP%/opfs-*.db` including partial files, and `/data/local/tmp/_capu_*` on the phone when `adb pull` fails (`RS:104-108,363-368`, `OP:238,300`)                                                                                                               |
| C37 | 2   | The session recorder force-pulls the same databases every 5 s, onto the same cache key and the same phone tmp path as the explorer (`src/composables/useSqliteRecorder.ts:163-168,200`)                                                                                                                                     |

### 6.3 Performance

| Id  | R   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Budget after                                                                                                               |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| F1  | 1   | IDB values are materialised with about 3 `callFunctionOn` + 3 `releaseObject` per record, so a 500-row page costs about 3,000 CDP round trips (`cdp:indexeddb.ts:590-608,621-684`). Fixing the read cost is a protocol change, made with tests (BRIEF rule 2: real bug)                                                                                                                                                                                                              | ≤ 3 round trips per page: one batched materialise call + one `releaseObjectGroup`                                          |
| F2  | 1   | Change tracking is mounted for the whole route (`StoragePanel.vue:6`). It primes every store sequentially, re-reads the whole dirty store (up to 1,500 records), flushes can overlap, it never pauses when hidden, and it has no store cap (`useIndexedDBChangesTracking.ts:96-148,182-183,221-228`)                                                                                                                                                                                 | Lease while IDB or Diagram is visible; one flush in flight; pause on background/hidden; store cap with an "untracked" mark |
| F3  | 1   | Offset paging is O(n) on the device for deep pages (`src/composables/useIDB.ts:59`)                                                                                                                                                                                                                                                                                                                                                                                                  | "Go to key" via key range; deep offsets warned                                                                             |
| F4  | 1   | Export/import moves the whole database in one evaluate, with three base64 copies (`idbImportExport.ts:107-196`)                                                                                                                                                                                                                                                                                                                                                                      | Store-by-store chunks under the 16 MiB frame; progress; cancel                                                             |
| F5  | 2   | `sqlite_open_database` always force-pulls (`RS:517`). Refresh pulls twice (`RS:942` + `SqliteExplorer.vue:932`). Every open runs `COUNT(*)` on every table **and view** (`RS:548-554`)                                                                                                                                                                                                                                                                                               | One pull per refresh; views not counted (or counted lazily); open reuses a fresh copy                                      |
| F6  | 2   | The 5 s poll has no in-flight guard (`src/composables/useLiveRefresh.ts:25-27`). A failed stat counts as dirty forever (`SqliteExplorer.vue:751-753`). No pause in background or hidden                                                                                                                                                                                                                                                                                              | Self-scheduling timeout, pause rules from §4.4, backoff on repeated stat failure                                           |
| F7  | 2   | Whole databases sit in the JS heap several times (`SqliteExplorer.vue:665-673`, `src/stores/sqlSession.store.ts:42`, base64 copies, two sql.js instances in a diff)                                                                                                                                                                                                                                                                                                                  | The diff runs in Rust (rusqlite on the two copies) or in a worker; no source bytes are kept after the diff                 |
| F8  | 3   | `COUNT(*)` on every filtered page, even with an unchanged WHERE; search is a full `CAST … LIKE` scan, run twice; the dump uses OFFSET paging (quadratic) (`useSqliteTableQuery.ts:80-91`, `sqliteQuery.ts:122-127`, `sqliteImportExport.ts:89-106`)                                                                                                                                                                                                                                  | Count once per predicate set; dump pages by rowid                                                                          |
| F9  | 2   | LocalForage loads every value in one double-encoded evaluate, with Uint8Array → `Array.from` (`cdp:localforage.ts:57,63-111`)                                                                                                                                                                                                                                                                                                                                                        | Keys + previews first; full values per selection                                                                           |
| F10 | 2   | Local storage puts full values into the DOM and runs `new Blob` per row per render (`LSExplorer.vue:314-317,475-478`)                                                                                                                                                                                                                                                                                                                                                                | Size computed once per fetch; previews capped                                                                              |
| F11 | 2   | OPFS `listDirectory` stats files sequentially; `entryBadge` runs three times per row (`cdp:opfs.ts:254-270`, `OPFSExplorer.vue:491-497`)                                                                                                                                                                                                                                                                                                                                             | Parallel stats inside the one evaluate; badges computed once per entry                                                     |
| F12 | 3   | `elkjs` (1.59 MB) is imported statically and instantiated at module load, on the main thread (`graph/storageGraphElkLayout.ts:1,23`). It is pulled in through a pure import (`useStorageGraphCanvasNodes.ts:9`). Vue Flow CSS is global (`src/assets/styles/main.css:9-10`). Field matching is O(n²); the full rebuild runs per keystroke (`StorageGraphExplorer.vue:413-441`); position saves copy O(n²) (`useStorageGraphStore.ts:108-120`); a deep watcher serialises every scope | ELK in a worker by dynamic import; search debounced; batched position writes; persistence debounced                        |
| F13 | 3   | Graph re-pulls every native database per mount (`staleTime` 0) and samples every IDB store twice                                                                                                                                                                                                                                                                                                                                                                                     | Uses the open database session                                                                                             |
| F14 | 1   | `console.log` of record data in production (`src/composables/useIDB.ts:48,62,80,83`, `cdp:indexeddb.ts:583-588,759`)                                                                                                                                                                                                                                                                                                                                                                 | No data in logs                                                                                                            |
| F15 | 1   | Sidebar template functions run several times per database on every render; snapshots sit in a deep `ref` and `jsonByteSize` stringifies every record (`IDBExplorer.vue:734-746,839,942,151-176`, `useIdbSnapshotStore.ts:13`)                                                                                                                                                                                                                                                        | Computed tree model; `shallowRef`/`markRaw` snapshots; sizes computed once                                                 |
| F16 | 1   | `useStorageSize` measures localStorage, Cache (reads every cached blob) and OPFS (recursive walk) just for the IDB overview (`useStorageSize.ts:50-87`, `cdp:storage.ts:164-198`, `cdp:opfs.ts:322-336`)                                                                                                                                                                                                                                                                             | IDB overview asks only for IDB usage (`navigator.storage.estimate` `usageDetails`)                                         |

Round 1 status of F3: deep offsets are warned in the pager. "Go to key" (a key-range page) is
**deferred** to the round-1 review or R2: it needs a second paging mode (pages counted from a key, not
an offset) in `useIdbPage`, and it should be designed with the live check of a 10k+ store.

### 6.4 UI debt the rewrite removes

- Two design systems on one screen. shadcn button, input, badge, select, dialog, popover, tooltip,
  checkbox, textarea and confirm-dialog are used in about 30 storage files; Graph and LS/LF/Cache/OPFS
  use only shadcn.
- Hard-coded colours: `CacheExplorer.vue:129`, Graph `#e8765a`, raw rgba.
- Wrong copy:
  - "Fit to grid" is a fixed 1200 px;
  - the footer hint says double-click;
  - "Copy selected as JSON" actually downloads;
  - export file names use `idb` instead of the database name;
  - "Opened … in SQL Explorer".
- Cache has a two-level expand for a single child.
- The Cache filter sits in the wrong pane.
- No "pulled at" time anywhere.
- No provenance on live data.
- Raw `title` tooltips.
- Size as `(size/1024).toFixed(0) KB`.

## 7. Phasing

Each round:

1. ticks its parity lines;
2. fixes its §6 ids with tests;
3. retires every shadcn import in the files it touches (`check:cladd-adoption --update`);
4. removes its files from `architecture/source-size-baseline.json` (`SqliteExplorer.vue`,
   `IDBTable.vue` and `IDBExplorer.vue` are listed today);
5. passes the gates in `BRIEF.md` §7;
6. ends with a review using the three dimensions.

### Round 1: Data frame + IndexedDB

**Presentation rewritten:** about 3,900 lines (`indexeddb/*.vue`, IDB parts of `changes/`, the sidebar
store), plus about 1,200 lines of new frame.

- **Frame** (`modules/storage/frame/`):
  - `DataWorkbench`, `DataSourceTree` + tree model, `DataCollectionHeader`, `ChangeSummary`,
    `DataPager`, `RecordPane`, `DataOverview`, the state components;
  - `useDataSidebarSettings` with migration;
  - `useDataConfirm`;
  - `useDataCommands` (`screen.storage`).
- **Shared:**
  - `JsonDiff` moves to code-viewer;
  - grid editors are wired to the `edit` emit;
  - `DataFilterPopover` and its predicate model;
  - column state persistence in `useGridColumns`;
  - `saveFileAs`.
- **IndexedDB on the frame,** including the snapshot merge ("Opened files", palette open command,
  ungated route kept) and change tracking as a lease.
- **Protocol fixes with tests** (fake-indexeddb, as in `__tests__/idbWrites.test.ts`):
  - F1 batched materialisation;
  - M2 placeholder types read-only;
  - M7 `onblocked`;
  - M8 lossless export (typed markers for Date, binary, Map, Set and BigInt, read back on import);
  - C13 size sample;
  - C14 key markers round-trip.
- **Fixes:** M3–M9, M12, C5 (IDB), C6–C14, C33, C34, F1–F4, F14–F16.
- **Verify live** (the Presalio app on the Redmi):
  - a Dexie database with Date fields;
  - a 10k+ store paged to the end;
  - a store delete while the app holds the connection (blocked path);
  - the DataGrid pinning and group drill-in left unverified by `26f17f88`.
- **Exit:** IDB parity lines ticked. No `IDBTable` / `IDBExplorer` / `IDBRowDetailDialog` /
  `FilterBuilder` / `IDBColumnSettings` / `IDBCellEditor` remain. `useSidebarSettingsStore.ts` is gone.

### Round 2: Key-value + Cache storage + OPFS + the pull pipeline

**Presentation rewritten:** about 2,100 lines (`LSExplorer`, `LocalForageExplorer`, `CacheExplorer`,
`OPFSExplorer`). Logic: Rust pull fixes in `sqlite.rs` / `opfs_pull.rs` and the file-viewer lift.

- **Key-value tab:**
  - LS + Session storage + LocalForage instances;
  - redirect from `/storage/localforage`;
  - the IDB `localforage` row links here.
- **Cache storage:**
  - entry pane: headers + body through `cache.match` (new read script, `jsLiteral`, `evaluateChecked`);
  - delete entry and delete cache (confirmed).
- **OPFS:**
  - the tree on the frame;
  - preview, download and confirmed delete;
  - two-way `?path=`.
- **File viewer lift:** move the transport-agnostic parts of `src/modules/devices/files/viewer/`
  (`viewerContent.ts`, `loadContent.ts`, `readPlan.ts`, `sniff.ts`, `sqliteHeader.ts`, `ViewerBody.vue`)
  to `src/shared/file-viewer/`, with `read(maxBytes)` injected.
  - Device keeps its adb reader and actions.
  - This touches the already-reviewed Device route. Its Files parity lines must stay ticked, and its
    tests must still pass.
- **Pull pipeline (Rust + `useLiveRefresh`), shared by SQLite and OPFS before SQLite's UI round:**
  - **Pulls:** one pull per refresh (F5); a "pulled at" time returned with every copy.
  - **WAL (C15):**
    - stat the main file + `-wal`;
    - delete a stale local `-wal` before writing a new main file;
    - pull main, WAL and SHM back to back and checkpoint the **local** copy before export or diff;
    - pull the OPFS `-wal` when present.
  - **Temp files (C36):** clean up on close/exit; partial files; the phone tmp path on failure.
  - **Recorder (C37):** reuses the explorer's fresh copy by key instead of force-pulling.
  - **Poll (F6):** `useLiveRefresh` in-flight guard plus pause.
  - **Diff (F7):** moves to Rust.
  - **Tests:** `cargo test` for the WAL and cleanup paths.
- **Fixes:** M4 (OPFS), M10, M11, C15, C26–C32, C36, C37, F5–F7, F9–F11.
- **Exit:**
  - LS/LF/Cache/OPFS parity lines ticked;
  - the four explorers are gone;
  - SQLite still works on the old screen with the new pipeline (its parity lines are unchanged).

### Round 3: SQLite + Diagram

**Presentation rewritten:** about 2,900 lines of SQLite (`SqliteExplorer.vue` and its toolbars,
overview and dialogs) and about 1,600 lines of Graph Vue. The Graph composables and utilities (about
3,400 lines) move mostly unchanged.

- **Gate:**
  - `"data"` gate requirement with resolver tests;
  - opened-file route `storage-sqlite-file` + palette "Open a SQLite file…";
  - the route `:db` becomes a stable source id (C22), with old name links resolved once.
- **SQLite on the frame:**
  - the split in §5.5;
  - SQL pane on `DataGrid` with Ctrl+Enter and history;
  - Structure with index SQL and triggers;
  - the editor on opened files only.
- **Diagram:**
  - moved to `modules/storage/diagram/` and lazily mounted as a database view in SQLite and IndexedDB,
    with the "Include the app's other data" toggle;
  - ELK in a worker;
  - Vue Flow CSS in the chunk;
  - scope migration;
  - `/storage/graph` redirect.
- **Fixes:** M1, M13, C1–C4, C5 (SQLite), C16–C25, C35, F8, F12, F13.
- **Exit:**
  - every parity line ticked;
  - `SqliteExplorer.vue`, `StorageGraphExplorer.vue` and both sidebar stores gone;
  - zero shadcn imports left in `modules/storage`.

#### Round 3 status (2026-11-06)

SQLite is done on the frame; Diagram is split off as **R3b** (below). Commits: `530afd9e` (gate),
`60ba3bf5` + `0dc43ebf` (Rust values, dumps, registration), `5d8f6cb8` + `c3018f57` (jeep chunks),
`f321f121` (SQLite on the frame), `249811d6` (Graph fixes in place). M13, C18, C19 and C35 were run
red on the code before the fix, then green. M1's old bug lived in the explorer's template, which is gone,
so its tests pin the new rule (writes decided per database, with a file open) rather than replay the old one.

| Id  | Status | Where, and the proving test                                                                                                                                                                        |
| --- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | fixed  | Writes decided by the database they act on (`browse/sqliteWriteAccess.ts`, `useSqliteWrites.ts`); a file is closed, never "deleted at the source". `useSqliteWrites.test.ts`, `sqliteTree.test.ts` |
| M13 | fixed  | `sqlite_import_dump`: replay on a `VACUUM INTO` copy, views and triggers dropped, `quick_check`, swap. Rust `sqlite_dump::tests`; `sqliteImportExport.test.ts` (one atomic call)                   |
| C1  | fixed  | In place in Graph (`updateZoomPercent` returned); vue-types ratchet 3 → 2. No unit test: the error was in the component's watcher                                                                  |
| C2  | fixed  | In place. `graph/storageGraphSqliteDiagnostics.test.ts`                                                                                                                                            |
| C3  | fixed  | In place. `stores/__tests__/useStorageGraphStore.test.ts`                                                                                                                                          |
| C4  | part   | In place: scope without the page id, old keys migrated, 60 scopes. The per-database key `serial::package::kind::databasePath` comes with the Diagram view (R3b)                                    |
| C5  | fixed  | SQLite params used as decoded once (`sqliteDatabaseRef.ts`, test with `%`)                                                                                                                         |
| C16 | fixed  | `sqliteAddress.ts`. `sqliteTree.test.ts` "addressOf"                                                                                                                                               |
| C17 | fixed  | Keyed row queries (`browse/useSqliteRows.ts`). `useSqliteTableQuery.test.ts` "a slow answer for an older page…"                                                                                    |
| C18 | fixed  | Rust markers for integers past 2^53, `sqlText.sqlLiteral` writes them in full. Rust `sqlite::tests`, `sqliteQuery.test.ts`, `useSqliteWrites.test.ts`                                              |
| C19 | fixed  | BLOB markers with hex (4 KiB per cell, all bytes for exports), `X'…'` in INSERTs and dumps, refusal for a part-read BLOB. Same tests                                                               |
| C20 | fixed  | Structure always from the pulled copy (`read_table_meta`); no device test possible                                                                                                                 |
| C21 | fixed  | `SqliteOverview.vue` error state with Try again                                                                                                                                                    |
| C22 | fixed  | Path in `:db`, `storage-sqlite-file/:file/:table?`, name links resolved once. `sqliteTree.test.ts` "findDatabase"                                                                                  |
| C23 | fixed  | Only the open database lists tables; settings keyed by path. `sqliteTree.test.ts`                                                                                                                  |
| C24 | fixed  | `sqliteOpenPlan.ts`: a copy already pulled opens, else "cannot be read yet", never a stat first                                                                                                    |
| C25 | fixed  | Any read query, said plainly; Ctrl+Enter; history per database                                                                                                                                     |
| C35 | fixed  | 2 MiB per evaluate with progress; discovery reads only a Blob's header. `packages/cdp-protocol/tests/jeep-sqlite.test.ts`                                                                          |
| F8  | fixed  | Count once per filter (keyed query, tested); the dump reads each table once in Rust                                                                                                                |
| F12 | part   | In place: ELK on demand in a worker, families split out, Vue Flow CSS in the graph chunk, search debounced, batched positions, debounced shallow persistence. O(n²) field matching remains         |
| F13 | part   | In place: one bad database no longer blanks the SQLite graph, schema kept 60 s. "Uses the open database session" needs the per-database Diagram (R3b)                                              |

Deferred again (R2 moved them to R3 with the SQLite screen; they were not in this round's list): C15 (WAL),
C36 (temp files), C37 (recorder reuse), F5 (one pull per refresh, views not counted), F6 rest (stat-failure
backoff; the in-flight guard and pause landed), F7 (diff in Rust). `stash@{0}` keeps the earlier unfinished
Rust rework for them.

**R3b** was planned here as: the Graph moves to `modules/storage/diagram/` and mounts lazily as a database
view in SQLite (beside Overview · SQL) and IndexedDB, scoped to the open database's session (F13), with
"Include the app's other data"; per-database scope key and migration (rest of C4); `/storage/graph`
redirect; the Graph Vue files on Cladd; O(n²) field matching; cell editing and row insert on opened files
only (§5.5), labelled as such.

#### Round 3b status (2026-11-06)

Diagram is done (`data-parity.md` Diagram section, every line ticked) and the last SQLite line (cell
edit and add row) is ticked. Commits: `170309fe` (field matching), `995ec7a2` (per-database layout keys),
`589fe603` (move), `e2a6268c` (Diagram view), `e0a95dd9` (Rust changeset), `69cfff9b` (cell edit and add
row). F12's field matching and the changeset's atomicity and key tests were run red first (the old pair
scan at 1.1 s against a 250 ms budget; an `execute_batch` write; a WHERE built from edited values).

| Id   | Status | Where, and the proving test                                                                                                                                                                                            |
| ---- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C4   | fixed  | Per database: `diagramScopeKey(serial, package, kind, path)`; the app-wide v2 layout is adopted once per database and kept for the others (`stores/useStorageGraphStore.ts`, `useStorageGraphStore.test.ts`)           |
| F12  | fixed  | Field matching through an index of shared names, same links as the pair scan (`diagram/storageGraph.utils.ts`, `storageGraph.utils.test.ts`); manual links build their id set once                                     |
| F13  | fixed  | SQLite draws the open copy through its address, never `sqlite_open_database`; IndexedDB uses the tab's store info and one 12-record sample per store (`diagram/useOwnDiagramEntities.ts`, `readSqliteDiagram.test.ts`) |
| §5.5 | done   | Cell edit and add row on opened files: staged, one transaction, read back (`sqlite/browse/sqliteChangeset.ts`, `sqlite_changeset.rs`; `sqliteChangeset.test.ts`, `useSqliteWrites.test.ts`, Rust tests)                |

Exit check: `SqliteExplorer.vue`, `StorageGraphExplorer.vue` and both sidebar stores are gone (the Graph had
no sidebar store of its own; `useStorageGraphStore` is the layout store the Diagram keeps). No retiring
shadcn import is left in `modules/storage`: the `@/components/ui/` imports there are Reka resizable and
the dropdown menu, which stay until Cladd has them (`DESIGN.md` §5). Still deferred from R2: C15, C36,
C37, F5, F6 rest, F7 (see above).

### Why this split, and its balance

R1 is the largest UI round because it builds the frame. R3 has the most lines but the least new
design: SQLite Browse already runs on `DataGrid`, and the Graph logic moves rather than being
rewritten. R2 is the lightest UI round but carries the Rust pipeline work. That work is independent
of presentation and is needed by both OPFS (R2) and SQLite (R3). Doing it in R2 also lets R3 be
judged on the screen alone.

If R3 overruns, Diagram becomes R3b. It depends on nothing else in R3 except the gate requirement.

## 8. Out of scope

Each item needs an owner decision before it is started:

- **Writing SQLite changes back to the phone.** Native needs `run-as` push plus the app stopped; OPFS
  needs a page script. Today device copies are read-only by design (R5b).
- **IndexedDB write tap** (who wrote the change): R8 in `rewrite-progress.md`. Until then the frame
  says "changed on the device" and does not claim the source.
- **Capacitor Preferences** on Android: SharedPreferences XML through `run-as`. This is a natural
  Key-value source, but it is new adb work.
- **Replay's IndexedDB/SQLite tables** (`src/modules/recording/Replay*Table.vue`) moving onto
  `DataGrid`: R8.
- **Persisting opened exports and files across reloads.**

## 9. Questions for the owner

Defaults are what the plan does if there is no answer:

1. Is "Key-value" the right tab name? The alternative is keeping "Local storage" with LocalForage
   and Session storage as sources inside it. Default: Key-value.
2. Graph retires into the database Diagram view, with a cross-source toggle. Default: yes, in R3.
3. Should "Search the whole store" for IndexedDB scan the device? It costs CDP time on big stores and
   is capped by count and time. Default: yes, explicit action only.
4. Session storage as a new Key-value source. Default: yes, since it is read-only work plus the same
   two DOMStorage calls.
