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

## Wireless pairing (Android 11+)

`Connect over Wi-Fi` pairs the way Android Studio does, without a cable or a typed address. The
Rust side (`src-tauri/src/commands/wireless/`) owns the whole session; the panel only draws it.

1. `wireless_pairing_start` draws a `studio-<10 random chars>` service name and a 12-character
   password from the OS CSPRNG (`getrandom`) and encodes `WIFI:T:ADB;S:<name>;P:<password>;;`
   as a QR code locally (`qrcodegen`). Only the QR matrix crosses IPC; the password stays in the
   session task, is never logged or persisted, and is dropped when the session ends.
2. Every second, discovery lists the adb services on the network. When the phone scans the code
   it advertises `_adb-tls-pairing._tcp` under that name, and the session sends
   `host:pair:<password>:<ip:port>`.
3. After `Successfully paired … [guid=<guid>]`, it waits for the phone's `_adb-tls-connect._tcp`
   service (matched by guid, else by the pairing host). adb usually connects a freshly paired
   phone on its own within a second; otherwise the session sends `host:connect:<ip:port>`.
4. States stream on `capubridge:wireless-pairing`: waiting, pairing, connecting, connected,
   failed with a reason (not seen, nothing discovered, unreachable, rejected, connect failed,
   discovery unavailable, ADB down). The QR code expires after 3 minutes.

`wireless_pairing_with_code` runs the same session from step 2 with a six-digit code, so the code
path also connects on its own. All requests use the adb host protocol on 127.0.0.1:5037 on a
fresh socket each (no `adb.exe` spawn); replies are checked by their text, because adb answers
`OKAY` to failed pairs and connects too.

### Discovery source

| Source                     | When                                                            |
| -------------------------- | --------------------------------------------------------------- |
| adb server mDNS            | `host:mdns:check` answers `mdns daemon version …` (the default) |
| Native browser (`mdns-sd`) | adb reports its mDNS unavailable (`ADB_MDNS=0`, or an old adb)  |

Verified on 2026-11-08 with the bundled platform-tools **37.0.0-14910828** on Windows 11:
`adb mdns check` answers `mdns daemon version [adb discovery 0.0.0]` and `adb mdns services`
prints `List of discovered mdns services` followed by `name<TAB>type<TAB>ip:port` lines; the
host-protocol payload is the same without the header. The parser skips IPv6 and unknown types.

### Reconnecting

Phones that connected over Wi-Fi are remembered by guid (no address is stored) in
`pairedPhones.store`. The panel lists every visible `_adb-tls-connect._tcp` service under
"Nearby phones" with one-click Connect, and `WirelessReconnectBootstrap` reconnects remembered
phones with "Reconnect by itself" on, polling every 5 s only while one exists and the window is
visible.

### Android 10 and older

No wireless pairing. With the phone on USB, "Switch to Wi-Fi" reads its address
(`ip -f inet addr show wlan0`, else the `src` of the `wlan` route), runs `tcpip 5555` and connects
to `<ip>:5555`; the cable can then be unplugged.
