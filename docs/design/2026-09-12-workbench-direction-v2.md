# Capubridge workbench direction v2

Design revision · 12 September 2026 · Taste target after feedback

## Why v1 felt off

The first concept was capable, but too much like a polished DevTools dashboard. It made Capubridge look broad before it felt fast. The product should feel closer to an editor: calm shell, precise panes, strong selected object, command-driven movement, and little visual noise.

The better direction is not "Android DevTools with more panels." It is a native investigation workspace for hybrid apps. Codex contributes task clarity, Zed contributes editor density and speed, Linear contributes restraint and hierarchy.

## New product feel

Capubridge should feel like this:

- A fast editor for runtime evidence.
- One live context at the top: device, app, target, data freshness.
- One selected object in focus: request, DOM node, record, log line, recording event, MCP action.
- Related evidence appears beside it, never as another dashboard.
- AI and MCP are command surfaces attached to evidence, not a permanent chatbot taking over the workspace.

The UI should avoid big panels that all compete for importance. Power comes from context, selection, and fast transitions.

## V2 concepts

- [Live editor workbench](concepts/04-v2-live-editor-workbench.png)
- [Recording timeline](concepts/05-v2-recording-timeline.png)

These are taste references, not implementation specs. They intentionally use illustrative data and must be normalized before production.

The live concept is closer than v1 because it uses one editor-like surface: left rail, runtime tree, request table, request inspector, slim console, small mirror. The phone mirror is still too visually heavy and should default to collapsed picture-in-picture unless the user's current task is touch reproduction.

The recording concept is stronger. It makes replay feel like a timeline editor, with tracks, playhead, selected event, related database and console evidence, and an attached AI/MCP composer. That should become the model for every read-only investigation mode.

## Shell

Use three persistent shell layers:

1. A narrow global rail with Connect, Workbench, Recordings, Automate, Settings.
2. A top command bar that accepts search, actions, scopes, and recent resources.
3. A context strip that says exactly what is live or read-only.

The rail should be quiet. Icons can carry recognition, but each top destination keeps a short label. No large sidebar tree at the global level.

The command bar is the center of gravity. It should support "open request," "inspect storage," "start recording," "show MCP endpoint," and "back to live." It is not just search; it is how expert users move.

The context strip is mandatory because Capubridge has dangerous ambiguity: live target, cached data, local draft, recording, imported database, MCP read-only mode. These states must be visible without hunting.

## Workbench Anatomy

Workbench should behave like an editor:

- Left activity rail selects product mode.
- Left tool tree selects runtime family.
- Center pane lists or edits the main object.
- Right inspector explains selected object.
- Bottom dock shows console, device logs, tasks, or transcript.

Tool families:

- Runtime: Network, Elements, Console, Performance.
- Data: IndexedDB, LocalStorage, SessionStorage, Cache, OPFS, SQLite, Imported.
- Device: Apps, Files, Logcat, Shell, Ports.
- Automation: MCP tools, activity, permissions.

Do not make every capability a top-level destination. Most features are tools inside one focused investigation surface.

## Visual System

Use a restrained editor palette:

- Background: near-white workspace, not creamy.
- Chrome: graphite or very soft gray.
- Borders: hairline separators.
- Accent: cobalt for selected state only.
- Error: red used sparingly and paired with text.
- Radius: 4-6 px for controls and panes.
- Shadows: almost none; use layers and dividers instead.

Typography should be compact and confident:

- UI text: 12-13 px.
- Table rows: 28-32 px.
- Pane headings: 13-16 px.
- Code/data: 12-13 px monospace.

No oversized hero text, no bento cards, no gradient chrome, no glass panels, no thick pill navigation.

## Interaction Rules

Selection drives the app. When the user selects a request, record, DOM node, log line, database row, or recording event, the right pane becomes the evidence inspector.

The inspector always answers:

- What is selected?
- Where did it come from?
- Is it live, cached, local, imported, or recorded?
- What can be done safely?
- What evidence is related?

Related evidence is conservative. "Open related data" can search keys or timestamps, but it must not pretend causality. "Near this time" is evidence; "caused by this" needs proof.

Dirty edits need a visible draft strip. Writes need exact destination language. SQLite local writes must say local copy or exported database unless a real device write-back exists.

## AI And MCP

AI should feel like Codex inside a workbench, not chat bolted onto DevTools.

Use a compact evidence composer:

- It opens from command bar, selection action, or inspector.
- It shows attached evidence chips.
- It states MCP mode: read-only or mutation enabled.
- It links every answer back to the selected request, row, log, or recording interval.

Automation should expose real capability first:

- Server state.
- Endpoint and token controls.
- Read-only or mutation mode.
- Tool groups.
- Recent activity.

Do not show "assistant connected" unless runtime can prove a client is connected. Do not treat MCP `confirm: true` as human approval.

## Recording Model

Recordings should look like a timeline editor, not a report viewer.

Core layout:

- Left list of recordings.
- Center timeline with tracks.
- Event table below timeline.
- Right inspector for selected event.
- Bottom transcript/log dock.

Tracks:

- Touch.
- Network.
- Console.
- Storage.
- Performance.

The playhead is shared. Selecting an event moves the playhead. Selecting a time shows nearby events and database state at that time. Missing tracks say "Not captured."

Read-only must be visible in the context strip and inspector. Editing controls disappear in recordings.

## What To Change From V1

Keep:

- Capability inventory.
- Context strip requirement.
- Explicit live/cached/local/recorded states.
- Draft and write-destination rules.
- Recording evidence model.
- MCP permission caution.

Change:

- Make the app shell thinner.
- Remove dashboard feeling.
- Make command bar primary.
- Reduce persistent companions.
- Collapse mirror by default.
- Make AI contextual and evidence-attached.
- Treat Recordings as a timeline editor.
- Use fewer card containers and more editor panes.

## Implementation Implications

When this becomes Vue work, design should start from shell primitives:

- App rail.
- Command bar.
- Context strip.
- Pane group.
- Runtime tree.
- Object table.
- Inspector.
- Dock.
- Evidence chips.

These primitives should be shared. Feature modules should provide capability descriptors, routes, commands, and inspector surfaces. They should not import each other's components directly.

The UI needs virtualized rows, lazy-loaded heavy tools, and bounded live streams. Visual density only works if the runtime stays fast.

## Reference Notes

Zed's public product framing emphasizes speed, editor-native AI, agentic editing, parallel agents, MCP/ACP extensibility, and "built with ultimate care." Those are useful product principles for Capubridge, but Capubridge should not mimic a code editor literally. It should borrow the feeling of fast, context-preserving work. Source: [Zed](https://zed.dev/).

Linear's public interface direction emphasizes a calmer interface, softened contrast, and structure without clutter. That supports Capubridge using quiet hierarchy instead of decorative dashboards. Source: [Linear](https://linear.app/).

Codex product docs frame work as tasks, context, review, parallel work, local tools, and staying in control. For Capubridge, this means AI/MCP should attach to selected evidence and make actions reviewable, not replace direct manipulation. Sources: [Codex IDE extension](https://developers.openai.com/codex/ide), [Codex CLI](https://developers.openai.com/codex/cli), [Codex cloud](https://developers.openai.com/codex/cloud).

## Short Verdict

V2 should be the taste target. V1 remains useful for coverage, but its visual tone should not lead implementation. Build the shell like a serious editor, then let Capubridge's unusual runtime capabilities show through selection, evidence, and command flow.
