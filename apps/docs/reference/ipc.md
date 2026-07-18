# IPC contract

CapuBridge maintains a canonical TypeScript contract for every command registered by Rust. A contract test compares the 130 command names with Tauri's `generate_handler!` registration and fails on additions, removals, duplicates, or drift.

## Contract layout

`src/runtime/ipc/contracts` groups commands by capability:

- Session
- Device and ADB
- Connection and CDP proxy
- Mirror and performance
- Storage and files
- Recording and replay
- Mock server

Each command defines its input object and result type. No-argument commands are represented separately so callers cannot accidentally send an invalid payload.

## Calling commands

```typescript
import { invokeCommand } from "@/runtime/ipc";

const devices = await invokeCommand("session_list_devices");
const targets = await invokeCommand("session_list_targets", { serial });
await invokeCommand("session_remove_reverse", { serial, remotePort });
```

The command name selects the permitted argument and inferred result types. Feature code does not supply a generic result independently of the command.

## Listening to events

```typescript
import { listenEvent } from "@/runtime/ipc";

const stop = await listenEvent("capubridge:session-event", (event) => {
  sessionStore.applyEvent(event);
});

stop();
```

The event map covers session, mirror, recording, local preview, and application events used by the frontend.

## Effect workflows

Scoped Effect code uses `invokeCommandEffect` and `listenEventEffect` from the same contract. `runtime/session.ts` provides the authoritative session service and live layer.

## Errors

Promise and Effect wrappers normalize failures into `IpcError` with:

- Operation type
- Command or event name
- Stable category
- Error code
- Retryability
- Safe message
- Original cause

Categories currently cover cancellation, validation, not found, permission, conflict, timeout, unavailable resources, transport, command failure, and unknown failures. Structured backend codes take precedence; message classification remains a compatibility fallback while Rust commands migrate from string errors.

## Migration rule

Direct imports of Tauri `invoke` and `listen` are forbidden in migrated feature code. New commands must update Rust registration, the typed contract, error behavior, call sites, and tests in the same change.
