# Session Events

Capubridge emits typed events on the `capubridge:session-event` channel.

## Event types

```typescript
// src/types/session.types.ts
type SessionEvent =
  | { type: "registryUpdated"; payload: RegistrySnapshot }
  | { type: "leaseStateChanged"; payload: { serial: string; kind: LeaseKind; state: LeaseState } }
  | { type: "logcatEntry"; payload: LogcatEntry }
  | { type: "logcatError"; payload: { serial: string; error: string } }
  | { type: "perfMetrics"; payload: PerfMetrics }
  | { type: "perfError"; payload: { serial: string; error: string } };
```

## Listening to events

```typescript
import { listen } from "@tauri-apps/api/event";
const unlisten = await listen("capubridge:session-event", (event: SessionEvent) => {
  switch (event.type) {
    case "registryUpdated":
      /* ... */ break;
    case "logcatEntry":
      /* ... */ break;
  }
});
onUnmounted(() => unlisten());
```
