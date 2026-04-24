# Capubridge

> A desktop devtool for hybrid app developers — bridging the Android device world and the browser runtime world in one place.

Capubridge is a [Tauri 2](https://tauri.app) desktop application built for **Capacitor / Ionic / React Native / NativePHP** developers who spend their days debugging apps running inside Android WebViews. It unifies ADB device management, Chrome DevTools Protocol (CDP) inspection, deep storage exploration, and live runtime tools into a single, native-feeling GUI — without ever opening a browser tab.also worth mentioning it was built mainly for webviews but could be really handy for other android apps debugging.also u can even inspect your local browser tabs :) .

Inspired by [aya](https://github.com/liriliri/aya) and the raw power of the [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/).

---

## The Problem

Debugging an app on a physical Android device today means juggling:

- `adb` commands in a terminal to manage devices
- `chrome://inspect` in a browser to find WebView targets
- Chrome DevTools opened in a separate floating window
- Manual `adb forward` port management per device
- No integrated view of IndexedDB, LocalStorage, Cache API, or SQLite

Capubridge replaces this fragmented workflow with a single desktop app that speaks ADB, CDP, and understands the Capacitor runtime.

---

## Features

### Device Management

- Auto-detect connected ADB devices (USB + TCP/IP)
- Connect / disconnect / pair wireless devices
- Per-device session with hot / warm / cold temperature model
- Restart ADB server, switch to TCP mode, root shell
- Shell command runner per device

### WebView & CDP Inspection

- Discover all debuggable WebView targets on the active device
- Forward CDP ports automatically (one port per device)
- Attach to any target — open Chrome DevTools externally or use the built-in console
- CDP proxy for direct WebSocket access from the frontend
- External DevTools lock prevents connection conflicts

### Storage Explorer

- **IndexedDB** — browse databases, object stores, records; edit and delete via CDP writes (changes go to the actual device)
- **LocalStorage** — inspect and modify key/value pairs live
- **Cache API** — explore cached request/response entries
- **OPFS** — browse origin private file system
- **SQLite** — list, scan, and query `.db` files pulled from the device; full SQL console with Monaco editor

### Logcat

- Live log streaming with lease-based lifecycle (stops automatically when you leave)
- Tag and level filtering
- xterm.js rendering — handles high-throughput output without jank

### Performance Monitor

- Live CPU, memory, and network metrics per app process
- Lease-bound: starts when you enter, stops when you leave

### Screen Mirror

- Mirror Android screen to the desktop via scrcpy
- Touch, swipe, scroll, and keyboard injection
- Screenshot capture and screen recording
- Clipboard sync (device ↔ host)
- Detachable mirror window with compact controls

### Package Manager

- List installed packages (third-party or all)
- App icon resolution with persistent cache
- Open package details, launch apps

### File Browser

- Browse device filesystem
- Pull files to host and open in native OS app
- Handles protected paths gracefully (`/storage/self`, `/storage/emulated`)

---

## Architecture

```
Android device
  ↕  ADB daemon / WebView sockets
Rust session runtime (Tauri backend)
  ├── device tracker          — USB/TCP attach/detach events
  ├── session registry        — per-device session lifecycle
  ├── per-device workers      — serialized control queue per device
  ├── live lease manager      — logcat / perf / mirror / console
  ├── cache store             — snapshot persistence (packages, targets, icons)
  └── typed session events    — pushed to frontend via Tauri event channel
Tauri IPC bridge
  └── Effect runtime wrappers — typed invoke + listen + cancellation
Pinia stores                  — presentation state, no invented device truth
Vue 3 modules                 — feature UI, composables, TanStack Query/Table
```

### Session Temperature Model

Each device session runs at one of three temperatures:

| State    | Meaning                                           |
| -------- | ------------------------------------------------- |
| **hot**  | Active device — live leases allowed               |
| **warm** | Known device — cached snapshots remain usable     |
| **cold** | Stale / offline — visible but not trusted as live |

### Work Classes

| Type               | Examples                                                       | Rules                                            |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------ |
| Snapshot / control | device refresh, package list, target discovery, shell commands | Serialized per device, duplicate work coalesced  |
| Live / leased      | logcat, perf, mirror, console attach                           | Explicit lease — starts on enter, stops on leave |

### Key Design Rules

- Rust owns all operational runtime state. Vue owns presentation state only.
- No watcher-driven transport orchestration.
- No hidden target refresh triggered by component mount chains.
- Frontend never invents device or session truth.
- CDP writes always go through `Runtime.evaluate` to the actual device — no fake local mutations.

---

## Tech Stack

| Layer             | Technology                                |
| ----------------- | ----------------------------------------- |
| Desktop framework | Tauri 2                                   |
| Frontend          | Vue 3 (Composition API, `<script setup>`) |
| Language          | TypeScript (strict) + Rust                |
| Build system      | Vite+ (`vp`)                              |
| Styling           | Tailwind CSS v4                           |
| State             | Pinia (setup stores) + TanStack Query     |
| Tables            | TanStack Table v8                         |
| Control plane     | Effect-TS (runtime/IPC boundary only)     |
| ADB (Rust)        | `adb_client` crate                        |
| SQLite (Rust)     | `rusqlite` (bundled static)               |
| WebSocket         | `tokio-tungstenite`                       |
| Monorepo          | pnpm workspaces + Vite+                   |

---

## Status

**v1.0.0-beta.1** — first public beta. Core session model, ADB management, CDP inspection, storage explorer, logcat, performance monitor, and screen mirror are all functional. Expect rough edges; APIs and IPC contracts may still shift before v1.0.0 stable.

---

## Roadmap

### v1.0.0 — Beta (current)

- [x] Session model with hot/warm/cold device states
- [x] Rust device tracker + per-device session workers
- [x] ADB device management GUI
- [x] CDP target discovery + automatic port forwarding
- [x] IndexedDB explorer (read / write / delete via CDP)
- [x] LocalStorage, Cache API, OPFS inspection
- [x] SQLite browser + query console
- [x] Logcat viewer (live, lease-bound)
- [x] Performance monitor (live, lease-bound)
- [x] Screen mirror (scrcpy, touch/keyboard injection)
- [x] Package manager with persistent icon cache
- [x] File browser with protected path fallbacks
- [x] Multi-platform builds (Linux, macOS x64/arm64, Windows)
- [x] Storage diff — compare storage snapshots between sessions or builds
- [x] JS console REPL — run arbitrary JavaScript in the WebView context with full autocomplete

### v1.x — Planned

- [ ] Network inspector — capture and replay HTTP/WebSocket traffic from the WebView
- [ ] Capacitor plugin inspector — inspect plugin bridge calls and responses live
- [ ] Crash symbolication — decode native Android stack traces using source maps
- [ ] iOS support — WebKit inspector protocol (under investigation)

### Future

- [ ] Remote device sharing — proxy a connected device to a teammate over the network
- [ ] Automated test runner integration — attach to a running test suite and capture storage state per test
- [ ] AI context export — bundle device state, logs, and storage into a prompt-ready snapshot

---

## Getting Started

### Download

Grab the latest release for your platform from the [Releases](../../releases) page.

| Platform            | Format               |
| ------------------- | -------------------- |
| macOS Apple Silicon | `.dmg` (arm64)       |
| macOS Intel         | `.dmg` (x64)         |
| Windows             | `.msi` / `.exe`      |
| Linux               | `.AppImage` / `.deb` |

### Requirements

- Android device with **USB debugging enabled**
- ADB in your PATH (it shipped with adb but if it didn't worked u can installd it from android platfroms).
- For WebView inspection: app built with `android:debuggable="true"` in `AndroidManifest.xml` (eg. when the app is not in release mode)

### Build from Source

```bash
# Install Vite+ globally
npm i -g vite-plus

# Clone and install
git clone https://github.com/inventor7/capubridge
cd capubridge
vp install

# Run desktop app in dev mode
vp run tauri

# Production build
vp run -r build
```

**Requirements:** Node 22+, pnpm 10+, Rust stable toolchain. `libwebkit2gtk-4.1-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev`.

---

## Acknowledgements

- [aya](https://github.com/liriliri/aya) — inspiration for what a native Android devtool GUI can feel like
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) — foundation for all WebView inspection features
- [scrcpy](https://github.com/Genymobile/scrcpy) — powering the screen mirror feature
- [Tauri](https://tauri.app) — making a lean, native desktop app possible with web tech

---

## License

MIT
