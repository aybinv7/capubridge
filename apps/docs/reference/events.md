# Session Events

CapuBridge emits the `SessionEvent` union on the `capubridge:session-event` channel. Event payloads are defined once in the Rust and TypeScript IPC contracts.

## Event union

```typescript
type SessionEvent =
  | { type: "registryUpdated"; snapshot: SessionRegistrySnapshot }
  | { type: "leaseStateChanged"; lease: SessionLeaseState }
  | { type: "logcatEntry"; serial: string; entry: LogcatEntry }
  | { type: "logcatError"; serial: string; message: string }
  | { type: "perfMetrics"; serial: string; metrics: PerfMetrics }
  | { type: "perfError"; serial: string; message: string };
```

`registryUpdated` includes the complete registry revision and optional per-device health snapshot. Consumers should replace their registry view with the newest revision instead of merging individual fields speculatively.

## Typed subscription

Application code subscribes through the central IPC adapter:

```typescript
import { listenEvent } from "@/runtime/ipc";

const stop = await listenEvent("capubridge:session-event", (event) => {
  if (event.type === "registryUpdated") {
    devicesStore.applySnapshot(event.snapshot);
  }
});

onUnmounted(stop);
```

Direct imports from `@tauri-apps/api/event` are reserved for the adapter. This keeps payload typing and error normalization consistent across every module.
