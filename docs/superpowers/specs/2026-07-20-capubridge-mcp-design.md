# CapuBridge MCP Server — Design

Status: Shipped (v2.0.0) — Phases 1 and 2 complete, plus device control (originally
scoped as part of Phase 3) and a `click_element` tool added beyond the original design.
Remaining Phase 3 items (state-mutating storage/app-lifecycle tools, mirror/recording)
are not yet built — see "Remaining / future work" below.
Date: 2026-07-20 (design) — 2026-07-21 (shipped)
Branch: `feat/mcp-server` (merged to `master`)
Author: brainstormed with Claude Code

## Summary

Expose CapuBridge's device / CDP / storage capabilities to AI assistants through an
embedded [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. The
server runs **inside the Tauri backend** (Rust) on `rmcp` (the official Rust MCP SDK),
served over **localhost HTTP (Streamable HTTP transport)**. MCP tools call the same core
`SessionRegistry` / `DeviceSession` methods the existing `#[tauri::command]` wrappers call,
so there is a single source of operational truth and no reimplementation.

## Goals

- Let an MCP client (Claude Code, Claude Desktop, Cursor, …) drive CapuBridge's real
  capabilities against the device/target the user already has selected.
- Reuse the existing Rust backend logic — zero duplication of ADB/CDP/session logic.
- Ship safely: opt-in, localhost-only, token-gated, with read-vs-destructive tiering.

## Non-goals

- No standalone MCP process that reimplements ADB/CDP (rejected — duplicates logic,
  diverges from the session model).
- No cross-language bridge / second process (rejected — a bridge exists only to run a
  different-language server; we don't need that, so it is pure cost).
- No cloud, remote, or multi-user access. Localhost only.
- Not every capability in v1. Phased surface (see below).

## Why embedded Rust + rmcp over HTTP/SSE (decision record)

Considered three shapes:

1. **Standalone MCP** — reimplement ADB/CDP in a separate process. Rejected: duplicates
   the Rust backend, diverges from the session model.
2. **TS bridge process** — separate Node MCP server over a localhost socket to the app.
   Rejected: performance is a non-differentiator here (I/O-bound, conversational rate,
   dominated by ADB/CDP round-trip latency), so the only argument for TS was SDK
   maturity / team stack — not a sound reason to add a process boundary, a hand-maintained
   cross-language JSON-RPC contract, a discovery/token handshake, and version-skew risk.
3. **Embedded Rust + rmcp (chosen)** — MCP server lives in the Tauri backend and calls the
   session registry **in-process**. One process, one language, no cross-language contract,
   native access to live session state. Aligns with the SPEC's "one mechanically verified
   source" IPC principle and "Rust owns operational truth."

Trade-off accepted: an embedded server can't be a stdio child spawned by the MCP client
(the app is a long-running GUI), so the transport is **Streamable HTTP** on localhost. All
current MCP clients support HTTP transport; the app is already running, so there is nothing
to spawn.

### rmcp capability verification (done during design)

- `transport-streamable-http-server` feature provides `StreamableHttpService`, a Tower
  service that mounts into the app's existing `axum 0.8` + `tower` stack.
- `StreamableHttpServerConfig` supports `with_allowed_hosts` / `with_allowed_origins` — the
  localhost lockdown our security model needs.
- `#[tool_router]` / `#[tool]` macros define tools from typed structs and support
  `read_only_hint` / destructive annotations — the mechanism for our safety tiering.

## Architecture

```
MCP client (Claude Code / Desktop / Cursor)
   │  Streamable HTTP (MCP), bearer token
   ▼
axum router on 127.0.0.1:<ephemeral>        ← new: mcp module in the Tauri backend
   ├─ auth layer (bearer token, host/origin allowlist = localhost only)
   └─ rmcp StreamableHttpService  →  #[tool_router] CapuBridgeTools
                                        │  in-process calls (Arc<SessionRegistry>, AppHandle)
                                        ▼
                              SessionRegistry / DeviceSession   (unchanged)
                                        ▼
                                   ADB / CDP / storage
```

### Module layout (Rust)

```
src-tauri/src/mcp/
  mod.rs          # public surface: McpServerState, start/stop, status
  server.rs       # axum router + rmcp StreamableHttpService wiring, bind + shutdown
  auth.rs         # per-launch token, bearer check, host/origin allowlist
  discovery.rs    # write/remove %APPDATA%/capubridge/bridge.json {port, token, pid, version}
  tools.rs        # #[tool_router] CapuBridgeTools — the MCP tool surface
  types.rs        # tool input/output structs (serde + schemars::JsonSchema)
```

- `McpServerState` is a Tauri-managed struct (like `MockServerManager`) holding the running
  server handle, bound port, and token. Registered in `lib.rs` `.manage(...)`.
- The MCP tools hold `Arc<SessionRegistry>` (from `SessionRegistryState::registry()`) and an
  `AppHandle` clone, so they call the exact same methods as the command layer.

### Control surface (Tauri commands, for the app UI)

- `mcp_get_status` → `{ enabled, running, port, connected_clients }`
- `mcp_set_enabled(enabled: bool)` → starts/stops the server, writes/removes the discovery
  file, returns status.

These back a **Settings toggle** (off by default) and an **active-connection indicator**.

## Security & consent model

The SPEC lists "AI workflow without a privacy model" as _hidden until specified_. This is
that model:

- **Off by default.** No server bound, no discovery file written, until the user enables MCP
  access in Settings.
- **Localhost only.** Bind `127.0.0.1` on an ephemeral port. `StreamableHttpServerConfig`
  host/origin allowlist rejects non-localhost `Host`/`Origin`.
- **Token-gated.** A cryptographically random token is generated per app launch. Every MCP
  request must present `Authorization: Bearer <token>`. Requests without it → 401.
- **Discovery file.** On enable, write `%APPDATA%\capubridge\bridge.json`
  (`{ port, token, pid, version }`, user-readable only) so the user can copy the URL+token
  into their MCP client config. Removed on disable / app exit.
- **Active-connection UI.** The app surfaces when an MCP client is connected.
- **Safety tiering.** Read tools carry `read_only_hint`. Mutating/destructive tools
  (storage writes, `clear`, `uninstall`, `reboot`, `evaluate_js`) carry a destructive
  annotation **and** require an explicit `confirm: true` argument; without it the tool
  returns an error describing the action instead of performing it.

## Tool surface (phased)

### Phase 1 — tracer bullet (this increment): infra + session/device read tools

Proves the whole pipe (MCP client → HTTP/SSE → rmcp → registry → response) with real data,
using only trivial, safe, already-extracted registry calls.

| Tool                 | Backend call                                                      | Kind                           |
| -------------------- | ----------------------------------------------------------------- | ------------------------------ |
| `get_active_session` | `registry.snapshot()` (active serial + tracker + selected target) | read                           |
| `list_devices`       | `registry.list_devices()`                                         | read                           |
| `list_targets`       | `session.list_targets()` for a serial                             | read                           |
| `select_device`      | `registry.set_active_serial(...)`                                 | state change (non-destructive) |

Plus infra: `mcp` module, axum + `StreamableHttpService` wiring, auth, discovery file,
`McpServerState`, control commands, Settings toggle + indicator.

### Phase 2 — CDP read tools (shipped)

Built the planned self-contained Rust CDP client (`mcp/cdp.rs`): a one-shot
connect/send/await-matching-`id` client (`call`/`evaluate`) for request-response CDP calls,
plus a second, persistent-connection path (`mcp/capture.rs`) for CDP _events_
(console/network don't fit a request-response model — they're unsolicited notifications
over a long-lived connection).

- `evaluate_js` (gated) — the foundational primitive; `read_storage` is expressed on top of
  it via injected JS (`local_storage_script`, `session_storage_script`,
  `indexeddb_databases_script`, `indexeddb_store_script` — cursor-paginated, not the CDP
  IndexedDB domain).
- `read_console` / `read_network` — backed by `CaptureRegistry`: one background loop per
  target enables `Log`/`Runtime`/`Network` and buffers events into bounded (200-entry) ring
  buffers. Capture starts lazily on first call for a target; that first call waits up to
  ~500ms for initial data before returning, so it isn't guaranteed-empty.

### Phase 3 — device control (shipped, read/interact tier only)

Originally scoped as "gated writes & mirror/recording." What shipped is the device
**interaction** tier — everything needed to see the screen and drive it — reusing existing
session/mirror logic with no new ADB plumbing:

- `list_packages`, `launch_app`, `take_screenshot` (writes to a temp file by default —
  inline base64 blew the token budget on typical screenshots — `inline: true` opts back in),
  `get_screen_size`.
- `tap` / `swipe` — go through the device's managed shell-command queue
  (`adb shell input ...`), validated against `get_screen_size` bounds first (an
  out-of-bounds tap/swipe is silently dropped by the device with no error otherwise).
- `input_text` / `press_key` — same queue; `input_text` is POSIX-shell-quoted
  (`device_control::shell_quote`) so free-text input can't break out into a second shell
  command.
- `shell_command` — arbitrary command via the same queue. Explicit, asked-for choice
  alongside the bounded primitives above, despite the risk; flagged high-risk in its
  description.
- `click_element` (added beyond the original design, from live-testing feedback) — finds a
  DOM element by CSS selector and/or visible text and dispatches a synthetic
  pointer/mouse-click sequence on it via CDP. More reliable than `tap` for WebView UI: it
  either finds the exact element or reports `found: false`, instead of a screen coordinate
  that can silently miss.

**Not shipped from the original Phase 3 scope** (see "Remaining / future work"):
`write_storage`/`delete_storage`, `clear_app_data`, `stop_app`/`uninstall_app`, `reboot`
(exposing the `mcp` tool), mirror video/recording tools.

## Single source of truth

Confirmed by reading `session/registry.rs`: the `#[tauri::command]` functions are thin
wrappers over `SessionRegistry` / `DeviceSession` methods. The MCP tools call those same
methods. No command logic is duplicated. If a Phase 2/3 tool needs logic currently living
inside a command body (not on the registry), that body is first extracted into a plain
`fn`/method that both the command and the tool call.

## Error handling

Tool handlers map `Result<_, AppError>` / `Result<_, String>` into MCP tool errors with a
stable message. The existing `AppError` categories (Validation, Cancelled, Timeout, Device
unavailable, Transport, Protocol, Permission, Filesystem, Internal) are surfaced in the tool
error text so the AI can reason about retry vs terminal. Safe user-facing message is
preserved; raw internal context is not leaked.

## Testing

- **auth.rs**: token generation is non-empty/unique; bearer check accepts the real token,
  rejects missing/wrong tokens; host/origin allowlist rejects non-localhost.
- **discovery.rs**: writes valid JSON with the bound port+token; removes the file on disable.
- **tools.rs**: each Phase 1 tool against a `SessionRegistry` seeded with fake devices
  returns the expected shape; `select_device` on an unknown serial errors.
- **server.rs**: start binds a localhost port and reports it in status; stop releases it.
- **smoke**: an MCP `initialize` + `tools/list` over the bound HTTP endpoint with the token
  returns the Phase 1 tool list (guarded so it does not require a device).

Validation runs through `vp check` and the root Vite+ Rust test task.

## Risks / open questions

- `rmcp` is younger than the TS SDK; pin a known-good version and keep the tool surface
  within documented macro features. (Transport + macros verified during design.)
- Streamable HTTP session/statefulness: start with `with_stateful_mode` per rmcp defaults;
  revisit if a client needs stateless.
- Discovery-file location on macOS/Linux differs from Windows (`%APPDATA%`); use Tauri's
  app-config dir resolver rather than hardcoding. (Windows is the current dev target.)

## Shipped tool surface (v2.0.0)

16 tools across four groups:

| Group          | Tools                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Session/device | `get_active_session`, `list_devices`, `list_targets`, `select_device`                                                           |
| Web/CDP (read) | `read_storage`, `read_console`, `read_network`                                                                                  |
| Web/CDP (act)  | `evaluate_js`, `click_element`                                                                                                  |
| Device control | `list_packages`, `launch_app`, `take_screenshot`, `get_screen_size`, `tap`, `swipe`, `input_text`, `press_key`, `shell_command` |

Every mutating/physical-effect tool (`select_device` excepted — a non-destructive state
change) requires `confirm: true`; without it the call fails with an explanation instead of
performing the action. Bugs found and fixed during live testing along the way:
`structuredContent` must be a JSON object per the MCP spec (array payloads only appear in
the text block now); `list_targets` was reading a cache nothing ever populated headlessly
(now calls `refresh_targets()` directly); `launch_app` misclassified Android's benign
"brought to front" warning as a failure; `tap`/`swipe` now reject out-of-bounds coordinates
instead of silently no-op'ing.

## Remaining / future work

- **Phase 3 writes**: `write_storage`/`delete_storage`, `clear_app_data`,
  `stop_app`/`uninstall_app`, `reboot`. None of the underlying ADB operations exist in the
  Rust backend yet (confirmed by search) — each needs new plumbing, not just a tool wrapper,
  unlike everything shipped so far which reused existing session/mirror logic.
- **Mirror/recording tools**: screen-video and session-recording control were in the
  original Phase 3 scope; not started.
- **SQLite query path for Capacitor apps**: live testing found `CapacitorSQLite.query()`
  fails with "No available connection for database" when called via `evaluate_js` — the
  app's own SQLite connection isn't reusable from outside, and `CapacitorSQLite.isConnection()`
  isn't implemented on Android at all. This is a plugin/architecture gap, not a bug in this
  server; fixing it would need either an in-app debug bridge or a documented
  connection-reopen convention. Not attempted — no way to verify a fix without a live device
  and app in front of us.
- **`structuredContent` for array-returning tools**: `list_devices`, `list_targets`,
  `list_packages`, `read_console`, `read_network` currently return their array only in the
  text content block (`structuredContent` is spec'd as object-only, so it's omitted for
  these). Wrapping each array in a named field (e.g. `{ "devices": [...] }`) would let
  `structuredContent` populate for these tools too, improving compatibility with MCP clients
  that specifically consume structured output. Deliberately not done during the bug-fixing
  session — it would change an already-shipped, already-tested response shape without being
  asked for, which is exactly the kind of unrequested churn to avoid. Worth doing later as
  its own scoped change if a client actually needs it.
- **Stale port convention in `CLAUDE.md`**: it documents a fixed CDP port scheme ("Device 1 →
  9222"); live testing observed dynamic forwarded ports (53972, 60883, ...). Should be
  corrected so future agents don't waste a round-trip guessing port 9222.
