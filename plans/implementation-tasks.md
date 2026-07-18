# CapuBridge Enhancement Implementation Tasks

Branch: `ayoub/enhancement-architecture-hardening`  
Source: `plans/architecture-hardening-and-modularization.md`

## Status legend

- `ACTIVE`: assigned in the current parallel implementation wave.
- `READY`: independent or its prerequisite is already being implemented.
- `BLOCKED`: must wait for a named contract or migration.
- `DEFERRED`: intentionally left for a later wave with its remaining scope recorded.
- `DONE`: implementation and permitted validation completed.

## Stream A: Security and trust boundaries

| Task   | Status | Deliverable                                                                | Depends on       | Exit gate                                           |
| ------ | ------ | -------------------------------------------------------------------------- | ---------------- | --------------------------------------------------- |
| SEC-01 | DONE   | Remove production privileged-WebView remote debugging and wildcard origins | None             | Production config contains neither exposure         |
| SEC-02 | DONE   | Add explicit production CSP with development-safe policy                   | SEC-01           | Policy test blocks unapproved script and connection |
| SEC-03 | DONE   | Split Tauri capabilities by window and privilege                           | SEC-01           | Preview cannot invoke privileged operations         |
| SEC-04 | DONE   | Validate preview URLs, navigation, and external opening                    | SEC-03           | Invalid schemes and origins fail safely             |
| SEC-05 | DONE   | Add security configuration regression tests                                | SEC-01 to SEC-04 | Tests run in root quality graph                     |

## Stream B: Device runtime and correctness

| Task   | Status | Deliverable                                                     | Depends on | Exit gate                                            |
| ------ | ------ | --------------------------------------------------------------- | ---------- | ---------------------------------------------------- |
| DEV-01 | DONE   | Remove exactly one selected ADB reverse mapping                 | None       | Unrelated mappings survive regression test           |
| DEV-02 | DONE   | Make package scan cancellation out-of-band                      | None       | Cancel acknowledged while scan remains active        |
| DEV-03 | DONE   | Add bounded worker receives and terminal timeout state          | DEV-02     | No indefinite worker receive path                    |
| DEV-04 | DONE   | Deterministic worker, listener, forward, and port cleanup       | DEV-03     | Repeated connect/disconnect leaks nothing observable |
| DEV-05 | DONE   | Add command priorities and bounded per-device queues            | DEV-02     | Stop/cancel/disconnect preempt background work       |
| DEV-06 | DONE   | Reduce global ADB lock hold time without spawning ADB processes | DEV-05     | Multi-device latency meets recorded budget           |
| DEV-07 | DONE   | Emit typed session health and queue telemetry                   | IPC-01     | UI receives stable health events                     |

## Stream C: Frontend modules and product truth

| Task    | Status   | Deliverable                                                     | Depends on     | Exit gate                                              |
| ------- | -------- | --------------------------------------------------------------- | -------------- | ------------------------------------------------------ |
| MOD-01  | DONE     | Declarative application module and route registry               | None           | Shell composes routes through public module surfaces   |
| MOD-02  | DONE     | Stable, beta, experimental, and hidden feature metadata         | MOD-01         | Navigation and commands use one registry               |
| PROD-01 | DONE     | Hide mock Capacitor, dead Hybrid, assistant, and no-op surfaces | MOD-02         | Production exposes no mock or placeholder route        |
| PROD-02 | DONE     | Correct system, light, and dark theme behavior                  | None           | Mode and persistence tests pass                        |
| MOD-03  | DONE     | Migrate Devices route and public API boundary                   | MOD-01, IPC-01 | No module imports Devices internals                    |
| MOD-04  | DEFERRED | Migrate Storage feature boundary                                | MOD-03, IPC-02 | Storage owns routes, state, services, types, and tests |
| MOD-05  | DEFERRED | Migrate Inspect and Network boundaries                          | MOD-03, CDP-01 | Independent public APIs and bounded streams            |
| MOD-06  | DONE     | Migrate Mirror and Recording/Replay boundaries                  | MOD-03, DEV-04 | Independent lifecycles and shared generic viewers      |
| PROD-03 | DONE     | Make Settings and shortcut behavior truthful                    | MOD-02         | Every visible setting and shortcut has real effect     |

## Stream D: Quality, release, contracts, and governance

| Task    | Status   | Deliverable                                               | Depends on       | Exit gate                                                         |
| ------- | -------- | --------------------------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| QUAL-01 | DONE     | Include desktop tests in recursive Vite+ tasks            | None             | Root test graph lists desktop suite                               |
| QUAL-02 | DONE     | Add Rust tests to a Vite+ task                            | None             | Root test graph runs Rust suite                                   |
| QUAL-03 | DONE     | Add CI quality dependency before desktop builds/releases  | QUAL-01, QUAL-02 | Build jobs cannot start after failed checks                       |
| REL-01  | DONE     | Synchronize application versions and enforce drift check  | None             | Root, desktop, Cargo, Tauri, README, and tag agree                |
| REL-02  | DONE     | Correct annotated-tag and release-note workflow           | REL-01           | Release dry run identifies matching tag                           |
| GOV-01  | DONE     | Enforce module boundaries with migration baseline         | None             | New cross-module imports fail immediately                         |
| GOV-02  | DONE     | Correct package metadata and add license                  | None             | Metadata and repository license agree                             |
| IPC-01  | DONE     | Define canonical typed command, event, and error contract | DEV-01, SEC-03   | Registration and TypeScript shapes are mechanically checked       |
| IPC-02  | DONE     | Route every invoke and event through typed runtime client | IPC-01           | Zero untyped invokes and direct component invokes                 |
| IPC-03  | DEFERRED | Replace opaque string errors with structured families     | IPC-01           | UI distinguishes validation, cancel, timeout, transport, internal |
| EFF-01  | DONE     | Consolidate duplicate Effect session layers               | IPC-02           | One runtime boundary remains                                      |
| CDP-01  | DONE     | Rename `utils` to a product CDP protocol package          | QUAL-03          | Imports, metadata, exports, build, and tests agree                |
| DOC-01  | DONE     | Create maintained product specification and ADR set       | MOD-02, IPC-01   | Docs describe executable behavior and ownership                   |
| DOC-02  | DONE     | Repair Vite+, release, module, and session guidance       | QUAL-03          | No stale or unsupported command remains                           |

## Stream E: Data scale, resilience, and release gate

| Task     | Status   | Deliverable                                                | Depends on        | Exit gate                                                |
| -------- | -------- | ---------------------------------------------------------- | ----------------- | -------------------------------------------------------- |
| DATA-01  | DONE     | Paginate IndexedDB within protocol limits                  | MOD-04            | No request exceeds protocol maximum                      |
| DATA-02  | DONE     | Virtualize every list that can exceed 50 items             | MOD-04, MOD-05    | Static inventory contains no exception without rationale |
| DATA-03  | DONE     | Bound network, frame, event, log, and cache retention      | MOD-05, MOD-06    | Sustained-session memory stays within budget             |
| MIR-01   | DONE     | Split mirror transport, decoding, input, state, and UI     | MOD-06            | Explicit tested stream state machine                     |
| REC-01   | DONE     | Harden recording/replay finalization and partial artifacts | MOD-06            | Stop, cancel, disconnect, and corrupt replay are tested  |
| ERR-01   | DONE     | Eliminate operational empty catches by capability          | IPC-03            | Zero silent operational failure paths                    |
| PERF-01  | DEFERRED | Record startup, queue, stream, memory, and cleanup budgets | DEV-07, DATA-03   | Representative hardware measurements documented          |
| OBS-01   | DEFERRED | Add privacy-safe local diagnostics export                  | DEV-07, IPC-03    | Export redacts secrets and reconstructs terminal reason  |
| SIZE-01  | DONE     | Split oversized files or approve narrow exceptions         | Module migrations | Every oversized file has one owner and rationale         |
| FINAL-01 | BLOCKED  | Run full readiness and close audit matrix                  | All tasks         | Every audit finding is done or explicitly deferred       |

## Parallel ownership rule

Streams own disjoint files during a wave. Cross-stream contract changes land through a narrow public file, then dependent streams rebase their local assumptions against the shared worktree. No stream creates branches, stages, commits, builds, or launches development servers.
