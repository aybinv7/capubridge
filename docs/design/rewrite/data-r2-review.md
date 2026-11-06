# Data round 2 (Key-value, Cache storage, OPFS) — review

Reviewed Key-value `f7566f11` `3818ccfa` `b8bcf494`, Cache storage `1d0eec52` `02c47081` `ba633a22`
`fc989c30` `bbdf3e38`, OPFS `7af3366f` `5be2a3bc` `d1b4a7fd` `b216547b` `45bbd2b7`. Paths relative to
`apps/desktop/src/modules/storage/` unless they start with `src/`, `packages/` or `src-tauri/`.
**Data-safety items (S) first, each with a test that fails before the fix.**

## Data safety

- **S1 — Graph still runs the risky LocalForage read**: `graph/useStorageGraphQueries.ts:100-107` uses
  `LocalForageDomain.getEntries` (`packages/cdp-protocol/src/cdp/domains/localforage.ts:63-81`), which
  calls `createInstance` and can upgrade the app's database; the raw `indexedDB.open('localforage')`
  fallback has no exists-guard. Move Graph onto `KeyValueDomain.discover()` / `readForage()`, then
  retire or guard `LocalForageDomain`.
- **S2 — Key-value deletes skip "changed since read"** (`packages/.../keyvalue-scripts.ts:79-82,222-224`,
  `keyvalue/kvWrites.ts:135` sends no `expected`): compare like saves do; batch deletes in one script
  (one frame-context resolution per batch), with progress.
- **S3 — Cache deletes**: entries past the 5 s budget have `version: ''` and skip the check
  (`cache-storage-scripts.ts:136-137,275`) and show a false "app saved a new response" banner
  (`cache/CacheEntryPane.vue:58-60`); the version ignores the body (`:49-52`); a partly failed delete
  reports "No entry was deleted" (`cache/cacheWrites.ts:85-104`); `cache.delete(request)` may match a
  sibling Vary variant — count `keys()` before/after each delete; cache delete checks only the count
  (`:313-318`). Unreached rows: read the version at delete time instead of skipping the check.
- **S4 — OPFS folder delete checks nothing inside and warns about nothing inside**
  (`packages/.../opfs-files-scripts.ts:172,186`, `opfs/opfsWrites.ts:22-38`): walk the folder first; list
  counts, databases, WAL/journal files and SAH-Pool slots in the confirmation; refuse while any file
  inside is held open (test with a nested locked file). Files with unknown size skip the size/date
  check — read stat at delete time instead.
- **S5 — a download can replace the destination with a truncated copy** (`src-tauri/src/commands/opfs_pull.rs`
  `copy_range_inner`, `save_into`): keep the `.capubridge-part` and error when `written != size` or the
  closing stat fails; `sync_all()` before rename. Rust tests.
- **S6 — Key-value frame storage may be read and written in different partitions** (reads via
  `DOMStorage.getDOMStorageItems`, writes in the frame's isolated world, `packages/.../keyvalue.ts:178-221`):
  read frame storage in the same isolated world as the writes.
- **S7 —** Windows line breaks rewritten on first edit (`keyvalue/KvValueEditor.vue:308,351-353`):
  preserve CRLF or say honestly what happens. Discovery opens every IndexedDB database without
  `onversionchange` (`keyvalue-scripts.ts:111-147`): add `db.onversionchange = () => db.close()`, open in
  parallel under one ~2.5 s budget, cache per target which databases are not LocalForage, `staleTime`.

## Broken or changed

- **B1 — sidebar "Delete the cache…" and "Delete the folder…" do nothing unless the item was already
  read** (`cache/cacheTreeActions.ts:71`, `cache/CacheStorageView.vue:87-94`, `useCacheWrites.ts:29,76-77`;
  `opfs/OpfsView.vue:78-95`, `useOpfsWrites.ts:28-39`): run the pending delete once the read settles;
  tests for this path.
- **B2 — OPFS "Pin to the top" only adds an icon** (ordered sources skip pinned-first,
  `frame/dataTreeModel.ts:33`).
- **B3 — Key-value type check gone** (old `LSExplorer.vue:115-146`): warn (not block) when the draft's
  type differs from the original's.
- **B4 — Ctrl+F in Key-value Text edit** does nothing (`KvValueEditor.vue` focusFind, `KvPane.vue:135-139`).
- **B5 — OPFS dates lost their time; "Today at…" frozen at read time**: exact time in a tooltip,
  ticking relative labels.
- **B6 —** after saving a non-text key the pane loses focus (`KvRows.vue:154`); a blocked delete
  toasts "Nothing was saved" (`useKvWrites.ts:191-196`).
- **B7 —** the OPFS folder walk is cached per target only (`opfs/useOpfsQueries.ts:39`): key by origin.
- Fix the false ticks in `docs/design/rewrite/data-parity.md` (Cache lines 325/329/331, OPFS 372/373 +
  pin, the Key-value "never createInstance" line) once each is really true.

## Performance

- **F1 — Cache pane reads up to 1 MiB per arrow key, uncancelled, 15 s cache** (`cache/CacheRows.vue:73-79,195`,
  `cache/useCacheQueries.ts:98-111`, `cache-storage-scripts.ts:185,192-206`): ~140 ms settle,
  `cache.keys(url, { ignoreVary: true })` narrowing, headers first and body only for text/image/SVG or
  on request, `gcTime` 0–2 s. List re-reads after each delete: patch the cached list.
- **F2 — LocalForage reads all values (≤5,000) in one long transaction; every write re-reads**
  (`keyvalue-scripts.ts:155-191`, `kvModel.ts:202-228`, `KvCollection.vue:47`): keys + type + size +
  240-char preview + hash; full value per key when the pane opens or an edit starts; batched
  short transactions; patch the cache after writes.
- **F3 — OPFS chunk reads block the app's main thread; previews uncancelled**
  (`src-tauri/src/commands/opfs_pull.rs:199-229`, `packages/.../opfs.ts:400-432`, `opfs/useOpfsPreview.ts:57-65`):
  try `IO.resolveBlob`/`IO.read` (verify on the emulator), else a worker from a Blob URL or 1–2 MiB
  chunks; a cancel check between chunks.
- **F4 —** bulk key deletes 1–3 CDP calls per key (with S2's batch).
- **F5 —** `JsonEditor` renders every line (`src/shared/components/data/JsonEditor.vue`): above ~64 KiB /
  2,000 lines edit as text with validation on save, or virtualise; one debounced parse passed down.
- **F6 —** grid cells scan whole strings per render (`src/shared/components/data/grid/valueFormat.ts:234-244`):
  bounded preview and line count in the shared grid (Ctrl+C still copies the full value).
- **F7 —** Key-value pane remounts and pretty-prints twice per focus step (`KvRows.vue:271,317`,
  `KvValueRead.vue:18-28`, `KvPane.vue:50-51`, `kvEdit.ts:29`): settle, lazy pretty, `baseDraft` only on Edit.
- **F8 —** `DOMStorage.enable` never disabled (`packages/.../keyvalue.ts:152`): drop it if reads work
  without, else ref-count with the recorder, or use events to patch the list.
- **F9 —** OPFS save cannot be cancelled and its state is per folder (`opfs_pull.rs:286-355`,
  `opfs/useOpfsDownload.ts`, `OpfsFolder.vue:63`): cancellable saves, module-level state, startup cleanup
  of stale `.capubridge-part`.
- **F10 —** Rust copies each chunk ~4× and writes on a tokio worker (`opfs_pull.rs:113-160,366-381`).
- **F11 —** OPFS listing calls `getFile()` 5,000× at once (`opfs-files-scripts.ts:117-130`): pool 16–32,
  5 s budget.

## UI/UX (all four Data tabs must behave as one product)

- **U1 — columns don't fit** (`keyvalue/kvGrid.ts`, `cache/cacheGrid.ts`, `opfs/opfsGrid.ts`): Name/Key/
  Value flex with a minimum, number columns narrow; drop columns by container query (Network's
  `showAt`); `HintTooltip` on pane titles.
- **U2 — OPFS has two "Delete folder…" buttons for different folders; destructive buttons are the only
  labelled header buttons** (`opfs/OpfsFolder.vue:213-223`, `cache/CacheCollection.vue:94-103`,
  `opfs/OpfsFilePane.vue`): header deletes into an overflow/row menu or named target; no pane for
  folders.
- **U3 — OPFS focus lost after opening a folder** (`opfs/OpfsView.vue:192`): focus the grid's first row
  after any navigation.
- **U4 — Cache and OPFS show bytes through different viewers**: one body viewer for both
  (`src/shared/file-viewer` with an injected reader, or add hex to `BinaryBody`).
- **U5 — accent and button hierarchy applied differently per tab**: Save accented (`keyvalue/KvPane.vue:271-279`,
  `frame/RecordPane.vue:212-220`); Bring to front accented everywhere (`keyvalue/KvCollection.vue:117`,
  `keyvalue/KeyValueView.vue:195-198`, `indexeddb/IdbRows.vue:506`, `indexeddb/IndexedDBView.vue:279-283`);
  Try again quiet everywhere (`src/shared/file-viewer/ViewerBody.vue:78-86`); pane delete the same in all
  tabs (quiet button, red on the confirm); one pane switcher (Segmented or Tabs, not both). Put it in a
  shared pane footer.
- **U6 — leaving a tab loses your place**: remember the last location per tab and target; sub-tabs link
  to it; skip the Cache overview when there is one cache; consistent landing.
- **U7 — SAH-Pool slot pane**: "Open in SQLite" primary, Download once, honest hex title, one size
  format (`src/shared/file-viewer/HexView.vue:31-36,88-100`, `opfs/OpfsFilePane.vue:187-210`).
- **U8 — "Databases in the pool"**: status bar, pane or row "Open in SQLite", header count follows the
  view, flags in words (`opfs/OpfsPoolRows.vue`, `opfs/OpfsFolder.vue:139-142,305-312`).
- **U9 — sizes/dates/status passed as text** (`src/shared/components/data/grid/types.ts:3-13`): typed
  columns with formatters, or per-column `align`/`glyph: false`/`tone`; option to hide the row gutter.
- **U10 —** Cache entry list like Network's (one name cell with method and host, right-aligned size,
  type words, hide an all-empty Served).
- **U11 —** sidebar width restore after the screen column opens and closes; label truncates before the
  quiet detail (`frame/DataWorkbench.vue:167-177`, `frame/DataTreeItem.vue:121,142-143`).
- **U12 —** one header identity pattern (host, quiet), counts only in the status bar, one name for the
  OPFS root; quieter tech chip.
- **U13 —** freshness tag: hollow `StatusDot` + "read once" in a `HintTooltip` (`frame/DataFreshness.vue`,
  `src/components/gate/ProvenanceTag.vue`).
- **U14 —** no "read-only" lock in Cache's status bar next to working deletes (`cache/CacheRows.vue:26-27,261-266`).
- **U15 —** `overflow-wrap:anywhere` for prose in `src/shared/http/KeyValueList.vue` (keep `break-all`
  for mono URLs), `whitespace-nowrap` on image dimensions (`src/shared/code-viewer/ImageView.vue:114`).

## Round 2 fixes

Each S fix has a test that failed before the fix (run red, then green). Commits are local on
`feat/ui-ux-overhaul`.

| Id           | Status  | Commit                 | Notes and proving test                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | ------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1           | fixed   | `0a8358d8`             | Graph reads LocalForage with `KeyValueDomain.readAllForage`; `LocalForageDomain` retired. `tests/keyvalue-graph.test.ts` (red on the old domain: `createInstance` called, database not found)                                                                                                                                                                                         |
| S2           | fixed   | `81925189`             | Deletes send `expected`; one script per 500 keys, one frame lookup, progress in the status bar; a part-way failure says how many went. `keyvalue-storage.test.ts` / `keyvalue-forage.test.ts` "deletes keep what the person did not see", `kvWrites.test.ts`                                                                                                                          |
| S3           | fixed   | `dc156e0a`             | Unread rows: version read before the question, empty version kept unless forced; no false "new response" banner; body in the fingerprint (size + first 32 KiB); per-entry failures; Vary siblings kept (`shared`) and extra removals counted; whole-cache fingerprint. `cache-storage.test.ts` "check what the read did not see" (5 red); `cacheWrites.test.ts`, `cacheModel.test.ts` |
| S4           | fixed   | `c1822356`             | `OPFSFilesDomain.inspect` walks before the question (counts, databases, journals, slots, held-open files); refused while anything inside is held open, even forced; fingerprint compared; unknown file sizes read before the question. `opfs-files.test.ts` "folder deletes look inside first" (5 red, nested locked file included), `opfsWrites.test.ts`                             |
| S5           | fixed   | `d3a00dc8`             | Short copy or failed closing stat is an error, part removed, destination untouched; `sync_all` before rename; short SQLite pull is an error. Rust `opfs_pull` tests (3 red on the old decision)                                                                                                                                                                                       |
| S6           | fixed   | `b6d42c1b`             | Local/Session storage read in the same frame context as writes. `keyvalue-storage.test.ts` "read where it is written" (red with a partitioned DOMStorage view)                                                                                                                                                                                                                        |
| S7           | fixed   | `e452b62a`, `669c1741` | CRLF restored on save, honest note for mixed/lone CR (`KvPane.test.ts`, 2 red); `onversionchange` close, parallel opens under 2.5 s, plain databases cached per target by `name@version`, 10 s `staleTime` (`keyvalue-discovery.test.ts`, 2 red)                                                                                                                                      |
| B1           | fixed   | `8c0943b8`             | `useWhenRead` runs the sidebar delete once the read settles (`useWhenRead.test.ts`)                                                                                                                                                                                                                                                                                                   |
| B2           | fixed   | `b9f9d9b7`             | Pinned folders move to the top of an ordered tree (`dataTreeModel.test.ts`)                                                                                                                                                                                                                                                                                                           |
| B3           | fixed   | `9a9a4e9a`             | Type-change warning, never blocking (`kvEdit.test.ts`)                                                                                                                                                                                                                                                                                                                                |
| B4           | fixed   | `3fc87423`             | Find bar in Text edit (shared `TextFindBar`)                                                                                                                                                                                                                                                                                                                                          |
| B5           | fixed   | `ed2d46b7`             | Time of day kept, minute clock, exact time on hover (grid cell titles)                                                                                                                                                                                                                                                                                                                |
| B6           | fixed   | `42bbdf3a`, `81925189` | Focus kept after saving a non-text key; blocked delete says "Nothing was deleted"                                                                                                                                                                                                                                                                                                     |
| B7           | fixed   | `aaac7ab1`             | Folder walk keyed by target and page origin                                                                                                                                                                                                                                                                                                                                           |
| Parity ticks | fixed   | this commit            | Cache, OPFS, pin and "never createInstance" lines corrected in `data-parity.md`, pending checks listed                                                                                                                                                                                                                                                                                |
| F1           | fixed   | `e197bd79`             | 140 ms settle, dropped reads, body only for text/image/SVG or on "Read the body", 2 s cache, list patched after deletes; `keys(url, { ignoreVary })` narrowing in `dc156e0a`                                                                                                                                                                                                          |
| F2           | phased  | `5693707e`             | Done: keys then values 200 per short transaction; Local/Session saves and all deletes patch the list. Remains: a list read of keys + type + size + 240-char preview + hash with the full value read on open/edit                                                                                                                                                                      |
| F3           | phased  | `56f05ccd`             | Done: 2 MiB chunks encoded by `FileReader` (protocol and Rust), `AbortSignal` between chunks, previews cancelled. Remains: CDP `IO.read` (needs a check on the emulator)                                                                                                                                                                                                              |
| F4           | fixed   | `81925189`             | With S2's batch                                                                                                                                                                                                                                                                                                                                                                       |
| F5           | fixed   | `6d36bf2f`             | Above 64 KiB / 2,000 lines JsonEditor is one plain textarea (validated, find works); the Key-value editor stops re-formatting large drafts. Not done: one shared debounced parse                                                                                                                                                                                                      |
| F6           | fixed   | `7d718b28`             | Bounded line count (64 KiB) and preview (`gridCore.test.ts`)                                                                                                                                                                                                                                                                                                                          |
| F7           | fixed   | `b2dc33a9`             | Pane follows 120 ms after the last step; edit draft built only on Edit. Not done: lazy pretty-print in `KvValueRead`                                                                                                                                                                                                                                                                  |
| F8           | fixed   | `b6d42c1b`             | `DOMStorage.enable` dropped (reads no longer use DOMStorage)                                                                                                                                                                                                                                                                                                                          |
| F9           | phased  | `6b1b9624`             | Done: Cancel in the toast (Rust `opfs_cancel_save`, Rust test), module-level state. Skipped: startup cleanup of stale parts; every error path now removes the part (S5), so only a killed process leaves one, and cleaning needs a journal of part paths                                                                                                                              |
| F10          | skipped | —                      | Bounded by F3's 2 MiB chunks; moving writes to `spawn_blocking` and cutting the copies is left for the R3 pull work                                                                                                                                                                                                                                                                   |
| F11          | fixed   | `c1822356`             | Pool of 24, 5 s budget, later files `unread`                                                                                                                                                                                                                                                                                                                                          |
| U1           | fixed   | `d8a53f89`             | Grid `grow`/`minWidth`/`hideBelow`; Name/Key/Value/Address grow; key tooltip in the Key-value pane title                                                                                                                                                                                                                                                                              |
| U2           | partial | `2512cd9a`             | Header deletes are named icon actions; the pane still opens for a folder row                                                                                                                                                                                                                                                                                                          |
| U3           | fixed   | `f172de3c`             | First row takes focus after opening a folder                                                                                                                                                                                                                                                                                                                                          |
| U4           | fixed   | `6800d011`             | Shared `HexDump` for OPFS files and cached/Network bodies                                                                                                                                                                                                                                                                                                                             |
| U5           | fixed   | `267d5a2e`             | Shared `DataPaneFooter`; Save and Bring to front accented; Try again quiet; Segmented in every pane                                                                                                                                                                                                                                                                                   |
| U6           | fixed   | `a7f77873`             | Places remembered per tab and target; single cache opens on landing                                                                                                                                                                                                                                                                                                                   |
| U7           | partial | `267d5a2e`             | "Open in SQLite" primary, Download secondary. Not done: hex title wording, one size format                                                                                                                                                                                                                                                                                            |
| U8           | skipped | —                      | "Databases in the pool" status bar and wording: not reached this round                                                                                                                                                                                                                                                                                                                |
| U9           | partial | `d8a53f89`, `ed2d46b7` | Per-column `align`, `glyph: false`, cell hover titles. Not done: `tone`, hiding the row gutter                                                                                                                                                                                                                                                                                        |
| U10          | partial | `b6d73513`             | All-empty Served hidden. Not done: one Network-style name cell                                                                                                                                                                                                                                                                                                                        |
| U11          | partial | `7a2a4cca`             | The quiet host truncates before the name. Not done: sidebar width restore after the screen column                                                                                                                                                                                                                                                                                     |
| U12          | partial | `2512cd9a`             | Counts only in the status bar. Not done: one OPFS root name, quieter tech chip                                                                                                                                                                                                                                                                                                        |
| U13          | fixed   | `7ab52a54`             | Hollow `StatusDot`, "read once" on hover                                                                                                                                                                                                                                                                                                                                              |
| U14          | fixed   | `f172de3c`             | No read-only lock beside working deletes                                                                                                                                                                                                                                                                                                                                              |
| U15          | fixed   | `f172de3c`             | `wrap-anywhere` for prose, `break-all` for mono; image dimensions `whitespace-nowrap`                                                                                                                                                                                                                                                                                                 |
