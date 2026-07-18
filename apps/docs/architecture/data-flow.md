# Data flow

## Device to Rust

ADB device operations use the shared managed ADB server connection. CapuBridge does not spawn a fresh `adb.exe` process for normal commands.

The session runtime turns device work into bounded operations:

1. A command identifies the device session and operation class.
2. The session scheduler applies priority, queue capacity, timeout, and cancellation policy.
3. The transport accesses the ADB daemon or forwarded WebView socket.
4. The session records a terminal result and emits updated state when required.

CDP traffic uses the forwarded port assigned to the selected device. Each device receives a distinct port allocation managed by the session runtime.

## Rust to Vue

Request-response work uses typed Tauri commands. Background lifecycle changes use typed events. High-frequency streams use scoped channels or feature-specific streams where available.

```typescript
const devices = await invokeCommand("session_list_devices");
const targets = await invokeCommand("session_list_targets", { serial });
```

The canonical contract determines each command's arguments and result. Direct feature imports from `@tauri-apps/api` are migrated to the runtime client.

## Vue state flow

```text
Typed IPC result or event
  → module service
  → TanStack Query cache or owning Pinia store
  → computed presentation state
  → Vue component
```

Components send explicit intent. They do not synthesize device state or trigger transport work through mount chains.

## Writes

Storage writes travel to the selected target through CDP, including `Runtime.evaluate` where required by the storage implementation. A local cache mutation cannot represent success until the target confirms the write.

## Cancellation and disconnect

Package scans and other long work receive a cancellation generation or signal outside the normal queue path. A disconnect, timeout, cancellation, or shutdown produces an explicit terminal result and starts deterministic cleanup.
