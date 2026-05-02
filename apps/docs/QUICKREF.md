# Capubridge Quick Reference

## Repo shape

```text
capubridge/
├── apps/
│   ├── desktop/
│   │   ├── src/
│   │   └── src-tauri/
│   └── website/
├── packages/
│   └── utils/
└── docs/
```

## Commands

All tooling go through `vp`.

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

- no `pnpm`, `npm`, `vitest`, `vue-tsc`, `eslint` direct
- `vp check` = fmt + lint + typecheck
- `vp test` = tests
- if custom script name collide with built-in, use `vp run <script>`

ADB bundle helper:

- `apps/desktop/package.json` has `bundle:adb`
- script downloads Google platform-tools into `apps/desktop/src-tauri/resources/adb`
- runtime prefer `CAPUBRIDGE_ADB_PATH`, then bundled adb, then PATH

## Runtime model

Capubridge now use session runtime.

- Rust own device/session/runtime state
- Vue/Pinia render snapshots, send intents
- one device session can be `hot`
- other known devices stay `warm` or `cold`
- targets = cached snapshot + manual refresh
- packages = cached snapshot + manual refresh
- logcat/perf/mirror/console = explicit leases

Core rule:

- no watcher-driven transport orchestration

## Main frontend files

| File                                                    | Job                                      |
| ------------------------------------------------------- | ---------------------------------------- |
| `apps/desktop/src/stores/session.store.ts`              | registry snapshot + active device        |
| `apps/desktop/src/stores/devices.store.ts`              | device UI intent layer                   |
| `apps/desktop/src/stores/targets.store.ts`              | target snapshots + selected target       |
| `apps/desktop/src/stores/source.store.ts`               | derived adb source + local chrome source |
| `apps/desktop/src/stores/connection.store.ts`           | CDP websocket/proxy ownership            |
| `apps/desktop/src/stores/logcat.store.ts`               | logcat lease state + entries             |
| `apps/desktop/src/stores/console.store.ts`              | console target attach state              |
| `apps/desktop/src/modules/mirror/useMirrorStream.ts`    | mirror lease wrapper                     |
| `apps/desktop/src/composables/useAppPackages.ts`        | package snapshot cache + refresh         |
| `apps/desktop/src/composables/useSessionPersistence.ts` | visual persistence only                  |
| `apps/desktop/src/runtime/session.ts`                   | typed session command/event bridge       |
| `apps/desktop/src/runtime/effect/tauri.ts`              | Effect wrappers for invoke/listen        |

## Main Rust files

| File                                                   | Job                       |
| ------------------------------------------------------ | ------------------------- |
| `apps/desktop/src-tauri/src/session/registry.rs`       | global session registry   |
| `apps/desktop/src-tauri/src/session/device_tracker.rs` | device presence tracking  |
| `apps/desktop/src-tauri/src/session/device_session.rs` | per-device worker/cache   |
| `apps/desktop/src-tauri/src/session/job_queue.rs`      | serialized control queue  |
| `apps/desktop/src-tauri/src/session/live_features.rs`  | live leases               |
| `apps/desktop/src-tauri/src/session/cache_store.rs`    | cache-only persistence    |
| `apps/desktop/src-tauri/src/session/events.rs`         | typed session events      |
| `apps/desktop/src-tauri/src/session/types.rs`          | session payload contracts |

## Device/session rules

- device presence come from Rust tracker, not frontend polling loop
- active device change go through `session_set_active_device`
- only hot device can start live leases
- stale snapshots visible, but marked stale
- package icon lookup must not trigger hidden package scan
- external DevTools must preserve `devtoolsFrontendUrl`

## Session commands

Registry/device:

- `session_get_registry_state`
- `session_list_devices`
- `session_refresh_devices`
- `session_set_active_device`
- `session_get_device_info`
- `session_shell_command`
- `session_tcpip`
- `session_root`
- `session_reboot`

Snapshots:

- `session_list_targets`
- `session_refresh_targets`
- `session_list_packages`
- `session_refresh_packages`
- `session_cancel_list_packages`
- `session_list_webview_sockets`
- `session_list_reverse`
- `session_reverse`
- `session_remove_reverse`

Leases:

- `session_start_logcat_lease`
- `session_stop_logcat_lease`
- `session_start_perf_lease`
- `session_stop_perf_lease`
- `session_start_mirror_lease`
- `session_stop_mirror_lease`
- `session_attach_console_target`
- `session_detach_console_target`

## Session events

Event name:

- `capubridge:session-event`

Payload types:

- `registryUpdated`
- `leaseStateChanged`
- `logcatEntry`
- `logcatError`
- `perfMetrics`
- `perfError`

## Effect boundary

Effect use only for runtime/control plane.

Use Effect for:

- Tauri invoke/listen wrappers
- cancellation/interruption normalization
- long-lived runtime coordination

Do not force Effect into:

- dumb presentational Vue components
- simple computed-only view logic

## Common flows

### Select device

1. UI call `devicesStore.selectDevice(device)`
2. store ask `sessionStore.setActiveDevice(serial)`
3. cached adb targets hydrate
4. source/target UI update from session state

### Refresh targets

1. UI send explicit refresh intent
2. Rust refresh target snapshot for selected serial
3. frontend replace target list for that source
4. optional persisted visual target reselect

### Start live feature

1. feature component request lease
2. Rust verify device is hot
3. runtime starts stream/session
4. typed events feed store
5. unmount/leave route stops lease

## Validation checklist

- device attach/remove update UI without repeated polling
- active device switch keep stale/fresh states sane
- startup restore reselect saved device without hidden fanout
- target refresh stays manual
- package refresh stays manual
- package/icon cache survive reload
- file manager `/storage/self` and `/storage/emulated` usable
- leaving logcat/perf/mirror/console tears lease down
- external DevTools open does not race normal reconnect path

## Sharp edges

- do not spawn fresh `adb.exe`; use shared adb server path
- do not hardcode transport behavior inside watchers
- do not claim runtime validation unless user/app confirmed it
- `git diff --check` clean still not equal runtime-safe
