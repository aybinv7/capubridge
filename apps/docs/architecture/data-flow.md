# Data Flow

How data flows from the Android device through the stack to the UI.

## Device → Rust

Android device communication happens through two channels:![Screenshot showing the data flow diagram]### ADB channel
Used for: device management, logcat, file operations, package listing.

- `adb devices` → device list
- `adb shell logcat` → log stream
- `adb pull` → file download
- `adb shell pm list packages` → package list
  All ADB commands go through the **shared ADB server path**. No fresh `adb. exe` spawns for normal device work.### CDP WebSocket channel
  Used for: target inspection, storage queries, DOM manipulation.
- Forwarded TCP port to device CDP endpoint
- WebSocket session to the selected target
- CDP commands and events

## Rust → Vue

Rust emits typed session events on the `capubridge:session-event` channel.
| Event | Payload | When |
|-------|---------|------|
| `registryUpdated` | Device list | Device attach/remove |
| `leaseStateChanged` | Lease state | Lease start/stop |
| `logcatEntry` | Log line | Logcat stream |
| `perfMetrics` | Metrics object | Perf stream |### Snapshot commands
Vue pulls snapshots explicitly:```typescript
// List targets
const targets = await invoke<CDPTarget[]>('session_list_targets', { serial });// List packages
const packages = await invoke<AppPackage[]>('session_list_packages', { serial });

````### Lease commands
Vue starts/stops live features explicitly:```typescript
// Start logcat lease
await invoke('session_start_logcat_lease', { serial });// Stop logcat lease
await invoke('session_stop_logcat_lease', { serial });
```## Vue → Rust
User actions send intents through invoke:```typescript// Select device
await invoke('session_set_active_device', { serial });// Refresh targets
await invoke('session_refresh_targets', { serial });// Refresh packages
await invoke('session_refresh_packages', { serial });
```## Vue → UI
Stores update, Vue reactivity propagates, UI renders. No watcher-driven transport.
## CDP commands
CDP commands go through `useCDP. ts` composable:```typescriptconst cdp = useCDP(targetId);
const databases = await cdp.send('IndexedDB.getDatabaseNames');```CDP writes go through `Runtime.evaluate` to ensure the target receives the change.
````
