# Data rounds 3 and 3b (SQLite on the frame, Diagram, editing opened files) — review

Reviewed the `feat(data)` / `fix(data)` / `docs(data)` commits from `530afd9e` to `b714909a`: gate `530afd9e`,
Rust values and dumps `60ba3bf5` `0dc43ebf`, jeep chunks `5d8f6cb8` `c3018f57`, SQLite frame `f321f121`,
Graph fixes `249811d6`, field matching `170309fe`, layout keys `995ec7a2`, move `589fe603`, Diagram view
`e2a6268c`, changeset `e0a95dd9`, cell edit and add row `69cfff9b`, docs `9714411e` `a3622891` `b714909a`.
Paths are relative to `apps/desktop/src/modules/storage/` unless they start with `src/`, `src-tauri/` or
`packages/`. This was a code read only: no tests were run and the running app was not looked at.

**The answer to "can a device copy ever be written?"** No path writes to the phone: nothing pushes a
file back, and every phone or page read goes through a pulled copy. The pulled copy itself is protected
in TypeScript (`browse/sqliteWriteAccess.ts`), but Rust guards only one of the three write commands
properly (S7). The changeset itself holds up: one transaction, one statement and exactly one row per
change, keys matched NULL-safely with `IS` against the values as read, BLOB and wide-integer cells
refused. The real risks are in what reaches the changeset (S1, S4, S5) and in what the person believes
was saved (S2, S3).

## Data safety

- **S1 — Editing a text cell removes its line breaks.** `CellEditor` is an `<input type="text">`
  (`src/shared/components/data/grid/editors/CellEditor.vue:96-114`), and the browser strips CR and LF
  from an input's value. Type one character into a multi-line value and every line break is gone; the
  person cannot see that happen (`cellEdit.ts:175-179` stages it as a normal change). The editor is shared
  with IndexedDB (`indexeddb/IdbRows.vue:20`), where the save goes **to the phone**. Fix: open a textarea
  editor for values containing `\r` or `\n` (or above ~200 characters), or refuse the inline edit with
  "Edit in the record pane". Add a test that a value with `\r\n` survives an edit of one other character.
- **S2 — "Saved to the file" saves a temporary copy, which is lost when the file closes.** Opening a file
  copies it to `%TEMP%` (`stores/useSqliteFilesStore.ts:97,142-156`); the original is never written. Yet
  the edit bar says "Changes are saved to the file on this computer" (`browse/SqliteEditBar.vue:25`), the
  toast says "Saved N changes to “app.db”" (`useSqliteWrites.ts:229`), and every confirmation says "the
  file “x” on this computer" (`:68,89,137,268`). Closing the file or quitting Capubridge then drops the
  edits with no word (`useSqliteTreeHandlers.ts:114-119`). Fix: say "the copy opened here"; once the copy
  has changed, mark the file row "changed" and put "Save a copy of the file…" in the edit bar; ask before
  "Close the file" when the copy changed. Writing back to the original is an owner decision; the copy
  wording is needed either way.
- **S3 — The unsaved-changes question is skipped by "Close the file" and by closing the window.** The
  guard lives in `browse/SqliteBrowse.vue:307-321` (`onBeforeRouteLeave/Update`). `closeFile` removes the
  file from the store before it navigates (`useSqliteTreeHandlers.ts:117-118`), so the table pane unmounts
  first and the staged edits vanish without the question. Nothing handles `beforeunload` or Tauri's
  close request. Fix: a small store of "tables with staged edits" that `closeFile`, the sidebar writes
  (S10) and a window close handler check before they act; a test that closing a file with staged edits
  asks first.
- **S4 — A typed integer past 2^53 is rounded, and the read-back approves the rounded value.** The
  number editor parses with `Number()` (`src/shared/components/data/grid/editors/cellEdit.ts:180-186`), so
  `9007199254740993` is written as `…992`. The read-back compares the file with what was _written_
  (`browse/sqliteChangeset.ts:136-153`), not with what was typed, so it reports "Read back and checked".
  C18 is fixed for reads only. Fix: digits outside the safe range become a `{ __type: "Number" }` marker
  (which `sqlLiteral` already writes in full); refuse anything else `Number()` would round. Test with a
  typed wide key on an insert.
- **S5 — Edits made while a save is running are thrown away.** `save()` sets `staged` to empty after the
  await (`browse/useSqliteStagedEdits.ts:155-164`), but `startEdit`, `commit` and `addRow` do not check
  `saving` (`:105-141`). The await includes up to 200 read-back queries (P6), so the window is real. Fix:
  refuse edits while saving, or on success remove only the edits that were in the saved snapshot. Test:
  commit an edit while `save` is pending.
- **S6 — Deleting rows can report a delete that did not happen, fails on large selections, and breaks
  the next save.** `deleteRows` matches with `=` (`useSqliteWrites.ts:124-129`), so a row with a NULL key
  is never deleted, and it says "Deleted the row" without checking the changed count (`:156`). The `OR`
  chain hits SQLite's expression-depth limit (1,000) when about 1,000 rows are selected. Staged edits of
  the deleted rows stay (`browse/SqliteBrowse.vue:257-261` drops only new rows), so the next save fails
  as a whole with "would touch 0 rows". Fix: delete through a Rust command that, like the changeset, runs
  one statement per key with `IS` in one transaction and checks each count; drop the staged edits of the
  deleted keys on success.
- **S7 — Rust guards differ per write command; two dead write paths remain.** `sqlite_execute_write`
  (delete rows, clear, drop) has no guard at all (`src-tauri/src/commands/sqlite.rs:961-994`).
  `sqlite_import_dump` checks only the `__local__` serial, which page copies share
  (`src-tauri/src/commands/sqlite_dump.rs:232-249`), while its doc comment says "Device copies are
  refused". `sqlite_apply_changeset` trusts the string `package == "file"` and any local path
  (`sqlite_changeset.rs:88`). Dead code: `useSQLite().executeWrite` with no guard
  (`src/composables/useSQLite.ts:113-125`) and `JeepSqliteDomain.deleteDatabase`, which deletes on the
  phone (`packages/cdp-protocol/src/cdp/domains/jeep-sqlite.ts:172-228`). Fix: `sqlite_save_local_bytes`
  registers each opened-file path in Rust; all three write commands accept only a registered path. Delete
  both dead functions. Rust tests that a pulled phone copy and a page copy are refused by all three.
- **S8 — WAL: a saved edit may be missing from "Save a copy of the file…".** `sqlite_export_bytes`
  reads the main file's bytes (`src-tauri/src/commands/sqlite.rs:941-956`). If the opened file is in WAL
  mode and another read connection is open when the changeset connection closes, the WAL is not
  checkpointed, and the saved copy lacks the edits. (Likely, not reproduced.) Opening a file also copies
  only the main file, so data still in a `-wal` beside the picked file is not shown. Fix: run
  `PRAGMA wal_checkpoint(TRUNCATE)` after every commit in the three write commands; export through the
  backup API or `VACUUM INTO`; at open, say when a `-wal` file sits beside the picked file.
- **S9 — Replaying an SQL file can write outside the file.** The dump runs through `execute_batch` on a
  read-write connection (`src-tauri/src/commands/sqlite_dump.rs:184-187`), so `ATTACH '…' AS x` or
  `VACUUM INTO '…'` in a picked file creates or changes files anywhere on the computer. Fix:
  `conn.set_limit(Limit::SQLITE_LIMIT_ATTACHED, 0)` on the scratch connection (VACUUM INTO also needs an
  attach slot), or an authorizer that denies ATTACH; a Rust test with a dump that attaches.
- **S10 — Sidebar writes ignore the table's staged edits.** "Delete every row…", "Drop the table…" and
  "Replace with an SQL file…" (`useSqliteWrites.ts:63-104,255-283`) run while the table may hold staged
  edits, which then fail the next save as a whole. Fix: include "N changes not saved are dropped" in the
  confirmation and discard them (uses S3's store).
- **S11 —** Rust read loops drop a row that fails to read without saying so (`filter_map(|r| r.ok())`,
  `src-tauri/src/commands/sqlite.rs:640,703`); a page shows fewer rows than it has, and a read-back of that
  row reports "no row with that key". Fix: return the error.
- **S12 —** Leaving a cell with an invalid value cancels the edit silently
  (`src/shared/components/data/grid/editors/CellEditor.vue:67-73`). Fix: keep the error visible in the edit
  bar note ("Not staged: “abc” is not a number").

## Broken or changed

- **B1 — Two capabilities are gone without a decision.** The old SQLite tab could free a SAH-Pool slot
  and force-release a held OPFS database (about:blank, then delete) when deleting a page database. Nothing
  calls `OPFSDomain.releaseSahPoolSlot` any more (`packages/cdp-protocol/src/cdp/domains/opfs.ts:587`), and
  the OPFS tab refuses held files without a way out. `data-parity.md:464` says "nothing that worked is
  gone", but these were reachable (through M1's path) and worked. Fix: re-home both in OPFS's delete
  confirmation, behind their own confirm, or record the owner's decision to drop them.
- **B2 — Ticks in `data-parity.md` that are not true as written:**
  - `:504` "Leaving the table with unsaved changes asks first": not for Close the file or the window (S3).
  - `:504` "wide integers … are not edited as text": typed wide integers are rounded (S4).
  - `:504` "every saved row is read back": capped at 200, and inserts into WITHOUT ROWID tables are never
    checked (`browse/sqliteReadBack.ts:11,63-83`); the toast says how many were not, the parity line
    should too.
  - `:594` source filter "shown with Include the app's other data": see B3.
  - `:576` "12 records sampled once a minute": re-sampled whenever any store's count changes
    (`diagram/useOwnDiagramEntities.ts:95`).
  - `:593` "Find a table, field or note": sticky notes are never searched, only shown
    (`diagram/useDiagramFilters.ts:61-65`).
  - `:617` and the store's doc ("keeps the most recently written"): eviction follows creation order,
    because updating a key keeps its place (`stores/useStorageGraphStore.ts:107-117`), so the oldest
    layout goes first even when it is used every day.
  - `:553,556` pending checks still name the Graph, which is gone.
  - Every SQLite and Diagram line was ticked from code; all 18 live checks (`:538-557`, `:620-638`)
    are open, and this round is the first to write files. `data-plan.md` R3/R3b status should say
    "code complete, not verified live" until they run.
- **B3 — "Include the app's other data" leaks its selects.** The source and origin selects show when the
  stored flag is on, even for an opened file where the switch is hidden (`diagram/DiagramToolbar.vue:80`
  uses `includeOther`, not `includeOther && canIncludeOther`). The source filter also stays applied after
  the switch is turned off (`diagram/useDiagramFilters.ts:45`), so a SQLite diagram can read "Nothing
  matches". Fix: both conditions, and reset the filter to "all" when the switch goes off.
- **B4 — Your own edits are shown as the app's changes.** Saves and deletes record changes with no source
  (`useSqliteWrites.ts:144-155,202-228`), so the row menu offers "Show what the app changed"
  (`browse/SqliteBrowse.vue:210`) and the change summary counts them. IndexedDB tags its own writes
  (`source: "capubridge"`, C33). Fix: the same tag, and "Changed here" as the label.
- **B5 — Same-named databases share diagram state.** An opened file's layout scope is `file:<name>`
  (`sqlite/SqliteDatabasePane.vue:59`, `indexeddb/IdbDatabaseView.vue:57`), so two `app.db` files share one
  layout; node ids use the database name, not its path (`diagram/storageGraphEntityBuilders.ts:233`), so
  same-named databases collide under "Include the app's other data". Fix: a content or path hash for
  files; the path in SQLite node ids.
- **B6 — The Diagram inspector lost its resize** (old Graph: resizable, 20–40 %). It is a fixed `w-80`
  that appears and disappears with the selection (`diagram/DiagramInspector.vue:64`), so the canvas jumps
  on every click. Fix: the frame's resizable pane with a persisted size, kept open with a quiet "Select a
  table" state once opened.
- **B7 — IndexedDB "Read again" does not redraw its diagram** (key unchanged unless a count changes,
  60 s stale time, `diagram/useOwnDiagramEntities.ts:85-106`); SQLite's does. Fix: invalidate the
  `idb-diagram` key in the IndexedDB refresh.
- **B8 — The Diagram chunk has no loading or error state** (`defineAsyncComponent` with a loader only,
  `sqlite/SqliteDatabasePane.vue:18`, `indexeddb/IdbDatabaseView.vue:18`): the area is blank while it
  loads, and stays blank if the chunk fails. Fix: `loadingComponent` / `errorComponent` with `DataState`.
- **B9 — A failed ELK load breaks "Lay out again" until a reload**: the rejected promise is cached
  (`diagram/storageGraphElkLayout.ts:22-34`). Fix: reset `engine` on rejection.
- **B10 —** The Diagram toolbar counts IndexedDB stores as "tables" (`diagram/DiagramToolbar.vue:104`).

## Performance

What holds: page and count queries keyed (C17, F8), virtualised grids, the Diagram and Vue Flow CSS in
their own chunk, ELK in a worker, search debounced, six schema reads at a time.

- **P1 — Opening a phone database copies the whole file into JavaScript.** `prime()` reads it through
  `sqlite_export_bytes` as base64 (`sqlite/useSqliteSnapshotSync.ts:92-94,194-200`,
  `sqlite/useSqliteTab.ts:137`) just to have a diff baseline, and each change diffs two full copies with
  sql.js on the main thread. This is F7, deferred since R2, and the largest memory cost left (a 200 MB
  database is ~270 MB of base64 plus the bytes). Fix: the Rust diff over the two pulled files, before any
  more SQLite features.
- **P2 — A jeep database is hashed in full inside the app every 5 s.** `pageDirty` returns `true` for
  anything but OPFS (`sqlite/useSqliteSnapshotSync.ts:114-116`), so each check reads the whole value and
  runs SHA-256 in the app's page (`packages/cdp-protocol/src/cdp/domains/jeep-sqlite.ts:230-291`). Fix:
  read 100 bytes and compare size plus the header's file-change counter (bytes 24–27); hash only when they
  differ.
- **P3 — The SQL pane and "Export all rows" have no row cap.** `sqlite_execute_query` collects every row
  (`src-tauri/src/commands/sqlite.rs:660-718`); `SELECT * FROM big` sends it all as JSON
  (`sqlite/SqliteSqlPane.vue:78`). Export reads the whole table with full BLOB hex, then builds the file
  in the renderer (`sqlite/browse/useSqliteTableQuery.ts:110-140`). Fix: cap the pane (e.g. 10,000 rows,
  "showing the first 10,000"); stream CSV/JSON/INSERT exports from Rust to the chosen file, as the dump
  already does.
- **P4 — Diagram schema reads cost three IPC calls and three file opens per table**
  (`sqlite/sqliteReads.ts:48-59`, `diagram/useOwnDiagramEntities.ts:28-31`). "Include the app's other
  data" runs every table of every other database at once, unbounded, after a forced pull of each
  (`diagram/useStorageGraphQueries.ts:126-180`). Fix: one `sqlite_read_schema` command per database (one
  connection, all tables); `mapLimited` for the other databases; reuse a fresh pull.
- **P5 — The Diagram rebuilds everything on each IndexedDB change.** Change counts are merged into
  `entities` (`diagram/useDiagramModel.ts:117-148`), which reruns relationships and field matching and the
  full node and edge rebuild (`diagram/DiagramView.vue:196-220`). Fix: keep the counts in their own map
  read by the node component.
- **P6 — The read-back after a save is up to 200 sequential IPC queries**, each opening the file
  (`sqlite/browse/sqliteReadBack.ts:48-83`). Fix: `RETURNING *` inside the Rust transaction, or one
  `SELECT … WHERE (key) IN (…)` per 100 rows.
- **P7 — Vue Flow renders every node** (`only-render-visible-elements="false"`,
  `diagram/DiagramView.vue:309`), and "Include the app's other data" adds one node per LocalForage key (up
  to 5,000). Fix: visible-only rendering (check frames and routed edges), and one node per LocalForage
  instance with its keys as fields.
- **P8 — Layout storage grows fast and fails quietly.** Adoption copies the whole app-wide layout into
  each database's scope (`stores/useStorageGraphStore.ts:429-436`); the whole store is stringified on every
  change (`:199-211`); a full quota only logs (`console.warn`), so layout edits stop being kept without a
  word. Fix: copy only this database's node ids; toast once when saving fails.
- **P9 —** Opened files get a new id each run, and those ids key persisted state that is never pruned or
  reused: show-as (`sqlite/browse/SqliteBrowse.vue:145-168`), the grid layout key (`:384`), sidebar
  settings (`file:<id>`). Fix: key by a content hash, or do not persist for files.
- **P10 —** The ELK worker lives until the app closes (`diagram/storageGraphElkLayout.ts:15-35`). Fix:
  terminate it when the last Diagram unmounts.

## UI/UX (the four Data tabs must behave as one product)

What holds: Cladd throughout, no retiring shadcn imports, one primary per view (Run, Save changes, the
panel Saves), red only on destructive confirms and on Delete note/link, `DataState` for loading, empty and
error, the gate rather than screen-local connect messages.

- **U1 — SQLite's record pane is not the shared one.** It uses `DataGridInspector`, a fixed `w-80` that
  cannot be resized (`sqlite/browse/SqliteBrowse.vue:433-442`), lacks `data-record-pane` (so the Ctrl+F
  guard in `sqlite/SqliteView.vue:106-112` does not exclude it), and shows changes in a modal
  (`SqliteChangeDiffDialog.vue`) where IndexedDB, Key-value, Cache storage and OPFS use `RecordPane` with
  a persisted size and an in-pane Changes view. This is the largest gap with the other tabs.
- **U2 — Edits are staged but deletes are immediate, in the same grid.** Discard brings edits back but
  not a deleted row (`sqlite/browse/SqliteBrowse.vue:257-261`); the grid already has a `staged-delete`
  state (`src/shared/components/data/grid/types.ts:60`). Fix: stage deletes too, so Save applies
  everything in one transaction.
- **U3 — You cannot see which cell changed, undo one, or set NULL.** Only the row is tinted
  (`src/shared/components/data/grid/DataGridRow.vue:38-40`); the text editor cannot produce NULL. Fix: mark
  edited cells (original on hover), add "Undo this change" and "Set to NULL" to the cell menu.
- **U4 — Ctrl+S does nothing while a cell is open**: the editor stops every key
  (`src/shared/components/data/grid/editors/CellEditor.vue:50`). Fix: commit, then let `mod+s` reach the
  grid.
- **U5 — Raw tooltips and a hand-written key label.** `title="Ctrl+S"` on Save
  (`sqlite/browse/SqliteEditBar.vue:39`) should be `KeyCaps` with `bindingTokens("mod+s")`, as Run does.
  Raw `title` also in `diagram/DiagramFieldTable.vue:36-38` (and the PK/IX/FK abbreviations are jargon:
  "Key", "Indexed", "Links to"), `sqlite/browse/SqliteBrowseToolbar.vue:76`,
  `sqlite/browse/SqliteColumnFilter.vue:78,93`, `diagram/DiagramNotePanel.vue:63`. Use `HintTooltip`.
- **U6 — The palette and keyboard do not reach the new actions.** No "Add a row", "Save changes",
  "Discard changes" or "Show the diagram" in `sqlite/useSqliteCommands.ts`; Add a row has no key.
  Key-value already registers "New key".
- **U7 — The Diagram has no keyboard.** No Ctrl+Z / Ctrl+Shift+Z, no zoom keys (+, −, 0 to fit), no
  Escape to clear the selection, no Delete beside Backspace, and nodes cannot be reached by Tab.
- **U8 — Discard drops every staged change with one quiet click and no undo**
  (`sqlite/browse/SqliteEditBar.vue:31-33`). Fix: a toast with Undo (cheap: keep the last staged object).
- **U9 — Copy.** The edit bar's sentence (S2). The SQL pane's "the database refuses statements that
  change data" reads oddly on an editable file: "This pane only reads; edit rows in Rows."
  `diagram/DiagramToolbar.vue:104` "tables" for stores (B10).
- **U10 — "Add filter" is `solid-fill` without `color="brand"`** (`sqlite/browse/SqliteColumnFilter.vue:106`),
  so it is neither the primary nor a secondary.
- **U11 — "Replace with an SQL file…" is not red in the menu** (`sqlite/sqliteTreeActions.ts:129`), while
  "Delete every row…" and "Drop the table…" are; `DESIGN.md` §5 asks for red text on menu items that lead
  to a destructive action.
