# Extension specification: `NavRail` family

Cladd extension — not an upstream port. Reuses Cladd `Button` and `Surface` (levels, solid and
transparent variants, outline bevel, hover and press overlays, focus ring), the radius and text
tokens, and the 200ms motion role. Composition research: Material 3 navigation rail, VS Code
activity bar, and the WAI-ARIA `aria-current` pattern (inventory only, no source copied).

## Purpose

A vertical application rail of primary destinations: an icon over a short label, the current
destination raised from the window background, and a footer pinned to the bottom for utility
destinations such as settings. It sits directly on the window background, outside any panel.

Without labels the rail is icon-only: larger icons, and each item explains itself in a tooltip
beside it, so the explanation never covers the neighbouring items the way a top or bottom tooltip
does in a vertical list.

Non-goals: routing, active-route matching, collapse animation, badges with counts, and nested
menus. The consumer decides which item is active and passes its router link component through `as`.

## Public API

| Name          | Kind      | Props                                                                  | Defaults                                                                                        |
| ------------- | --------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `NavRail`     | component | `as`, `labels`                                                         | `as 'nav'`, `labels true`                                                                       |
| `NavRailItem` | component | `as`, `label`, `active`, `current`, `hideLabel`, `disabled`, `tooltip` | `as 'a'`, `active false`, `current 'page'`, `hideLabel false`, `disabled false`, `tooltip true` |

Slots: `NavRail` has `default` (items) and `footer` (pinned to the bottom). `NavRailItem` has `icon`
(scoped with `{ active }`, so the consumer can draw a filled glyph for the current destination and
an outline one otherwise; the rail stays icon-set agnostic),
`indicator` (a small status mark in the top-right corner, for example an unread dot) and `hint`
(extra tooltip content after the label, for example a key hint or a maturity word).
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

Side tooltip: while the label is not drawn (icon-only rail or `hideLabel`) and `tooltip` is on, the
item renders a `NavRailTooltip` (internal, not exported): a Cladd tooltip surface teleported to the
overlays root and anchored with CSS anchor positioning at `position-area: center right`, 8px from
the item, falling back with `flip-inline`. It repeats the accessible name visually, so it is
`aria-hidden` and the item keeps `aria-label` as its only name.

## Keyboard behavior

| Key       | Outcome                                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| Tab       | Moves through items in document order, footer last; a keyboard-focused icon-only item shows its tooltip at once. |
| Escape    | Hides the side tooltip.                                                                                          |
| Enter     | Activates the item's native link or button behaviour.                                                            |
| Shift+Tab | Moves backwards.                                                                                                 |

No roving focus: a rail is a short list of links, each in the tab order. The focus ring is the
Cladd `Button` ring drawn inside the item (`tightFocusRing`) so it never leaves the rail column.

## State

`active` is controlled by the consumer. `NavRail` provides `labels` to its items through injection;
an item outside a rail behaves as if labels are shown. Each item owns one tooltip flag
(`useNavRailTooltip`): mouse hover opens it after Cladd's shared tooltip delay (so moving down the
rail after the first one is instant), keyboard focus (`:focus-visible`) opens it at once, and
leaving, a press, blur or Escape closes it. Touch never opens it.

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

| Part       | Labels shown                | Labels hidden    |
| ---------- | --------------------------- | ---------------- |
| Rail width | `w-16` (64px)               | `w-14` (56px)    |
| Item size  | `w-13.5 h-12.5` (54 × 50px) | `size-11` (44px) |
| Icon       | `size-4.25` (17px)          | `size-5` (20px)  |
| Label      | `text-cladd-2xs`, gap 3px   | side tooltip     |
| Indicator  | `top-1.5 right-2.5`         | `top-2 right-2`  |

Tooltip: Cladd's tooltip surface (gradient, level 5 dark or 1 light, outline, `rounded-cladd-tooltip`,
`text-cladd-xs`, scale and fade over 200ms) growing from its left edge (`origin-left`).

Active item: `Surface` `variant="solid"` at level `+2` with `outline` (the Cladd bevel),
`text-cladd-fg`, medium weight. Inactive item: `variant="transparent"`, `text-cladd-fg-softer`,
hover overlay `bg-cladd-surface-hover` and `text-cladd-fg`. Radius `rounded-cladd-md`. Items are
spaced 4px apart with a 4px top inset. Motion is the Surface 200ms colour role, and press scaling
follows `Button`; both collapse under reduced motion with the rest of Cladd.

## Performance

Linear in items. One injected computed per rail. Each icon-only item adds one watcher and at most
one pending timer; its tooltip mounts only while open, so a closed rail renders no overlay nodes.

## Tests

`tests/components/navRail.test.ts` covers: nav root and accessible name, labelled sizing, compact
sizing with labels moved to `aria-label` and the 20px icon, `hideLabel`, `aria-current` and
`data-active` on the active item only, the raised surface level and outline on the active item,
polymorphic `as` with forwarded attributes, the footer slot, the indicator slot, `disabled`, the
side tooltip on hover with its `hint` slot and `aria-hidden`, a press cancelling a pending tooltip,
no tooltip for labelled, disabled or `tooltip: false` items, and the right-side anchor style, and the `active` flag passed to the icon slot.

## Evidence

Validated with `vp check` and the package tests. Visual reference: the Capubridge shell design
(window `#0f0f0f`, raised `#1c1c1c`, soft bevel), consumed by Capubridge's primary rail. No
recorded browser capture in this package yet.

## Provenance

Cladd extension — not an upstream port. Reuses Cladd `Button`/`Surface`, surface levels, outline
bevel, radius, text and motion tokens. Composition research: Material 3 navigation rail, VS Code
activity bar, WAI-ARIA `aria-current` (inventory only, no source copied).
