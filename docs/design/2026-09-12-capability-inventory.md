# Capubridge capability inventory

12 September 2026 · Source-based design discovery

This inventory covers the capability families found in the product specification, Rust command surface, IPC contracts, CDP adapters, and MCP catalog. It does not claim every control is exposed, tested, or stable. No current UI implementation or visuals were inspected. Uncommitted source additions were visible during discovery and are not assumed released.

Evidence labels: **Specified** means documented in the active specification; **Code** means a command, adapter, or typed contract was inspected; **Conditional** requires a supported target or environment; **Experimental/hidden** follows the product specification; **Proposed** means new UX or functionality.

| Capability family                | Discovered scope                                                                                                 | Evidence and qualification                                                                           | Proposed home                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Physical connections             | USB discovery, TCP/IP connect/disconnect, wireless pair, device identity                                         | Specified + Code: `commands/adb.rs`, `contracts/device.ts`                                           | Connect                             |
| Session management               | Active device, cached snapshots, offline state, cancellation, leases, per-device queues                          | Specified: SPEC and QUICKREF; Code: session contracts                                                | Persistent context and Tasks        |
| Android emulators                | List installed AVDs, launch AVD, distinguish emulator/device                                                     | Code: `commands/emulator.rs`, MCP emulator tools; environment conditional                            | Connect                             |
| Local browser/runtime            | Chrome discovery/launch/port verification, target list/open/activate, local WebView navigation and target access | Code: `commands/chrome.rs`, `commands/local_webview.rs`, connection contracts; exposure not verified | Connect source choices              |
| Device operations                | Reboot modes, root where supported, restart/start ADB, TCP mode                                                  | Specified + Code: `commands/adb.rs`                                                                  | Device details                      |
| Applications                     | Package list/scope, metadata, icons, launch; stop/clear/uninstall specified                                      | Code for list/details/launch; remaining operations not independently traced through the shell path   | Apps                                |
| Targets                          | WebView socket discovery, CDP forwarding, attach/proxy, external Chrome DevTools                                 | Specified + Code: connection contracts, port_forward and cdp_proxy commands                          | Context selector                    |
| Ports                            | CDP forwards, ADB reverse rules, exact removal                                                                   | Specified + Code: adb and port_forward commands                                                      | Ports                               |
| Device shell                     | Arbitrary scoped command execution                                                                               | Code: adb shell command and MCP tool; mutating/high-risk operation                                   | Shell                               |
| Device files                     | Directory list, read, pull, open, picker, delete, reveal on host; protected path handling                        | Code: `commands/files.rs`; generic upload not independently verified                                 | Files                               |
| Native logs                      | Start/stop Logcat, tag/level filtering per README                                                                | Specified + Code command surface; high-throughput live collection                                    | Logcat/main or dock                 |
| Native performance               | Process CPU, memory, network metrics, start/stop lifecycle                                                       | README + Code: `commands/perf.rs`                                                                    | Performance                         |
| DOM                              | Tree, attributes, HTML, location picking, box model, edits, removal, scroll into view                            | Specified + Code: CDP `dom.ts` and `overlay.ts`                                                      | Elements                            |
| CSS                              | Matched/inline/computed styles, rule and stylesheet operations                                                   | Code: CDP `css.ts`                                                                                   | Elements details                    |
| JavaScript console               | Evaluate expressions, console capture, explicit target lifecycle                                                 | Specified + MCP Code                                                                                 | Console/main or dock                |
| Framework DevTools               | Official Vue/React component inspection; capabilities depend on target build                                     | README + framework-devtools documentation; no frontend inspected                                     | Detected tools under Inspect        |
| HTTP                             | Request lifecycle, headers, payload, response, timing, redirects, errors, bounded capture                        | Specified + Code: CDP network adapter and MCP web tools; WebView scope, native HTTP not guaranteed   | Network                             |
| Advanced network                 | WebSocket protocol events, Fetch interception, local mock server                                                 | Code exists; SPEC keeps incomplete WebSocket/throttling/mocking workflows hidden or opt-in           | Network only when ready             |
| IndexedDB                        | Database/store discovery, paged records, edits/deletes, real target writes                                       | Specified + Code adapter; use protocol pagination                                                    | Storage / Browser                   |
| Local and session storage        | Key/value reads; localStorage writes/deletes; sessionStorage read via MCP                                        | Code adapters + MCP read_storage; full sessionStorage UI/edit path not verified                      | Storage / Browser                   |
| Cookies                          | Inspection/mutation included in storage specification                                                            | Specified; adapter/UI completeness not independently checked                                         | Storage / Browser                   |
| Cache API                        | Cache list, request entries, sizes, delete cache/entry                                                           | Specified + Code: `storage.ts`                                                                       | Storage / Browser                   |
| OPFS                             | Directory list, file bytes, size, deletion, SQLite discovery/probing/extraction                                  | Specified + Code: OPFS adapter and uncommitted opfs_pull; recent changes not assumed released        | Storage / Browser                   |
| LocalForage                      | Origins/entries, set/delete supported data                                                                       | Specified + Code: `localforage.ts`                                                                   | Storage adapter                     |
| Native SQLite                    | Discover/scan/stat, pull/open, tables, schema, indexes, foreign keys, paged rows, query, refresh, close          | Code: `commands/sqlite.rs`; app/path access conditional                                              | Storage / Device databases          |
| SQLite local files               | Save/import bytes, overwrite bytes, export, execute writes against local path                                    | Code: `commands/sqlite.rs`; native write command does not itself establish device write-back         | Storage / Imported or snapshot      |
| Browser-backed SQLite            | OPFS variants, SAH pool, wa-sqlite, jeep-sqlite descriptors and byte reads                                       | Code: sqlite types, OPFS and jeep adapters; dirty working-tree additions present                     | Storage / Browser with source badge |
| Screen interaction               | scrcpy mirror, screen size, tap/swipe/touch/scroll, keys/text, clipboard, detach per README                      | Specified + Code: `commands/mirror.rs`                                                               | Mirror companion or full pane       |
| Media capture                    | Screenshot and screen recording                                                                                  | Specified + Code: mirror commands; distinct from replay session recording                            | Mirror actions                      |
| Session recording                | DOM/rrweb, network, console; optional performance/database tracks; start/append/stop/finalize                    | Specified + Code: recording commands and MCP frontend tools                                          | Global session capture action       |
| Recording library                | List/read/delete sessions, orphan cleanup, partial artifact support, export preview/export                       | Specified + Code: recording and export commands                                                      | Recordings                          |
| Recorded database evidence       | Snapshot pages, sources, rows, changed rows, summaries, changes for keys                                         | Code: `commands/recording_db.rs`; MCP database-at-time reads                                         | Replay / Database                   |
| Cross-track queries              | Filter by time, network fields, console level; page results; correlate nearby track events                       | Code: MCP `query_recording`; unified visual evidence links are Proposed                              | Replay evidence panel               |
| MCP                              | 30 named tools; local server enable/status, token, mutation mode                                                 | SPEC + Code: MCP tools and `mcp.types.ts`; off/read-only defaults                                    | Automation                          |
| Updates                          | Update checks, install, stable/pre-release channels per README                                                   | Code: updater commands; app settings utility                                                         | Settings                            |
| Hybrid/Capacitor-specific panels | Plugins, permissions, deep links, configuration, bridge data                                                     | SPEC explicitly hides mock-only surfaces; generic JS access does not prove a finished dedicated tool | No primary destination until real   |
| Integrated AI chat               | Contextual explanation and suggested investigations                                                              | Proposed; embedded MCP is not a verified chat UI                                                     | Optional future companion           |
| Automation history/approvals     | Caller trace, per-action review, revoke/cancel, evidence attachments                                             | Proposed; current MCP status does not establish these contracts                                      | Future Automation                   |

## MCP catalog

The 30 tool names match the inspected Rust tool attributes and frontend type catalog:

- Session: `get_active_session`, `list_devices`, `list_targets`, `select_device`.
- Emulator: `list_emulators`, `launch_emulator`.
- Device: `list_packages`, `launch_app`, `take_screenshot`, `get_screen_size`, `tap`, `swipe`, `input_text`, `press_key`, `shell_command`.
- Web: `evaluate_js`, `click_element`, `long_press`, `read_storage`, `read_console`, `read_network`.
- Frontend bridge: `select_target`, `start_recording`, `stop_recording`, `get_recording_status`.
- Recorded evidence: `list_recordings`, `read_recording`, `read_recording_track`, `read_recording_db`, `query_recording`.

Capture may begin on first read and is bounded. Background Android applications may stop answering CDP. Recording control through the frontend bridge requires the app window and a selected connected target. Mutation intent fields are not proof of human approval.

## Repository evidence

- [Product specification](../../apps/docs/SPEC.md)
- [Product README](../../README.md)
- [Runtime quick reference](../../apps/docs/QUICKREF.md)
- [Framework capabilities](../../apps/docs/framework-devtools.md)
- [IPC contracts](../../apps/desktop/src/runtime/ipc/contracts)
- [Rust commands](../../apps/desktop/src-tauri/src/commands)
- [MCP tool definitions](../../apps/desktop/src-tauri/src/mcp/tools)
- [MCP types and catalog](../../apps/desktop/src/types/mcp.types.ts)
- [SQLite source types](../../apps/desktop/src/types/sqlite.types.ts)
- [CDP adapters](../../packages/cdp-protocol/src/cdp/domains)

All relative links resolve from this inventory. The design direction deliberately separates specified capabilities, source-backed behavior, conditional access, hidden work, and proposed additions.
