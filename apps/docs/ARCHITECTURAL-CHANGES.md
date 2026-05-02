# Device Session Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Capubridge's Android transport/runtime layer around Rust-owned device sessions so device tracking, snapshot refreshes, and live features stop being watcher-driven and stop crashing under load.

**Architecture:** Rust becomes the source of truth for operational device/session/cache/runtime state. Vue/Pinia becomes the presentation layer that sends intents, renders snapshots, and subscribes to typed session events. One device session can be hot at a time, other connected devices stay warm/cold with stale cached data.

**Tech Stack:** Tauri 2, Rust, adb_client, Vue 3, Pinia, TypeScript, Tauri events, cache-only local persistence

---

## Locked decisions

- Multi-device is supported.
- Only one device session is hot/live at a time.
- Inactive devices keep visible cached data and are marked stale.
- Live features are route/component scoped.
- Leaving a live feature stops its runtime work.
- Targets use single snapshot on open plus manual refresh.
- Packages use cached snapshot plus manual refresh.
- Rust owns operational state and session orchestration.
- Vue owns visual state and presentation preferences.
- Rust persistence is cache-only and rebuildable in phase 1.
- Per-device control work is serialized.
- Live streams are leased outside the normal control queue.
- Snapshot jobs coalesce by `job_kind + resource_scope`.
- Duplicate snapshot jobs cancel cooperatively when possible, otherwise stale-drop their results.
- Session updates use query/command plus event streams, not frontend polling.
- Device presence should move to `track-devices` instead of repeated `adb_list_devices` polling.
- Effect is adopted on the frontend runtime/control plane.
- Effect is not mandatory for purely presentational Vue component code.

---

## Why this refactor exists

Current behavior is still shaped like:

- Vue watchers decide transport behavior.
- Multiple stores/composables can trigger overlapping ADB/CDP work.
- Rust exposes commands, but orchestration is mostly caller-driven.
- A large amount of device work still funnels through shared blocking access.

This creates avoidable failure modes:

- repeated refresh storms
- stale async work applying after context changed
- modal-triggered transport fanout
- high latency when low-value snapshot jobs pile up
- disconnect/offline errors surfacing too late

This plan moves Capubridge toward a runtime model closer to mature device tooling:

- event-driven device presence
- backend-owned session lifecycles
- explicit control plane vs live stream separation
- scoped cancellation and stale result protection

---

## Non-goals for this plan

- Do not redesign the UI shell again.
- Do not change visual interaction patterns beyond what the new event model requires.
- Do not add durable product-state persistence in phase 1.
- Do not introduce always-live target discovery.
- Do not keep background-heavy work alive for inactive devices.

---

## Rust codebase refactor goal

Yes, the Rust side also needs a structural refactor.

Current command-layer hotspots:

- `apps/desktop/src-tauri/src/commands/adb.rs` is `1563` lines
- `apps/desktop/src-tauri/src/commands/mirror.rs` is `882` lines
- `apps/desktop/src-tauri/src/commands/sqlite.rs` is `659` lines
- `apps/desktop/src-tauri/src/commands/files.rs` is `462` lines
- `apps/desktop/src-tauri/src/commands/perf.rs` is `406` lines

This is still too god-file shaped for a session-driven architecture. The refactor is not optional polish; it is part of making the runtime scalable and maintainable.

### Target Rust structure

```text
apps/desktop/src-tauri/src/
├── commands/
│   ├── mod.rs
│   ├── adb/
│   │   ├── mod.rs
│   │   ├── server.rs
│   │   ├── device_info.rs
│   │   ├── shell.rs
│   │   ├── pairing.rs
│   │   ├── packages.rs
│   │   ├── package_icons.rs
│   │   ├── logcat.rs
│   │   ├── webviews.rs
│   │   ├── reverse.rs
│   │   └── aya.rs
│   ├── cdp/
│   │   ├── mod.rs
│   │   ├── proxy.rs
│   │   └── port_forward.rs
│   ├── mirror/
│   │   ├── mod.rs
│   │   ├── scrcpy.rs
│   │   ├── control.rs
│   │   ├── recording.rs
│   │   └── screenshots.rs
│   ├── perf/
│   │   ├── mod.rs
│   │   ├── session.rs
│   │   └── collectors.rs
│   ├── sqlite/
│   │   ├── mod.rs
│   │   ├── cache.rs
│   │   ├── scan.rs
│   │   ├── query.rs
│   │   └── schema.rs
│   └── files/
│       ├── mod.rs
│       ├── listing.rs
│       ├── transfer.rs
│       └── deletion.rs
├── session/
│   ├── mod.rs
│   ├── registry.rs
│   ├── device_tracker.rs
│   ├── device_session.rs
│   ├── job_queue.rs
│   ├── cache_store.rs
│   ├── events.rs
│   ├── guards.rs
│   └── types.rs
└── runtime/
    ├── mod.rs
    ├── errors.rs
    ├── event_bus.rs
    └── paths.rs
```

### Ownership rules for the refactor

- `commands/*` should become thin Tauri command adapters.
- `session/*` should own orchestration and runtime policy.
- `runtime/*` should hold shared primitives, not feature logic.
- Feature helpers should live next to their feature, not inside one giant utility file.
- New files should be responsibility-based, not “one more helper bucket”.

### Immediate split points

`adb.rs` should be split at minimum into:

- server/bootstrap
- device list + device info
- shell helpers
- pairing/connectivity
- package metadata
- package icon extraction
- logcat
- WebView socket discovery
- reverse rules
- AYA helper protocol

`mirror.rs` should be split at minimum into:

- scrcpy process/session ownership
- control channel
- recording
- screenshot
- input actions

`sqlite.rs` should be split at minimum into:

- database cache
- scanner
- query execution
- schema/table metadata

This split should happen progressively while introducing the session runtime. We do not need one giant “rename files only” refactor first.

---

## Frontend runtime refactor and Effect adoption goal

Yes, the Vue side also needs a stronger runtime model.

Current frontend pain points:

- large Promise-heavy stores and composables
- many local `try/catch` blocks with inconsistent error normalization
- `console.error` / `toast.error` mixed directly into control flow
- manual timeout and interval handling
- ad-hoc cancellation and cleanup logic
- watcher-driven async orchestration
- weak distinction between expected rejections, domain errors, stale work, and true defects

Effect is a good fit for this app because the frontend is not a normal page UI. It is a desktop runtime surface with:

- Tauri IPC
- typed events
- WebSocket/CDP sessions
- leases and teardown
- cancellation and interruption
- concurrency control
- long-lived background work

### Adoption rule

Use Effect in the frontend runtime/control plane.

Do not force Effect into simple presentational SFC logic where plain Vue is clearer.

### Where Effect should be used

- `apps/desktop/src/composables/useSessionRuntime.ts`
- `apps/desktop/src/stores/session.store.ts`
- `apps/desktop/src/stores/connection.store.ts`
- `apps/desktop/src/modules/mirror/useMirrorStream.ts`
- `apps/desktop/src/stores/logcat.store.ts`
- `apps/desktop/src/stores/console.store.ts`
- frontend wrappers around:
  - Tauri `invoke`
  - Tauri event listeners
  - WebSocket/CDP lifecycle
  - cancellation / timeout / retry policy

### Where Effect should not be required

- dumb UI components
- layout components
- simple local form state
- ordinary computed-only view models
- simple TanStack Query read components that do not own runtime orchestration

### Target frontend structure

```text
apps/desktop/src/
├── runtime/
│   ├── effect/
│   │   ├── errors.ts
│   │   ├── tags.ts
│   │   ├── layers.ts
│   │   ├── runtime.ts
│   │   ├── tauri.ts
│   │   ├── events.ts
│   │   ├── ws.ts
│   │   ├── cancellation.ts
│   │   └── session.ts
│   ├── session/
│   │   ├── mappers.ts
│   │   ├── selectors.ts
│   │   └── commands.ts
│   └── shared/
│       ├── clock.ts
│       └── ids.ts
├── composables/
│   ├── useSessionRuntime.ts
│   └── ...
├── stores/
│   ├── session.store.ts
│   ├── connection.store.ts
│   ├── logcat.store.ts
│   └── console.store.ts
└── types/
    ├── session.types.ts
    └── ...
```

### Effect design rules

- Normalize unknown/foreign errors at the Tauri/WebSocket boundary.
- Treat errors as typed values, not strings.
- Use interruption/cancellation for lease-bound and snapshot work where possible.
- Keep Vue-facing adapters simple:
  - `Ref`
  - plain store state
  - typed commands
- Keep `Option`, `Exit`, `Either`, and rich error unions mostly inside the runtime layer unless a UI screen truly benefits from seeing them directly.
- Prefer one Effect-backed runtime service boundary instead of scattered local wrappers in many files.

### Error taxonomy to adopt

- expected rejection
  - user canceled
  - lease stopped because route changed
  - stale work dropped
- domain error
  - device offline
  - target unavailable
  - package snapshot missing
- runtime defect
  - invariant broken
  - unexpected event payload
  - bridge contract mismatch
- interruption
  - device switched
  - session deactivated
  - feature lease canceled

### Migration stance

This is not a whole-frontend rewrite.

The migration should be:

1. create a small Effect runtime layer
2. use it for the new session bridge first
3. migrate the highest-complexity async files next
4. leave simple Vue components alone unless there is a real benefit

### First candidate files for Effect

- `apps/desktop/src/composables/useSessionRuntime.ts`
- `apps/desktop/src/stores/session.store.ts`
- `apps/desktop/src/stores/connection.store.ts`
- `apps/desktop/src/modules/mirror/useMirrorStream.ts`

These files have the highest need for:

- interruption
- scoped cleanup
- timeout control
- error normalization
- controlled concurrency

---

## File structure

### Rust runtime files

**Create**

- `apps/desktop/src-tauri/src/session/mod.rs`
  session module entrypoint
- `apps/desktop/src-tauri/src/session/types.rs`
  shared session, job, cache, and event types
- `apps/desktop/src-tauri/src/session/events.rs`
  Tauri event payload builders and emit helpers
- `apps/desktop/src-tauri/src/session/registry.rs`
  global registry of device sessions and active device selection
- `apps/desktop/src-tauri/src/session/device_tracker.rs`
  long-lived ADB `track-devices` worker
- `apps/desktop/src-tauri/src/session/device_session.rs`
  actor-style worker per device serial
- `apps/desktop/src-tauri/src/session/job_queue.rs`
  serialized control queue, coalescing, cancel tokens, stale-drop generation logic
- `apps/desktop/src-tauri/src/session/cache_store.rs`
  cache-only persistence for rebuildable session snapshots
- `apps/desktop/src-tauri/src/session/guards.rs`
  online-device admission helpers and session state validation

**Modify**

- `apps/desktop/src-tauri/src/lib.rs`
  register new commands and session startup/shutdown
- `apps/desktop/src-tauri/src/commands/mod.rs`
  expose session module integration
- `apps/desktop/src-tauri/src/commands/adb.rs`
  migrate device list logic and device-scoped command entrypoints to use session guards/registry
- `apps/desktop/src-tauri/src/commands/port_forward.rs`
  route target refresh and forward lifecycle through session jobs
- `apps/desktop/src-tauri/src/commands/perf.rs`
  convert perf to leased live session work
- `apps/desktop/src-tauri/src/commands/mirror.rs`
  align mirror session lifetime with session lease model
- `apps/desktop/src-tauri/src/commands/cdp_proxy.rs`
  make proxy ownership align with target/session lifetime

### Frontend state and integration files

**Create**

- `apps/desktop/src/types/session.types.ts`
  frontend types for session snapshots, stale markers, job status, and session events
- `apps/desktop/src/stores/session.store.ts`
  primary frontend store for Rust-owned session state
- `apps/desktop/src/composables/useSessionRuntime.ts`
  typed command/query/event bridge from Vue to Rust session APIs
- `apps/desktop/src/runtime/effect/errors.ts`
  tagged frontend runtime error types and normalization helpers
- `apps/desktop/src/runtime/effect/tags.ts`
  Effect service tags for Tauri bridge, event stream, websocket bridge, and session runtime
- `apps/desktop/src/runtime/effect/layers.ts`
  layer composition for frontend runtime services
- `apps/desktop/src/runtime/effect/runtime.ts`
  app-level Effect runtime/bootstrap helpers
- `apps/desktop/src/runtime/effect/tauri.ts`
  typed Effect wrappers for `invoke`
- `apps/desktop/src/runtime/effect/events.ts`
  typed Effect wrappers for Tauri event streams
- `apps/desktop/src/runtime/effect/ws.ts`
  typed websocket/CDP connection helpers with scoped cleanup
- `apps/desktop/src/runtime/effect/cancellation.ts`
  interruption helpers, timeout policy, lease cancellation utilities

**Modify**

- `apps/desktop/src/stores/devices.store.ts`
  stop owning polling and shift to session-derived device list
- `apps/desktop/src/stores/source.store.ts`
  reduce source ownership to presentation or merge pieces into session store
- `apps/desktop/src/stores/targets.store.ts`
  stop direct target orchestration and consume session snapshots
- `apps/desktop/src/stores/logcat.store.ts`
  start/stop logcat through leased session runtime
- `apps/desktop/src/stores/console.store.ts`
  bind to active target/session events instead of direct watcher fanout
- `apps/desktop/src/composables/useAdb.ts`
  move callers toward typed session commands
- `apps/desktop/src/composables/useAppPackages.ts`
  read cached package snapshots and manual refresh through session APIs
- `apps/desktop/src/composables/useCDP.ts`
  remove transport orchestration watchers and replace with session intents
- `apps/desktop/src/composables/useSessionPersistence.ts`
  keep visual/session selection persistence only
- `apps/desktop/src/components/DeviceManagerModal.vue`
  consume snapshot/manual-refresh model from session store
- `apps/desktop/src/components/layout/TitleBar.vue`
  stop selecting runtime behavior through watcher fanout
- `apps/desktop/src/components/layout/ConnectionSummary.vue`
  render session stale/fresh state from backend snapshots
- `apps/desktop/src/modules/devices/DeviceLogcat.vue`
  route scope-based logcat lease requests through session APIs
- `apps/desktop/src/modules/console/ConsoleOutput.vue`
  route target console lease lifecycle through session APIs
- `apps/desktop/src/modules/console/ConsoleExceptions.vue`
  consume event stream model
- `apps/desktop/src/modules/console/ConsoleRepl.vue`
  bind eval/target state to active hot session
- `apps/desktop/src/types/ipc.types.ts`
  document new command signatures
- `apps/desktop/src/main.ts`
  bootstrap shared runtime error reporting and Effect runtime wiring

### Documentation files

**Modify**

- `docs/ARCHITECTURAL-CHANGES.md`
  execution tracker
- `docs/QUICKREF.md`
  add session runtime rules after implementation stabilizes
- `docs/SPEC.md`
  update architecture section after rollout completes

---

## Execution order

### Phase 0: Contracts and invariants

**Outcome**

- No implementation yet.
- Session vocabulary is fixed.
- Rust and Vue share one event/command language.
- Frontend runtime boundaries for Effect are fixed.

**Files**

- Create: `apps/desktop/src-tauri/src/session/types.rs`
- Create: `apps/desktop/src/types/session.types.ts`
- Modify: `apps/desktop/src/types/ipc.types.ts`
- Modify: `apps/desktop/src/main.ts`
- Modify: `docs/ARCHITECTURAL-CHANGES.md`

**Changes needed**

- Define session lifecycle states:
  - `cold`
  - `warm`
  - `hot`
- Define device connectivity states:
  - `online`
  - `offline`
  - `unauthorized`
  - `stale`
- Define job classes:
  - snapshot
  - mutate
  - lease_start
  - lease_stop
- Define resource scopes:
  - device
  - target
  - package_scope
  - storage_scope
  - mirror
  - perf
  - logcat
- Define job outcome model:
  - completed
  - canceled
  - stale_dropped
  - failed
- Define events:
  - device tracker update
  - session snapshot updated
  - active device changed
  - job started
  - job finished
  - lease state changed
  - runtime error
- Define frontend runtime boundaries:
  - Tauri command boundary
  - Tauri event boundary
  - websocket boundary
  - Vue adapter boundary
- Define frontend error taxonomy:
  - expected rejection
  - domain error
  - runtime defect
  - interruption

**Acceptance criteria**

- One canonical session type model exists in Rust.
- Frontend TS types mirror the Rust payload shape.
- Effect adoption boundaries are documented before migration starts.
- No new implementation proceeds without these contracts.

---

### Phase 1: Rust device tracker and session registry

**Outcome**

- Device presence becomes event-driven.
- `devices.store.ts` stops polling ownership.
- One registry controls all connected device sessions.

**Files**

- Create: `apps/desktop/src-tauri/src/session/registry.rs`
- Create: `apps/desktop/src-tauri/src/session/device_tracker.rs`
- Create: `apps/desktop/src-tauri/src/session/events.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src-tauri/src/commands/adb.rs`
- Create: `apps/desktop/src/stores/session.store.ts`
- Modify: `apps/desktop/src/stores/devices.store.ts`
- Create: `apps/desktop/src/runtime/effect/errors.ts`
- Create: `apps/desktop/src/runtime/effect/tauri.ts`
- Create: `apps/desktop/src/runtime/effect/events.ts`
- Create: `apps/desktop/src/runtime/effect/runtime.ts`

**Changes needed**

- Start a Rust-side `track-devices` worker on app startup.
- Convert device attach/remove/state changes into typed Tauri events.
- Build a global session registry keyed by device serial.
- Add commands:
  - `session_list_devices`
  - `session_get_registry_state`
  - `session_set_active_device`
- Update frontend device list to hydrate from session snapshot plus events.
- Wrap device/session commands and device tracker events behind Effect-based frontend runtime services.
- Remove `setInterval`-driven polling ownership from `devices.store.ts`.

**Acceptance criteria**

- USB/Wi-Fi device attach/remove updates the UI without repeated polling.
- Active device can be switched without starting heavy feature work automatically.
- Device tracker errors surface as typed runtime errors, not crashes.
- Frontend no longer handles device tracker lifecycle with raw polling promises.

---

### Phase 2: Per-device worker and control queue

**Outcome**

- Each device gets one actor-style worker.
- Snapshot jobs coalesce.
- Mutating jobs stay ordered.

**Files**

- Create: `apps/desktop/src-tauri/src/session/device_session.rs`
- Create: `apps/desktop/src-tauri/src/session/job_queue.rs`
- Create: `apps/desktop/src-tauri/src/session/guards.rs`
- Modify: `apps/desktop/src-tauri/src/session/registry.rs`
- Modify: `apps/desktop/src-tauri/src/commands/adb.rs`
- Create: `apps/desktop/src/runtime/effect/cancellation.ts`
- Create: `apps/desktop/src/runtime/effect/tags.ts`
- Create: `apps/desktop/src/runtime/effect/layers.ts`

**Changes needed**

- Add one worker task per known device serial.
- Separate job handling into:
  - serialized control queue
  - leased live runtime handles
- Implement resource-scope job keys.
- Implement duplicate snapshot coalescing.
- Implement cooperative cancellation tokens.
- Implement stale generation checks for non-interruptible work.
- Add online-device guards for device-scoped commands.
- Mirror the same cancellation and interruption model in the frontend runtime layer so command callers can stop waiting cleanly.

**Acceptance criteria**

- Repeated refresh actions do not create unbounded backend backlog.
- Offline device commands fail fast with typed errors.
- A completed stale snapshot never overwrites a newer session snapshot.
- Frontend callers can distinguish interruption from failure.

---

### Phase 3: Cache-only persistence

**Outcome**

- Device session snapshots survive short app restarts.
- Cache is disposable and rebuildable.

**Files**

- Create: `apps/desktop/src-tauri/src/session/cache_store.rs`
- Modify: `apps/desktop/src-tauri/src/session/device_session.rs`
- Modify: `apps/desktop/src-tauri/src/session/registry.rs`
- Modify: `apps/desktop/src/stores/session.store.ts`

**Changes needed**

- Persist cache-only records for:
  - known devices
  - last active device
  - target snapshot
  - package snapshot
  - fetched-at timestamps
  - stale markers
- Add safe schema versioning with drop-and-rebuild behavior.
- Mark restored snapshots stale until refreshed by runtime events or manual actions.

**Acceptance criteria**

- Restarting the app shows last known device snapshots without claiming they are live.
- Clearing the cache does not break the app.
- No UI preference state is moved into Rust here.

---

### Phase 4: Target discovery migration

**Outcome**

- Target refresh stops being watcher-driven.
- Device manager uses snapshot on open plus manual refresh only.

**Files**

- Modify: `apps/desktop/src-tauri/src/commands/port_forward.rs`
- Modify: `apps/desktop/src-tauri/src/commands/cdp_proxy.rs`
- Modify: `apps/desktop/src-tauri/src/session/device_session.rs`
- Modify: `apps/desktop/src/stores/targets.store.ts`
- Modify: `apps/desktop/src/composables/useCDP.ts`
- Modify: `apps/desktop/src/components/DeviceManagerModal.vue`

**Changes needed**

- Add session command:
  - `session_refresh_targets`
- Keep target discovery device-scoped and manual.
- Store target snapshots in Rust session state.
- Emit target snapshot updates to Vue.
- Remove automatic target fetch chains from frontend watchers.
- Keep external DevTools ownership logic, but make it session-aware.

**Acceptance criteria**

- Opening device manager produces one controlled target snapshot, not repeated refresh fanout.
- Manual refresh only refreshes the selected device scope.
- Switching devices does not attach or fetch targets implicitly beyond the allowed light session work.

---

### Phase 5: Package snapshot migration

**Outcome**

- Packages become cached read models.
- Package refresh is explicit and manual.

**Files**

- Modify: `apps/desktop/src-tauri/src/commands/adb.rs`
- Modify: `apps/desktop/src-tauri/src/session/device_session.rs`
- Modify: `apps/desktop/src/composables/useAppPackages.ts`
- Modify: `apps/desktop/src/components/layout/ConnectionSummary.vue`
- Modify: `apps/desktop/src/components/DeviceManagerModal.vue`
- Modify: `apps/desktop/src/modules/devices/AppIcon.vue`

**Changes needed**

- Add session command:
  - `session_refresh_packages`
- Keep package snapshots in Rust cache with fetched-at time.
- Expose package stale/fresh markers to Vue.
- Keep icon resolution lazy and never use icon extraction as a hidden package refresh trigger.
- Remove frontend assumptions that package list should track target changes.

**Acceptance criteria**

- Packages remain visible when stale.
- Package refreshes do not auto-chain off target changes.
- Device manager can render package-related target groups without starting new package scans unless explicitly requested.

---

### Phase 6: Live feature leases

**Outcome**

- Logcat, perf, mirror, and target-attached console become explicit leases.
- Leaving a feature stops its runtime work.

**Files**

- Modify: `apps/desktop/src-tauri/src/commands/adb.rs`
- Modify: `apps/desktop/src-tauri/src/commands/perf.rs`
- Modify: `apps/desktop/src-tauri/src/commands/mirror.rs`
- Modify: `apps/desktop/src-tauri/src/session/device_session.rs`
- Modify: `apps/desktop/src/stores/logcat.store.ts`
- Modify: `apps/desktop/src/stores/console.store.ts`
- Modify: `apps/desktop/src/stores/mirror.store.ts`
- Modify: `apps/desktop/src/modules/devices/DeviceLogcat.vue`
- Modify: `apps/desktop/src/modules/console/ConsoleOutput.vue`
- Modify: `apps/desktop/src/modules/console/ConsoleExceptions.vue`
- Modify: `apps/desktop/src/modules/console/ConsoleRepl.vue`
- Modify: `apps/desktop/src/modules/mirror/useMirrorStream.ts`
- Modify: `apps/desktop/src/stores/connection.store.ts`

**Changes needed**

- Add commands:
  - `session_start_logcat_lease`
  - `session_stop_logcat_lease`
  - `session_start_perf_lease`
  - `session_stop_perf_lease`
  - `session_start_mirror_lease`
  - `session_stop_mirror_lease`
  - `session_attach_console_target`
  - `session_detach_console_target`
- Route live events through typed session event channels.
- Ensure disconnect or active-device change tears down incompatible leases.
- Ensure route/component unmount releases its lease.
- Move the highest-complexity frontend runtime flows to Effect-backed scoped programs.

**Acceptance criteria**

- Leaving logcat stops logcat traffic.
- Leaving perf stops perf traffic.
- Leaving mirror stops mirror runtime work unless explicitly detached and owned elsewhere.
- Only the hot session owns live feature traffic.
- Mirror and connection flows stop relying on ad-hoc timeout and cleanup management.

---

### Phase 7: Frontend cleanup and watcher removal

**Outcome**

- Frontend becomes a consumer of backend session state.
- Accidental orchestration watchers are removed.

**Files**

- Modify: `apps/desktop/src/composables/useCDP.ts`
- Modify: `apps/desktop/src/composables/useSessionPersistence.ts`
- Modify: `apps/desktop/src/stores/source.store.ts`
- Modify: `apps/desktop/src/stores/targets.store.ts`
- Modify: `apps/desktop/src/stores/devices.store.ts`
- Modify: `apps/desktop/src/components/layout/TitleBar.vue`
- Modify: `apps/desktop/src/components/layout/AppShell.vue`

**Changes needed**

- Remove device/target orchestration from frontend watcher chains.
- Keep only visual persistence and view-model assembly in Vue.
- Ensure hot/warm/cold state is rendered but not invented in frontend logic.
- Update title bar and shell to send intents rather than start runtime work directly.

**Acceptance criteria**

- Frontend no longer drives transport policy through incidental watchers.
- Session activation and live feature ownership are explicit intents.
- Transport behavior remains consistent when components remount.

---

### Phase 8: Verification, documentation, and rollout hardening

**Outcome**

- New runtime model is testable, documented, and safe to iterate on.

**Files**

- Modify: `docs/QUICKREF.md`
- Modify: `docs/SPEC.md`
- Modify: `docs/ARCHITECTURAL-CHANGES.md`
- Modify: relevant Rust/TS files touched in earlier phases

**Changes needed**

- Add verification checklist for:
  - device attach/remove
  - active device switching
  - stale snapshot restore
  - target refresh coalescing
  - package refresh coalescing
  - live lease teardown on route exit
  - disconnect during running work
- Update docs to describe:
  - hot/warm/cold sessions
  - snapshot vs live work
  - queue/coalescing rules
  - persistence boundaries
- Keep a short migration journal in this file as implementation progresses.

**Acceptance criteria**

- Team can explain the runtime model from docs alone.
- The app no longer depends on repeated `adb_list_devices` polling for presence.
- Crash surface from stale watcher-driven transport work is materially reduced.

---

## Suggested implementation sequence

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 3
8. Phase 7
9. Phase 8

This order prioritizes runtime control first, then migrates expensive feature paths, then adds cache persistence, then cleans remaining frontend orchestration.

---

## Risks to watch

- Moving too much UI preference state into Rust
- keeping both old stores and new session store authoritative at the same time
- adding event streams without generation checks
- trying to make target discovery always live again
- treating every ADB failure as a fatal condition instead of typed runtime state
- overusing locks inside Rust session workers instead of keeping ownership local

---

## Progress log

- [x] Architecture decisions locked through grill-me discussion.
- [x] Planning document created.
- [x] Phase 0 contracts implemented.
- [x] Phase 1 device tracker implemented.
- [x] Phase 2 per-device worker and queue implemented.
- [x] Phase 3 cache-only persistence implemented.
- [x] Phase 4 target discovery migrated.
- [x] Phase 5 package snapshots migrated.
- [x] Phase 6 live feature leases migrated.
- [x] Phase 7 watcher cleanup completed.
- [x] Phase 8 docs and verification completed.

Current phase 8 implementation status:

- startup, device switch, and target restore flows now run from explicit intents instead of watcher-driven orchestration
- package/icon cache persistence restored and modal target rows now prime package metadata without waiting for the apps tab
- file manager storage parents now expose usable virtual entries for `/storage/self` and `/storage/emulated`
- app-level verification passed for startup restore, device apps package/icon flows, target modal rendering, and file manager storage access
- `docs/QUICKREF.md` and `docs/SPEC.md` now describe real monorepo paths, `vp` workflow, session runtime ownership, lease rules, and validation boundaries
- next execution target is incremental Rust command-file splitting and further hardening, not more watcher architecture work

---

## Phase 8 verification checklist

- [x] device attach/remove updates UI from session snapshots instead of repeated frontend polling
- [x] active device switching works through explicit intent path
- [x] startup restore path reselects saved device cleanly
- [x] target refresh remains manual and scoped
- [x] package refresh remains manual and scoped
- [x] package and icon cache survive reload
- [x] logcat/perf/mirror/console leases tear down on route or ownership exit
- [x] file manager can traverse `/storage/self` and `/storage/emulated`
- [x] external DevTools path no longer attempts invalid synthetic fallback targets
- [ ] automated runtime regression suite exists for session runtime

Verification source:

- in-app validation during phases 6 and 7
- user-confirmed runtime checks for package/icon flows, modal target rendering, startup flow, and file manager storage access
- doc verification and architecture drift cleanup completed in phase 8

---

## Migration journal

- Phase 0 fixed shared session contracts across Rust and TypeScript.
- Phase 1 moved device presence ownership into Rust session registry and tracker.
- Phase 2 added per-device serialized workers and queue/coalescing behavior.
- Phase 3 added cache-only persistence for registry, targets, and packages.
- Phase 4 moved target discovery to explicit session snapshots and manual refresh.
- Phase 5 moved package snapshots to cached session-backed reads with explicit refresh.
- Phase 6 converted logcat, perf, mirror, and console into leases.
- Phase 7 removed remaining watcher-driven transport orchestration from frontend startup/device paths.
- Phase 8 aligned docs with real runtime model and closed validation tracker for this architecture migration.

---

## Execution handoff

Plan complete and saved to `docs/ARCHITECTURAL-CHANGES.md`.

Two execution options:

1. Subagent-Driven (recommended)
2. Inline Execution

If implementation starts, phase 0 and phase 1 should land first before any deeper feature migration.
