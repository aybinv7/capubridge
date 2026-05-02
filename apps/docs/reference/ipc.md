# IPC Contract

All Tauri commands are defined in Rust with `#[tauri::command]` and typed in TypeScript.

## Registry/Device commands

| Command                      | Rust                                | TS                      |
| ---------------------------- | ----------------------------------- | ----------------------- |
| `session_get_registry_state` | `src-tauri/src/session/registry.rs` | `invoke<RegistryState>` |
| `session_list_devices`       | `src-tauri/src/session/registry.rs` | `invoke<ADBDevice[]>`   |
| `session_refresh_devices`    | `src-tauri/src/session/registry.rs` | `invoke<ADBDevice[]>`   |
| `session_set_active_device`  | `src-tauri/src/session/registry.rs` | `invoke<void>`          |
| `session_get_device_info`    | `src-tauri/src/commands/adb.rs`     | `invoke<DeviceInfo>`    |
| `session_shell_command`      | `src-tauri/src/commands/adb.rs`     | `invoke<string>`        |

## Snapshot commands

| Command                        | Description              | Return             |
| ------------------------------ | ------------------------ | ------------------ |
| `session_list_targets`         | List CDP targets         | `CDPTarget[]`      |
| `session_refresh_targets`      | Refresh target snapshot  | `CDPTarget[]`      |
| `session_list_packages`        | List installed packages  | `AppPackage[]`     |
| `session_refresh_packages`     | Refresh package snapshot | `AppPackage[]`     |
| `session_cancel_list_packages` | Cancel package listing   | `void`             |
| `session_list_webview_sockets` | List WebView sockets     | `string[]`         |
| `session_list_reverse`         | List reverse forwards    | `ReverseForward[]` |
| `session_reverse`              | Add reverse forward      | `void`             |
| `session_remove_reverse`       | Remove reverse forward   | `void`             |

## Lease commands

| Command                         | Description                |
| ------------------------------- | -------------------------- |
| `session_start_logcat_lease`    | Start logcat stream        |
| `session_stop_logcat_lease`     | Stop logcat stream         |
| `session_start_perf_lease`      | Start perf metrics stream  |
| `session_stop_perf_lease`       | Stop perf metrics stream   |
| `session_start_mirror_lease`    | Start screen mirror        |
| `session_stop_mirror_lease`     | Stop screen mirror         |
| `session_attach_console_target` | Attach console to target   |
| `session_detach_console_target` | Detach console from target |

## Event channel

- Name: `capubridge:session-event`
- Payload: typed `SessionEvent` union
