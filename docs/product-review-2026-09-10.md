# Capubridge product and engineering review

Reviewed September 9–10, 2026. Source: commit 1a5ff59, version 2.4.4. The working tree was clean before this report. No application source was changed.

## Verdict

Capubridge addresses a real problem: debugging Android WebView applications requires moving between device controls, browser inspection, storage, and evidence captured during reproduction. The implementation contains substantial engineering and useful workflows. It is worth continuing.

My current overall assessment is **5.5/10**, with **8/10 product potential** for a focused Android WebView debugging tool. These are judgment scores, not measured reliability percentages or predictions of commercial success. The strongest opportunity is diagnosing stateful and offline application failures through storage inspection, synchronized recording, and AI-accessible evidence. The weakest areas are lifecycle correctness, accurate feature promises, and release discipline.

I would keep the product in beta and prioritize stabilization before broadening platform coverage or investing further in a general component library. A debugger must be trustworthy: showing an incorrect value, reporting a write that does not reach the intended target, or losing the recording of a rare failure is especially damaging.

## Scope and evidence

The review inspected feature registration and routes, representative screen components, shared state and IPC, CDP adapters, session scheduling, ADB integration, recording/replay, MCP, update handling, packaging scripts, documentation, and GitHub workflows. All 13 checked-in marketing screenshots were visually inspected. They are dated April 28, 2026 and do not establish the appearance or behavior of the September build.

This was a broad source audit with targeted in-memory reproductions, not a line-by-line certification of every source file. No dev server, app build, Rust compilation, installer, or connected-device operation was started. Current rendered UI, real-device compatibility, performance under sustained load, and installer behavior remain unverified. Missing local Vue/Pinia skills were replaced with official documentation as review guidance.

Validation completed:

| Check                   | Result         | Meaning                                                                                  |
| ----------------------- | -------------- | ---------------------------------------------------------------------------------------- |
| vp check                | Passed         | 1,012 files formatted; no lint/type errors in 873 files                                  |
| Workspace tests         | 303 passed     | 174 desktop, 126 UI-package, 3 CDP-package tests; the CDP result was replayed from cache |
| Module boundaries       | Passed, cached | Checker reports zero migration exceptions within its scan scope                          |
| Direct IPC boundary     | Passed, cached | Direct invoke/listen imports are isolated to the adapter                                 |
| Silent-error boundary   | Passed, cached | Syntactic checker passes; this does not prove errors reach users                         |
| Version synchronization | Passed, cached | Canonical checked application versions are 2.4.4                                         |
| Theme contrast          | Passed         | Six themes × eight accents at token level; not a rendered accessibility audit            |
| Source-size boundary    | Failed         | Seven files violate the configured baseline                                              |
| Rust tests              | Not run        | Would invoke compilation; user owns builds                                               |

Additional in-memory probes loaded the actual TypeScript implementations without contacting a device:

- A CDP command remained pending after its mocked socket closed; the pending map retained the command.
- A database named customer’s-db, using an ASCII apostrophe in the probe, produced invalid generated JavaScript in putRecord.
- Requesting 50 LocalForage records traversed all 10,000 fixture records before returning 50.
- An object represented by a CDP objectId and description was returned to the caller as the string “Object”.

These establish implementation behavior for the tested inputs. They do not substitute for a full device test matrix.

## Overall scorecard

Scale: 1–3 = major gaps, 4–5 = substantial weaknesses, 6–7 = credible beta, 8–9 = strong, 10 = exceptional with extensive evidence. Scores overlap and are not averaged into the overall assessment; correctness and trust receive greater weight.

| Dimension                | Score /10 | Assessment                                                                        |
| ------------------------ | --------- | --------------------------------------------------------------------------------- |
| Problem usefulness       | 8         | A real, recurring debugging workflow                                              |
| Differentiation          | 7         | Strongest in combined device, storage, recording, and evidence queries            |
| Stack suitability        | 8         | Vue, Rust, Tauri, CDP, Pinia, and Query fit the problem                           |
| Architecture             | 6         | Useful boundaries and lifecycle concepts, inconsistently applied                  |
| Correctness and recovery | 4         | Confirmed failures at core transport, storage, and recording boundaries           |
| Performance/scalability  | 5         | Good bounded network design; unbounded storage fallback and lifecycle leaks       |
| UI/UX                    | 6         | Coherent visual language; discoverability and truthfulness need work              |
| Feature completeness     | 6         | Significant real functionality mixed with partial and no-op surfaces              |
| MCP usefulness           | 8         | Recorded evidence and device operations are meaningful agent capabilities         |
| MCP execution quality    | 6         | Real implementation, but lifecycle, scope, and consent semantics need improvement |
| Security/privacy         | 4         | Good initial isolation; proxy and export weaknesses remain                        |
| Release engineering      | 4         | Multi-platform pipeline exists; latest tag fails and checks run too late          |
| Public-claim accuracy    | 4         | Stack, support, settings, and guarantees have drifted                             |
| Market validation        | 3         | No retention, task-success, or willingness-to-pay evidence established            |

## Findings, ordered by impact

### 1. P1 — CDP proxy accepts unauthenticated WebSocket clients

[cdp_proxy.rs:68](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src-tauri/src/commands/cdp_proxy.rs:68) accepts a handshake without validating Origin or a session credential, then relays arbitrary CDP traffic. Loopback binding restricts network reachability but does not authenticate local callers. Where browser local-network policy permits, an untrusted page that reaches the port could also attempt a connection. This is a source-confirmed exposure; browser exploitation was not attempted.

Require a per-session credential and an explicit origin policy. Validate destination URLs against discovered targets. Track accepted connections so stopping the proxy closes existing relays: the current stop at line 184 aborts only the listener task, while connection tasks are independently spawned.

### 2. P1 — CDP requests can hang indefinitely after disconnect

[client.ts:38](C:/Users/aybin/code/ayb/capubridge/packages/cdp-protocol/src/cdp/client.ts:38) stores pending requests but has no command deadline or socket-close/error rejection path. close() only closes the socket. The connection store changing its status cannot settle those promises.

The isolated probe confirmed a retained pending command after close. This affects query spinners, mutations, and recording stop: the network recorder awaits pending body requests. Add bounded requests, rejection of all outstanding work on terminal events, send-state checks, and deterministic teardown tests. Connection establishment also needs consistent close-before-open handling.

### 3. P1 — Stopping DOM recording does not stop the recorder in the app

[rrweb-inject-script.ts:43](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/lib/replay/rrweb-inject-script.ts:43) discards rrweb.record’s stop function. [useRrwebRecorder.ts:125](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/composables/useRrwebRecorder.ts:125) removes the future-document script and binding but does not stop current-document observers, restore history methods, clear timers, or reset the started flag.

Consequences include continued instrumentation after stop and a subsequent no-reload recording being skipped. The buffer has no bound; if its binding becomes unavailable, retrying flushes can retain accumulating events. Expose a target-side teardown function and invoke it before removing transport hooks. Verify start/stop/start without navigation and cleanup after disconnect.

### 4. P1 — Recording finalization failures delete recoverable evidence

[useRecordingSession.ts:346](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/composables/useRecordingSession.ts:346) calls recording_delete_session when finalization reports errors. The command deletes the archive, partial archive, and work directory. Writer tests retaining a failed buffer do not prove recoverability when the higher-level workflow then discards the writer and deletes persisted tracks.

Preserve a failed recording as a recoverable partial artifact with track-level status. Reserve deletion for explicit discard. Test disk-full, track-stop failure, app exit, and interrupted finalization against the whole orchestration path.

### 5. P1 — Native SQLite “Clear” can report success while restoring the original data

[sqlite.rs:1129](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src-tauri/src/commands/sqlite.rs:1129) writes only to the pulled local file for Android databases. [SqliteExplorer.vue:826](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/storage/sqlite/SqliteExplorer.vue:826) executes DELETE, calls handleRefresh, and displays a success toast. The refresh path re-pulls the unchanged device database.

This is more than a documentation problem: the action’s own refresh can discard its local result. One import dialog explains cache-only writes, but that explanation does not cover every mutation flow. Make native snapshots visibly read-only, or offer explicit editable copies with export; implement target writes only through a supported transactional adapter. Never overwrite a live device database blindly.

### 6. P2 — IndexedDB fallback pagination loads the entire object store

[indexeddb.ts:546](C:/Users/aybin/code/ayb/capubridge/packages/cdp-protocol/src/cdp/domains/indexeddb.ts:546) collects every cursor record before slicing a page. LocalForage always takes this path; other stores take it on protocol failure. The probe requested 50 records and traversed 10,000.

The displayed page size does not bound work or memory on the inspected app. Advance to the offset and stop after pageSize + 1, retaining key-range/index semantics. For deeper pagination, consider cursor-based continuation rather than increasing offset scans.

### 7. P2 — IndexedDB decoding and editing do not preserve the full data model

[indexeddb.ts:102](C:/Users/aybin/code/ayb/capubridge/packages/cdp-protocol/src/cdp/domains/indexeddb.ts:102) substitutes a RemoteObject description when its value is absent. That turns a handle-backed record into display text. putRecord also accepts no explicit primary key, while [IDBExplorer.vue:412](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/storage/indexeddb/IDBExplorer.vue:412) passes only record.value. Out-of-line-key stores can reject the write or insert a new row instead of editing the selected one.

Resolve remote objects or use a bounded value-reading adapter. Preserve primary keys separately from index keys. Define supported serialization for Dates, binary keys, blobs, and compound values. Database and store identifiers must be encoded as JavaScript literals: the apostrophe probe currently produces a SyntaxError. Errors from record editing should reach the UI; the inspected catch only logs them.

### 8. P1 for shared evidence — Recording exports lack the promised redaction policy

[useNetworkRecorder.ts:47](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/composables/useNetworkRecorder.ts:47) copies header values unchanged and persists request/response headers and bodies. The archive writer packages these tracks without a redaction step. DOM capture also lacks an explicit product-wide masking policy.

Raw capture can be a legitimate local debugging mode. The defect is promising redacted diagnostics and portable sharing without clearly distinguishing a safe export from raw evidence. Add a sanitized export default, explicit raw export, secret-header filtering, configurable body/DOM masking, and a preview of omitted data. Public screenshots also appear to contain application/business identifiers; replace them with an intentional demo dataset rather than assuming they are safe.

### 9. P2 — MCP captures outlive server shutdown

[capture.rs:140](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src-tauri/src/mcp/capture.rs:140) spawns capture loops without storing task handles or accepting the server cancellation token. [server.rs:35](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src-tauri/src/mcp/server.rs:35) shuts down HTTP/MCP sessions but cannot join those loops.

Disabling MCP may leave instrumentation and sockets active until the target disconnects. Repeated disable/enable cycles can add duplicate captures. Connect capture lifetime to server and target leases, remove dead entries, and bound bytes as well as entry counts. The registry also uses target ID alone; device identity and endpoint generation belong in its key.

### 10. P2 — Settings expose controls with no operational effect

[SettingsAdb.vue:8](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/settings/SettingsAdb.vue:8) stores path and polling interval only in component refs. [SettingsChrome.vue:9](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/settings/SettingsChrome.vue:9) does the same for executable, port, arguments, and launch mode. Neither script persists or applies these values to runtime configuration.

Users can attempt to fix a connection problem through controls that cannot change it. Wire each control through a validated runtime contract or remove/disable it with accurate wording. General settings are mostly static information and should not imply configurable features.

### 11. P2 — Experimental route gating is incomplete

[network/routes.ts:21](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/modules/network/routes.ts:21) registers mocking as a child of the enabled beta Network feature. The child’s experimental metadata is not evaluated by root feature filtering, and [SubNavTabs.vue:94](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src/components/layout/SubNavTabs.vue:94) filters navigation visibility without maturity.

The route remains registered and discoverable without the experimental opt-in described in the spec. Apply maturity gating recursively to route registration and navigation. Also consolidate useMockServer ownership: both NetworkPanel and NetworkMock instantiate independent lifecycle hooks against shared state and the same CDP connection.

### 12. P2 — Queue priority and response timeout are not operation cancellation

[device_session.rs:316](C:/Users/aybin/code/ayb/capubridge/apps/desktop/src-tauri/src/session/device_session.rs:316) times out the waiting receiver; only package scans receive a special cancellation signal. The worker executes a synchronous job before selecting the next priority item. A running shell operation can therefore delay lifecycle/control work, and queued mutations can remain eligible after their caller has timed out.

The priority scheduler is useful, but it does not establish the spec’s preemption guarantee. Add deadlines/cancellation to job execution and explicitly distinguish “caller stopped waiting” from “operation was cancelled.” Avoid automatic mutation retries without idempotency or outcome reconciliation.

### 13. P2 — Release validation is deferred until tagging

The checked-in build workflow is manual-only, while release validation runs on version tags. No pull-request or ordinary branch-push workflow was present. The public v2.4.4 run failed specifically at the source-size check, so its build matrix was skipped.

Run cheap quality gates on PRs and the main branch. Keep draft release creation, then require platform artifact verification before publication. The source-size guard should catch this before someone creates a release tag.

## Feature and screen scorecard

“Value” means usefulness to the intended Android WebView developer. “Delivery” is the source/visual assessment of current maturity, not a measured device pass rate. Where no screenshot existed, the assessment is source-only.

| Screen or capability                   | Value /10 | Delivery /10 | Assessment and priority                                                                                    |
| -------------------------------------- | --------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| Device discovery/selection             | 8         | 7            | Real session model and target discovery; improve stale-device cleanup and first-run recovery               |
| Device overview                        | 5         | 7            | Useful orientation; large screenshot area gives limited actionable information                             |
| Installed apps/emulator entry points   | 7         | 6            | Relevant device workflow; validate fresh-install and platform-specific paths                               |
| File browser                           | 7         | 6            | Real browsing, previews, search bounds, protected-path handling; stress large trees and transfers          |
| Device performance                     | 6         | 6            | Useful coarse monitoring; clarify sampling, units, unavailable values, and overhead                        |
| App overview/permissions               | 8         | 7            | Valuable bridge between package information and WebView state                                              |
| App performance                        | 7         | 6            | Native/JS measurements together help; CPU normalization and chart limits need explicit meaning             |
| App data usage/battery                 | 6         | 6            | Real backend-oriented flow with unavailable states; avoid presenting partial samples as complete           |
| Mirror/input/screenshots               | 8         | 7            | Essential reproduction companion; lifecycle tokens and tests are positive; platform stress unverified      |
| Logcat                                 | 7         | 6            | Real lease and filtering, bounded to 900 entries; current renderer is Vue rows, not documented xterm       |
| Console/REPL/exceptions                | 8         | 6            | Useful execution and diagnosis; core CDP cancellation flaw affects reliability                             |
| IndexedDB live explorer                | 9         | 5            | Core differentiator; fix decoding, keys, identifiers, and bounded fallback first                           |
| IndexedDB import/snapshot/change views | 8         | 6            | Useful evidence workflow; test fidelity, comparison scope, and failed imports                              |
| LocalForage                            | 7         | 5            | Helpful convenience, but underlying IndexedDB fallback can scan everything                                 |
| LocalStorage                           | 7         | 7            | Real edit/delete flow and virtual list; validate origin changes and reconnect behavior                     |
| Cache API                              | 6         | 5            | Browsing exists; errors can look like an empty cache, and full mutation support is not established         |
| OPFS/SQLite WASM decoding              | 8         | 6            | Distinctive specialist value; distinguish inspected source from extracted local snapshot                   |
| Native/local SQLite                    | 9         | 4            | Strong utility, but cache-only mutation semantics currently undermine trust                                |
| Storage graph                          | 6         | 5            | Potential for schema discovery; overview screenshot is unreadable at fit-to-all scale                      |
| HTTP network inspector                 | 8         | 7            | Strong explicit retention budgets and body cache; recording has different limits and semantics             |
| Network mocking                        | 7         | 4            | Real interception code; experimental visibility and duplicated ownership need repair                       |
| WebSocket frames/throttling            | 6         | —            | Not delivered as dedicated current routes; do not count old screenshots as support                         |
| Recording                              | 9         | 4            | Excellent product direction; teardown, failure recovery, and privacy need priority                         |
| Replay/evidence queries                | 9         | 6            | Valuable multi-track history; avoid implying full native video or deterministic app replay                 |
| DOM/CSS inspector                      | 7         | 6            | Useful alongside mirror; do not chase all Chrome DevTools functionality                                    |
| Vue/React DevTools                     | 8         | 7            | Good use of official tooling and capability probes; compatibility/build-mode matrix still needed           |
| Appearance/shortcuts                   | 6         | 7            | Token system and theme tests are positive; rendered focus, opacity and keyboard behavior remain unverified |
| General settings                       | 3         | 3            | Mostly informational; little configurable value                                                            |
| ADB/Chrome settings                    | 7         | 2            | Visible configuration is local UI state only                                                               |
| MCP settings and server                | 8         | 6            | Real opt-in integration, useful controls; stronger ownership and scope needed                              |
| Updates                                | 8         | 6            | Signed updater artifacts and channels exist; installation/recovery not exercised                           |
| Capacitor/Hybrid/Assistant panels      | —         | —            | Hidden placeholders; correctly excluded from delivered-feature value                                       |
| Browser preview                        | —         | —            | Experimental; do not present as a supported cross-platform inspection path                                 |

## Stack and architecture

Keep Vue 3, TypeScript, Rust, Tauri, CDP, Pinia, and TanStack Query. There is no evidence that a framework rewrite would solve the demonstrated problems. Vue’s official [performance guidance](https://vuejs.org/guide/best-practices/performance) supports the existing direction of lazy routes, list virtualization, and restrained reactivity. [Pinia](https://pinia.vuejs.org/introduction) is a suitable state layer here.

The backend session model, coalesced jobs, health information, lease concept, typed IPC adapter, and feature registry are sound foundations. ADB device acquisition releases the shared server lock before many device operations; it would be inaccurate to claim that all device work is serialized by one global mutex.

The architecture is nevertheless a partially modular system. Feature routes and private components are separated, but substantial domain state remains in root stores/composables, and shell/shared components reach into module internals. Passing the current import checker does not establish universal public-boundary enforcement. Move ownership gradually when touching a feature; avoid a large folder reshuffle that leaves the same dependencies in place.

The TypeScript/Rust contract test checks command-name coverage, not argument and return-shape equivalence. Error categories also differ across the Rust and frontend layers, with many errors inferred from message strings. Generated contracts or schema-backed boundary tests would provide more value than another nominal interface.

Effect can remain useful at resource and cancellation boundaries. Its presence alone does not cancel a pending CDP request or a blocking Rust operation; cancellation has to reach the resource that does the work.

The repository now contains a separate UI package with substantial tests while the desktop still imports its local component set. That may be a planned migration, but it is a second product-sized maintenance obligation. Consolidate the design-system destination before expanding both surfaces. Do not prioritize more generic primitives over debugger correctness.

Documentation is stale: the current desktop uses Tailwind v4; the provided project guidance describes UnoCSS. The current logcat screen renders Vue rows; the README describes xterm. Monaco is claimed in places but was not found in the inspected current desktop imports. These are reasons to derive public documentation from current capabilities instead of preserving historical stack lists.

## What scalability means here

For a local desktop tool, cloud user count is not the first scaling problem. The relevant dimensions are concurrent devices, active targets, event rate, record size, capture duration, and developer ownership of the code.

The network store is a good example: 5,000 entries, a 24 MiB history budget, 32 MiB body-cache budget, and animation-frame-batched updates. Those are logical payload budgets, not a measured process-memory ceiling. Apply similarly explicit budgets to MCP strings, outstanding requests, target captures, recording buffers, graph discovery, and file previews.

Virtualizing rows does not bound data acquisition. The IDB fallback demonstrates this directly. Recording export also reads whole tracks/artifacts into memory before writing ZIP entries; stream those files for long captures. Logcat is bounded, but rendering 900 rows and repeatedly filtering them still warrants a sustained-throughput test.

Proposed validation targets, not achieved results: a two-hour capture; three devices while one stalls; a 100,000-record store; large binary records; rapid target switching; cable removal during writes; repeated mirror/record/MCP start-stop cycles. Track process memory, target-app overhead, request latency, dropped events, and resource counts after cleanup.

## Can it be agnostic?

It can be framework-agnostic within debuggable Chromium WebViews. Capacitor, Ionic, NativePHP, plain web code, and a React Native WebView can share the ADB/CDP core. React or Vue inside that WebView can receive optional framework adapters.

“React Native support” needs qualification: inspecting a WebView embedded in React Native does not establish native React Native/Hermes inspection. React Native has its own [DevTools/runtime integration](https://reactnative.dev/docs/react-native-devtools). Likewise, Android device tools work beyond WebViews, but the DOM/storage debugger does not become a native Android debugger.

iOS is a separate transport and lifecycle project. A desktop build for macOS does not imply iOS target support. Keep iOS out of near-term promises until WebKit support is implemented and validated.

Use capability-driven adapters with a common identity: device, application, target, origin, and connection generation. Each adapter should declare what it can read/write, its execution semantics, and its limits. This permits expansion without pretending that SQLite, IndexedDB, native UI, and WebKit all behave identically.

## Is MCP useful, or feature inflation?

MCP is justified here. The repository exposes actual tools for device/session discovery, target selection, JavaScript, storage reads, console/network capture, screenshots, input, app launching, emulator operations, and recording queries. The most valuable layer is being able to ask about a recorded failure without replaying megabytes of raw events into an assistant.

A strong workflow is: select the target, reproduce a failure, capture it, query failed requests, correlate nearby console events, inspect database state at the relevant time, and return a compact evidence packet. Correlation is evidence for a hypothesis, not proof of causation. Keep timestamps, source identities, truncation markers, and errors in the output.

Generic browser automation already has competition: [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) provides browser inspection and automation. Capubridge’s opportunity is Android/device integration and its saved evidence model, not the mere existence of an evaluate_js tool.

The server’s loopback binding, bearer authentication, default-off state, and mutation parameters are useful foundations. However, confirm:true is an argument the agent can supply; it is not proof that a human approved that particular action. The [MCP tool specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) leaves control and consent responsibilities to clients and implementations. Product wording should describe the actual protection precisely.

For stronger control, offer read-only access by default, explicitly scoped device/target write access, revocable credentials, and an action log. The token is persisted across launches, despite the spec promising per-launch tokens. Persistence can be a valid usability choice, but document it and protect credential-file access. Recording-control tools depend on the running app’s frontend bridge, so the present implementation is not a headless automation service.

Measure MCP through real tasks: success rate, incorrect-target actions, time to obtain useful evidence, and amount of manual correction. Tool count and impressive prompts are poor substitutes.

## UI and product focus

The screenshots show a recognizable developer workspace: consistent side navigation, split panels, restrained color, and a useful mirror alongside inspected state. The app-overview and combined replay views communicate the product better than the device-specification dashboard.

Several screenshot labels are visually faint; token contrast tests do not cover every opacity-modified foreground. Icon-only navigation, truncated long names, dense toolbars, and the graph’s tiny fit-to-all view raise discoverability costs. Test actual rendered layouts at the configured 800×600 initial window as well as larger displays.

The graph should begin with a selected entity and its immediate relationships, with search and progressive expansion. Distinguish declared foreign keys from inferred relationships. A visually impressive all-schema canvas is not automatically useful for finding a bug.

The first-run experience should answer: Is the device authorized? Is the app foregrounded? Is its WebView debuggable? Is the selected origin correct? Is this live data or a snapshot? Can this action write to the target? These questions deserve more prominence than implementation terminology.

The product should concentrate on a few excellent journeys: connect to a WebView; inspect and safely change application state; reproduce and preserve a failure; explain it using correlated evidence. Device utilities support those journeys. They do not all need to become independent flagship products.

## Releases and public positioning

The repository remote, workflows, and updater all point to GitHub. No GitLab pipeline was found; a separate GitLab system, if one exists, was not reviewed.

Public API inspection on September 9 showed:

- [v2.4.4 workflow](https://github.com/aybinv7/capubridge/actions/runs/33543183993): failed at the source-size boundary; release matrix skipped.
- [v2.4.3 release](https://github.com/aybinv7/capubridge/releases/tag/v2.4.3): latest published release, dated August 7, with Windows, macOS, Linux and updater assets.

The local source-size failures were:

| File                     | Current lines |               Allowed |
| ------------------------ | ------------: | --------------------: |
| useStorageGraphData.ts   |           901 | 800 without exception |
| commands/sqlite.rs       |         1,159 |                 1,087 |
| ReplayDatabasesPanel.vue |         1,133 |                 1,129 |
| StorageGraphExplorer.vue |         1,350 |                   855 |
| IDBTable.vue             |         1,208 |                 1,105 |
| SqliteExplorer.vue       |         2,080 |                 1,936 |
| SqliteTable.vue          |         1,182 |                   814 |

The gate working is positive. Split responsibilities where warranted; do not treat raising baselines as the only release repair. A four-line overage and a 495-line increase deserve different engineering responses.

Other release observations:

- Draft releases and a multi-platform matrix are good choices.
- Updater signatures exist, but they are distinct from OS signing/notarization. The checked-in macOS identity is ad-hoc; no Apple signing/notarization setup was found in the workflow. Actual installer signatures were not inspected.
- Packaging fetches “latest” platform-tools and scrcpy. Rebuilding the same tag can therefore bundle different binaries. Pin versions and expected digests; scrcpy’s optional digest verification alone does not make the build reproducible.
- Actions are version-tagged rather than commit-pinned, and the release workflow grants contents-write at workflow scope. Tighten permissions and pin release inputs as the product matures.
- The public release channel calls beta builds stable releases. That can be intentional, but the product’s beta status and channel meaning should be consistent.
- README version/roadmap text, repository owner links, bundled-ADB requirements, old screenshots, and per-launch-token claims need reconciliation.

AYA already offers many device-management features, including mirroring, files, packages, monitoring, logcat, and a shell; see its [feature list](https://github.com/liriliri/aya). Chrome already debugs Android WebViews; see [official remote-debugging guidance](https://developer.chrome.com/docs/devtools/remote-debugging/webviews). Therefore, “all these screens in one app” is a useful convenience but an incomplete differentiation argument.

Suggested positioning: **Inspect Android WebView state, reproduce failures, and preserve the evidence in one local workspace.** Add AI as a way to use that evidence. Validate the proposition with developers outside the author’s own app and workflow.

## Recommended order of work

1. Repair transport and capture lifetimes: CDP pending requests, proxy authentication/child teardown, rrweb stop/restart, MCP capture shutdown, and operation cancellation semantics.
2. Protect evidence and data truth: retain failed recordings, correct SQLite snapshot behavior, preserve IDB values/keys, and make exports’ privacy modes explicit.
3. Make the visible product honest: remove/apply no-op settings, enforce experimental routes, label live/snapshot/read-only states, update support claims and screenshots.
4. Move quality checks before tagging and pin native packaging dependencies. Add installation/update verification for each supported desktop platform.
5. Run a small, observed beta with external WebView developers. Compare time to first useful inspection and time to diagnose a real bug against their current tools.
6. Expand only where repeated user evidence identifies a missing capability. Prioritize deeper recording/storage diagnosis over more panels, another UI foundation, cloud accounts, or immediate iOS scope.

The engineering mentality has strong parts: explicit boundaries, performance budgets, official framework integrations, and a willingness to hide incomplete work. Its current weakness is treating architectural rules and many implemented surfaces as evidence that complete workflows are reliable. The next milestone should demonstrate that Capubridge preserves truth through failure. That would improve the product more than another major feature release.
