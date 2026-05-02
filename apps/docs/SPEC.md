# Capubridge Specification

Capubridge desktop devtool for WebView-based Android app debugging.

- ADB device management
- remote WebView/CDP inspection
- storage exploration
- live runtime tools
- Hybrid app framework support (Capacitor, React Native, native Android, etc.)

This spec reflects current implemented architecture, not old prototype shape.

---

## 1. Product goal

Capubridge joins two worlds in one tool:

- **runtime world** (any WebView-based Android app)
  - CDP targets
  - IndexedDB
  - LocalStorage
  - Cache/OPFS/SQLite flows
  - console/runtime inspection
- **device world** (physical or emulated Android devices)
  - ADB devices
  - logcat
  - files
  - packages
  - mirror/perf

Works with any WebView-based app: Capacitor, React Native WebView, NativePHP, or custom Android apps with embedded Chrome tabs.

Main product value:

- one active device workflow
- explicit, stable runtime ownership
- low watcher fanout
- cached snapshots for non-live data
- leased runtime work for live data

---

## 2. Tech stack

### Monorepo

- root build system: Vite+ via `vp`
- apps:
  - `apps/desktop`
  - `apps/website`
- shared package:
  - `packages/utils`

### Desktop frontend

- Vue 3
- TypeScript strict
- Pinia setup stores
- TanStack Query
- Effect on runtime/control plane
- UnoCSS
- xterm.js
- Monaco

### Desktop backend

- Tauri 2
- Rust
- `adb_client`
- typed Tauri commands + typed Tauri events

---

## 3. Repo structure

```text
capubridge/
├── apps/
│   ├── desktop/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── composables/
│   │   │   ├── modules/
│   │   │   ├── runtime/
│   │   │   ├── stores/
│   │   │   └── types/
│   │   └── src-tauri/
│   │       └── src/
│   │           ├── commands/
│   │           └── session/
│   └── website/
├── packages/
│   └── utils/
└── docs/
```

Important frontend runtime files:

- `apps/desktop/src/stores/session.store.ts`
- `apps/desktop/src/stores/devices.store.ts`
- `apps/desktop/src/stores/source.store.ts`
- `apps/desktop/src/stores/targets.store.ts`
- `apps/desktop/src/stores/connection.store.ts`
- `apps/desktop/src/stores/logcat.store.ts`
- `apps/desktop/src/stores/console.store.ts`
- `apps/desktop/src/runtime/session.ts`
- `apps/desktop/src/runtime/effect/*`

Important Rust runtime files:

- `apps/desktop/src-tauri/src/session/registry.rs`
- `apps/desktop/src-tauri/src/session/device_tracker.rs`
- `apps/desktop/src-tauri/src/session/device_session.rs`
- `apps/desktop/src-tauri/src/session/job_queue.rs`
- `apps/desktop/src-tauri/src/session/live_features.rs`
- `apps/desktop/src-tauri/src/session/cache_store.rs`

---

## 4. Architecture

### 4.1 Source of truth

Rust own operational runtime state.

Vue own presentation state.

Rust responsibilities:

- device presence tracking
- per-device session lifecycle
- cache-only snapshot persistence
- target/package snapshot ownership
- live lease ownership
- typed session events

Vue responsibilities:

- render snapshots
- visual selection
- local UX persistence
- explicit user intents
- CDP connection UI state

### 4.2 Session model

Device sessions use temperature model:

- `hot`
  - active device
  - allowed to run live leases
- `warm`
  - known device
  - snapshot data can stay usable
- `cold`
  - stale/offline/restored snapshot
  - visible but not trusted as live

### 4.3 Runtime split

Two work classes exist:

- snapshot/control work
  - device refresh
  - package snapshot
  - target snapshot
  - shell/package/file intents
- live work
  - logcat
  - perf
  - mirror
  - console target attach

Rules:

- snapshot work serialized per device
- duplicate snapshot work coalesced
- stale results must not overwrite newer state
- live work use explicit leases
- leaving feature stops live work

### 4.4 Data flow

```text
Android device
  ↕ ADB daemon / WebView sockets
Rust session runtime
  ├─ device tracker
  ├─ registry
  ├─ per-device sessions
  ├─ cache store
  └─ typed session events
Tauri command/event bridge
Effect runtime wrappers
Pinia stores + Vue modules
```

### 4.5 Critical rules

- no watcher-driven transport orchestration
- no hidden target refresh from component mount chains
- no hidden package scan from icon resolution
- no always-live discovery loop for targets
- frontend must not invent device/session truth

---

## 5. Module behavior

### Device/session shell

- device presence come from Rust tracker
- active device set by explicit intent
- inactive devices may remain visible as stale

### Targets

- adb targets stored as Rust snapshots
- UI load path:
  - list cached snapshot
  - manual refresh when user asks
- persisted target restore is visual only
- external DevTools ownership blocks normal reconnect path

### Packages and icons

- package list is cached snapshot by serial + scope
- scopes:
  - `third-party`
  - `all`
- package refresh explicit
- icon resolution lazy
- icon metadata should use cached package snapshot, not trigger hidden refresh

### Files

- file browser uses explicit directory requests
- protected parent paths may expose virtual entries instead of failing hard
- current hardening includes usable parents for:
  - `/storage/self`
  - `/storage/emulated`

### Live features

- logcat lease bound to route/component scope
- perf lease bound to route/component scope
- mirror lease bound to route/component scope
- console attach bound to active hot device and target

---

## 6. State model

### Frontend stores

- `session.store`
  - registry snapshot
  - active serial
  - tracker status
- `devices.store`
  - device-facing intent layer
  - selected device UI helpers
- `source.store`
  - derived adb source
  - explicit local chrome source
- `targets.store`
  - target snapshots by source
  - selected target
- `connection.store`
  - CDP websocket/proxy ownership
  - external DevTools lock
- `logcat.store`
  - logcat lease state + entries
- `console.store`
  - console target attach state
- `mirror.store`
  - mirror view state

### Rust snapshots

- `SessionRegistrySnapshot`
- `SessionDeviceSnapshot`
- `SessionTargetSnapshot`
- `SessionLeaseState`

### Session events

- `registryUpdated`
- `leaseStateChanged`
- `logcatEntry`
- `logcatError`
- `perfMetrics`
- `perfError`

---

## 7. IPC contract

### Registry/device commands

- `session_get_registry_state`
- `session_list_devices`
- `session_refresh_devices`
- `session_set_active_device`
- `session_get_device_info`
- `session_shell_command`
- `session_tcpip`
- `session_root`
- `session_reboot`

### Snapshot commands

- `session_list_targets`
- `session_refresh_targets`
- `session_list_packages`
- `session_refresh_packages`
- `session_cancel_list_packages`
- `session_list_webview_sockets`
- `session_list_reverse`
- `session_reverse`
- `session_remove_reverse`
- `session_open_package`

### Lease commands

- `session_start_logcat_lease`
- `session_stop_logcat_lease`
- `session_start_perf_lease`
- `session_stop_perf_lease`
- `session_start_mirror_lease`
- `session_stop_mirror_lease`
- `session_attach_console_target`
- `session_detach_console_target`

### Event channel

- event name: `capubridge:session-event`

---

## 8. Effect boundary

Effect used for runtime/control plane only.

Use Effect for:

- typed invoke wrappers
- typed event listen wrappers
- interruption normalization
- command failure normalization

Current runtime files:

- `apps/desktop/src/runtime/effect/tauri.ts`
- `apps/desktop/src/runtime/effect/tags.ts`
- `apps/desktop/src/runtime/effect/cancellation.ts`
- `apps/desktop/src/runtime/session.ts`

Error classes in runtime:

- `TauriInvokeError`
- `TauriListenError`
- `SessionInterruptedError`
- `SessionCommandFailedError`

Rule:

- keep Effect inside runtime/service edge
- keep plain Vue state in stores/components where clearer

---

## 9. ADB and CDP integration

### ADB

ADB command ownership is Rust-side.

Rules:

- shared ADB server path
- no fresh `adb.exe` spawn pattern for normal device work
- per-device session owns serialized control work

### CDP

CDP transport still frontend-facing, but ownership coordinated through session/runtime rules.

Rules:

- target discovery for adb devices goes through session snapshot flow
- local Chrome source explicit
- external DevTools must preserve `devtoolsFrontendUrl`
- fallback synthetic targets without valid frontend metadata must not be opened as external DevTools

---

## 10. Verification strategy

### Core runtime checklist

- device attach/remove updates UI without repeated polling
- active device switch does not fan out hidden transport work
- stale device snapshots remain visible but marked stale
- startup restore reselects saved device cleanly
- target refresh remains manual
- package refresh remains manual
- package/icon cache survives reload
- file browser can traverse `/storage/self` and `/storage/emulated`
- leaving logcat/perf/mirror/console tears lease down
- disconnect during running work does not crash app
- external DevTools open does not fight normal reconnect path

### Validation rules

- prefer user/in-app validation for runtime claims
- static checks help but do not prove runtime safety
- do not mark transport/runtime behavior verified unless app behavior confirmed

---

## 11. Build and workflow

Use `vp`.

```bash
vp install
vp dev
vp run tauri
vp check
vp test
vp run -r build
vp run ready
```

Rules:

- no direct `pnpm`
- no direct `vue-tsc`
- no direct `eslint`
- no direct `vitest`

---

## 12. Current implementation status

Done:

- session contracts
- Rust registry + device tracker
- per-device session workers + queue
- cache-only persistence
- target snapshot migration
- package snapshot migration
- live leases
- watcher cleanup

Current documented hardening:

- startup/device-switch intent flow explicit
- package/icon cache persistence restored
- modal target rows prime package metadata
- file manager parent storage fallbacks added

Next focus after this phase:

- continue Rust command file splits
- expand automated verification where cheap
- keep runtime model stable while features grow
