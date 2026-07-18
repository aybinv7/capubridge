# Session Runtime

The Rust session runtime owns device lifecycle, ADB work serialization, cached snapshots, and stream leases. Vue reads typed snapshots through the IPC adapter and does not create a second source of truth.

## Ownership

| Component        | Responsibility                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Session registry | Maintains one session per device serial and the active device                            |
| Device tracker   | Maintains the long-lived ADB device tracker and reconciles attach/detach state           |
| Device worker    | Serializes work for one device and owns cleanup                                          |
| Job queue        | Bounds pending work, prioritizes lifecycle operations, and coalesces duplicate snapshots |
| Cache store      | Persists rebuildable stale snapshots only                                                |

## Queue behavior

Each device queue has a fixed capacity of 64 jobs. Work is processed in this order:

1. Lifecycle operations
2. Control operations
3. Snapshot operations
4. Background operations

FIFO order is preserved inside a priority class. Duplicate snapshot work is coalesced, and a full queue rejects new work instead of growing memory without a bound. Cancellation state is independent from the queue so a busy worker can observe cancellation promptly.

## Session health

Every live device snapshot may include health telemetry:

```typescript
interface SessionHealthSnapshot {
  queueDepth: number;
  queueCapacity: number;
  activeOperation: string | null;
  lastTerminalFailure: string | null;
  connectionAgeMs: number;
  cleanupState: "active" | "shuttingDown" | "detached" | "stopped";
}
```

The telemetry is operational state, not analytics. It is intended for truthful UI status, diagnostics, and timeout investigation.

## Temperature model

| State  | Meaning                                                            |
| ------ | ------------------------------------------------------------------ |
| `hot`  | Active device; live leases may run                                 |
| `warm` | Connected device; snapshots are available without active live work |
| `cold` | Detached, offline, or restored stale snapshot                      |

## Cleanup contract

Disconnect and shutdown terminate worker work, fail pending callers, stop listeners, and remove only the forward or reverse mapping owned by that session. Session waits are bounded; callers receive a terminal timeout rather than waiting indefinitely.

All ADB commands continue through the shared daemon connection. The runtime does not spawn a new `adb.exe` process per operation.
