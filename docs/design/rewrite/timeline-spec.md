# Global timeline strip — owner's pick (2026-11-06)

The owner reviewed three HTML options (A inset tray, B seam, C instrument rail) and composed one
design from the best of each. This file is the source of truth for v1 UI. The data comes from
`src/stores/timeline.store.ts` (marker ring, 1 s buckets, reveal registry, host clock), and the
scope and honesty rules from `timeline-sources.md` §3–4.

## Resting state (A, trimmed)

- **A's inset tray.** A floating card under the page content, on the same background as the page,
  separated from it by Cladd depth (`--bevel`, rounded corners, a small gap). It must read as its
  own surface that belongs to the page.
- **No left section.** Drop A's left block (the "Last 5 min" label and legend). The strip starts
  directly with the timeline.
- **Inside: B's rendering.** Stacked per-second density bars, quiet tones, with errors as small
  red caps along the top of their bucket. Colour means something only where DESIGN.md says so.
- **Right cluster:** `1m · 5m · 15m` (Cladd Segmented), the current clock time, then the eye
  toggle that hides the strip.

## Hover (A's expand + C's axis)

- **A's expand.** Hovering the strip grows it smoothly from 28 px to about 64 px with Cladd spring
  motion. It overlays upward and does not push the page.
- **Lane labels on the left, shown only when expanded:** Errors, Network, Console, Logcat, each
  with its count. The lanes separate into rows.
- **Click a lane label to filter.** The lane is never removed. It goes dim (disabled), its marks
  fade, and it drops out of the counts and the click preview. Click again to restore. The choice
  persists.
- **C's time axis, shown only when expanded:** `-5 min … -1 min … now` (it follows the chosen
  window), plus the live "now" edge.
- **Bucket hover card:** the same in every option. A Cladd tooltip with counts per lane for that
  second and the time.

## Click a moment (C's preview)

- A Cladd popup above the strip.
- **At its top, C's magnified second:** a mini timeline of that one second, with each item placed
  by millisecond and coloured by lane.
- **Below it, the item list:** up to 20 items, mixed types in time order (time, lane icon, label),
  each with "Go to". "Go to" navigates to the section and calls the reveal registry (select the
  request, scroll to and flash the row).
- **Aged-out items** stay listed but say so plainly ("No longer kept — Console keeps the last
  10,000").
- **Recording ranges:** a click inside one offers "Open the recording at this moment".

## Hide

- The eye hides the strip; the choice persists.
- It comes back from a shortcut and from a quiet control in the shell (the status area or the
  panel toggles in the title bar). The shortcut must not clash with existing ones; check
  `commands.store` and the dock.

## Relation to the dock

The console drawer that replaces the dock is a later step (console UI round). For v1 the strip
sits at the bottom of the main work column, and the existing dock keeps opening above it.
Design so the drawer can later grow out of the tray.

## Performance

- Paint at most 10 times a second, and never while the window is hidden.
- Use a canvas, or one SVG path per lane, not a DOM node per bar.
- Hover and expand use transforms only.
- No work per marker on the main thread outside the store's own batching.
