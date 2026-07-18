# Architecture overview

CapuBridge uses a Rust-owned operational runtime and a modular Vue presentation layer. Rust owns device truth and resource lifecycles. Vue renders snapshots and sends explicit user intent.

```text
Android devices
  ↕ managed ADB daemon and WebView sockets
Rust transport and session runtime
  ↕ typed Tauri commands, channels, and events
Typed frontend IPC client
  ↕ module services, TanStack Query, and Pinia
Vue feature modules
```

## Dependency direction

- The application shell composes feature public APIs.
- Feature modules depend on the typed runtime and shared primitives.
- Feature modules never import another module's internal files.
- Shared code remains domain-neutral and cannot own feature state.
- Tauri command adapters depend on session and transport services, not frontend concepts.

The module-boundary quality gate rejects new cross-module imports. The current migration baseline is empty.

## Ownership

### Rust

- Device discovery and connection state
- Per-device sessions and work scheduling
- Cancellation, timeouts, and terminal operation state
- ADB/CDP port and transport resource lifecycles
- Live feature leases and cleanup
- Session health and operational events

### Vue

- Route and feature composition
- Visual selection and workflow presentation
- Persisted UI preferences
- Query caches for remote data
- Explicit commands sent through the typed IPC client

## Frontend state

- TanStack Query owns cached remote and device data.
- Setup Pinia stores own durable domain selection, workflow state, and preferences.
- Components own short-lived presentation state.
- Watchers do not own transport orchestration.

## Trust zones

The privileged application WebView and local preview content use separate capabilities. Production builds do not expose the main WebView through a remote-debugging port. Preview URLs and labels are validated before privileged operations.

## More detail

- [Data flow](./data-flow)
- [Session runtime](./session)
- [ADB integration](./adb)
- [CDP transport](./cdp)
- [Source-size governance](./source-size-governance)
- [Architecture decisions](./decisions/)
