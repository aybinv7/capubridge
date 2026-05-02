# Targets & CDP

A **target** is a Chrome tab or WebView running on the Android device. Capubridge connects to targets via the **Chrome DevTools Protocol (CDP)**.

## What is a target?

On Android, every browser tab and WebView component registers as a CDP target with the ADB daemon. Capubridge discovers these targets by:

1. Forwarding a local port to the device's CDP WebSocket endpoint
2. Requesting the list of targets from the ADB daemon
3. Opening a CDP session to the selected target

## Target types

| Type               | Description                 | Example                   |
| ------------------ | --------------------------- | ------------------------- |
| **page**           | A Chrome tab in the browser | `capubridge.app`          |
| **webview**        | A WebView in another app    | Capacitor app, RN WebView |
| **service-worker** | A service worker            | Background sync           |
| **browser**        | The Chrome browser itself   | DevTools secondary        |
| **other**          | Other CDP target types      | Extensions, etc.          |

## Selecting a target

1. Click the **device pill** in the sidebar or press `⌘D`
2. The **Target Selector** opens
3. You'll see all available targets grouped by type
4. Click a target and **Inspect**
   The target is forwarded to a local port (e.g., `localhost:9222`). Capubridge opens a CDP WebSocket session on that port.

## Target snapshot model

Targets are **cached snapshots** — not live discovery loops:

- When you open the Target Selector, you see one snapshot of the available targets
- Click **Refresh** to get a new snapshot
- Targets do **not** automatically refresh on a timer

## Port forwarding

Each target gets its own forwarded port on the host machine:

- First selected target: port `9222`
- Second: port `9223`
- And so on...
  Ports are managed by the **Targets Store** and the session runtime.

## CDP domains

Capubridge uses these CDP domains for inspection:
| Domain | Used for |
|--------|---------|
| **Page** | Target listing and lifecycle |
| **DOM** | DOM tree, attributes, styles |
| **CSS** | Computed styles, selectors |
| **Runtime** | JavaScript evaluation, object inspection |
| **Storage** | IndexedDB, LocalStorage, Cache |
| **Network** | Request/response interception |
| **ApplicationInspector** | App-specific inspection |
| **Log** | Console output |

## External DevTools

Capubridge can open the target in your **local Chrome browser's DevTools**:

1. Select a target
2. Click **Open in Chrome DevTools**
The app preserves the `devtoolsFrontendUrl` so the target opens correctly in your browser.
<div class="warning">When external DevTools is open, the normal reconnect path in Capubridge is paused. Close the external DevTools to resume Capubridge's CDP session.</div>
