# CapuBridge product specification

Status: Active beta specification  
Application version: 1.15.0

## Product goal

CapuBridge is a local-first desktop developer tool for inspecting and controlling Android WebView applications. It combines device operations, Chrome DevTools Protocol inspection, storage tools, screen mirroring, and session recording without requiring users to coordinate separate ADB and browser workflows manually.

## Supported user

Primary users build or debug Android applications that embed a WebView, including Capacitor, Ionic, React Native WebView, NativePHP, and native Android applications.

## Product guarantees

- Production builds do not expose the privileged application WebView for remote debugging.
- Device operations use one managed ADB daemon connection instead of spawning one ADB process per command.
- Rust owns device presence, sessions, leases, ports, command lifecycles, and operational truth.
- Vue owns presentation state and explicit user intent.
- Storage mutations are performed against the real target and are never simulated only in local state.
- Long operations expose success, failure, cancellation, timeout, and disconnect outcomes.
- Lists that can exceed 50 items are virtualized, paginated, streamed, or explicitly bounded.
- A production-visible feature performs a real workflow and declares its maturity.

## Feature maturity

| Level        | Meaning                                                   | Production visibility   |
| ------------ | --------------------------------------------------------- | ----------------------- |
| Stable       | Complete workflow, error states, tests, and documentation | Visible by default      |
| Beta         | Real workflow with documented limitations                 | Visible with beta label |
| Experimental | Real but incomplete or higher-risk workflow               | Explicit opt-in only    |
| Hidden       | Mock, dead, unsafe, or placeholder behavior               | Never visible           |

## Stable and beta capabilities

### Devices

- Discover USB and TCP/IP ADB devices.
- Connect, disconnect, pair, select, inspect, reboot, root, and switch TCP mode where supported.
- List packages, inspect details, launch, stop, clear, and uninstall applications.
- Browse and transfer device files with protected-path failure handling.
- Manage CDP forwards and ADB reverse rules by exact mapping.
- Cancel long scans without waiting for their normal queue position.

### Targets and connections

- Discover debuggable WebView targets through the selected device session.
- Assign and release a distinct forwarded CDP port per device.
- Connect the embedded tooling or open supported targets in external Chrome DevTools.
- Represent target navigation, backgrounding, disconnect, and reconnection explicitly.

### Storage

- Inspect and mutate IndexedDB, Local Storage, Cache API, OPFS, cookies, LocalForage, and supported SQLite data.
- Paginate IndexedDB within protocol limits.
- Virtualize large tables and trees.
- Confirm writes against the target before presenting success.
- Export and import data through validated file operations.

### Inspect and console

- Inspect DOM structure, styles, computed values, and box model.
- Execute JavaScript in the selected target through a typed CDP connection.
- Preserve an explicit connection and disconnect lifecycle.

### Network

- Capture supported HTTP request lifecycles with bounded history and payload retention.
- Show headers, timing, request, response, redirect, and failure data when available.
- WebSocket inspection, throttling, and request mocking remain hidden unless their complete workflow is enabled and tested.

### Mirror

- Start and stop managed screen mirroring.
- Send touch, swipe, scroll, key, text, and clipboard input where supported.
- Capture screenshots and recordings.
- Release stream, decoder, listener, process, forward, and temporary resources on every terminal path.

### Recording and replay

- Record DOM, console, network, performance, and storage-related events supported by the connected target.
- Finalize portable recording artifacts after normal stop, cancellation, or disconnect where recovery is possible.
- Replay partial artifacts safely and report corrupt or unsupported data.
- Use shared read-only presentation primitives instead of importing another module's private UI.

## Hidden capabilities

The following surfaces remain hidden from production until a separate specification and complete implementation exist:

- Mock-only Capacitor plugin, permission, deep-link, configuration, or bridge data.
- Duplicate Hybrid tooling without a distinct workflow.
- Assistant placeholder or AI workflow without a privacy model.
- Network tabs and controls that do not alter or inspect real target behavior.
- Settings that do not affect runtime behavior.

## Architecture constraints

### Frontend modules

Each feature module owns routes, components, composables, services, stores, types, locales, and tests. Modules expose a small public surface to the application shell. A module cannot import another module's internal file.

Shared code is restricted to generic UI primitives, platform contracts, and reusable infrastructure. Domain-specific state remains in the owning module.

### State

- TanStack Query owns cached remote and device data.
- Pinia setup stores own durable domain selection, workflow state, and UI preferences.
- Components own ephemeral presentation state.
- One typed runtime client owns Tauri invokes and event subscriptions.
- Effect is limited to scoped cancellation, retries, resource lifetime, and dependency boundaries where those capabilities provide concrete value.

### Backend

- A session supervisor owns each device lifecycle and work queue.
- Cancellation, stop, disconnect, and health operations can preempt background work.
- Blocking operations have a deadline or cancellation path.
- The shared ADB transport is singular, but unrelated devices are not needlessly serialized.
- Streaming work has explicit start, status, stop, and terminal events.

### Security

- Main application and local preview content are separate trust zones.
- Tauri capabilities are assigned by window and minimum required operation.
- CSP is explicit and deny-by-default.
- URLs, paths, ports, serials, scripts, and expressions are validated at their privilege boundary.
- Diagnostic exports redact secrets and inspected content by default.

## IPC contract

The command contract defines command names, input payloads, result payloads, events, and structured errors from one mechanically verified source.

Every error exposes a stable category:

- Validation
- Cancelled
- Timeout
- Device unavailable
- Transport
- Protocol
- Permission
- Filesystem
- Internal

The frontend uses the category to choose retry, recovery guidance, or terminal messaging. Technical context must not replace the safe user-facing message.

## Quality and release gates

- `vp check` passes.
- Desktop, package, and Rust tests run through the root Vite+ task graph.
- Module dependency checks pass.
- Application versions match root `package.json`.
- Production security configuration tests pass.
- Critical session transitions and cleanup paths have deterministic tests.
- No production mock, dead route, no-op control, untyped invoke, silent operational catch, or indefinite blocking receive remains.
- The release tag is annotated and exactly matches the canonical version.

## Non-goals

- Cloud accounts or remote device sharing before local security is complete.
- AI features before data handling and privacy are specified.
- iOS inspection before a WebKit transport and lifecycle specification exists.
- A big-bang rewrite of Vue, Rust, Tauri, Pinia, TanStack Query, or the ADB transport.
