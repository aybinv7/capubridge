# SQLite screen (Data › SQLite) — audit and redesign proposal

Written 2026-11-07 on `feat/ui-ux-overhaul` (after `d4c386db`). Read-only: nothing in the code was changed.
Paths are relative to `apps/desktop/src/` unless they start with `src-tauri/`, `packages/` or `docs/`.
`S/` = `modules/storage/sqlite/`, `F/` = `modules/storage/frame/`, `G/` = `shared/components/data/grid/`.

Sources: the code, `docs/design/rewrite/{data-plan,data-parity,data-r3-review,BRIEF}.md`,
`apps/desktop/DESIGN.md`, Cladd in `packages/cladd/src`, one screenshot of the running app (Overview of
`presalio.sqlite3`, SAH-Pool, 121 tables, 9,452 rows, 14.8 MB; taken without keys or clicks), and the
owner's description of the table view (`audit_survey_input`). I did not see the owner's table-view
screenshot itself.

---

## 0. Summary

The screen works and is safe; it is just the R1 frame applied without a second design pass. Its
problems are structural rather than cosmetic:

1. **Nothing has depth.** The sidebar, the header, the grid and the inspector are flat boxes separated by
   1 px borders. The grid hard-codes `cladd-surface-level-1` plus a border whatever it sits on.
2. **The table view repeats itself.** The table name is shown three times and the database name twice.
   The overview lists every table twice.
3. **Finding things is slow.** 121 tables sit in a truncated list, there is no quick open, no recents,
   no way to jump to a row, and a foreign-key link opens page 1 of the target table instead of the row.
4. **Switching tables throws state away.** The pane remounts per table, so the filter, search, sort,
   page, hidden columns and scroll are lost every time.
5. **The record pane is the odd one out.** It is a fixed 320 px `DataGridInspector`, not the shared
   resizable `RecordPane` the other four tabs use (review item U1, still open).
6. **The overview answers "how many rows" and nothing a developer actually asks.**

**Design headline:** a database is a **workspace of tabs on a raised surface**. The sidebar finds,
the tab strip holds what you are working on, and the grid sits in a recessed well with a resizable,
maximisable record pane beside it. Each name appears once: the database in the sidebar, the table on
its tab, the row's key in the record pane. `Ctrl+P` opens any table, `Ctrl+G` jumps to a row by its
key, and a link follows to the row it points at. The overview becomes a **database health page**:
size per table, what changed while you watched, sync columns, schema checks, and file and WAL facts.

**Tabs:** VS Code-style preview tabs. A single click opens a table in the one preview tab (italic) and
replaces it. A double-click, an edit, or any change to the filter, search or sort keeps it. Overview is
a fixed first tab. Tabs are kept per database and restored when it is opened again.

---

## 1. Audit

Each item gives the evidence (file:line) and why it matters. **(owner)** marks the owner's own points.

### 1.1 Layout and depth

| #   | Problem                                                                                                                                                                                                                                                                                        | Evidence                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| L1  | **(owner)** The frame has no surfaces. The sidebar and main area are bare `ResizablePanel`s on the Data panel, separated by a 1 px handle line. DESIGN.md §1 says "Depth, not borders."                                                                                                        | `F/DataWorkbench.vue:17-35`, handle `:28-30`                                                               |
| L2  | The grid draws its own flat box: it is always `cladd-surface-level-1` with `border border-cladd-outline`, so it ignores the Cladd surface context (`useSurface`) it sits in. Any parent `Surface` or `SurfaceCut` is visually cancelled.                                                       | `G/DataGrid.vue:408`                                                                                       |
| L3  | The inspector is a second flat box (`cladd-surface-level-1 … border`) beside it: two same-level boxes with no hierarchy between data and detail. Network already does this right, with the details in a `Surface level="+1" outline` (`modules/network/requests/NetworkRequests.vue:199-207`). | `G/DataGridInspector.vue:90`                                                                               |
| L4  | The table view stacks four horizontal bands before any data: header (`min-h-11`), edit bar (opened files), toolbar, then the grid. On a phone or page copy that is 3 bands and about 100 px of chrome.                                                                                         | `F/DataCollectionHeader.vue:24-44`, `S/browse/SqliteEditBar.vue`, `S/browse/SqliteBrowseToolbar.vue:56-59` |
| L5  | The overview stretches four large tiles over the whole width, then draws its only chart in the left half of a two-column grid; the right half stays empty (visible in the screenshot at 1920 px).                                                                                              | `F/DataOverview.vue:44` (tiles), `:60` (`@3xl:grid-cols-2` with one chart)                                 |
| L6  | The sidebar is too narrow for the names it holds. With 121 tables, names like `account_journal…` and `account_payment…` truncate at the default 260 px, and the table name is the only thing that tells them apart. The maximum is 360 px.                                                     | `F/DataWorkbench.vue:21-23`, `F/DataTreeItem.vue:121`                                                      |

### 1.2 Redundancy

| #   | Problem                                                                                                                                                                                                                                                             | Evidence                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| R1  | **(owner)** The table name appears three times: the sidebar selection, the header title, and the inspector title.                                                                                                                                                   | `F/DataTreeItem.vue:121`; `S/SqliteTablePane.vue:140`; `S/browse/SqliteBrowse.vue:503` |
| R2  | The database name appears twice in the table view: the sidebar (expanded parent row) and the header identity "table in presalio.sqlite3".                                                                                                                           | `S/SqliteTablePane.vue:121-124,141`                                                    |
| R3  | The inspector title is the table name, when the useful title is the row. IndexedDB's `RecordPane` uses the record's key (`indexeddb/IdbRows.vue:618`, `keyLabelOf`).                                                                                                | `S/browse/SqliteBrowse.vue:503`                                                        |
| R4  | The overview lists the tables twice: "Most rows" (top 10 with counts), then "Tables and views" (all of them with counts).                                                                                                                                           | `S/SqliteOverview.vue:41-57` and `:76-128`                                             |
| R5  | The row count of the open table is in the sidebar and in the pager. That is fine on its own, but together with R1 and R2 it makes the header carry nothing the screen does not already say.                                                                         | `F/DataTreeItem.vue:149-151`, `F/DataPager.vue`                                        |
| R6  | The database header shows the opaque SAH-Pool file name (`.opfs-sahpool/.opaque/qvegd8igrp8`) as its identity line. This is a loud identifier with no meaning (BRIEF: "no raw … as the main label"). The source chip tooltip already says where the file is stored. | `S/SqliteDatabasePane.vue:73`; `S/SqliteSourceBadge.vue:16-30`                         |

### 1.3 Navigation and hot access

| #   | Problem                                                                                                                                                                                                                                                                                                                                                            | Evidence                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| N1  | **(owner)** There is no quick open. Reaching a table means clicking into the sidebar search (it has no key) or scrolling a list of 121 truncated names. `Ctrl+F` belongs to row search. The palette has no "open table" entries.                                                                                                                                   | `F/DataSourceTree.vue:180-186`; `S/useSqliteCommands.ts:48-140`                                      |
| N2  | There are no recents. Pins exist (they sort first, `F/dataTreeModel.ts:22-36`) but show only as a 6 px dot.                                                                                                                                                                                                                                                        | `F/DataTreeItem.vue` pinned dot                                                                      |
| N3  | **Switching tables discards everything.** The pane is keyed by table (`:key="…::table"`), so the WHERE, search, sort, page, page size, grouping, hidden columns, active row and scroll are recreated empty. Column visibility is also reset explicitly.                                                                                                            | `S/SqliteView.vue:222`; `S/browse/useSqliteTableQuery.ts:32-40`; `S/browse/SqliteBrowse.vue:178-184` |
| N4  | There is no way to reach a row by its key. The pager has previous, next and page size only, so row 40,000 of a 50,000-row table is 800 clicks away.                                                                                                                                                                                                                | `F/DataPager.vue:58-85`                                                                              |
| N5  | **A foreign-key link drops its value.** The inspector emits `(target, value)` but `followForeignKey` keeps only the table name and opens page 1 of it. The link therefore lands on the table, not on the row.                                                                                                                                                      | `G/DataGridInspector.vue:170`; `S/SqliteTablePane.vue:116-119`                                       |
| N6  | **Paging is not stable under a sort.** Sorting appends `ORDER BY "col" dir` with no tie-breaker, and pages are read with `LIMIT/OFFSET`. When a column has duplicate values (status, dates, booleans), rows can appear on two pages or on none. Without a sort there is no `ORDER BY` at all. This is a correctness bug, and N4 (go to row) cannot be built on it. | `src-tauri/src/commands/sqlite.rs:604-617`; `S/browse/sqliteQuery.ts:45`                             |
| N7  | Each table click pushes a history entry (`router.push`), so Back walks back through every table looked at. Without tabs that is the only "recents" there is.                                                                                                                                                                                                       | `S/useSqliteLocation.ts:59-62`                                                                       |
| N8  | The sidebar search finds tables only in the open database (C23, on purpose). A cross-database "where is table X" needs the other databases' table lists. They are not read, and reading them means pulling each database.                                                                                                                                          | `S/sqliteTree.ts:35-44`                                                                              |

### 1.4 Record pane

| #   | Problem                                                                                                                                                                                                                                                                                    | Evidence                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| P1  | **(owner)** The pane cannot be resized: it is fixed at `w-80` (320 px). IndexedDB, Key-value, Cache and OPFS all use a `ResizablePanel` with `size-unit="px"`, 280–560 px, persisted under `capubridge:data-record-pane-size:v2`. This is open review item U1.                             | `S/browse/SqliteBrowse.vue:498-507` (`:500`); compare `indexeddb/IdbRows.vue:602-610` |
| P2  | **(owner)** There is no way to see a large JSON value full size. JSON fields render inline in a 320 px column, each in its own `JsonViewer`. TEXT columns that hold JSON (common in offline-sync schemas) show as wrapped text.                                                            | `G/DataGridInspector.vue:185-196`                                                     |
| P3  | The pane stays open and empty when no row is selected ("Select a row to see every field…"), taking 320 px. IndexedDB mounts its pane only when a record exists. BRIEF: "empty states that keep a large pane open".                                                                         | `S/browse/SqliteBrowse.vue:499`; `G/DataGridInspector.vue:142-146`                    |
| P4  | It lacks what `RecordPane` has: `data-record-pane` (so the `Ctrl+F` guard in `S/SqliteView.vue:116-122` cannot exclude it), `Ctrl+↑/↓` to step through records, an in-pane Changes view (SQLite opens a modal instead, `S/SqliteChangeDiffDialog.vue`), and an Edit view for opened files. | `F/RecordPane.vue:96-113,126-157`; `S/SqliteTablePane.vue:225`                        |
| P5  | Cladd rules are broken inside the inspector: a raw `<input type="search">` instead of `SearchField`; icon buttons without `IconAction` (no tooltip); a raw `title` on the link button.                                                                                                     | `G/DataGridInspector.vue:132-139`, `:99-119`, `:169`                                  |

### 1.5 Overview

| #   | Problem                                                                                                                                                                                                                                                                                       | Evidence                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| O1  | **(owner)** It reports counts only: Tables, Views, Rows, Size. It says nothing about which tables are big on disk, what changed, how the file is kept (journal mode, WAL), the schema version (`user_version`), free pages, or the schema's health.                                           | `S/SqliteOverview.vue:30-39`                               |
| O2  | "Most rows" stands in for size. For an app database, the expensive tables are often the ones with large TEXT or BLOB values, not the ones with many rows. `dbstat` is compiled into the bundled SQLite (`libsqlite3-sys-0.32.0/build.rs:126`, `-DSQLITE_ENABLE_DBSTAT_VTAB`) and is not used. | `S/SqliteOverview.vue:41-57`                               |
| O3  | It ignores what Capubridge uniquely knows. The 5 s snapshot diff already records table-level changes (`useSqliteChangeIndex`, `SqliteChangeSummary.latestAt`), but the overview does not show them.                                                                                           | `S/useSqliteTab.ts:40`; `types/sqliteChanges.types.ts:3-9` |
| O4  | The bars use the storage category hue (`bg-cat-storage`) as decoration on a screen where everything is storage. DESIGN.md §2: categories mark evidence kinds.                                                                                                                                 | `F/DataOverview.vue:76`                                    |
| O5  | The CREATE SQL disclosure duplicates Structure, but without a link to it.                                                                                                                                                                                                                     | `S/SqliteOverview.vue:121-125`                             |

### 1.6 Performance

| #   | Problem                                                                                                                                                                                                                                                                       | Evidence                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| F1  | Opening a table makes 5 IPC calls, and each opens the file in Rust. The columns are read twice (`useSqliteColumns` plus the structure's own columns), and the full structure (indexes, foreign keys, triggers) is always fetched, even on Rows, only to get the foreign keys. | `S/SqliteTablePane.vue:62-63`; `S/sqliteReads.ts:67-80`; `src-tauri/src/commands/sqlite.rs:660-662` (`open_db` per call) |
| F2  | The remount per table (N3) also re-fetches the columns and structure, unless they are still within the 60 s `gcTime`. Row pages are dropped after 15 s.                                                                                                                       | `S/useSqliteCatalog.ts:43-45`; `S/browse/useSqliteRows.ts:60`                                                            |
| F3  | Opening a database still copies the whole file into JavaScript as the diff baseline (review P1 / F7, open). Every tab design below assumes that cost is fixed first or kept off the open path.                                                                                | `S/useSqliteSnapshotSync.ts` `prime()`; `data-r3-review.md` P1                                                           |
| F4  | The sidebar calls `actionsFor(row)` for every visible row on every render, building a new action array each time.                                                                                                                                                             | `F/DataSourceTree.vue:225-229`                                                                                           |
| F5  | Search is a full-table `CAST(col AS TEXT) LIKE` over every column, and runs once with the count. That is acceptable at Presalio sizes. On a 100k-row table every keystroke (after the 250 ms debounce) is a full scan, with no "searching…" state in the toolbar.             | `S/browse/sqliteQuery.ts:111`; `S/browse/SqliteBrowseToolbar.vue:30-37`                                                  |
| F6  | The overview needs nothing new per table if it is built right. A naive design would cost one IPC call per table (121 here) for sizes, columns and indexes. Section 4.4 does it in one Rust call.                                                                              | —                                                                                                                        |

### 1.7 States and honesty

| #   | Problem                                                                                                                                                                                                                                                                                                                            | Evidence                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| S1  | "local copy · read 7 min ago" while the database is checked every 5 s. The header never passes `watched`, and the sync exposes no last-check time, so a database being watched reads as stale.                                                                                                                                     | `S/SqliteTablePane.vue:139-145` (no `:watched`); `S/useSqliteSnapshotSync.ts:14,285` |
| S2  | **Hiding the WHERE field would hide active filters.** The column filter form and the context menu's "Filter: equals this value" are written as text into the same WHERE string (`addFilter` → `andWhere`). Removing the bar (owner point 2) without a new model makes those filters invisible. The design must show them as chips. | `S/browse/useSqliteTableQuery.ts:72-74`; `S/browse/SqliteBrowse.vue:281-291`         |
| S3  | "Choose a database" is a generic empty pane, even when there is only one or two databases and the last one used is known.                                                                                                                                                                                                          | `S/SqliteView.vue:265-270`                                                           |
| S4  | **The unsaved-edits guard fires on every route update**, `?view=` included. Once table switches become tab switches (route updates), every switch would ask "Leave N changes unsaved?". The staged edits must live per tab, not per mounted component.                                                                             | `S/browse/SqliteBrowse.vue:369-370`                                                  |
| S5  | The filter error sits under the WHERE input; with the WHERE moved into a popover it needs a new home (the chip, in red with the database's words).                                                                                                                                                                                 | `S/browse/SqliteFilterBar.vue:73-76`                                                 |

### 1.8 Cladd and accent rules

What holds: one primary per view (Save changes / Save to the file in the edit bar, Run in SQL, the
primary actions of the empty states), red only on destructive confirms and on the Delete row item, and
`Segmented` active states in the brand accent.

| #   | Problem                                                                                                                                                                                  | Evidence                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| C1  | The Mark role (`signal-mark`: "user marks, bookmarks, annotations") is used for the primary-key icon and for the row-state text ("written by the app just now"). Neither is a user mark. | `G/DataGridInspector.vue:97,159`                                |
| C2  | The WHERE field is hand-built (`div` + `input`) rather than Cladd `InputGroup`/`InputGroupInput`, and its error uses a raw `title`.                                                      | `S/browse/SqliteFilterBar.vue:34-50,75`                         |
| C3  | P5 above (raw input, icon buttons without `IconAction`, raw `title`).                                                                                                                    | `G/DataGridInspector.vue`                                       |
| C4  | O4 above (category hue as decoration).                                                                                                                                                   | `F/DataOverview.vue:76`                                         |
| C5  | Two `ConfirmDialog` instances are mounted for one screen (view and browse). This is harmless, but the tab design adds more mount points, so it should stay one per view.                 | `S/SqliteView.vue:284-288`; `S/browse/SqliteBrowse.vue:536-540` |

---

## 2. Research: what the others do, and what to adopt

| Tool                  | What it does well                                                                                                                                                                                                                                  | Adopt                                                                                                                                    | Source                                                                                                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TablePlus             | **Open Anything** (`⌘P`): fuzzy match over databases, schemas, tables and views. A new object replaces the current tab if that tab has no changes; a double-click keeps the tab. `⌘W`, `⌘[`/`⌘]`, `⌘1–9`, plus close others / to the right.        | `Ctrl+P` quick open; "replace if untouched" (our preview rule); close others / to the right.                                             | [Open Anything](https://docs.tableplus.com/gui-tools/open-anything), [Tabs](https://tableplus.com/docs/gui-tools/the-interface/multi-tabs-workspaces-windows), [Shortcuts](https://docs.tableplus.com/utilities/shortcut-keys)                                         |
| Beekeeper Studio      | **Quick Search** (`Ctrl/Cmd+P`) over tables, views and saved queries; `Ctrl+Enter` opens the Structure. Pinned tables persist per saved connection.                                                                                                | `Ctrl+Enter` → Structure in quick open; pins and recents per database.                                                                   | [Release 2.1](https://beekeeperstudio.io/blog/release-2.1), [Easy to use](https://beekeeperstudio.io/features/easy-to-use), [Release 1.13](https://beekeeperstudio.io/blog/release-1.13)                                                                               |
| DBeaver               | A **References panel** shows the row a foreign key points at **and** the rows that point at the selected key; "Open" puts it in a new tab. A record mode shows one row as a column; a Value panel shows the focused value.                         | FK follow that lands on the row (in a tab); "Rows that point here" in the record pane.                                                   | [References panel](https://dbeaver.com/docs/dbeaver/References-Panel/) (team docs: [desktop](https://dbeaver.com/docs/team-edition/desktop/References-Panel/)), [Data view](https://dbeaver.com/docs/dbeaver/Data-View-and-Format/)                                    |
| DB Browser for SQLite | A filter row per column, and a global filter (3.12). `Ctrl+Shift+F` focuses the filter line. The Edit Cell dock shows the row and column being edited.                                                                                             | `Ctrl+Shift+F` for the advanced filter. We do **not** adopt a per-column filter row: the owner asked for search only.                    | [3.13.0 notes](https://github.com/sqlitebrowser/sqlitebrowser/releases/tag/v3.13.0), [3.12.2 changelog](https://www.softpedia.com/progChangelog/SQLite-Database-Browser-Changelog-141732.html), [tutorial](https://datacarpentry.org/sql-socialsci/02-db-browser.html) |
| Chrome DevTools       | The IndexedDB view starts from a key ("show keys greater or equal to"). Values do not update in real time; you click Refresh.                                                                                                                      | "Go to key" as a first-class jump. Its weakness (no live updates) is where Capubridge already wins (watch every 5 s); make that visible. | [DevTools IndexedDB](https://developer.chrome.com/docs/devtools/storage/indexeddb), [IndexedDBViews.ts](https://chromium.googlesource.com/devtools/devtools-frontend/+/main/front_end/panels/application/IndexedDBViews.ts)                                            |
| VS Code               | **Preview tabs**: a single click opens a file in an italic preview tab that the next single click replaces; a double-click, or editing, keeps it. Since 1.52, Quick Open does not open in preview (`workbench.editor.enablePreviewFromQuickOpen`). | The preview-tab model, including "quick open opens a kept tab".                                                                          | [preview mode](https://github.com/isLishude/blog/issues/162), [1.52 quick-open change](https://backiee.wasmer.app/http_Stackoverflow_com/questions/52013870/how-to-open-files-in-new-tabs-in-visual-studio-code)                                                       |
| SQLite                | `dbstat` gives the bytes per table and index (one row per page; `SUM(pgsize) GROUP BY name`).                                                                                                                                                      | Table size in the overview, in one query.                                                                                                | [dbstat](https://sqlite.org/dbstat.html)                                                                                                                                                                                                                               |

The sources vary in weight. TablePlus, DBeaver, SQLite and Chrome are official docs. The VS Code
double-click detail comes from secondary sources. Beekeeper's quick-search scope comes from release
notes and marketing pages.

---

## 3. Proposed design

### 3.1 Principles applied

- **Each name once.** The database lives in the sidebar, the table on its tab, the row's key in the record
  pane. Facts about the database (source, freshness, Read again, its menu) sit at the right end of the
  tab strip, because they apply to every tab.
- **Depth carries the hierarchy** (DESIGN.md §1). The Data panel is the base. The workspace is a
  raised surface. Data sits in a recessed cut. The record pane is raised one more level. Borders remain
  only where structure needs them (the grid's header row).
- **Search is the main control.** Filtering is still there, shown as chips, with SQL behind one button.
- **Keyboard first, mouse equal.** Every jump has a key, and every key has a visible control with
  `KeyCaps`.

### 3.2 Main screen (a table open, record pane open)

```
Data panel (existing shell surface, rounded-surface)
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ IndexedDB  Key-value  Cache storage  OPFS  [SQLite]                                   (section Tabs)  │
├───────────────────────────┬──────────────────────────────────────────────────────────────────────────┤
│ SIDEBAR (panel base, flat)│ WORKSPACE  = Surface level +1, outline, rounded-well                     │
│ ┌───────────────────────┐ │ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │⌕ Go to table…   Ctrl P│ │ │ ⌂  │ audit_survey_input × │ /res_partner/ × │ ⌄3 ·· ● checked 3 s ago ⟳ ⋯│ │ ← tab strip
│ └───────────────────────┘ │ ├──────────────────────────────────────────────────────────────────────┤ │
│ In the app's files        │ │ [Rows|Structure|SQL]  ⌕ Search rows…………………  [state = 'draft' ×]       │ │ ← toolbar
│  ▸ geotracker.db   1.2 MB │ │                       [WHERE … ×]  Filter ▾  +2 ~5  Columns  Export ⋯ │ │
│ In the page               │ │ ┌ SurfaceCut (well) ────────────────────────────┐┃┌ Surface +1 ─────┐ │ │
│  ▾ presalio.sqlite3 14.8MB│ │ │ #  id   survey_id  value      write_date   …   │┃│ id 4182   ⤢ ↑ ↓ ⧉ ×│ │
│    Pinned                 │ │ │ 1  4182 77         "yes"      2026-11-06 …     │┃│ Fields | JSON | Changes│
│     • audit_survey_input  │ │ │ 2  4183 77         "no"       …                │┃│ ⌕ Find a field     │ │
│    Tables (121)           │ │ │ …  (virtualised)                               │┃│ id          4182   │ │
│     account_journal     1 │ │ │                                                │┃│ survey_id → 77  ↗  │ │
│     account_payment…   13 │ │ │                                                │┃│ value       "yes"  │ │
│     …                     │ │ └────────────────────────────────────────────────┘┃│ Rows that point here│ │
│ Opened files              │ │ 1–50 of 380 · 1 selected · 3 ms · lock read-only  Go to row ⌗  ▣          │ │ ← status
│  (none)                   │ └──────────────────────────────────────────────────────────────────────┘ │
│ 2 hidden · Show them      │                                                                          │
└───────────────────────────┴──────────────────────────────────────────────────────────────────────────┘
   ┃ = ResizableHandle (record pane, persisted px)      /res_partner/ = preview tab (italic)
```

| Region                  | Cladd / shared components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar                 | `DataSourceTree` (kept) on the panel base, with no surface of its own. Above the tree, a `Button variant="transparent"` "Go to table…" with `KeyCaps` (`mod+p`), opening the quick open. The local `SearchField` stays inside the tree (as filter-as-you-type). An open database lists **Pinned**, then **Tables (n)**, as group rows (`DataTreeRow` kind `text`, which already exists). Default width rises to 280 px; max to 440 px.                                                                                                                                                                                                                                       |
| Workspace               | `Surface variant="solid" level="+1" outline` with `rounded-well`, filling the main panel with 8 px gutters (as Network does at `NetworkRequests.vue:199`). It publishes its level, so everything inside resolves depth from it.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Tab strip               | New `SqliteTabStrip`, `role="tablist"`. Each tab is a Cladd `Surface` (`variant="transparent" hoverable clickable`; the active tab is `variant="solid" pressed` with a 2 px `signal-select` inset line at the bottom, i.e. active navigation). Close is an `IconAction` (`size="xs"`, `tabindex="-1"`). Overflow is a Cladd `Popover` containing a `SearchField` and a Cladd `List`/`ListButton` of all tabs. The right end holds `DataFreshness` (with `watched`), `IconAction` Read again, and `DataRowMenu` (database menu). Cladd `Tabs` is **not** used: its `TabsList` is a `Segmented`, and a close button inside a segmented button is a nested interactive control. |
| Toolbar                 | `Segmented`/`SegmentedButton` (Rows · Structure · SQL), `SearchField` (`flex-1`, the widest control), filter chips as Cladd `Chip` with a remove `IconAction`, `Popover` "Filter" (see 3.5), `ChangeSummary`, `DataGridColumnsMenu`, Export `Popover`, `DataRowMenu` (table menu).                                                                                                                                                                                                                                                                                                                                                                                           |
| Grid                    | `SurfaceCut` (recessed well, `rounded-well`) around `DataGrid`. `DataGrid` gains a `frame` prop (`"box"` today, `"none"` inside a well), so it stops drawing its own level-1 box (L2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Record pane             | The shared `RecordPane` (replacing `DataGridInspector`) inside `ResizablePanel size-unit="px"`, wrapped in `Surface level="+1" outline rounded-well`. New icons: maximise (`Maximize2`), plus the existing previous, next, copy and close, all `IconAction`.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Status                  | `DataGridStatus` + `DataPager`, plus a new `IconAction` "Go to row" (`mod+g`) and the pane toggle (kept).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Edit bar (opened files) | Unchanged (`SqliteEditBar`), placed between the toolbar and the well.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Nothing else repeats the table name. The `DataCollectionHeader` is not used for tables any more:
the tab carries the name; the database's freshness and menu live in the tab strip; the table's
freshness ("read 12 s ago") moves to the status bar next to the query time; and the table's actions
stay in the toolbar `⋯`. The view/table distinction ("view in presalio.sqlite3") becomes the tab's icon
(`Table2` / `Eye`).

### 3.3 Tabbed state and tab behaviour

```
 ⌂ │ audit_survey_input ● × │ res_partner × │ /stock_move/ × │ SQL × │ ⌄ 4 more   ··  ● checked 3 s ago ⟳ ⋯
 ▲      ▲ dot = staged edits     kept tab        preview (italic)   SQL tab   overflow (Popover, searchable)
 └ Overview, fixed, icon + "Overview" tooltip, not closable
```

**Recommendation: VS Code-style preview tabs.** Browsing 121 tables is a single-click activity. Without a
preview tab it produces dozens of tabs; without tabs it loses state on every switch (N3).

- **Kinds:** `overview` (fixed first tab, one per database), `table` (one per table; Rows · Structure ·
  SQL is a per-tab view, as today), `sql` (the database SQL console, `Ctrl+T`), and `diagram` (one per
  database). Overview · SQL · Diagram stop being a segmented switch and become tabs.
- **Preview:** a single click on a table in the sidebar or in the overview opens it in **the** preview
  tab (italic title), replacing the current preview. There is at most one preview tab per database.
- **What keeps a tab:** a double-click on the sidebar row or on the tab; opening from quick open (as
  VS Code since 1.52); any change the user invested in (search, a filter chip, WHERE, sort, page size,
  grouping, a hidden column, a staged edit); following a link (FK) into it; `Enter` on the sidebar row.
- **Opening an open table** activates its tab and never duplicates it.
- **Close:** the `×` on hover or on the active tab, middle-click, or `Ctrl+W`. Focus goes to the
  tab on the right, otherwise the one on the left. A tab with staged edits asks first ("Leave 3 changes
  to “t” unsaved?", the existing wording) — **only on close, never on switch** (S4).
- **Tab menu** (right-click or `Shift+F10`): Keep open (on a preview), Close, Close others, Close to the
  right, Close all, Reopen closed tab, Copy table name, Show in the sidebar.
- **Overflow:** tabs shrink from 200 px to 96 px. Past that, the strip scrolls horizontally with an edge
  fade, the active tab is always scrolled into view, and "⌄ N more" opens a searchable list of every tab
  (closable from the list).
- **Restore:** tabs (kind, table, view, query state, kept or preview, active tab) are kept **per
  database**, under the sidebar scope plus the database identity (`serial::package::sqlite::<path>`, or the
  picked file's path for an opened file, as P9 did). Opening the database again restores them; tables
  that no longer exist are dropped with a toast ("2 tabs closed: their tables are gone"). The cap is 12
  tabs and 10 closed tabs per database, across 30 databases, pruned oldest first.
- **Address bar:** the active tab is the URL (`/storage/sqlite/:db/:table?view=`). Deep links from
  Device › Files and the Diagram therefore keep working; arriving by URL opens a kept tab. Opening a table
  pushes a history entry; switching between open tabs replaces it, so Back means "the table I came
  from", not "every tab I glanced at". This is an owner choice; see the alternatives in 6.3.
- **Mounting:** `<KeepAlive :max="4">` over the tab bodies, keyed by tab id. Tabs beyond that unmount,
  but their state lives in the tab store and is restored, and their row page is re-read from the local
  copy (one IPC call, milliseconds). Staged edits are **not** in a component: they move to a per-tab
  entry in the unsaved store, so an unmounted tab keeps them.

### 3.4 Record pane: resize and full size

- **Resize:** the same `ResizablePanelGroup` as the other Data tabs and the same persisted key
  (`capubridge:data-record-pane-size:v2`), so one width follows you across Data. Default 380 px, min
  280 px. The max rises from 560 px to **960 px**; the grid panel keeps `min-size` 30 %, so the grid
  never disappears. A double-click on the handle returns to 380 px; dragging below 200 px closes the pane
  (the same as the toggle). The handle is focusable and arrow-keyable (Reka).
- **Shown only with a row** (P3): no row means no pane, and the grid takes the width. The toggle
  remembers whether the pane should appear when a row is chosen.
- **Title** = the row's key (`id 4182`, or `order_id 12 · line 3` for a composite key), in mono, with the
  row number and state as the quiet line ("row 37 · written by the app just now"). This uses neutral text,
  not `signal-mark` (C1).
- **Maximise** (`Maximize2`, `Shift+Space`, label "Fill the workspace with this record"): a **layout
  change, not a dialog**. The pane takes the whole workspace body below the tab strip; the grid is
  hidden but stays mounted with its selection. `Ctrl+↑/↓` still step rows. `Esc` or `Minimize2` returns.
  Inside it:
  - JSON is shown with the full `JsonViewer` (read) or `JsonEditor` (opened files), with its filter
    (`Ctrl+F`).
  - Fields lays the values out in two columns at `@3xl`.
  - TEXT cells whose content parses as JSON are shown parsed, labelled "stored as text", with a
    toggle back to the raw text.
  - The state is never persisted: it always opens normal.
  - A dialog is the alternative; it was rejected because the owner dislikes "overlays where a layout
    change was expected" (BRIEF).
- **Links:** an FK field shows `→ 77` with "Open the linked row" (new tab, lands on the row, see 3.6). A
  **Rows that point here** section lists the tables whose foreign keys reference this table, each with a
  count and "Show them", which opens that table with a filter chip. Counts are read on demand per pane
  open: one `SELECT COUNT(*)` per referencing column, capped at 20 columns.
- **Changes:** the in-pane Changes view of `RecordPane` (JSON diff) replaces the `SqliteChangeDiffDialog`
  modal. The context-menu item "Show what the app changed" opens the pane on that view.

### 3.5 Search only, filters as chips

```
[Rows|Structure|SQL]  ⌕ Search rows…………………………   [state = 'draft' ×] [WHERE qty > 3 ×]   Filter ▾
                                                                                        ┌──────────────────────────┐
                                                                                        │ Column  [state      ▾]   │
                                                                                        │ is      [equals     ▾]   │
                                                                                        │ value   [draft        ]  │
                                                                                        │ ──────────────────────── │
                                                                                        │ SQL  WHERE [qty > 3    ] │
                                                                                        │ ! no such column: qtty   │
                                                                                        │        Clear    [Apply]  │
                                                                                        └──────────────────────────┘
```

- **Model change** (fixes S2): `useSqliteTableQuery` keeps `filters: SqliteFilterChip[]` (column,
  operator, value, label, and its SQL from `predicate()`) plus one free `where`. The effective WHERE is
  the AND of the chips, the free WHERE and the search. The context-menu filters and the column filter
  form add chips, not text.
- **Popover** (Cladd `Popover`, `position="bottom-end"`): the column filter form (moved from
  `SqliteColumnFilter`) and the SQL WHERE field (Cladd `InputGroup` + `InputGroupInput`, mono, `Enter`
  applies, `Esc` reverts, as today). "Apply" is the popover's one primary. `Ctrl+Shift+F` opens it with
  the WHERE field focused (as DB4S).
- **Errors:** a WHERE the database refuses turns its chip red, and the popover shows the database's
  words in a `FieldError` (S5). The search field is never blocked by it.
- **"Open in SQL"** in the toolbar `⋯` opens the SQL tab seeded with the current SELECT (WHERE, sort,
  limit). This is where power users write the real query.

### 3.6 Hot access

- **Quick open** (`Ctrl+P`, also the sidebar button and the palette's "Go to a table…"). It is a Cladd
  `Popup` built on the Reka Listbox pattern the command palette already uses
  (`components/command/CommandPalette.vue:3-16`), with fuzzy ranking from `lib/commands/fuzzy.ts` and a
  virtual list.
  - **Empty query:** this database's recent tables (up to 8), then pinned tables, then the other
    databases.
  - **Typing:** tables and views of the open database ranked by name. Column names are matched too
    ("barcode" → `product_product.barcode`, shown as `product_product · barcode`), from the facts
    command in 4.4. Databases match by name. Other databases' tables are listed only if they were read in
    this run (N8: no hidden pulls).
  - **Keys:** `Enter` opens a kept tab; `Ctrl+Enter` opens Structure (as Beekeeper); `Alt+Enter` opens
    the SQL tab seeded with `SELECT * FROM t`.
  - **`table:key`** (e.g. `res_partner:4182`) opens the table and goes to that row.
- **Recents:** the last 10 tables opened per database, kept beside the tab state. They feed quick open's
  empty state and the overview.
- **Pins:** unchanged storage (`pinnedItems`). They now show as a **Pinned** group at the top of the open
  database's tables instead of a 6 px dot.
- **Go to row** (`Ctrl+G`, status-bar `IconAction`): a `Popover` with one field per primary-key column
  (typed: `NumberField` for integers, wide integers kept exact), or `#n` for a row number.
  - **Prerequisite (fixes N6):** every page query gets a deterministic order. The user's sort is
    followed by `rowid` (or the primary key for `WITHOUT ROWID`); with no sort, `rowid`.
  - **Locate:** one `COUNT(*)` of the rows before the key under the current order and filters. The page
    is `floor(pos / pageSize)`; that page is read, the row selected and the pane opened.
  - **Hidden by filters:** "Row 4182 is hidden by the filters: Clear them and go".
- **FK follow** (fixes N5): "Open the linked row" opens or activates the target table's tab and goes to
  the row by the referenced column's value.
- **Keyboard focus regions:** `F6` / `Shift+F6` cycle sidebar → tab strip → toolbar → grid → record pane
  (VS Code's convention).

### 3.7 Keyboard map

All bindings are registered through `useSqliteCommands` (palette group "Data", `screen: true`), shown
with `KeyCaps` and `bindingTokens`. The owner types on **AZERTY**, where punctuation and the top-row
digits arrive with Shift. So `Ctrl+[`/`]` and `Ctrl+1…9` are avoided; if digits are ever added, they
must match on `event.code`.

| Keys                          | Action                                             | When                                                    | New |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------- | --- |
| `Ctrl+P`                      | Go to a table (quick open)                         | SQLite tab; also while typing in Data inputs (`global`) | yes |
| `Ctrl+G`                      | Go to a row by key                                 | a table tab on Rows                                     | yes |
| `Ctrl+F`                      | Search rows                                        | unchanged rule (focus in Data, not the pane)            | —   |
| `Ctrl+Shift+F`                | Filter popover, WHERE focused                      | a table tab on Rows                                     | yes |
| `Ctrl+T`                      | New SQL tab for this database                      | a database is open                                      | yes |
| `Ctrl+W`                      | Close the active tab (asks if it has staged edits) | any closable tab                                        | yes |
| `Ctrl+Shift+T`                | Reopen the last closed tab                         | closed tabs exist                                       | yes |
| `Ctrl+PageDown` / `PageUp`    | Next / previous tab                                | tabs exist                                              | yes |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Most-recently-used tab switcher (hold Ctrl)        | tabs exist                                              | yes |
| `Space`                       | Open the record pane on the row                    | grid focused                                            | —   |
| `Shift+Space`                 | Fill the workspace with the record / restore       | a row is selected                                       | yes |
| `Esc`                         | Restore a maximised record, then close the pane    | pane focused                                            | —   |
| `Ctrl+↑` / `Ctrl+↓`           | Previous / next record                             | pane focused                                            | —   |
| `F6` / `Shift+F6`             | Next / previous region                             | SQLite tab                                              | yes |
| `Ctrl+S`, `Ctrl+Shift+N`      | Save changes, add a row                            | opened files (unchanged)                                | —   |
| `Ctrl+Enter`                  | Run (SQL); open Structure (quick open)             | per context                                             | —   |

Collision check: `rg 'binding: "'` lists `mod+k`, `mod+j`, `mod+b`, `mod+.`, `mod+f`, `mod+shift+{d,i,j,n}`,
`space`, `enter` and `delete`. None of the new keys is taken. `Ctrl+W` and `Ctrl+Tab` must be checked
live in the Tauri WebView2 (they are browser accelerators in Edge).

### 3.8 Overview: the database at a glance

```
 ⌂ Overview │ audit_survey_input × │ …                                    ● checked 3 s ago  ⟳  ⋯
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FACTS (one row of SurfaceCut wells, small)                                                          │
│ 14.8 MB file · 3,610 pages × 4 KB │ 2 % free (74 pages) │ journal: delete · no WAL │ schema v 37 │ sah-pool ⓘ │
├──────────────────────────────────────────────────────────┬────────────────────────────────────────┤
│ TABLES  (DataGrid in a SurfaceCut, sortable, virtualised)  │ CHANGED WHILE WATCHED  since 01:10      │
│ ⌕ Filter tables   [All | Changed | Sync | No key | Empty]  │ ● stock_move        +12 ~3     2 s ago │
│ name                 rows   size     share     idx  sync   │ ● audit_survey_input  ~1       40 s ago│
│ product_template    1,320  3.1 MB  ████████░  4   wd ruid │ ○ nothing else changed                  │
│ res_country_city    1,517  0.9 MB  ███░░░░░░  1           │ [Mark now]  → "what changed since mark" │
│ audit_survey_input    380  0.4 MB  █░░░░░░░░  2   wd      ├────────────────────────────────────────┤
│ …121 rows                                                  │ SCHEMA CHECKS                           │
│                                                            │ ● 3 tables have no primary key   Show  │
│                                                            │ ● 14 links have no index         Show  │
│                                                            │ ○ No foreign keys declared (ⓘ inferred │
│                                                            │   links available in the Diagram)      │
│                                                            │ ○ Check integrity   [Run quick_check]  │
│                                                            │ ○ Check links       [Run foreign_key_  │
│                                                            │                       check]           │
│                                                            ├────────────────────────────────────────┤
│                                                            │ SYNC COLUMNS (detected, editable)       │
│                                                            │ write_date in 96 tables · _ruid in 88  │
│                                                            │ sync flag: none found   [Choose…]      │
└──────────────────────────────────────────────────────────┴────────────────────────────────────────┘
```

- **Facts** (one Rust call, 4.4): file size, page size × page count, free pages and their share
  ("2 % free"; with a hint "VACUUM would give back 296 KB", wording only, no action on a device copy),
  journal mode and the size of a `-wal` beside the copy (a native database's WAL is pulled with it,
  `src-tauri/src/commands/sqlite.rs:256-261`), `user_version` as "schema v 37" (the number app
  migrations bump), the encoding, and the source chip with its explanation. The opaque SAH-Pool path
  (R6) moves into that chip's tooltip.
- **Tables:** the old "Most rows" and "Tables and views" merge into **one** sortable `DataGrid` (R4).
  - **Columns:** name (with the view icon), rows, size on disk (`dbstat`, table plus its indexes), a share
    bar in a neutral fill (C4), index count, a "no key" mark, sync-column tags, and the change counts
    while watched.
  - **Opening:** a click opens the table in the preview tab; a double-click keeps it.
  - **Segments:** quick `Segmented` filters (All · Changed · Sync · No key · Empty).
  - **CREATE SQL:** it leaves the overview; "Structure" in the row menu goes there (O5).
- **Changed while watched:** fed by `useSqliteChangeIndex` (already in memory, no new reads). Tables are
  ordered by `latestAt`, with +added ~changed −deleted, and a click opens the table with "changes only"
  on. "Mark now" is innovation I1.
- **Schema checks:** each check is a `StatusDot` beside a word, and each "Show" filters the table grid.
  - **Cheap, from the facts call:** tables without a primary key, foreign-key columns without an index,
    tables with no rows, no foreign keys declared at all (likely for an offline-sync schema; it points to
    the Diagram's inferred links), and free pages over 20 %.
  - **On demand:** `PRAGMA quick_check` and `PRAGMA foreign_key_check`. They cost O(file) and run only
    when asked, with a spinner and a cancel.
- **Sync columns:** names are detected by rule (`write_date`, `create_date`, `updated_at`,
  `modified*`, `_ruid`, `*sync*`, `is_dirty`, `dirty`, `deleted`, `active`, `last_*`). The result is shown
  as a count and tagged in the grid; "Choose…" lets the user confirm or correct it per database (kept with
  the tab state). These feed innovation I3.
- **No primary action** on the overview; everything is navigation. The states keep their current words
  ("Opening the database", "Could not open the database" with Try again, "This database has no tables").

### 3.9 States

| State                                  | Design                                                                                                                                                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No database chosen                     | If one database exists, or the last used one is in the list, it opens automatically on its restored tabs. Otherwise the workspace shows the databases as a `List` of `ListButton`s (name, place, size, last opened), not a sentence (S3). |
| Opening / copying from the page        | Unchanged (`DataState` loading, toast with progress for jeep). The tab strip shows only ⌂ until the tables arrive.                                                                                                                        |
| Page not reachable (app in background) | Unchanged rules (stale provenance, the existing copy is readable). The freshness at the strip's right end reads "stale · copy from 01:10" with the hatch pattern.                                                                         |
| Watched                                | "● checked 3 s ago" (live dot) plus "last change 7 min ago" on hover. This needs `useSqliteSnapshotSync` to expose `checkedAt` and `changedAt` (S1).                                                                                      |
| Table gone after a read again          | Its tab shows "“t” is not in the database any more" with Close; nothing else breaks.                                                                                                                                                      |
| Filter refused                         | Red chip plus `FieldError` in the popover (S5). The grid keeps the last good rows under an inline `DataState compact` error, as IndexedDB does.                                                                                           |
| Read-only                              | Unchanged lock and reason in the status bar. The pane's lock line stays.                                                                                                                                                                  |

---

## 4. What stays the same (parity)

Nothing in `data-parity.md` § SQLite may disappear. Every line keeps its behaviour; only these homes
move:

| Parity group (data-parity.md)                                                                                                                                                           | After this redesign                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sources and opening (all lines)                                                                                                                                                         | Unchanged code paths (`useSqliteSources`, `useSqliteOpening`, `sqliteOpenPlan`, `openSqliteFile`, gate, file route).                                                                                                                                                                           |
| Sidebar: search, open file, hidden banner, expand persisted                                                                                                                             | Unchanged in `DataSourceTree`; the quick-open button is added above. Expand state is still persisted.                                                                                                                                                                                          |
| Sidebar: database row (name, detail, stripe, unreachable note)                                                                                                                          | Unchanged. The source chip and its explanation move from the database header to the overview facts and the strip's freshness tooltip.                                                                                                                                                          |
| Database menu (pin, hide, save copy, save as SQL, replace with SQL file, forget marks, close file, show in OPFS)                                                                        | Same `sqliteTreeActions` in the sidebar row menu, and in the tab strip's `⋯` (it was in the header `⋯`).                                                                                                                                                                                       |
| Table row and table menu (pin, hide, forget marks, delete every row, drop table)                                                                                                        | Same actions in the sidebar row menu and the toolbar `⋯`. "Drop the table" also closes its tab.                                                                                                                                                                                                |
| Resizable sidebar persisted                                                                                                                                                             | Same key `capubridge:data-layout:v2:sqlite`; the bounds become 220–440 px.                                                                                                                                                                                                                     |
| Overview: name, size, package, tiles, top 10 bars, table list, CREATE SQL, Read again, states                                                                                           | Name in the sidebar; size and package in the facts; counts in the facts and the grid header; top 10 and the list become one sortable grid (sorted by rows reproduces "Most rows"); CREATE SQL in Structure (row menu "Structure"); Read again at the strip's right end; the same three states. |
| Table view tabs: Rows · Structure · SQL, `?view=`, database Overview · SQL (+ Diagram)                                                                                                  | Per-tab `Segmented` for table views (`?view=` kept); database Overview, SQL and Diagram become tabs (`?view=sql` / `?view=diagram` open those tabs).                                                                                                                                           |
| Table toolbar: name, changes-only toggle, page size, paging, Read again                                                                                                                 | Name on the tab; `ChangeSummary` in the toolbar; `DataPager` unchanged in the status bar; Read again at the strip's right end.                                                                                                                                                                 |
| Browse: WHERE bar (Enter, Esc, ×, error)                                                                                                                                                | In the Filter popover, with the same keys, plus a chip with × and the error on the chip.                                                                                                                                                                                                       |
| Browse: search, group chip, columns, export, header menu, grouped drill-in, context menu, staged edits, delete, keys, recent-row highlight, status bar, empty states, read-only reasons | Unchanged. Staged edits move from the component to the per-tab unsaved store; `Ctrl+S`, Discard with undo, and the close guards keep their words.                                                                                                                                              |
| Inspector (Space, toggle, Fields/JSON, FK link, persisted view)                                                                                                                         | Shared `RecordPane`: Space, the toggle (`capubridge:data-record-pane`) and `capubridge:inspector-view` are kept; the FK link now lands on the row.                                                                                                                                             |
| Diff dialog                                                                                                                                                                             | The Changes view in the record pane (same JSON diff, same "Changed in T", key and "Seen …" facts).                                                                                                                                                                                             |
| Structure, SQL pane, refresh / poll / change tracking, import/export formats                                                                                                            | Unchanged components and commands. The SQL pane also opens as its own tab.                                                                                                                                                                                                                     |
| Persisted keys and URL                                                                                                                                                                  | All existing keys are kept. New: `capubridge:sqlite-tabs:v1` (tabs, recents, closed stack, chosen sync columns per database). The URL shape is unchanged.                                                                                                                                      |
| Palette commands (add row, save, discard, diagram, read again, find, pane, save copy, save as SQL)                                                                                      | Kept. New: go to table, go to row, new SQL tab, close tab, reopen closed tab, next/previous tab, filter with SQL, fill workspace with record.                                                                                                                                                  |

---

## 5. Innovation: five ideas that go past the reference tools

Ordered by value for this product. Each is honest about its cost and dependencies.

1. **I1 — Mark, act, see.** There is a "Mark now" button (overview and tab strip `⋯`, palette "Mark the
   database now"). After it, every view can filter to "changed since the mark": the overview lists the
   tables the app wrote to, each tab can show only those rows, and the record pane shows before and after.
   The workflow is: mark, tap Sync on the phone, and see exactly what the sync wrote, across all tables,
   in seconds. None of the desktop tools watch an app's database on a phone, and DevTools does not even
   refresh by itself. **Cost:** small UI work on top of the existing change store (`observedAt` is already
   kept). **Dependency:** F7/P1 (diff in Rust) for large databases; on Presalio's 15 MB it works today.
2. **I2 — Links that land, both ways, including inferred ones.** An FK follow lands on the row in a tab,
   and "Rows that point here" shows the reverse (DBeaver's References panel, as a pane section).
   Offline-sync schemas often declare **no** foreign keys, so the Diagram's name-based field matching
   (`diagram/storageGraph.utils.ts`, F12) is reused to offer **inferred** links (`partner_id` → a table
   with a matching key), always labelled "inferred" with the rule on hover, and never shown as declared.
   **Cost:** medium; the locate query from Go to row is reused.
3. **I3 — Sync lens.** For tables with detected (or chosen) sync columns, the toolbar offers three
   one-click chips: "Newest first" (sort by `write_date` desc, kept as the tab's default),
   "Changed since …" (a time picker, or "since the mark"), and "Not synced" (if a flag column is chosen).
   The overview shows how many rows each table has in that state, on demand. It turns a generic grid into
   a tool for the bug Presalio-type apps actually have: "this row did not go up". **Cost:** small (chips
   are the 3.5 model); detection rules need a live check against Presalio.
4. **I4 — Open anything, down to the row and the column.** Quick open matches tables, views, columns
   ("which table has `barcode`?") and `table:key`, with `Ctrl+Enter` → Structure and `Alt+Enter` → SQL.
   TablePlus and Beekeeper stop at the table. **Cost:** small once the facts call (4.4) returns column
   names.
5. **I5 — Compare with a copy.** "Compare with…" diffs this database against a saved copy or an opened
   file (for example yesterday's export versus now): schema differences and row-count deltas per table in
   the overview, then a row diff per table in its tab. It is the snapshot diff pointed at any two files.
   **Cost:** large; it needs the Rust diff (F7). It should come last.

---

## 6. Implementation plan

Small steps, each shippable and reviewable on its own, ordered by what the owner sees first. Every step
follows BRIEF rule 7 (`vp check`, `vp test run`, the ratchets) and updates `data-parity.md`. Following
the owner's method (memory: "show rendered options first, owner picks by eye"), steps 3 and 5 start with
2–3 rendered options as a throwaway prototype for the owner to pick from, before the real build.

### Step 1 — Shared record pane in SQLite (owner points 5, R1, R3, P1–P5) — small

- **Files:** `S/browse/SqliteBrowse.vue` (swap `DataGridInspector` for `ResizablePanelGroup` +
  `RecordPane`, key `capubridge:data-record-pane-size:v2`); new `S/browse/useSqliteRecordPane.ts` (active
  row, key title from `orderKeyColumns`, previous/next across the page, read-only reason, `before` from
  the change overlay); `F/RecordPane.vue` (an optional `maximizable` with `maximize` emit and
  `Maximize2`/`Minimize2` `IconAction`, an optional "parse JSON in text" view); `S/SqliteTablePane.vue`
  (`followForeignKey` keeps the value; it lands on the row in step 4); retire `S/SqliteChangeDiffDialog.vue`
  in favour of the Changes view.
- **Raise the max:** 560 → 960 px in all five `*Rows.vue`, so the width shared across Data stays in one
  range.
- **Tests:** `useSqliteRecordPane.test.ts` (title for a single, composite and NULL key; previous/next at
  page edges; no pane without a row); `F/__tests__/RecordPane.test.ts` (maximise emits, `Esc` restores,
  JSON-in-text parsed and labelled); keep `DataGrid.test.ts` green.
- **Parity:** the Inspector and Diff dialog lines are retargeted.

### Step 2 — Search-only toolbar, filter chips, no repeated names (owner points 2, 3; S2, S5, R2) — small/medium

- **Files:** `S/browse/useSqliteTableQuery.ts` (`filters: SqliteFilterChip[]`, `where`, effective WHERE);
  `S/browse/sqliteQuery.ts` (chip SQL from `predicate`); new `S/browse/SqliteFilterChips.vue` and
  `S/browse/SqliteFilterPopover.vue` (absorbing `SqliteFilterBar.vue` and `SqliteColumnFilter.vue`);
  `S/browse/SqliteBrowseToolbar.vue` (search `flex-1`, chips, Filter button); `S/SqliteTablePane.vue` (drop
  `DataCollectionHeader`; segmented, changes, columns, export and menu go into the toolbar; freshness goes
  to the status bar); `S/useSqliteCommands.ts` (`mod+shift+f`).
- **Tests:** `useSqliteTableQuery.test.ts` (chips AND with WHERE and search; removing a chip; context
  "equals" adds a chip, not text; a refused WHERE marks its chip; page resets); `sqliteQuery.test.ts`
  (chip SQL for NULL, wide integer, BLOB refusal unchanged).

### Step 3 — Depth (owner point 1; L1–L3) — small code, needs the owner's pick first

- **Files:** `F/DataWorkbench.vue` (main slot inside `Surface level="+1" outline rounded-well` with
  gutters); `G/DataGrid.vue` (a `frame` prop: `"box"` default, `"none"`, so a parent `SurfaceCut` gives
  the depth); the five `*Rows.vue` hosts and `SqliteBrowse.vue` wrap the grid in `SurfaceCut`;
  `G/DataGridInspector.vue` loses its last user (keep it or delete it, `check:modules`).
- **Scope:** done for all Data tabs at once, so the four tabs keep behaving as one product
  (data-r3-review "UI/UX" premise).
- **Tests:** `DataGrid.test.ts` (`frame="none"` drops the level-1 box and border); screenshots in dark and
  light for the owner.

### Step 4 — Hot access without tabs yet (owner point 4; N1, N2, N4, N5, N6) — medium

- **Rust first (N6):** `src-tauri/src/commands/sqlite.rs` `sqlite_table_rows` appends `, rowid` (or the
  PK for `WITHOUT ROWID`) to every `ORDER BY`, and orders by `rowid` when there is no sort;
  `S/browse/sqliteQuery.ts:45` does the same for query pages. Rust test: 1,000 rows with 3 distinct sort
  values read in pages of 50 return each row exactly once.
- **Files:** new `S/quick/SqliteQuickOpen.vue`, `S/quick/sqliteQuickOpenModel.ts` (pure: candidates from
  tables, columns, databases, recents, pins; `table:key` parsing; ranking with `rankByScore`);
  `S/useSqliteRecents.ts` (per-database list, capped and pruned); new `S/browse/SqliteGoToRow.vue` and
  `S/browse/sqliteRowLocate.ts` (the COUNT-before query for the current order and filters; composite, NULL
  and wide-integer keys); `S/SqliteTablePane.vue` (FK lands on the row); `F/DataSourceTree.vue` / `S/sqliteTree.ts`
  (a "Pinned" group row; the quick-open button slot; memoise `actionsFor` per row key, F4);
  `S/useSqliteCommands.ts` (`mod+p`, `mod+g`, palette "Go to a table…").
- **Tests:** `sqliteQuickOpenModel.test.ts`, `useSqliteRecents.test.ts`, `sqliteRowLocate.test.ts` (asc,
  desc, ties, filters, a key that does not exist, a key hidden by filters), and an FK follow test.

### Step 5 — Tabs (owner point 7; N3, N7, S4, F2) — large, needs the owner's pick of the strip first

- **Files:** new `modules/storage/stores/useSqliteTabsStore.ts` (Pinia setup store: tabs per database,
  preview rule, keep rules, close and neighbour, closed stack, LRU, persistence `capubridge:sqlite-tabs:v1`
  with debounce, prune and try/catch); `S/tabs/SqliteTabStrip.vue`, `S/tabs/SqliteTabItem.vue`,
  `S/tabs/SqliteTabOverflow.vue`, `S/tabs/SqliteTabMenu.vue`, `S/tabs/useSqliteTabKeys.ts`; `S/SqliteView.vue`
  (render the active tab under `<KeepAlive :max="4">`, route ⇄ store sync); `S/useSqliteLocation.ts`
  (push on open, replace on switch); `S/SqliteTablePane.vue` / `useSqliteTableQuery.ts` (state read from and
  written to its tab); `modules/storage/stores/useSqliteUnsavedStore.ts` and `S/browse/useSqliteStagedEdits.ts`
  (staged edits per tab, outside the component); `S/browse/SqliteBrowse.vue` (the route guard is replaced by
  a close guard); `S/SqliteDatabasePane.vue` split into Overview, SQL and Diagram tab bodies.
- **Tests:** `useSqliteTabsStore.test.ts` (single click replaces the preview; double-click, filter, edit
  and quick open keep it; no duplicate tab; close picks the right neighbour; reopen closed; cap and LRU;
  restore drops a missing table; persistence round trip, corrupt value, prune at 30 databases); a route
  sync test (a deep link opens a kept tab; Back goes to the previous table); `sqliteUnsavedGuard.test.ts`
  extended (switching tabs never asks; closing a tab with edits asks; closing the file asks with the count
  across tabs).

### Step 6 — Overview as a health page (owner point 6; O1–O5, F6) — medium

- **Rust:** new `src-tauri/src/commands/sqlite_facts.rs`, `sqlite_database_facts(address)`: one read-only
  connection returns pragmas (`page_size`, `page_count`, `freelist_count`, `journal_mode`, `user_version`,
  `encoding`), the `-wal` size beside the copy, `dbstat` bytes per table plus its indexes, and per table
  its columns, PK flag, `WITHOUT ROWID`, index count, and FK columns with whether they are indexed. This
  also serves review item P4 (one schema command per database) for the Diagram. Register it in `lib.rs`
  and `ipc.types`/contracts. Rust tests on a fixture database: sizes add up to the file within one page;
  WAL size is reported; a database without `dbstat` (defensive) returns `null` sizes rather than failing.
- **Files:** `S/sqliteReads.ts`, new `S/useSqliteFacts.ts` (TanStack Query under `sqliteQueryRoot`, so Read
  again refreshes it); pure `S/overview/sqliteHealth.ts` and `S/overview/sqliteSyncColumns.ts`; the
  `S/SqliteOverview.vue` split into `S/overview/SqliteOverviewFacts.vue`, `SqliteOverviewTables.vue`
  (`DataGrid`), `SqliteOverviewChanges.vue` and `SqliteOverviewChecks.vue`; `F/DataOverview.vue` either
  stays for the other tabs or shrinks to its tiles.
- **Tests:** `sqliteHealth.test.ts` (each rule, including thresholds), `sqliteSyncColumns.test.ts`
  (Presalio-like names, false positives such as `active` on a lookup table), and an overview state test
  (error, empty, loading).

### Step 7 — Innovations — after the owner reviews steps 1–6

I3 (sync lens chips, small), I1 (mark, small, after F7 for large databases), I2 (references and inferred
links, medium), then I5 (compare, large, needs F7).

---

## 7. Assumptions, risks and alternatives

### 7.1 Assumptions (to check live, read-only)

- `dbstat` is available in the bundled SQLite: **verified** in `libsqlite3-sys-0.32.0/build.rs:126`
  (`-DSQLITE_ENABLE_DBSTAT_VTAB`). Its speed on a 200 MB copy is not measured.
- A SAH-Pool copy reads as a normal database once its header is stripped (it already does for rows). Its
  journal mode may not be WAL at all; the facts show what the file says.
- Presalio's mobile schema declares few or no foreign keys and uses `write_date` / `_ruid`. This is
  inferred from SIG's Odoo sync conventions, **not checked** on this database; check it with a read-only
  `SELECT` on `pragma_foreign_key_list` across tables before building I2/I3.
- I worked from the owner's description of the table view and one screenshot of the overview; the table
  view itself was not captured, to avoid sending keys or clicks.
- `Ctrl+W`, `Ctrl+Tab` and `Ctrl+P` reach the page in Tauri's WebView2 and are not taken by the shell.
  Check live; fall back to `Ctrl+F4` for close if not.

### 7.2 Risks

| Risk                                                                                                                                    | Mitigation                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staged edits on an opened file lost or wrongly guarded when tabs switch (S4): this is data safety                                       | Move staged edits into the per-tab unsaved store **before** the tab UI; red-first tests for "switch never asks, close asks, file close counts every tab".              |
| Memory with many tabs kept alive                                                                                                        | `KeepAlive :max="4"`; state in the store, not the component; row pages re-read from the local copy. F3/P1 (whole file in JS) stays the bigger cost; fix it first.      |
| Changes to the shared frame (`DataGrid` frame, `DataWorkbench` surface, record pane max) ripple to IndexedDB, Key-value, Cache and OPFS | Do them for all tabs in one step with screenshots of each tab; keep the defaults backward compatible (`frame="box"`).                                                  |
| Paging tie-breaker changes the order users see in sorted views                                                                          | Only rows with equal sort values change relative order, which was undefined before; say so in `data-parity.md`.                                                        |
| Preview tabs confuse people who do not know VS Code                                                                                     | Italic plus tooltip "Preview: the next table you open replaces it. Double-click to keep it."; "Keep open" in the tab menu; any invested change keeps it automatically. |
| Sync-column heuristics are wrong                                                                                                        | Show them as "detected", let the user correct them per database, and never hide rows based on a guess without a visible chip.                                          |
| Shortcut collisions on AZERTY                                                                                                           | No punctuation or digit shortcuts; match on `event.code` if digits are ever added (memory: `user-keyboard-layout.md`).                                                 |
| "Rows that point here" counts are slow on large tables without indexes                                                                  | On demand, capped at 20 referencing columns, with a cancel; flag the missing index in Schema checks (it is the same finding).                                          |

### 7.3 Alternatives considered

- **Tabs:**
  - (a) **No tabs**: quick open, recents and per-table state restored from a store. It is cheaper (no
    strip, no KeepAlive), fixes N1–N4, and loses only side-by-side switching. If the owner wants to stop
    after step 4, this is the fallback: step 5's store without the strip.
  - (b) **TablePlus model**: the current tab is replaced if it has no changes; there is no italic state.
    It is simpler to explain, but a single click on a table that you sorted keeps it as a new tab, so
    tabs pile up faster.
  - (c) **Browser model**: every open is a new tab. This explodes at 121 tables. It was rejected.
- **Record full size:** a Cladd `Dialog` instead of an in-place maximise. It is easier to build, but it
  is an overlay where a layout change fits (owner's stated dislike). It was rejected; it is kept as a
  fallback if the maximise conflicts with the edit bar.
- **Sidebar:**
  - **A database switcher** (one dropdown) instead of the tree, with the body listing only the tables.
    It is cleaner, but it changes the shared `DataSourceTree` contract and drops the expand/collapse
    parity line. It was not chosen; the tree stays.
  - **Grouping tables by name prefix** (`account_*`, `product_*`) by reusing
    `diagram/storageGraphNamingFamilies.ts` ("three or more share a first part"). It is attractive at
    121 tables, but it competes with quick open. Left as a follow-up toggle.
- **Overview sizes:**
  - **A treemap** instead of a share bar in a sortable grid. It looks richer, but it reads worse for exact
    comparison, and every table needs a label. It was rejected.
  - **Row counts only, as today.** This misleads for TEXT- or BLOB-heavy tables. It was rejected now that
    `dbstat` is available.
