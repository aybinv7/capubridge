# Session Runtime

Rust-owned device session state and orchestration.

## Core components

### Registry

Global registry of device sessions. Keys by serial.

```rust
// src-tauri/src/session/registry.rs
pub struct SessionRegistry { /* ... */ }
impl SessionRegistry {
  pub fn get_or_create(&mut self, serial: &str) -> &mut DeviceSession;
  pub fn set_active(&mut self, serial: &str);
  pub fn get_active(&self) -> Option<&DeviceSession>;
}
```

### Device Tracker

Long-lived ADB `track-devices` worker. Emits typed events on device attach/remove.

```rust
// src-tauri/src/session/device_tracker.rs
pub struct DeviceTracker { /* ... */ }
impl DeviceTracker {
  pub fn start(app: AppHandle) { /* ... */ }
  pub fn stop(&mut self) { /* ... */ }
}
```

### Per-Device Worker

Actor-style worker per device serial. Owns the control queue and cache.

```rust
// src-tauri/src/session/device_session.rs
pub struct DeviceSession { /* ... */ }
impl DeviceSession {
  pub fn queue_snapshot(&mut self, job: SnapshotJob) { /* ... */ }
  pub fn start_lease(&mut self, kind: LeaseKind) { /* ... */ }
  pub fn stop_lease(&mut self, kind: LeaseKind) { /* ... */ }
}
```

### Job Queue

Serialized control queue with coalescing.

```rust
// src-tauri/src/session/job_queue.rs
pub struct JobQueue { /* ... */ }
impl JobQueue {
  // Key: (job_kind, resource_scope)
  // Duplicate snapshots coalesce — stale results drop new results if generation is lower
}
```

### Cache Store

Cache-only persistence for rebuildable snapshots.

```rust
// src-tauri/src/session/cache_store.rs
pub struct CacheStore { /* ... */ }
impl CacheStore {
  pub fn save_target_snapshot(&mut self, serial: &str, targets: &[CDPTarget]) { /* ... */ }
  pub fn load_target_snapshot(&self, serial: &str) -> Option<TargetSnapshot> { /* ... */ }
}
```

### Session Events

Typed event payloads emitted to Vue.

````rust
// src-tauri/src/session/events.rs
pub enum SessionEvent {
  RegistryUpdated(RegistrySnapshot),
  LeaseStateChanged { serial: String, kind: LeaseKind, state: LeaseState },
  LogcatEntry(LogcatEntry),
  PerfMetrics(PerfMetrics),
}
```## Temperature model
| State | Description |
|-------|-------------|
| **hot** | Active device, live leases allowed |
| **warm** | Known device, snapshots usable, leases not allowed |
| **cold** | Stale/offline/restored snapshot |
````
