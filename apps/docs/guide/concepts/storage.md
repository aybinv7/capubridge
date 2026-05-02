# Storage Context

Capubridge's Storage Inspector works with a **storage context** — the combination of the connected device and selected target. Storage is always scoped to a specific target.

## Storage types

Capubridge can inspect all major browser storage mechanisms:

### IndexedDB

Live access to IndexedDB databases, object stores, and records via the **CDP Storage** and **CDP IndexedDB** domains. Uses TanStack Table with virtual scrolling for large datasets.

### LocalStorage

Key-value pairs managed by the browser's `localStorage` API. Viewed and edited directly in the app.

### SQLite

`. db` and `.db-journal` files found in the app's private storage. Browsed using **sql. js** (WASM) — queries run entirely in the browser.

### OPFS (Origin Private File System)

Files created by the OPFS API. Explored through a virtual file tree.

### Cache API

Cached HTTP responses stored via the Cache API. Viewed as request/response pairs with metadata.

### LocalForage

LocalForage is a IndexedDB wrapper. Capubridge treats LocalForage stores as IndexedDB databases — they share the same underlying storage.

## Storage graph

The **Storage Graph** visualizes relationships between storage entities:

- IndexedDB databases as nodes
- Object stores as child nodes
- Cross-references between databases

## How it works

All storage access goes through **CDP** (not by pulling files from the device):

1. Capubridge opens a CDP session to the target
2. Storage queries are sent as CDP commands
3. The device's Chrome/WebView returns the data
4. Capubridge renders it
   This means the Storage Inspector **only works** when a target is selected.

## Scope and isolation

Each target has its own isolated storage. Storage from one app is **not** accessible in another app's context. The target acts as the security boundary.

## Change tracking

Capubridge can track changes to IndexedDB in real time:

1. Select a database and object store
2. Enable **Change tracking** in the toolbar
3. Capubridge watches for DOM mutations via CDP
4. Changes appear as an overlay in the DOM inspector
   Changes are tracked by comparing snapshots — old vs. new value.
