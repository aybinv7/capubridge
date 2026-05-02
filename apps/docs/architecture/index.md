# Architecture Overview

Capubridge's architecture is split between a **Rust backend** (Tauri 2) and a **Vue frontend** (Vue 3 + TypeScript). Rust owns operational state. Vue owns presentation.

## System design

The architecture follows the **session runtime** pattern: Rust is the source of truth for device/session/cache state. Vue renders snapshots and sends intents.

```text
Android device
    ↕ ADB daemon / WebView sockets
Rust session runtime
    ├─ device tracker
    ├─ registry
    ├─ per-device sessions
    ├─ cache store
    └─ typed session events
    ↕ Tauri command/event bridge
Effect runtime wrappers
    ↕ Pinia stores + Vue components
```

## Ownership model

### Rust owns

- Device presence tracking
- Per-device session lifecycle
- Cache-only snapshot persistence
- Target/package snapshot ownership
- Live lease ownership
- Typed session events

### Vue owns

- Rendering snapshots
- Visual selection
- Local UX persistence
- Explicit user intents
- CDP connection UI state

## Frontend state

Vue state is organized into **Pinia setup stores**:
| Store | Job |
|-------|-----|
| `session. store. ts` | Registry snapshot + active device |
| `devices. store. ts` | Device UI intent layer |
| `targets. store. ts` | Target snapshots + selected target |
| `source. store. ts` | Derived ADB source + local Chrome source |
| `connection. store. ts` | CDP WebSocket/proxy ownership |
| `logcat. store. ts` | Logcat lease state + entries |
| `console. store. ts` | Console target attach state |
| `mirror. store. ts` | Mirror stream state |
| `dock. store. ts` | Dock layout state |

## Backend modules

Rust code is organized into:![Screenshot showing the Rust module structure]
| Directory | Job |
|----------|-----|
| `commands/` | Tauri command adapters |
| `session/` | Session runtime (registry, tracker, sessions) |
| `runtime/` | Shared primitives (errors, paths) |

## CDP transport

CDP transport is **frontend-facing but Rust-coordinated**:- Target discovery goes through the session snapshot flow

- Local Chrome source is explicit
- External DevTools preserve `devtoolsFrontendUrl`
- Fallback synthetic targets without valid frontend metadata are not opened as external DevTools
<div class="tip">The key rule: no watcher- driven transport orchestration. Frontend never invents device/session truth.</div>
