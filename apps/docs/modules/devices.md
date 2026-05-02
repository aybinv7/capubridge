# Device Management

The **Devices** module is your home base for ADB management. From here you manage connected devices, browse installed apps, stream logcat, and explore device storage.

## Device List

The main view when you open the module. Shows all devices Capubridge can see.

### Connecting

Click the **device pill** in the sidebar footer to open the device manager:![Screenshot showing the device manager with connected devices]
From here you can:

- **USB** — connect a device via USB
- **Wi-Fi** — pair a device over the network
- **Refresh** — refresh the device list

### Device states

| State        | Indicator  | Meaning                       |
| ------------ | ---------- | ----------------------------- |
| Online       | Green dot  | Connected, accepting commands |
| Offline      | Gray dot   | ADB offline or USB issue      |
| Unauthorized | Yellow dot | USB debugging not approved    |
| No driver    | Red dot    | Driver missing on Windows     |

## App Browser

Browse installed apps on the device.

### List view

1. Click **Apps** in the Devices toolbar
2. Browse the app list (virtual scrolling for large lists)
3. Search by package name or app name
4. Filter by **Third-party**, **System**, or **All**

### App icon resolution

App icons are resolved through `dumpsys package`. Icons are cached after first fetch. Large lists load icons lazily — you may see placeholder icons until the icon is fetched.

### Inspect an app

Click an app to open the **App Inspector** for that package:![Screenshot showing the App Inspector with Overview, Permissions, Network, Battery, and Performance tabs]
The App Inspector shows:

- **Overview** — package name, version, install date, APK path
- **Permissions** — granted and denied permissions
- **Network** — data usage for the app
- **Battery** — battery usage statistics
- **Performance** — memory, CPU, frame rate
- **Capacitor** — Capacitor config (if Capacitor app)

## Logcat

Stream the live Android system log.

### Opening logcat

1. Click **Logcat** in the Devices toolbar
2. The logcat stream starts automatically
3. Live entries scroll in the terminal (xterm. js)

### Filters

| Filter         | Format                       | Example                                           |
| -------------- | ---------------------------- | ------------------------------------------------- |
| Tag            | `tag:<tag>`                  | `tag:ActivityManager`                             |
| Priority       | `<priority>`                 | `*:E` for errors                                  |
| Message        | `message:<text>`             | `message:NullPointer`                             |
| PID            | `pid:<pid>`                  | `pid:1234`                                        |
| Combine with ` | `— e.g.,`tag:ActivityManager | \*:E` shows error and above from ActivityManager. |

### Clear and buffer

- **Clear** — clear the terminal
- **Buffer size** — set the ring buffer size (`ring`, `main`, `system`, `crash`, `radio`)

### Stopping

The logcat lease stops when you navigate away from the Logcat view. This is managed automatically by the session runtime.

## File Explorer

Browse the device's file system.

### Navigation

1. Click **Files** in the Devices toolbar
2. Start from `/` or a common path
3. Navigate with breadcrumb clicks

### Protected paths

Some paths are restricted by Android's sandbox. Capubridge provides **virtual entries** for common storage paths so navigation doesn't fail hard:![Screenshot showing /storage/self and /storage/emulated with virtual entries]
| Path | Virtual entry |
|------|-----------|
| `/storage/self` | Shows `internal` and `emulated` |
| `/storage/emulated` | Shows storage volumes |
| `/sdcard` | Alias for `/storage/emulated/0` |

### File operations

- **Pull** — download a file from the device
- **Push** — upload a file to the device
- **Delete** — delete a file (with confirmation)
- **View** — open text/binary files in a viewer dialog

### Unsupported file types

Binary files (images, APKs) show a placeholder:![Screenshot showing unsupported file type message] <div class="tip">The file browser uses explicit directory requests. Protected parent paths expose virtual entries instead of failing hard.</div>
