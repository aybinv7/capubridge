# Extension specification: `NavRail` family

Cladd extension — not an upstream port. Reuses Cladd `Button` and `Surface` (levels, solid and
transparent variants, outline bevel, hover and press overlays, focus ring), the radius and text
tokens, and the 200ms motion role. Composition research: Material 3 navigation rail, VS Code
activity bar, and the WAI-ARIA `aria-current` pattern (inventory only, no source copied).

## Purpose

A vertical application rail of primary destinations: an icon over a short label, the current
destination raised from the window background, and a footer pinned to the bottom for utility
destinations such as settings. It sits directly on the window background, outside any panel.

Non-goals: routing, active-route matching, tooltips, collapse animation, badges with counts, and
nested menus. The consumer decides which item is active, passes its router link component through
`as`, and wraps items in its own tooltip.

## Public API

| Name          | Kind      | Props                                                       | Defaults                                                                        |
| ------------- | --------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `NavRail`     | component | `as`, `labels`                                              | `as 'nav'`, `labels true`                                                       |
| `NavRailItem` | component | `as`, `label`, `active`, `current`, `hideLabel`, `disabled` | `as 'a'`, `active false`, `current 'page'`, `hideLabel false`, `disabled false` |

Slots: `NavRail` has `default` (items) and `footer` (pinned to the bottom). `NavRailItem` has `icon`
and `indicator` (a small status mark in the top-right corner, for example an unread dot).
`label` is required. Native attributes (`href`, `to`, `aria-*`, listeners) forward to the root.
Types: `NavRailProps`, `NavRailItemProps`, `NavRailItemCurrent`, and the matching `*DefaultProps`.
Both components read `CladdProvider` defaults under `NavRail` and `NavRailItem`.

## Semantics

`NavRail` renders `nav` (or `as`) with `data-labels` while labels are shown; the consumer names it
with `aria-label`. The footer renders `div[data-slot="nav-rail-footer"]`. `NavRailItem` renders a
Cladd `Button` as `a` (or `as`). While active it sets `aria-current` to `current` and
`data-active`. With labels shown the label is visible text (`span[data-slot="nav-rail-item-label"]`)
and is the accessible name; when the rail hides labels or the item sets `hideLabel`, the label
moves to `aria-label`. `disabled` follows Cladd `Button` (`data-disabled`, `aria-disabled` on
non-button roots, pointer events off).

## Keyboard behavior

| Key       | Outcome                                               |
| --------- | ----------------------------------------------------- |
| Tab       | Moves through items in document order, footer last.   |
| Enter     | Activates the item's native link or button behaviour. |
| Shift+Tab | Moves backwards.                                      |

No roving focus: a rail is a short list of links, each in the tab order. The focus ring is the
Cladd `Button` ring drawn inside the item (`tightFocusRing`) so it never leaves the rail column.

## State

Stateless. `active` is controlled by the consumer. `NavRail` provides `labels` to its items
through injection; an item outside a rail behaves as if labels are shown.

## Composition

```
NavRail (labels)
├── NavRailItem × n   (icon slot, label, indicator slot)
└── footer slot
    └── NavRailItem × n
```

Items may be wrapped in a tooltip trigger. The rail does not create a surface, so items resolve
their levels against the enclosing surface (the window background in a desktop shell).

## Styling

| Part       | Labels shown                | Labels hidden |
| ---------- | --------------------------- | ------------- |
| Rail width | `w-16` (64px)               | `w-12` (48px) |
| Item size  | `w-13.5 h-12.5` (54 × 50px) | `size-10`     |
| Icon       | `size-4.25` (17px)          | same          |
| Label      | `text-cladd-2xs`, gap 3px   | not drawn     |

Active item: `Surface` `variant="solid"` at level `+2` with `outline` (the Cladd bevel),
`text-cladd-fg`, medium weight. Inactive item: `variant="transparent"`, `text-cladd-fg-softer`,
hover overlay `bg-cladd-surface-hover` and `text-cladd-fg`. Radius `rounded-cladd-md`. Items are
spaced 4px apart with a 4px top inset. Motion is the Surface 200ms colour role, and press scaling
follows `Button`; both collapse under reduced motion with the rest of Cladd.

## Performance

Linear in items. One injected computed per rail, no watchers, observers, timers or listeners.

## Tests

`tests/components/navRail.test.ts` covers: nav root and accessible name, labelled sizing, compact
sizing with labels moved to `aria-label`, `hideLabel`, `aria-current` and `data-active` on the
active item only, the raised surface level and outline on the active item, polymorphic `as` with
forwarded attributes, the footer slot, the indicator slot, and `disabled`.

## Evidence

Validated with `vp check` and the package tests. Visual reference: the Capubridge shell design
(window `#0f0f0f`, raised `#1c1c1c`, soft bevel), consumed by Capubridge's primary rail. No
recorded browser capture in this package yet.

## Provenance

Cladd extension — not an upstream port. Reuses Cladd `Button`/`Surface`, surface levels, outline
bevel, radius, text and motion tokens. Composition research: Material 3 navigation rail, VS Code
activity bar, WAI-ARIA `aria-current` (inventory only, no source copied).
