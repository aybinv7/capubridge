# DevBridge — Project Specification

> The ultimate desktop dev tool for hybrid app developers.  
> ADB GUI + deep browser storage inspector + remote device debugging in one Tauri app.  
> Think: Aya × IndexedDB Browser, but mature, remote-debug-aware, and Capacitor-native.

---

## Table of Contents

1. [Vision & Problem Statement](#1-vision--problem-statement)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture](#4-architecture)
5. [Module Specs](#5-module-specs)
   - 5.1 Device Manager
   - 5.2 Storage Inspector
   - 5.3 Network Inspector
   - 5.4 Console & Runtime
   - 5.5 Hybrid App Tools
6. [Data Models & Types](#6-data-models--types)
7. [State Management](#7-state-management)
8. [IPC Contract (Rust ↔ Vue)](#8-ipc-contract-rust--vue)
9. [CDP Integration Layer](#9-cdp-integration-layer)
10. [ADB Integration Layer](#10-adb-integration-layer)
11. [UI System & Design Tokens](#11-ui-system--design-tokens)
12. [Routing](#12-routing)
13. [Testing Strategy](#13-testing-strategy)
14. [Build & Release](#14-build--release)
15. [Phase Roadmap](#15-phase-roadmap)

---

## 1. Vision & Problem Statement

### The gap

Hybrid app developers (Capacitor, Ionic, Cordova) debug across two worlds simultaneously:

- The **browser** world: IndexedDB, LocalStorage, Cache API, network requests, JS runtime
- The **device** world: Android processes, ADB, logcat, file system, app packages

Existing tools force you to juggle:

- `chrome://inspect` — clunky, no editing, no query, data doesn't update live
- Chrome DevTools Application panel — read-only IDB, no copy, no proper search
- Android Studio — full IDE overhead just to run `adb logcat`
- Aya/TangoADB — great ADB GUI but zero browser/storage awareness
- Various Chrome extensions — work only on local pages, break on remote debugging targets

### What DevBridge is

A single Tauri desktop app that:

- Acts as a full **ADB GUI** (devices, logcat, files, packages, screen)
- Provides a **deep storage inspector** (IDB with full CRUD + query, LocalStorage, Cache API, OPFS, SQLite-in-IDB)
- Connects to **any CDP target** — local Chrome tab, USB Android device, emulator — from one interface
- Has **Capacitor-specific intelligence** built in (plugin storage mapping, sync queue viewer, migration tracker)

### Primary users

Hybrid app developers using Capacitor/Ionic, debugging on physical Android devices daily. Teams of 2–10 devs. Power users — they want raw access, not hand-holding.

---

## 2. Tech Stack

### Frontend

| Concern           | Choice                        | Reason                                                        |
| ----------------- | ----------------------------- | ------------------------------------------------------------- |
| Framework         | Vue 3                         | Composition API, `<script setup>`, excellent TS support       |
| Language          | TypeScript (strict)           | Full type safety across IPC boundary                          |
| Build             | Vite 5                        | Fast HMR, native ESM, Tauri-compatible                        |
| Styling           | UnoCSS                        | Atomic CSS, zero runtime, Tailwind-compatible utilities       |
| Component library | Radix Vue (headless) + custom | Accessible primitives, we own the visual layer                |
| Tables            | TanStack Table v8             | Pro-level table handling, virtual rows for large IDB datasets |
| Terminal emulator | xterm.js v5                   | Logcat output, console REPL                                   |
| JSON editor       | Monaco Editor (slim build)    | Code editing in query console and JSON cell editor            |
| Charts            | Chart.js 4 (lazy loaded)      | Storage quota viz, record count charts                        |
| Icons             | Lucide Vue                    | Clean, consistent, tree-shakeable                             |
| Virtual scroll    | Vue Virtual Scroller          | Long lists (logcat, network requests)                         |

### Tauri / Rust backend

| Concern   | Choice                        | Notes                                           |
| --------- | ----------------------------- | ----------------------------------------------- |
| Framework | Tauri 2 stable                | Desktop only target (Windows, macOS, Linux)     |
| Shell     | tauri-plugin-shell            | Spawn `adb` subprocess, stream stdout           |
| FS        | tauri-plugin-fs               | Save snapshots, seeds, export files             |
| Store     | tauri-plugin-store            | Persist app prefs, saved queries, seed profiles |
| WebSocket | Native browser WS in frontend | CDP connection stays in JS layer                |
| HTTP      | Native fetch in frontend      | Hit localhost:9222 JSON endpoint                |

### CDP Integration

- Runs entirely in the **Vue frontend** via browser `WebSocket` API
- `chrome-remote-interface` not needed — raw CDP WS is simple enough, we get better TS types rolling our own thin wrapper
- ADB port forwarding handled by Rust shell plugin (`adb forward tcp:9222 localabstract:chrome_devtools_remote`)

### State Management

| Concern                                  | Choice                            |
| ---------------------------------------- | --------------------------------- |
| Global app state                         | Pinia                             |
| Server state / CDP data                  | TanStack Query (Vue Query)        |
| Real-time streaming (logcat, CDP events) | Pinia + composable event emitters |

### Dev tooling

- ESLint + `@antfu/eslint-config`
- Prettier
- Vitest (unit + component tests)
- Playwright (e2e via `tauri-driver`)
- `@tauri-apps/cli` for build/dev

---

## 3. Project Structure

```
devbridge/
├── src/                          # Vue frontend
│   ├── main.ts
│   ├── App.vue
│   │
│   ├── assets/
│   │   └── styles/
│   │       ├── main.css          # UnoCSS entry
│   │       └── tokens.css        # CSS custom properties (design tokens)
│   │
│   ├── router/
│   │   └── index.ts              # Vue Router — panel-level routes
│   │
│   ├── stores/                   # Pinia stores
│   │   ├── devices.store.ts      # ADB device list, selected device
│   │   ├── targets.store.ts      # CDP targets (local + remote)
│   │   ├── connection.store.ts   # Active CDP WS connections
│   │   ├── storage.store.ts      # IDB/LS/Cache data cache
│   │   ├── network.store.ts      # Captured network requests
│   │   ├── console.store.ts      # Console messages log
│   │   ├── logcat.store.ts       # ADB logcat stream
│   │   └── ui.store.ts           # Panel layout, sidebar state
│   │
│   ├── composables/              # Reusable logic
│   │   ├── useCDP.ts             # CDP WebSocket client, command/event
│   │   ├── useADB.ts             # Tauri IPC → ADB commands
│   │   ├── useLogcat.ts          # Logcat streaming composable
│   │   ├── useIDB.ts             # IndexedDB CDP operations
│   │   ├── useStorage.ts         # Unified storage (IDB + LS + Cache)
│   │   ├── useNetworkCapture.ts  # CDP Network domain events
│   │   ├── useSeeds.ts           # Snapshot/seed profile management
│   │   └── useShortcuts.ts       # Global keyboard shortcuts
│   │
│   ├── modules/                  # Feature modules (one dir per panel)
│   │   │
│   │   ├── devices/              # MODULE 1: ADB device manager
│   │   │   ├── DevicesPanel.vue          # Panel root
│   │   │   ├── DeviceList.vue            # Connected devices sidebar
│   │   │   ├── DeviceCard.vue            # Single device card
│   │   │   ├── LogcatViewer.vue          # xterm.js logcat terminal
│   │   │   ├── LogcatToolbar.vue         # Filter, tag, level controls
│   │   │   ├── AppManager.vue            # Installed packages list
│   │   │   ├── FileExplorer.vue          # ADB file browser
│   │   │   ├── ScreenCapture.vue         # Screenshot/record controls
│   │   │   ├── DeviceInfo.vue            # Hardware/OS info dashboard
│   │   │   └── WirelessPairing.vue       # ADB over TCP/IP setup
│   │   │
│   │   ├── storage/              # MODULE 2: Storage inspector (CORE)
│   │   │   ├── StoragePanel.vue          # Panel root
│   │   │   ├── StorageSidebar.vue        # DB/store tree navigation
│   │   │   ├── StorageTree.vue           # Recursive tree component
│   │   │   │
│   │   │   ├── idb/
│   │   │   │   ├── IDBExplorer.vue       # Main IDB view
│   │   │   │   ├── IDBTable.vue          # TanStack Table for records
│   │   │   │   ├── IDBTableToolbar.vue   # Search, filter, refresh
│   │   │   │   ├── IDBRecordEditor.vue   # JSON editor for create/edit
│   │   │   │   ├── IDBQueryConsole.vue   # JS query console (Monaco)
│   │   │   │   ├── IDBSchemaView.vue     # Inferred schema + indexes
│   │   │   │   ├── IDBDiffViewer.vue     # Before/after snapshot diff
│   │   │   │   └── IDBStats.vue          # Record count, store sizes
│   │   │   │
│   │   │   ├── localstorage/
│   │   │   │   ├── LSExplorer.vue        # LocalStorage key-value table
│   │   │   │   └── LSEditor.vue          # Inline value editing
│   │   │   │
│   │   │   ├── cache/
│   │   │   │   ├── CacheExplorer.vue     # Cache API storage explorer
│   │   │   │   └── CacheEntryDetail.vue  # Request/response headers + body
│   │   │   │
│   │   │   ├── opfs/
│   │   │   │   ├── OPFSExplorer.vue      # Origin Private File System tree
│   │   │   │   └── OPFSFilePreview.vue   # File content preview
│   │   │   │
│   │   │   ├── seeds/
│   │   │   │   ├── SeedManager.vue       # Save/load/delete DB snapshots
│   │   │   │   └── SeedCard.vue          # Single seed profile card
│   │   │   │
│   │   │   └── quota/
│   │   │       └── QuotaGauge.vue        # Storage quota + persistence
│   │   │
│   │   ├── network/              # MODULE 3: Network inspector
│   │   │   ├── NetworkPanel.vue          # Panel root
│   │   │   ├── NetworkTable.vue          # TanStack Table — requests list
│   │   │   ├── NetworkTableToolbar.vue   # Method filter, URL search
│   │   │   ├── RequestDetail.vue         # Headers, payload, response
│   │   │   ├── WSFrameViewer.vue         # WebSocket frame inspector
│   │   │   ├── NetworkThrottle.vue       # Offline/throttle controls
│   │   │   └── RequestMocker.vue         # Response intercept/mock
│   │   │
│   │   ├── console/              # MODULE 4: Console & runtime
│   │   │   ├── ConsolePanel.vue          # Panel root
│   │   │   ├── ConsoleLog.vue            # Log messages (xterm or custom)
│   │   │   ├── ConsoleEntry.vue          # Single log entry w/ object tree
│   │   │   ├── REPL.vue                  # JS REPL (Monaco input)
│   │   │   └── ExceptionTracker.vue      # Uncaught errors list
│   │   │
│   │   └── hybrid/               # MODULE 5: Capacitor/hybrid tools
│   │       ├── HybridPanel.vue           # Panel root
│   │       ├── PluginStorageMap.vue      # Capacitor plugin storage viewer
│   │       ├── SyncQueueInspector.vue    # Offline sync queue visualizer
│   │       ├── MigrationTracker.vue      # IDB version + migration log
│   │       └── PersistenceChecker.vue    # Storage persist API status
│   │
│   ├── components/               # Shared UI components
│   │   ├── layout/
│   │   │   ├── AppShell.vue              # Root layout
│   │   │   ├── Sidebar.vue               # Left nav sidebar
│   │   │   ├── PanelHeader.vue           # Per-panel top bar
│   │   │   ├── SplitPane.vue             # Resizable split view
│   │   │   └── StatusBar.vue             # Bottom status bar
│   │   │
│   │   ├── primitives/
│   │   │   ├── Button.vue
│   │   │   ├── Badge.vue
│   │   │   ├── Input.vue
│   │   │   ├── Select.vue
│   │   │   ├── Tooltip.vue
│   │   │   ├── ContextMenu.vue
│   │   │   ├── Dialog.vue
│   │   │   ├── Tabs.vue
│   │   │   ├── Toggle.vue
│   │   │   └── Skeleton.vue
│   │   │
│   │   ├── data/
│   │   │   ├── JsonTree.vue              # Collapsible JSON object viewer
│   │   │   ├── DataTable.vue             # TanStack Table wrapper (shared)
│   │   │   ├── CodeBlock.vue             # Syntax-highlighted code
│   │   │   └── KeyValueRow.vue           # Simple k/v display
│   │   │
│   │   └── feedback/
│   │       ├── EmptyState.vue
│   │       ├── ErrorBoundary.vue
│   │       ├── LoadingSpinner.vue
│   │       └── Toast.vue
│   │
│   ├── lib/                      # Pure logic, no Vue deps
│   │   ├── cdp/
│   │   │   ├── client.ts                 # CDP WebSocket client class
│   │   │   ├── domains/
│   │   │   │   ├── indexeddb.ts          # CDP IndexedDB domain wrappers
│   │   │   │   ├── network.ts            # CDP Network domain wrappers
│   │   │   │   ├── runtime.ts            # CDP Runtime domain wrappers
│   │   │   │   ├── storage.ts            # CDP Storage domain wrappers
│   │   │   │   └── log.ts                # CDP Log domain wrappers
│   │   │   └── types.ts                  # CDP protocol TypeScript types
│   │   │
│   │   ├── adb/
│   │   │   ├── commands.ts               # All adb command builders
│   │   │   ├── parser.ts                 # Parse adb output (devices, packages)
│   │   │   └── types.ts
│   │   │
│   │   ├── storage/
│   │   │   ├── idb-utils.ts              # IDB data normalization
│   │   │   ├── sqlite-extractor.ts       # jeep-sqlite blob → SQL tables
│   │   │   ├── diff.ts                   # Snapshot diff algorithm
│   │   │   └── schema-inferrer.ts        # Infer schema from IDB records
│   │   │
│   │   └── utils/
│   │       ├── format.ts                 # Bytes, timestamps, truncation
│   │       ├── json.ts                   # Safe parse/stringify helpers
│   │       └── debounce.ts
│   │
│   └── types/                    # Global TypeScript types
│       ├── adb.types.ts
│       ├── cdp.types.ts
│       ├── storage.types.ts
│       ├── network.types.ts
│       └── ipc.types.ts
│
├── src-tauri/                    # Rust/Tauri backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json          # Tauri 2 capabilities
│   └── src/
│       ├── main.rs
│       ├── lib.rs                # App setup, plugin registration
│       └── commands/
│           ├── mod.rs
│           ├── adb.rs            # ADB subprocess commands
│           ├── port_forward.rs   # ADB port forwarding for CDP
│           └── fs.rs             # File export/import helpers
│
├── tests/
│   ├── unit/                     # Vitest unit tests
│   └── e2e/                      # Playwright tests
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
│
├── package.json
├── vite.config.ts
├── tsconfig.json
├── uno.config.ts
├── eslint.config.js
└── README.md
```

---

## 4. Architecture

### Data flow overview

```
Physical Android Device (USB)
    ↕ ADB USB transport
ADB daemon (adb server on host machine, port 5037)
    ↕ adb forward tcp:9222 localabstract:chrome_devtools_remote
localhost:9222  ← Chrome DevTools HTTP endpoint
    ↕ WebSocket (CDP protocol)
DevBridge Frontend (Vue)
    ↕ Tauri IPC (invoke/events)
DevBridge Backend (Rust)
    ↕ tauri-plugin-shell → child process
adb binary (for device commands, logcat, file ops)
```

### Key architectural decisions

**CDP runs in JS, not Rust.** The CDP WebSocket connects from the Vue frontend directly to `localhost:9222`. No proxying through Rust. This means: lower latency, simpler code, native browser `WebSocket` API, and easy access to Chrome's JSON endpoint via `fetch`. Rust is only needed for things the browser can't do: spawning `adb` as a subprocess and streaming its stdout.

**One CDP client per target.** Each selected debug target (local tab or Android device page) gets its own `CDPClient` instance. Connection state lives in Pinia. Switching targets = switching which client instance receives commands.

**ADB port forwarding is automatic.** When user selects an Android device target, the app automatically runs `adb forward tcp:9222 localabstract:chrome_devtools_remote` via Tauri shell plugin. The frontend then polls `localhost:9222/json` as if it were a local target.

**Storage data is never cached in Rust.** All IDB/LS/Cache data flows through CDP WebSocket → Vue. Pinia caches it with TTLs. Rust has no knowledge of storage contents.

---

## 5. Module Specs

### 5.1 Device Manager

**Purpose:** Full ADB GUI. Replaces need for Android Studio just for device management.

#### 5.1.1 Device list

- Poll `adb devices -l` every 3 seconds via Tauri IPC
- Show: serial, model name, Android version, battery %, connection type (USB / WiFi), status (online/offline/unauthorized)
- Click to select → becomes active device for all other panels
- Right-click context menu: copy serial, open properties, disconnect WiFi device

#### 5.1.2 Logcat viewer

- Stream `adb logcat` via Tauri shell plugin `stdout` events → Pinia → xterm.js
- Toolbar controls:
  - Filter by log level (V/D/I/W/E/F)
  - Filter by tag (text input, supports regex)
  - Filter by PID/process name
  - Search (highlight matching lines)
  - Clear button
  - Pause/resume toggle
  - Export to `.txt` file
- Color coding per level (verbose=gray, debug=white, info=green, warn=yellow, error=red, fatal=magenta)
- Auto-scroll with "scroll lock" toggle (stop auto-scroll when user scrolls up)
- Line count display in status bar

#### 5.1.3 App manager

- List all installed packages: `adb shell pm list packages -f -3` (3rd party only) + `adb shell dumpsys package <pkg>`
- Display: package name, version, install date, APK path, size
- Actions per app: force stop, clear data + cache, uninstall, pull APK to host, open in storage inspector
- Filter by name, sort by install date / name / size
- "Open in Storage Inspector" → auto-connects CDP to that app's WebView

#### 5.1.4 File explorer

- Browse device filesystem via `adb shell ls -la`
- Pull files: `adb pull <device_path> <local_path>`
- Push files: drag-and-drop onto panel → `adb push`
- Delete: `adb shell rm`
- Create directory: `adb shell mkdir`
- Show file size, permissions, modified date
- Quick shortcuts to common paths: `/sdcard/`, `/data/data/<package>/`, `/data/local/tmp/`

#### 5.1.5 Screen capture

- Screenshot: `adb exec-out screencap -p` → display inline + save button
- Screen record: `adb shell screenrecord /sdcard/record.mp4` → stop button → `adb pull`
- Mirror preview (future): via scrcpy subprocess

#### 5.1.6 Device info

- One-click dashboard panel showing:
  - Model, manufacturer, Android version, API level
  - Screen resolution + DPI
  - CPU architecture
  - Available RAM / storage
  - Battery level + charging status
  - Network interfaces + IP addresses
- All via `adb shell getprop` + `adb shell dumpsys`

#### 5.1.7 Wireless debugging

- Step-by-step wizard UI for ADB over TCP/IP:
  1. Confirm device is connected via USB
  2. Run `adb tcpip 5555`
  3. Get device IP from `adb shell ip route`
  4. Run `adb connect <ip>:5555`
  5. Confirm USB can be unplugged
- Saved WiFi device IPs persist in app store for quick reconnect

---

### 5.2 Storage Inspector

**This is the core module. The deepest feature investment goes here.**

#### 5.2.1 Storage sidebar tree

Left panel showing all storage for the active CDP target:

```
📦 my-app.com
  ├── 🗄 IndexedDB
  │   ├── appDatabase (v3)
  │   │   ├── users (142 records)
  │   │   ├── syncQueue (12 records)
  │   │   └── settings (1 record)
  │   └── jeep-sqlite  ← Capacitor SQLite
  │       └── mydb.db  (show SQL tables inside)
  ├── 📝 LocalStorage (18 keys)
  ├── 📋 SessionStorage (4 keys)
  ├── 🌐 Cache API
  │   ├── v1-static (34 entries)
  │   └── v1-api (12 entries)
  ├── 📁 OPFS
  │   └── /mydb.sqlite
  └── 📊 Quota: 14.2 MB / 2.4 GB (persistent ✓)
```

Click any node → loads that store's data in the main content area.

#### 5.2.2 IDB table view

Powered by TanStack Table v8.

- Virtual rows — handle 100k+ records without DOM blowup
- Columns auto-generated from record structure (schema inference)
- Column features: sortable, resizable, hideable, reorderable via drag
- Inline cell editing: double-click → opens inline editor (plain value or JSON editor for objects)
- Multi-select rows (checkbox): bulk delete
- Toolbar:
  - **Search**: text search across all fields (debounced, uses `Runtime.evaluate` cursor scan)
  - **Filter**: per-field filter conditions (`=`, `!=`, `contains`, `>`, `<`, key range)
  - **Refresh**: re-fetch from CDP, show last-updated timestamp
  - **Auto-refresh**: toggle with interval picker (1s / 5s / 10s / 30s)
  - **Add record**: opens JSON editor modal → writes via `Runtime.evaluate`
  - **Export**: JSON or CSV, current view or full store
  - **Import**: paste JSON array or upload file → bulk insert
  - **Snapshot**: save current state as a named seed
- Pagination: configurable page size (50 / 100 / 500) using CDP cursor-based pagination
- Record count and store size shown in toolbar

#### 5.2.3 IDB query console

Monaco editor panel (below or beside table, resizable).

- Write arbitrary JS that runs via `Runtime.evaluate` in the page context
- Has access to everything `window` has access to: IDB, Capacitor plugins, etc.
- Saved queries: name and save any query, loads from app store
- Query history (last 50 queries)
- Result rendered as JSON tree or table depending on return value type
- Keyboard shortcut: `Ctrl/Cmd + Enter` to run

Example queries available as snippets:

```js
// Get all records from a store
const db = await idb.openDB("appDatabase");
return await db.getAll("users");

// Count records matching condition
const all = await db.getAll("syncQueue");
return all.filter((r) => r.status === "pending").length;

// Get Capacitor Preferences
return await Preferences.getAll();
```

#### 5.2.4 Schema view

Automatically inferred from scanning up to 1000 records:

- Field name, inferred type, nullability, sample values
- Index list (from CDP `IndexedDB.requestDatabase`)
- Key path info
- Version history annotations (user-editable, stored in app store)

#### 5.2.5 Snapshot / diff

- **Take snapshot**: stores full copy of a DB/store JSON in app store with timestamp + label
- **Diff view**: select any two snapshots (or live vs snapshot) → visual diff:
  - Added records (green)
  - Deleted records (red)
  - Modified records (amber, with field-level diff inside)
- Useful for: debugging "what did this action write", verifying sync operations

#### 5.2.6 Seed profiles

- Save a named set of IDB data: "empty state", "logged-in user", "500 synced records", "error state"
- Restore: clears the target stores and re-inserts seed data via `Runtime.evaluate`
- Export seed to JSON file (for sharing with team)
- Import seed from JSON file

#### 5.2.7 Capacitor SQLite bridge

- Detect databases stored via `@capacitor-community/sqlite` (jeep-sqlite pattern — IDB stores with blob value)
- Extract the SQLite binary from the IDB blob
- Parse SQL tables using `sql.js` (WASM SQLite in the browser)
- Show SQL tables as regular table views using TanStack Table
- Allow SQL queries against the extracted database

#### 5.2.8 LocalStorage / SessionStorage

- Simple key-value table
- Inline edit values (strings)
- Add/delete keys
- JSON auto-detection: if value is valid JSON, show expand icon → renders as JSON tree

#### 5.2.9 Cache API explorer

- List all named caches
- Per cache: list all cached requests (URL, method, status, size, date)
- Click entry: show full request headers, response headers, response body preview
- Delete individual entries or full cache
- Size breakdown per cache

#### 5.2.10 OPFS explorer

- Tree view of Origin Private File System
- Click file → preview (text files, JSON, binary hex)
- Download file to host via Tauri fs plugin
- Delete files/directories
- Show file size, type

#### 5.2.11 Storage quota

Always-visible at bottom of storage sidebar:

- Bar chart: used / quota, broken down by type (IDB, Cache, OPFS)
- Persistence status badge: `persistent` (green) or `best-effort` (yellow, with warning tooltip)
- "Request persistence" button → calls `navigator.storage.persist()` via `Runtime.evaluate`
- Data from `navigator.storage.estimate()` polled every 30s

---

### 5.3 Network Inspector

#### 5.3.1 Request table

TanStack Table. Columns: method, URL, status, type, initiator, size, time, waterfall.

- Live capture via CDP `Network` domain events (enabled on connection)
- Filter by: method, status code range, URL contains, resource type (XHR/fetch/WS/doc/script)
- Clear, pause/resume capture
- URL search with regex support
- Export as HAR file

#### 5.3.2 Request detail panel

Click any request → right panel opens:

- Tabs: Headers / Payload / Response / Timing
- Headers: request + response headers, formatted
- Payload: formatted JSON body or form data
- Response: rendered as JSON tree or raw text, image preview for image types
- Timing: DNS, connect, send, wait, receive breakdown as visual bar

#### 5.3.3 WebSocket frame inspector

- Separate tab in network panel
- List all open WS connections
- Per connection: frame list with direction (↑↓), timestamp, size, payload
- Auto-parse JSON frames, render as JSON tree
- Essential for debugging Capacitor sync protocols (PowerSync, etc.)

#### 5.3.4 Network conditions

- Throttle presets: No throttling / Fast 3G / Slow 3G / Offline
- Custom: set download kbps, upload kbps, latency ms
- Via `Network.emulateNetworkConditions`
- Offline toggle: quick button in panel header

#### 5.3.5 Request mocking

- Intercept responses via `Fetch.enable` + `Fetch.requestPaused` events
- Rules: match URL pattern → respond with custom status/headers/body
- Enable/disable per rule
- Useful for testing error states without modifying app code

---

### 5.4 Console & Runtime

#### 5.4.1 Console log

- CDP `Runtime.consoleAPICalled` + `Log.entryAdded` events
- Display: timestamp, level icon, message, source file + line
- Collapsible object/array values (JSON tree)
- Filter by level, search by text
- Clear button, preserve log option (don't clear on navigation)
- `console.error` and uncaught exceptions highlighted with red background

#### 5.4.2 JS REPL

- Monaco editor input at bottom of console panel
- `Ctrl/Cmd + Enter` to evaluate via `Runtime.evaluate`
- Expression mode (return value shown) vs statement mode
- `await` support (`awaitPromise: true` in CDP)
- Result rendered inline below input as JSON tree
- History: arrow keys navigate previous commands
- Autocomplete via `Runtime.getProperties` (basic scope completion)

#### 5.4.3 Exception tracker

- Dedicated sub-tab listing all uncaught exceptions and unhandled promise rejections
- Stack trace with source mapping if source maps available
- Click stack frame → opens source in a read-only Monaco view

---

### 5.5 Hybrid App Tools

Capacitor/Ionic-specific intelligence. Applies on top of storage and console panels.

#### 5.5.1 Plugin storage mapper

Auto-detect and label known Capacitor plugin storage patterns:

- `@capacitor/preferences` → show as clean key-value panel (not raw IDB)
- `@capacitor/filesystem` → cross-reference with OPFS explorer
- `capacitor-secure-storage-plugin` → show keys (values are encrypted, shown as `[encrypted]`)
- Community plugins: map by known IDB database names
- User-definable plugin mappings (stored in app store)

#### 5.5.2 Sync queue inspector

For apps using offline-first sync (PowerSync, RxDB, WatermelonDB, ElectricSQL, custom):

- Auto-detect common sync queue patterns in IDB (known table name prefixes)
- Show: pending operations count, operation type (insert/update/delete), table/entity, created at, retry count
- Filter by status: pending / in-flight / failed
- Clear failed items button
- Manual trigger sync button (calls app-defined sync function via REPL)

#### 5.5.3 Migration tracker

- Read IDB database version from CDP
- Let user annotate version numbers with migration notes (stored in app store, per app origin)
- Show version history timeline
- "Version mismatch" warning if detected DB version doesn't match latest in annotations
- Useful when onboarding a device mid-development (version not what you expect)

#### 5.5.4 Persistence checker

- Show `navigator.storage.persisted()` result for the active target
- Explain the risk: non-persistent storage can be evicted by the OS on Android (low storage pressure)
- One-click: call `navigator.storage.persist()` and show result
- Badge in status bar always shows current state

---

## 6. Data Models & Types

```typescript
// src/types/adb.types.ts

export interface ADBDevice {
  serial: string;
  model: string;
  product: string;
  transportId: string;
  connectionType: "usb" | "wifi";
  status: "online" | "offline" | "unauthorized" | "no-permissions";
  androidVersion?: string;
  apiLevel?: number;
  battery?: number;
}

export interface ADBPackage {
  packageName: string;
  versionName: string;
  versionCode: number;
  apkPath: string;
  installTime: Date;
  dataDir: string;
  sizeBytes?: number;
}

export interface LogcatEntry {
  id: string; // generated uuid
  timestamp: Date;
  pid: number;
  tid: number;
  level: "V" | "D" | "I" | "W" | "E" | "F";
  tag: string;
  message: string;
}

// src/types/cdp.types.ts

export interface CDPTarget {
  id: string;
  type: "page" | "background_page" | "worker" | "iframe";
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
  deviceSerial?: string; // set when target is on a remote device
  faviconUrl?: string;
}

export interface CDPConnection {
  targetId: string;
  ws: WebSocket;
  sessionId?: string;
  status: "connecting" | "connected" | "disconnected" | "error";
}

// src/types/storage.types.ts

export interface IDBDatabaseInfo {
  name: string;
  version: number;
  objectStoreNames: string[];
  origin: string;
}

export interface IDBObjectStoreInfo {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: IDBIndexInfo[];
  recordCount?: number;
  estimatedSizeBytes?: number;
}

export interface IDBIndexInfo {
  name: string;
  keyPath: string | string[];
  unique: boolean;
  multiEntry: boolean;
}

export interface IDBRecord {
  key: IDBValidKey;
  value: unknown;
}

export interface StorageSnapshot {
  id: string;
  label: string;
  createdAt: Date;
  targetOrigin: string;
  dbName: string;
  storeName: string;
  records: IDBRecord[];
}

export interface SeedProfile {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  targetOrigin: string;
  stores: {
    dbName: string;
    storeName: string;
    records: IDBRecord[];
  }[];
}

export interface StorageQuota {
  usage: number;
  quota: number;
  usageDetails: {
    indexedDB?: number;
    caches?: number;
    fileSystem?: number;
  };
  persisted: boolean;
}

// src/types/network.types.ts

export interface NetworkRequest {
  requestId: string;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  resourceType: string;
  requestHeaders: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  mimeType?: string;
  encodedDataLength?: number;
  timing?: NetworkTiming;
  timestamp: number;
  wallTime: number;
  initiator: {
    type: string;
    url?: string;
    lineNumber?: number;
  };
  isWebSocket?: boolean;
  wsFrames?: WSFrame[];
}

export interface WSFrame {
  requestId: string;
  timestamp: number;
  direction: "send" | "receive";
  opcode: number;
  mask: boolean;
  payloadData: string;
  payloadLength: number;
}

export interface NetworkTiming {
  dnsStart: number;
  dnsEnd: number;
  connectStart: number;
  connectEnd: number;
  sendStart: number;
  sendEnd: number;
  receiveHeadersEnd: number;
  resourceSendTime: number;
}
```

---

## 7. State Management

### Pinia store structure

```typescript
// stores/devices.store.ts
export const useDevicesStore = defineStore("devices", () => {
  const devices = ref<ADBDevice[]>([]);
  const selectedDevice = ref<ADBDevice | null>(null);
  const isPolling = ref(false);

  async function refreshDevices() {
    /* adb devices -l */
  }
  function startPolling(intervalMs = 3000) {
    /* ... */
  }
  function stopPolling() {
    /* ... */
  }
  function selectDevice(device: ADBDevice) {
    /* ... */
  }

  return { devices, selectedDevice, isPolling, refreshDevices, startPolling, selectDevice };
});

// stores/targets.store.ts
export const useTargetsStore = defineStore("targets", () => {
  const targets = ref<CDPTarget[]>([]);
  const selectedTarget = ref<CDPTarget | null>(null);

  async function fetchTargets(port = 9222) {
    /* GET localhost:9222/json */
  }
  function selectTarget(target: CDPTarget) {
    /* ... */
  }

  return { targets, selectedTarget, fetchTargets };
});

// stores/connection.store.ts
export const useConnectionStore = defineStore("connection", () => {
  const connections = ref<Map<string, CDPConnection>>(new Map());

  async function connect(target: CDPTarget): Promise<CDPConnection> {
    /* ... */
  }
  function disconnect(targetId: string) {
    /* ... */
  }
  function getConnection(targetId: string) {
    /* ... */
  }

  return { connections, connect, disconnect, getConnection };
});
```

### TanStack Query usage

TanStack Query (Vue Query) is used for data that has a natural stale/refresh lifecycle:

```typescript
// In IDBExplorer.vue
const {
  data: records,
  isLoading,
  refetch,
} = useQuery({
  queryKey: ["idb", targetId, dbName, storeName, page, pageSize],
  queryFn: () =>
    idbDomain.requestData({ targetId, dbName, storeName, skipCount: page * pageSize, pageSize }),
  staleTime: autoRefreshEnabled ? refreshIntervalMs : Infinity,
  refetchInterval: autoRefreshEnabled ? refreshIntervalMs : false,
});
```

---

## 8. IPC Contract (Rust ↔ Vue)

All Tauri commands are defined in `src-tauri/src/commands/`. Frontend calls via `invoke()`.

```typescript
// src/types/ipc.types.ts — mirrors Rust command signatures

// ADB commands
invoke('adb_list_devices'): Promise<ADBDevice[]>
invoke('adb_get_device_info', { serial: string }): Promise<DeviceInfo>
invoke('adb_list_packages', { serial: string }): Promise<ADBPackage[]>
invoke('adb_force_stop', { serial: string, packageName: string }): Promise<void>
invoke('adb_clear_data', { serial: string, packageName: string }): Promise<void>
invoke('adb_uninstall', { serial: string, packageName: string }): Promise<void>
invoke('adb_pull_apk', { serial: string, apkPath: string, destPath: string }): Promise<void>
invoke('adb_list_files', { serial: string, path: string }): Promise<FileEntry[]>
invoke('adb_pull_file', { serial: string, devicePath: string, hostPath: string }): Promise<void>
invoke('adb_push_file', { serial: string, hostPath: string, devicePath: string }): Promise<void>
invoke('adb_screenshot', { serial: string }): Promise<Uint8Array>  // PNG bytes
invoke('adb_start_recording', { serial: string }): Promise<void>
invoke('adb_stop_recording', { serial: string, destPath: string }): Promise<void>
invoke('adb_tcpip', { serial: string, port: number }): Promise<void>
invoke('adb_connect_wifi', { host: string, port: number }): Promise<void>
invoke('adb_disconnect_wifi', { host: string, port: number }): Promise<void>

// CDP port forwarding
invoke('adb_forward_cdp', { serial: string, localPort: number }): Promise<void>
invoke('adb_remove_forward', { serial: string, localPort: number }): Promise<void>

// Logcat streaming — uses Tauri events, not invoke
// Start: invoke('start_logcat', { serial: string, pid?: number }) → streams events
// Stop: invoke('stop_logcat', { serial: string })
// Event name: 'logcat-line' → payload: LogcatEntry

// File operations
invoke('save_export', { path: string, content: string }): Promise<void>
invoke('read_import', { path: string }): Promise<string>
```

### Logcat streaming pattern

```typescript
// useLogcat.ts
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export function useLogcat(serial: Ref<string>) {
  const entries = ref<LogcatEntry[]>([]);
  let unlisten: (() => void) | null = null;

  async function start() {
    unlisten = await listen<LogcatEntry>("logcat-line", (event) => {
      entries.value.push(event.payload);
      if (entries.value.length > 10_000) entries.value.shift(); // rolling buffer
    });
    await invoke("start_logcat", { serial: serial.value });
  }

  async function stop() {
    await invoke("stop_logcat", { serial: serial.value });
    unlisten?.();
  }

  return { entries, start, stop };
}
```

---

## 9. CDP Integration Layer

### Client class

```typescript
// src/lib/cdp/client.ts

export class CDPClient {
  private ws: WebSocket;
  private pendingCommands = new Map<number, { resolve: Function; reject: Function }>();
  private eventHandlers = new Map<string, Set<Function>>();
  private commandId = 1;

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
    this.ws.addEventListener("message", this.handleMessage.bind(this));
  }

  async send<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = this.commandId++;
    return new Promise((resolve, reject) => {
      this.pendingCommands.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(event: string, handler: Function): () => void {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, new Set());
    this.eventHandlers.get(event)!.add(handler);
    return () => this.eventHandlers.get(event)?.delete(handler);
  }

  private handleMessage(event: MessageEvent) {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      const pending = this.pendingCommands.get(msg.id);
      if (pending) {
        msg.error ? pending.reject(msg.error) : pending.resolve(msg.result);
        this.pendingCommands.delete(msg.id);
      }
    } else if (msg.method) {
      this.eventHandlers.get(msg.method)?.forEach((h) => h(msg.params));
    }
  }

  close() {
    this.ws.close();
  }
}
```

### Target discovery

```typescript
// src/lib/cdp/targets.ts

// For local Chrome / local WebViews
export async function fetchLocalTargets(port = 9222): Promise<CDPTarget[]> {
  const res = await fetch(`http://localhost:${port}/json`);
  return res.json();
}

// For remote Android device:
// 1. Run adb forward tcp:PORT localabstract:chrome_devtools_remote (via Tauri IPC)
// 2. Then fetchLocalTargets(PORT) works identically
// Each device gets its own forwarded port (9222 = device 1, 9223 = device 2, etc.)
export async function forwardAndFetchTargets(serial: string, port: number): Promise<CDPTarget[]> {
  await invoke("adb_forward_cdp", { serial, localPort: port });
  return fetchLocalTargets(port);
}
```

### IDB domain wrapper

```typescript
// src/lib/cdp/domains/indexeddb.ts

export class IDBDomain {
  constructor(private client: CDPClient) {}

  async enable() {
    return this.client.send("IndexedDB.enable");
  }

  async getDatabases(securityOrigin: string): Promise<IDBDatabaseInfo[]> {
    const { databaseNames } = await this.client.send<{ databaseNames: string[] }>(
      "IndexedDB.requestDatabaseNames",
      { securityOrigin },
    );
    return Promise.all(databaseNames.map((name) => this.getDatabase(securityOrigin, name)));
  }

  async getDatabase(securityOrigin: string, databaseName: string): Promise<IDBDatabaseInfo> {
    const { databaseWithObjectStores } = await this.client.send<any>("IndexedDB.requestDatabase", {
      securityOrigin,
      databaseName,
    });
    return databaseWithObjectStores;
  }

  async getData(params: {
    securityOrigin: string;
    databaseName: string;
    objectStoreName: string;
    indexName?: string;
    skipCount: number;
    pageSize: number;
    keyRange?: unknown;
  }): Promise<{ records: IDBRecord[]; hasMore: boolean }> {
    const result = await this.client.send<any>("IndexedDB.requestData", params);
    return {
      records: result.objectStoreDataEntries.map((e: any) => ({
        key: e.key.value,
        value: deserializeRemoteObject(e.value),
      })),
      hasMore: result.hasMore,
    };
  }

  async deleteRecord(
    securityOrigin: string,
    databaseName: string,
    objectStoreName: string,
    keyRange: unknown,
  ) {
    return this.client.send("IndexedDB.deleteObjectStoreEntries", {
      securityOrigin,
      databaseName,
      objectStoreName,
      keyRange,
    });
  }

  async clearStore(securityOrigin: string, databaseName: string, objectStoreName: string) {
    return this.client.send("IndexedDB.clearObjectStore", {
      securityOrigin,
      databaseName,
      objectStoreName,
    });
  }
}

// Write/update records goes through Runtime.evaluate:
// await client.send('Runtime.evaluate', {
//   expression: `
//     new Promise((resolve, reject) => {
//       const req = indexedDB.open('${dbName}');
//       req.onsuccess = () => {
//         const tx = req.result.transaction('${storeName}', 'readwrite');
//         const store = tx.objectStore('${storeName}');
//         const putReq = store.put(${JSON.stringify(record)});
//         putReq.onsuccess = () => resolve(putReq.result);
//         putReq.onerror = () => reject(putReq.error);
//       };
//     })
//   `,
//   awaitPromise: true,
//   returnByValue: true
// })
```

---

## 10. ADB Integration Layer

### Rust command: adb_list_devices

```rust
// src-tauri/src/commands/adb.rs

use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub async fn adb_list_devices(app: tauri::AppHandle) -> Result<Vec<AdbDevice>, String> {
    let output = app.shell()
        .command("adb")
        .args(["devices", "-l"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_devices(&stdout))
}

fn parse_devices(output: &str) -> Vec<AdbDevice> {
    output.lines()
        .skip(1) // skip "List of devices attached"
        .filter(|line| !line.trim().is_empty() && !line.starts_with("*"))
        .filter_map(|line| parse_device_line(line))
        .collect()
}
```

### Rust command: logcat streaming

```rust
#[tauri::command]
pub async fn start_logcat(
    app: tauri::AppHandle,
    serial: String,
    window: tauri::WebviewWindow,
) -> Result<(), String> {
    let (mut rx, _child) = app.shell()
        .command("adb")
        .args(["-s", &serial, "logcat", "-v", "threadtime"])
        .spawn()
        .map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    if let Some(entry) = parse_logcat_line(&line_str) {
                        let _ = window.emit("logcat-line", entry);
                    }
                }
                CommandEvent::Terminated(_) => break,
                _ => {}
            }
        }
    });

    Ok(())
}
```

---

## 11. UI System & Design Tokens

### Design principles

- **Dark-first.** Developer tool. Dark theme is default, light theme available.
- **Information dense.** Tables fill available space, minimal chrome.
- **Low distraction.** Muted colors for structure, accents only for status/actions.
- **Keyboard navigable.** Every primary action has a shortcut.

### Color tokens (CSS custom properties)

```css
/* src/assets/styles/tokens.css */
:root {
  /* Surfaces */
  --surface-base: #0f0f11;
  --surface-raised: #16161a;
  --surface-overlay: #1e1e24;
  --surface-sunken: #0a0a0c;

  /* Borders */
  --border-default: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.16);
  --border-focus: #4f8ef7;

  /* Text */
  --text-primary: #e8e8ea;
  --text-secondary: #8b8b94;
  --text-tertiary: #55555e;
  --text-link: #4f8ef7;

  /* Status */
  --status-success: #3dd68c;
  --status-warning: #f0a030;
  --status-error: #f04040;
  --status-info: #4f8ef7;

  /* Log levels */
  --log-verbose: #55555e;
  --log-debug: #8b8b94;
  --log-info: #3dd68c;
  --log-warn: #f0a030;
  --log-error: #f04040;
  --log-fatal: #c030f0;

  /* Accents */
  --accent-primary: #4f8ef7;
  --accent-secondary: #9f7cf7;

  /* Sizing */
  --sidebar-width: 220px;
  --storage-sidebar-width: 260px;
  --panel-header-height: 40px;
  --status-bar-height: 24px;
  --toolbar-height: 40px;
}
```

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ AppShell                                                             │
│ ┌──────┐ ┌──────────────────────────────────────────────────────┐   │
│ │      │ │ PanelHeader (target selector + panel controls)       │   │
│ │      │ ├──────────────────────────────────────────────────────┤   │
│ │ Nav  │ │                                                      │   │
│ │ Side │ │          Active Panel Content                        │   │
│ │ bar  │ │                                                      │   │
│ │      │ │                                                      │   │
│ │      │ │                                                      │   │
│ │      │ │                                                      │   │
│ └──────┘ └──────────────────────────────────────────────────────┘   │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ StatusBar: connected device | target | storage persist | CDP   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

Nav sidebar icons (left, 52px wide): Devices, Storage, Network, Console, Hybrid Tools, Settings

### Keyboard shortcuts

| Shortcut               | Action                           |
| ---------------------- | -------------------------------- |
| `Cmd/Ctrl + 1-5`       | Switch to panel 1-5              |
| `Cmd/Ctrl + R`         | Refresh active panel data        |
| `Cmd/Ctrl + Enter`     | Run query in active console      |
| `Cmd/Ctrl + S`         | Save current snapshot            |
| `Cmd/Ctrl + F`         | Focus search in active panel     |
| `Cmd/Ctrl + Shift + C` | Clear active log/network/console |
| `Cmd/Ctrl + ,`         | Open settings                    |
| `F5`                   | Reconnect to selected target     |

---

## 12. Routing

```typescript
// src/router/index.ts

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/devices" },
  { path: "/devices", component: () => import("@/modules/devices/DevicesPanel.vue") },
  {
    path: "/storage",
    component: () => import("@/modules/storage/StoragePanel.vue"),
    children: [
      { path: "", redirect: "idb" },
      { path: "idb/:db?/:store?", component: IDBExplorer },
      { path: "localstorage", component: LSExplorer },
      { path: "cache", component: CacheExplorer },
      { path: "opfs", component: OPFSExplorer },
    ],
  },
  { path: "/network", component: () => import("@/modules/network/NetworkPanel.vue") },
  { path: "/console", component: () => import("@/modules/console/ConsolePanel.vue") },
  { path: "/hybrid", component: () => import("@/modules/hybrid/HybridPanel.vue") },
  { path: "/settings", component: () => import("@/modules/settings/SettingsPanel.vue") },
];
```

---

## 13. Testing Strategy

### Unit tests (Vitest)

- All `src/lib/` functions — CDP client, ADB parsers, schema inferrer, diff algorithm, format utils
- Pinia stores — test actions/mutations with mocked IPC
- Composables — `useLogcat`, `useCDP`, `useIDB` with mocked WebSocket

### Component tests (Vitest + Vue Test Utils)

- TanStack Table configurations (sorting, filtering, virtual scroll)
- JSON tree renderer
- Query console Monaco integration

### E2E tests (Playwright via tauri-driver)

- Device connection flow
- IDB data load and display
- Create/edit/delete record
- Export to JSON
- Snapshot and restore flow

### Manual test checklist (per release)

- [ ] USB device detected and shown
- [ ] CDP connects to Android WebView
- [ ] IDB loads and paginates correctly
- [ ] Inline edit persists to device
- [ ] Logcat streams and filters correctly
- [ ] Wireless ADB pairing wizard works
- [ ] Snapshot diff produces correct output
- [ ] Seed restore clears and re-inserts correctly
- [ ] Export/import JSON round-trip

---

## 14. Build & Release

### Dev

```bash
pnpm tauri dev         # Hot reload, Vite + Tauri
```

### Build

```bash
pnpm tauri build       # Produces platform installer in src-tauri/target/release/bundle/
```

### Platform targets

| OS      | Installer format     |
| ------- | -------------------- |
| macOS   | `.dmg` + `.app`      |
| Windows | `.msi` + NSIS `.exe` |
| Linux   | `.AppImage` + `.deb` |

### CI (GitHub Actions)

- `ci.yml` — lint, type-check, unit tests on every PR
- `release.yml` — triggered by `v*` tag, builds all 3 platforms via matrix, uploads to GitHub Releases

### App signing

- macOS: Apple Developer certificate (code sign + notarize via `tauri-action`)
- Windows: Authenticode certificate (optional for internal tool, required for public release)

---

## 15. Phase Roadmap

### Phase 1 — Foundation (weeks 1–3)

**Goal:** Skeleton app that connects to a device and shows IDB data.

- [ ] Tauri 2 project init with Vue 3 + TS + Vite + UnoCSS
- [ ] AppShell layout (sidebar, panel area, status bar)
- [ ] Pinia stores: devices, targets, connection
- [ ] Tauri IPC: `adb_list_devices`, `adb_forward_cdp`
- [ ] CDP client (`CDPClient` class)
- [ ] Target picker UI (local + remote targets)
- [ ] IDB panel: load databases, stores, records (read-only, paginated)
- [ ] TanStack Table integration for IDB records
- [ ] Basic device list panel (name, status, select)

**Done when:** Can plug in an Android device, select it, select a Capacitor app, and browse its IDB data.

### Phase 2 — Storage depth (weeks 4–6)

- [ ] IDB inline edit (CDP `Runtime.evaluate` write)
- [ ] IDB create record (JSON editor modal)
- [ ] IDB delete single + bulk
- [ ] IDB search and filter
- [ ] IDB query console (Monaco + Runtime.evaluate)
- [ ] LocalStorage + SessionStorage panel
- [ ] Storage quota gauge + persistence checker
- [ ] Snapshot + diff
- [ ] Seed profile save/restore
- [ ] Export JSON/CSV

**Done when:** Storage panel is feature-complete and usable as primary IDB tool.

### Phase 3 — Device tools (weeks 7–9)

- [ ] Logcat viewer (streaming, filter, search, export)
- [ ] App manager (list, force stop, clear data, pull APK)
- [ ] Device info dashboard
- [ ] File explorer (browse, pull, push)
- [ ] Wireless ADB wizard
- [ ] Screenshot capture

**Done when:** ADB panel replaces need for Android Studio for day-to-day device tasks.

### Phase 4 — Network + Console (weeks 10–11)

- [ ] Network request capture table
- [ ] Request detail panel (headers/payload/response/timing)
- [ ] WebSocket frame inspector
- [ ] Network throttling / offline toggle
- [ ] Console panel (log display + REPL)
- [ ] Exception tracker

### Phase 5 — Hybrid intelligence (weeks 12–13)

- [ ] Capacitor plugin storage mapper
- [ ] Capacitor SQLite bridge (jeep-sqlite → sql.js)
- [ ] OPFS explorer
- [ ] Sync queue inspector
- [ ] Migration tracker
- [ ] Request mocking

### Phase 6 — Polish (ongoing)

- [ ] Light theme
- [ ] Multi-target split view
- [ ] Screen recording
- [ ] Full keyboard navigation
- [ ] E2E test suite
- [ ] Auto-update (tauri-plugin-updater)
- [ ] Onboarding flow for first launch
- [ ] Team settings export/import (shared seed profiles, saved queries)

---

## Appendix A — Key dependencies (package.json)

```json
{
  "dependencies": {
    "vue": "^3.4",
    "vue-router": "^4.3",
    "pinia": "^2.2",
    "@tanstack/vue-table": "^8.20",
    "@tanstack/vue-query": "^5.50",
    "xterm": "^5.3",
    "xterm-addon-fit": "^0.8",
    "monaco-editor": "^0.50",
    "@vueuse/core": "^10.11",
    "lucide-vue-next": "^0.400",
    "radix-vue": "^1.9",
    "vue-virtual-scroller": "^2.0",
    "sql.js": "^1.12",
    "chart.js": "^4.4",
    "date-fns": "^3.6"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0",
    "@tauri-apps/api": "^2.0",
    "vite": "^5.3",
    "vitest": "^2.0",
    "playwright": "^1.45",
    "unocss": "^0.61",
    "typescript": "^5.5",
    "@antfu/eslint-config": "^2.23",
    "vue-tsc": "^2.0"
  }
}
```

## Appendix B — Cargo.toml dependencies

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-fs = "2"
tauri-plugin-store = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
```

## Appendix C — Claude Code instructions

When using Claude Code to implement features, provide this context:

1. **Always read `SPEC.md` first** before implementing any feature
2. **TypeScript strict mode** — no `any` except in CDP deserialization layer
3. **Composition API only** — no Options API, no class components
4. **`<script setup>` always** — no `defineComponent` wrapper
5. **Named exports for composables** — `export function useXxx()`
6. **Pinia stores as composable functions** — use the setup store syntax
7. **CDP writes always go through `Runtime.evaluate`** — never fake local mutations
8. **IPC errors must bubble to UI** — every `invoke()` call has error handling
9. **No hardcoded port 9222** — always configurable, default in settings store
10. **Virtual scrolling for any list > 50 items** — use Vue Virtual Scroller or TanStack virtual
