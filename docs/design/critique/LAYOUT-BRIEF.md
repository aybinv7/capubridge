# Layout and structure brief (round 02)

This brief is for critics and designers working on Capubridge's **shell**: how the window is divided, how
layers stack, how panels dock, and which layout template each screen uses. Read `BRIEF.md`, `RUBRIC.md`
and `round-01/00-synthesis.md` first. This brief adds what those documents do not cover.

## Owner decisions now in force (2026-11-04)

These four decisions are binding on every proposal:

1. **No Capacitor or Ionic framing.** The category is a _session debugger for Android apps on real devices_
   today, and grows into a _flight recorder_.
2. **The companion app is coming.** Connection tiers are ADB · shell agent · companion · in-app SDK, and
   the UI must show which tier delivered each value.
3. **Honesty comes first.** There is one derived link-and-health state, and one gate pattern on every
   surface. Every value carries its source and the time it was read.
4. **The timeline is the spine.** Evidence on one clock must be visible and central. It must not be a
   destination you navigate to.

## What exists today (see `round-01` evidence)

The shell is laid out in these regions:

| Region      | Contents                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Title bar   | Context crumb (device › app · state), Record, search/palette, terminal toggle, "Device" (mirror) toggle, window controls |
| Left rail   | Seven labelled items: Device, App, Data, Network, Elements, Replay, Flows. Settings sits at the bottom.                  |
| Sub-tab bar | One per area                                                                                                             |
| Content     | The area's screen                                                                                                        |
| Mirror pane | A **native child webview** for scrcpy, on the right, about 400 px                                                        |
| Status bar  | Connection states in mono                                                                                                |
| Dock        | Console and Logcat, hidden by default                                                                                    |

## The hard constraint: the native mirror

The mirror is a native child webview. **HTML cannot draw over it**: no popover, dialog, menu, toast or
tooltip can overlap its rectangle.

Today the app hides the mirror or moves it out of the way while a modal is open. Every proposal must
design its layer stack around this, and say exactly what happens to the mirror for each overlay type.

## The questions every proposal must answer

1. **Region map.** Define every persistent region, with sizes in px at 1920×1080 and 1280×800, its
   minimum and maximum, and what collapses first when the window is narrower.
2. **Navigation model.**
   - What does the rail represent (jobs, lenses, objects, or none)?
   - Are tabs documents or modes?
   - How does the inspector follow the selection?
   - How do back and forward work?
   - Map **every** capability in `docs/design/2026-09-12-capability-inventory.md` to a home. Nothing may
     be orphaned or duplicated.
3. **Timeline and context placement.**
   - Where does the global timeline live?
   - How is "live" (the right edge) distinguished from "recorded" (an opened `.capu`)?
   - How does the context bar show the device, app, target, tier and freshness?
4. **Layer stack.** Give the z-order from base to top: shell, panes, sticky headers, inspector,
   popovers, menus, the palette, dialogs, toasts, drag ghosts. For each layer, say how it coexists with
   the native mirror.
5. **Docking and splitting.**
   - What can be split, dragged, pinned or detached?
   - What persists across relaunches?
   - What is fixed on purpose?
6. **Screen templates.** Define four to six layout templates (for example list–detail, grid with
   inspector, tree with detail, stream, timeline player, form). Assign every current screen to one
   template, and draw each template as an ASCII wireframe with measurements.
7. **States in the layout.** Say where the gate goes for each of these states, and what space it takes:
   - disconnected;
   - unauthorised;
   - target paused;
   - not debuggable;
   - companion missing;
   - empty;
   - loading;
   - error.
8. **Personas.**
   - How does the same shell serve a developer at the desk, a QA tester capturing a session, and a
     support person opening a received `.capu`?
   - Is there a mode switch, or progressive disclosure?
9. **Density and grid.** Give the base unit, row heights, gutters, panel paddings and type sizes
   per region. Every value must use Cladd components and Bench tokens (`apps/desktop/DESIGN.md`,
   `packages/cladd/src`).
10. **Migration.** Describe how to get from today's shell to this one in shippable steps, without a big
    bang.

## Prior art to judge, not to obey

`docs/design/2026-11-04-ui-ux-rewrite-study.md` §4 proposes this anatomy:

- context bar;
- labelled rail;
- document tabs;
- device pane;
- inspector;
- an always-visible timeline;
- the dock;
- the status bar.

The same team that is now under review proposed it, and it was never built or critiqued. Beat it, fix
it, or reject it, with reasons.

`docs/design/2026-09-12-persistent-shell-contract.md` is an older contract with the same status.
