# Runtime Overview

The frontend runtime layer wraps Tauri IPC and WebSocket transport in typed abstractions.

## Runtime files

| File                             | Job                                     |
| -------------------------------- | --------------------------------------- |
| `runtime/session.ts`             | Typed session command/event bridge      |
| `runtime/effect/tauri.ts`        | Effect wrappers for `invoke`            |
| `runtime/effect/events.ts`       | Effect wrappers for Tauri event streams |
| `runtime/effect/ws.ts`           | CDP WebSocket helpers                   |
| `runtime/effect/cancellation.ts` | Interruption and cancellation utilities |
| `runtime/effect/errors.ts`       | Tagged runtime error types              |

## Effect adoption rule

Use Effect for: **runtime/control plane** — Tauri IPC, typed events, WebSocket lifecycle, lease cancellation.
Do **not** use Effect for: presentational Vue components, simple computed view models, local form state.

## Error taxonomy

| Class                  | Examples                             |
| ---------------------- | ------------------------------------ |
| **Expected rejection** | User canceled, lease stopped         |
| **Domain error**       | Device offline, target unavailable   |
| **Runtime defect**     | Invariant broken, unexpected event   |
| **Interruption**       | Device switched, session deactivated |
