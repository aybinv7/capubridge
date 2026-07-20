# CapuBridge MCP Server — Design

Status: Approved design, implementation in progress
Date: 2026-07-20
Branch: `feat/mcp-server`
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

### Phase 2 — CDP read tools (next increment)

Requires a small, self-contained Rust CDP client (open the target's
`web_socket_debugger_url` via `tokio-tungstenite`, as `cdp_proxy.rs` already does; send a
JSON command; await the matching `id`). `evaluate_js` is the foundational primitive;
storage reads are expressed on top of it (matching CLAUDE.md's Runtime.evaluate pattern) or
via CDP storage domains later.

- `evaluate_js` (gated), `read_storage` (IndexedDB/LocalStorage/cookies, paginated),
  `read_console`, `read_network`.

### Phase 3 — gated writes & mirror/recording

- `write_storage` / `delete_storage`, `clear_app_data`, `launch_app` / `stop_app` /
  `uninstall_app`, `reboot` (all destructive + `confirm: true`).
- `screenshot`, mirror input, recording start/stop.

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

```

```
