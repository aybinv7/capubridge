# Round 01 · 00 · Synthesis

2026-11-04 · Orchestrator's synthesis of reports 01–08. `[AI-assisted]`

## Sources and independence

| Report | Reviewer                                    | Model                  | Independence                                                           |
| ------ | ------------------------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| 01–05  | Five specialist critics (`.claude/agents/`) | Claude Opus 5.5        | Separate roles and contexts                                            |
| 06     | Red team                                    | Claude Opus 5.5        | Verified the S0 and S1 findings of 01–05                               |
| 07     | Codex                                       | gpt-6-luna, max effort | **Blind first pass**, a different model family, then cross-examination |
| 08     | OpenCode                                    | Claude Fable 5.1, max  | Own position first, then the decisions                                 |

The phone mirror and the serial number were redacted before the evidence was sent to 07 and 08.

## Scores

| Dimension          | Red team (06) | Codex blind (07) |
| ------------------ | ------------- | ---------------- |
| Positioning        | 4.5           | 4.5              |
| Brand              | 5.0           | 5.0              |
| IA                 | 5.0           | 4.0              |
| Core flows         | 4.5           | 4.5              |
| Visual craft       | 5.0           | 5.0              |
| Component fidelity | 4.0           | 5.0              |
| States and honesty | 3.5           | 3.5              |
| Interaction        | 5.0           | 5.0              |
| Density            | 5.0           | 5.0              |
| Differentiation    | 5.0           | 4.5              |
| **Overall**        | **4.7**       | **4.6**          |

The Codex pass was blind and came from a different model family, yet it lands within 0.1 of the red team.
**Consensus: 4.6–4.7.** Self-assessed rounds had claimed 6.9.

## Consensus (all reviewers)

1. **States and honesty are the binding constraint at 3.5.** Under the cap rule they hold the product down,
   so the honesty layer goes first.
2. **The rail structure is wrong.**
   - "Flows" opens an agent.
   - "Device" names two different things.
   - App and Apps are distinct places with almost the same name.
   - Replay is a file picker with no library.
3. **The differentiator, evidence on one clock, is invisible.** No timeline appears on any screen.
4. **The website overclaims.** Throttling, native logs in recordings, installing the build, benchmarks
   and scenario comparison are all advertised and none of them ships. "No helper APK" is also misleading.
5. **The Capacitor/Ionic frame must go, and the name carries it.** If the product is renamed, the
   rename happens before the companion's first public listing.
6. **A separate companion APK can never attach to another app's WebView debugging socket.** This was
   verified in Chromium's `devtools_auth.cc`. Field capture of a release build's data needs an in-app
   SDK.

## Disagreements and rulings

| Topic                                                             | Positions                                                                                                                                                              | Ruling                                                                                                                      |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Category word                                                     | 01: "flight recorder". 07: "Android app debugging workbench" (honest now). 08: "session debugger" now, "flight recorder" in 12 months.                                 | **Owner decision.** Recommended: 08. Today's claim is limited to what ships, and the recorder claim waits for its features. |
| Rename timing                                                     | 01/06/07: before the Play listing. 08: same moment, but not urgent, so start clearance now.                                                                            | They agree in substance. Start clearance now and rename at the companion's public launch.                                   |
| WebView reach                                                     | 07 cites the Chrome doc: the app must call `setWebContentsDebuggingEnabled`. 08 cites Chromium source: debugging is force-enabled on every `android:debuggable` build. | **08.** The source outranks the doc. The honest claim is "any debuggable build, no code change".                            |
| Severity of the Network "live" and IndexedDB "none found" defects | 06: S0. 07: S1, because a banner warns about staleness.                                                                                                                | **S0 kept.** The product's thesis is honesty, and a banner does not excuse a contradicting value.                           |
| Performance "silent pipeline failure"                             | 06 M5: the error is never rendered. 07: `DevicePerf.vue:308` renders an error banner.                                                                                  | **07.** The false-zero defect stands; the silent-failure claim is withdrawn pending a reproduction.                         |
| SQLite gating                                                     | 06 M2: gate it like IndexedDB. 07: SQLite reads over ADB, not CDP.                                                                                                     | **07.** Show the last-pull time; do not infer staleness from CDP pause.                                                     |
| Companion v0 tier                                                 | 02: a shell agent for device facts. 08: development permissions granted over ADB persist and need no shell.                                                            | **08 for v0.** The shell agent carries only what needs the shell UID.                                                       |
| Companion–SDK link                                                | 02: a signature-protected binder. 08: impossible across two signing keys.                                                                                              | **08.** Use a local socket with peer credentials plus a token.                                                              |
| MCP size                                                          | Brief and inventory: 30 tools. 08: 56 tools in code.                                                                                                                   | **08.** Update the brief and the inventory.                                                                                 |

## Owner decisions (consolidated)

1. **In-app debug SDK.** All reviewers: yes, staged. Generalise `@cavulsqa/recorder` instead of building
   a second SDK.
2. **Category word.** Choose "session debugger" (recommended), "debugging workbench" or "flight
   recorder".
3. **Rename.** Start trademark and domain clearance now (Direction), and rename at the companion's public
   launch.
4. **Brand architecture across Capubridge, Capuchoo and `@cavulsqa/recorder`.** Recommended: one format,
   one desktop reader, and two producers (the companion and the SDK).
5. **Honesty freeze as a release gate.** All reviewers: yes, first.
6. **Website overclaims.** Remove them now.
7. **Companion distribution.** Recommended: pushed over ADB first, with no Play listing and no VPN in 2026.
8. **Escalations, to the Tech Lead or Direction:**
   - the AGPL "aya" helper inside the MIT product;
   - the client scenario that ships in the core.
9. **Round 2 evidence.** Approve the recapture list in 06 §6 and 08 §3 item 9.

## Proposed order (from 08, endorsed by 06 and 07)

| Weeks | Track                                    | Content                                                                                                                                                                                                          |
| ----- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–2   | **Truth**                                | One link-health state and one Gate component. Provenance carries the read time. No seeded zeros. The agent inherits the context. `--user` everywhere. Temp copies are cleaned up. The website claims are pulled. |
| 3–4   | **Spine**                                | A global timeline strip. "Save the last N minutes". Replay opens on its library. SQLite and Logcat tracks on by default. Requests are joined to the rows they changed.                                           |
| 5–6   | **Companion v0, pushed over ADB**        | An owned, pinned shell agent replaces aya. An APK with ADB-granted development permissions: a capture tile, device truth, logs, exit reasons and `.capu` sharing.                                                |
| 7–8   | **SDK spike, naming clearance, round 2** | A spike of the SDK, naming clearance, and round 2 of the critique on fresh evidence.                                                                                                                             |
