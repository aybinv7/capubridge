# Effect and IPC runtime

Effect is limited to the control boundary where scoped cancellation, typed failure, resource lifetime, or dependency injection provides concrete value. It is not a second application state system.

## Canonical client

`src/runtime/ipc` owns:

- The command map for every registered Rust command.
- The event map for Tauri and application events.
- Typed Promise-based invoke and listen functions.
- Typed Effect wrappers.
- IPC error normalization.

```typescript
const devices = await invokeCommand("session_list_devices");

const stop = await listenEvent("capubridge:session-event", (event) => {
  sessionStore.applyEvent(event);
});
```

## Error behavior

Every runtime failure becomes an `IpcError` with operation context, command or event name, category, code, retryability, message, and original cause. Cancellation is represented explicitly instead of being treated as an unknown command failure.

Backend error families will increasingly provide stable codes directly. Message classification remains a compatibility fallback during that migration.

## Session service

`runtime/session.ts` contains the only authoritative session bridge service and live Effect layer. Former Effect layer files are compatibility re-exports while call sites migrate.

## Ownership rule

- Promise call sites use `invokeCommand` and `listenEvent`.
- Scoped Effect workflows use `invokeCommandEffect` and `listenEventEffect`.
- Components and feature stores do not import Tauri invoke or listen APIs directly.
- Pinia and TanStack Query remain responsible for application state and caching.
