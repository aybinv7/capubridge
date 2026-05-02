# App Inspector

Inspect the selected app on the device at a high level. Shows overview, permissions, network usage, battery usage, and performance metrics.

## Overview tab

Shows app metadata:![Screenshot showing the App Overview tab]

- **Package name** — e.g., `com.myapp.app`
- **Version** — `1.2.3 (123)`
- **Install date** — when the APK was installed
- **APK path** — path to the APK on the device
- **Signature** — signing certificate fingerprint

## Capacitor tab

Shows Capacitor integration details for the app:![Screenshot showing the Capacitor tab]

- **Capacitor version** — detected from `capacitor.config.ts`
- **Plugins** — installed Capacitor plugins
- **WebView version** — Chrome/WebView version
- **JS engine** — JavaScript engine (V8, JavaScriptCore)

## Permissions tab

All permissions requested by the app, with their grant status:![Screenshot showing the permissions list]

- **Granted** — green checkmark
- **Denied** — red X
- **Prompt** — hollow circle (not yet decided)
  Click a permission to request or revoke it.

## Network tab

Data usage for the app's network requests:![Screenshot showing the network usage chart]

- **Total sent** — bytes uploaded
- **Total received** — bytes downloaded
- **Charts** — over time

## Battery tab

Battery usage breakdown:![Screenshot showing the battery usage chart]

- **Screen on time** — time with screen active
- **CPU time** — CPU usage while foregrounded
- **Background** — usage while backgrounded

## Performance tab

Real-time performance metrics for the app:![Screenshot showing the performance chart with FPS, Memory, and CPU curves]

- **Frame rate** — FPS over time
- **Memory** — heap size and allocations
- **CPU** — CPU usage percentage
