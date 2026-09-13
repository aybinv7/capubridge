# Introduction

Capubridge is a desktop developer tool for **WebView-based Android apps**. It runs on your development machine and connects to physical or emulated Android devices over ADB.

## What it does

Capubridge bridges two worlds:

### Runtime World — inside the WebView

- **CDP targets** — Android Chromium WebViews exposed for remote debugging
- **IndexedDB** — explore databases, object stores, and records
- **LocalStorage** — key-value data for web apps
- **SQLite** — inspect supported SQLite snapshots; native Android snapshots are read-only
- **OPFS** — Origin Private File System files
- **Cache API** — cached network responses
- **Console** — JavaScript console output and errors
- **DOM inspector** — tree view, styles, computed values

### Device World — Android itself

- **ADB device management** — USB, Wi-Fi, emulators
- **Logcat** — live Android system log stream
- **File explorer** — browse device storage
- **App browser** — list and inspect installed apps
- **Screen mirror** — live device screen streaming
- **Performance metrics** — CPU, memory, FPS

## Supported runtime boundary

Capubridge works with Android Chromium WebViews when the application exposes a debuggable CDP target. Capacitor, Ionic, NativePHP, and React Native WebView can work when their web content meets that requirement.

The following are not currently supported:

- iOS WebKit inspection
- Native React Native/Hermes runtime inspection
- Generic WebView runtimes without a Chrome-compatible CDP target
- Remote device sharing or remote MCP access

See the [capability matrix](./capabilities) before relying on a workflow in production.

## Tech stack

Capubridge is built with:

| Layer    | Technology             |
| -------- | ---------------------- |
| Desktop  | Tauri 2                |
| Backend  | Rust                   |
| Frontend | Vue 3 + TypeScript     |
| State    | Pinia + TanStack Query |
| Build    | Vite+ (`vp`)           |

## Key design principles

### One active device at a time

You work with one device at a time — the **hot device**. Other connected devices stay visible as **warm** or **cold** snapshots.

### Session leases

Live features (logcat, perf, mirror, console) are **explicit leases**. Leaving the feature stops the lease automatically.

### No watcher-driven transport

Rust owns the device/session state. Vue only renders snapshots and sends intents. No hidden transport fanout from component watchers.

### Manual refresh

Targets and packages use **cached snapshots + manual refresh**. Not automatic polling loops.

## Next steps

<div class="grid grid-cols-2 gap-4 my-8">

[Install Capubridge →](./installation) Get the app running in minutes.

[Quick Start →](./quick-start) Connect your first device and explore IndexedDB.

</div>
