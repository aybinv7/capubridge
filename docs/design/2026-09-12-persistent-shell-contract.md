# Capubridge persistent shell contract

Capubridge is one workbench. Navigation and runtime controls keep the same position across every feature. Routes replace feature content only.

## Fixed shell

### Global feature rail

The rail contains only product-level destinations:

- Devices
- App
- Storage
- Network
- Inspect
- Replay
- Settings

The collapsed rail uses icons with tooltips. The expanded rail adds these exact labels. A feature must not appear again in a secondary sidebar.

### Live context control

The title bar always represents the active live context:

`Source / Device / Target / Connection state`

Examples:

- `USB / Pixel 8 / Efficy [Dev] / Live`
- `Local Chrome / localhost:5173 / Connected`
- `No device / Select device`
- `Pixel 8 / No target / Pick target`

Selecting a target makes it the main target for all target-scoped tools. Opening Replay does not replace or clear this context.

### Global actions

These remain in the title bar across every route:

- Command palette
- Record session
- Bottom dock
- Mirror
- Window controls

Actions use truthful availability. Disabled actions explain their requirement. No placeholder actions appear.

### Optional global surfaces

- Mirror opens as a resizable right or left pane, can collapse, switch side, or detach.
- Bottom dock opens below feature content and contains Logcat, REPL, Console, and Exceptions.
- Both preserve state across route changes.

## Scope ownership

| Surface                                                                   | Scope                  | Required context                                    |
| ------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------- |
| Devices: Overview, Apps, Files, Performance                               | Device                 | Active ADB device                                   |
| App: Overview, Performance, Data Usage                                    | App or target          | Active device package or target                     |
| Storage: IndexedDB, LocalForage, LocalStorage, Cache, OPFS, SQLite, Graph | Target                 | Active CDP target; imported SQLite may be local     |
| Network: Requests                                                         | Target                 | Active CDP target                                   |
| Inspect: Elements and framework plugins                                   | Target                 | Active CDP target                                   |
| Logcat                                                                    | Device                 | Active ADB device                                   |
| REPL, Console, Exceptions                                                 | Target                 | Active CDP target                                   |
| Mirror                                                                    | Device or local target | Active mirror-capable source                        |
| Record                                                                    | Target                 | Active connected target                             |
| Replay                                                                    | Recording artifact     | Loaded `.capu` file; live context remains available |
| AI / MCP settings                                                         | Global runtime         | None to configure; active session for tools         |

## Feature region

Each route owns three possible layers:

1. Module tabs for real sibling routes only.
2. Feature toolbar for actions, filters, and capture state belonging to that module.
3. Feature canvas for tables, trees, inspectors, editors, graphs, or replay.

Network therefore shows `Requests` in its module header and the request table in its canvas. It does not receive a second Runtime sidebar containing Network.

## Selection and inspectors

Selection stays local to the current feature. When details are needed, a consistent right inspector opens inside the feature canvas. The inspector never becomes a second navigation system.

Examples:

- Network request selected: request, response, headers, timing.
- Storage row selected: value, metadata, edit actions, related changes.
- DOM node selected: styles, computed values, box model.
- Replay event selected: recorded payload and related recorded evidence.

## Replay contract

Replay uses the same shell as live features.

- Global rail, live context, Record, Dock, and Mirror remain fixed.
- Recording label, recorded device, duration, and read-only state live in Replay's feature header.
- Player, correlated lanes, selected event, and recorded evidence live inside Replay's feature canvas.
- Replay Console, Network, Performance, Elements, and Databases are recorded-data views. They do not duplicate the global live dock or global feature rail.
- The recorded device frame is part of replay evidence. It is not the live Mirror surface.

## Empty-state rule

Empty space remains empty unless the user can take a real next action.

- No device: `Select or connect a device`.
- Device selected, no target: `Pick or refresh a target`.
- No recording loaded: `Open a .capu recording`.
- Feature unsupported: state the missing capability and context.

No fake icons, metrics, recent items, charts, panels, or generated data.

## Visual continuity

- Near-black graphite shell and surfaces.
- Warm-white primary text and readable muted text.
- Coral selection and recording accent.
- Semantic colors reserved for runtime meaning.
- Hairline pane borders, compact 12–14 px UI type, 4–6 px radii.
- Same rail width, title-bar height, context placement, global-action placement, and dock behavior on every route.
