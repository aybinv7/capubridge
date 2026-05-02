# Storage Inspector

<ModuleNav :tabs="[
  { label: 'IndexedDB', icon: '🗄️', anchor: 'indexeddb' },
  { label: 'LocalStorage', icon: '⚡', anchor: 'localstorage' },
  { label: 'SQLite', icon: '📊', anchor: 'sqlite' },
  { label: 'OPFS', icon: '📂', anchor: 'opfs' },
  { label: 'Cache API', icon: '🗜️', anchor: 'cache-api' },
  { label: 'Storage Graph', icon: '🕸️', anchor: 'storage-graph' },
  { label: 'Change Tracking', icon: '↔️', anchor: 'change-tracking' },
]" />

The **Storage** module provides deep inspection of browser storage mechanisms running on the selected target. All storage access goes through CDP — not file pulling.

## Storage tabs

The module has 8 tabs covering each storage type:![Screenshot showing all 8 storage tabs — IndexedDB, LocalStorage, SQLite, OPFS, Cache, Graph, Changes, and more]

## IndexedDB

Explore IndexedDB databases, object stores, and records. This is the most feature-rich tab.

### Database list

1. Click the **IndexedDB** tab
2. All databases in the target appear in the left sidebar
3. Click a database to expand its object stores
4. Click an object store to browse its records

### TanStack Table

Records are displayed in a **TanStack Table** with:

- **Sorting** — click column headers
- **Filtering** — search bar + advanced filters
- **Virtual scrolling** — for datasets >50 records
- **Column settings** — show/hide columns via toolbar
- **CRUD** — create, read, update, delete

### Toolbar actions

| Button      | Action                          |
| ----------- | ------------------------------- |
| **Search**  | Filter records by key or value  |
| **Filters** | Open advanced filter builder    |
| **Export**  | Export to CSV or JSON           |
| **Columns** | Configure column visibility     |
| **Refresh** | Reload the current object store |

### Advanced filters

Build complex queries with the filter builder:![Screenshot showing the advanced filter builder]
Example: `age > 25 AND status = "active" ORDER BY name`

### Row detail

Double-click a row to open the **Row Detail Dialog**:![Screenshot showing the row detail dialog with JSON editor]
From here you can:

- View the full record as formatted JSON
- Edit values inline
- Delete the record
- Compare with a previous version (if change tracking is enabled)

## LocalStorage

Simple key-value browser. Shows all `localStorage` entries for the target.

- Click a key to view the value (JSON formatted)
- Edit values directly

## SQLite

Browse `. db` and `.db-journal` files found on the device.

### Database list

1. Click the **SQLite** tab
2. Select a database file
3. Browse tables in the left sidebar
4. Click a table to see its rows in a TanStack Table

### Query builder

Run SQL queries with the filter builder:![Screenshot showing the SQL filter builder]

### Row detail

Double-click a row for full row detail and inline editing.

### Limitations

SQLite browsing uses **sql. js** (WASM). Complex queries (JOINs across large tables) may be slow. Consider using the **IDB** interface instead for IndexedDB data.

## OPFS

Browse Origin Private File System files through a virtual file tree. Files can be read, written, or deleted from the UI.

## Cache API

Browse cached HTTP responses. Each entry shows:![Screenshot showing the Cache API explorer with request/response pairs]

- **URL** — the cached request URL
- **Status** — HTTP status code
- **Size** — response body size
- **TTL** — time until expiration
  Click an entry to view the full request and response headers and body.

## Storage Graph

Visualize relationships between storage entities as a graph:![Screenshot showing the storage graph with IndexedDB databases as nodes and object stores as child nodes]

- **Nodes** — databases, object stores, cache entries
- **Edges** — relationships between entities
- **Pan/zoom** — canvas controls in the toolbar
- **Annotations** — add notes to nodes

## Change Tracking

Track real-time changes to IndexedDB records:![Screenshot showing the change tracking overlay in the DOM inspector]
When enabled, Capubridge watches for DOM mutations and compares snapshots. Changes appear as overlays on the affected nodes in the Inspect module. <div class="warning">Change tracking requires an active CDP connection. The target must be inspected in Capubridge (not just viewed in the app).</div>
