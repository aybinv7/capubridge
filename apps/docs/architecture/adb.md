# ADB Integration

All ADB commands go through the **shared ADB server path** — never through fresh `adb. exe` spawns.

## ADB server path

The ADB server runs as a single TCP listener (default port `50`37). All Capubridge ADB work routes through it.

```rust
// All ADB commands use this pattern
let mut server = get_server().lock();
let mut device = server.get_device_by_name(&serial)?;
device.shell_command(&cmd, Some(&mut stdout), None)?;
```

## Why no fresh spawns

- Prevents RunDLL error dialog popups on Windows
- Avoids process startup overhead
- Prevents race conditions with multiple ADB instances
- Maintains a single authenticated session per device

## Target discovery

CDP WebView targets are discovered by:![Screenshot showing the target discovery flow]1. Forward a local port: `adb forward tcp:<local> localabstract:<socket>` 2. Request the list: `adb shell "cat /proc/net/unix" | grep webview` 3. Get WebSocket endpoint: Query the device's CDP daemon 4. Open a session: `adb forward` for the WebSocket port

## Port forwarding

| Each selected target gets a forwarded TCP port:![Screenshot showing port forwarding per target] | Device   | Target | Local Port |
| ----------------------------------------------------------------------------------------------- | -------- | ------ | ---------- |
| Device 1                                                                                        | Target 1 | 9222   |
| Device 1                                                                                        | Target 2 | 9223   |
| Device 2                                                                                        | Target 1 | 9224   |

Port management is in the Targets Store and the session runtime. Ports are reused when targets disconnect.
