# Extension specification: `StatusDot`

Cladd extension, not an upstream port. Reuses Cladd's accent colour scopes (`cladd-color-*` and
`--cladd-primary`), the `fg-softer` ink for the quiet neutral, and the reduced-motion rule. Composition
research: GitHub Primer `StateLabel` dots, Linear status marks, the macOS window-list dot, and the
WAI-ARIA `img` role for a named graphic (inventory only, no source copied).

## Purpose

A small round mark that states one condition next to a label: online, live, stale, failed, starting.
It is the mark only. The meaning must also be carried by the adjacent text or by `label`, never by
the colour alone.

Non-goals: counts, badges with text, avatars, and positioning over another element. The consumer
places the dot inline (or in a `NavRailItem` `indicator` slot) and owns its spacing.

## Public API

| Name        | Kind      | Props                                        | Defaults                                          |
| ----------- | --------- | -------------------------------------------- | ------------------------------------------------- |
| `StatusDot` | component | `color`, `label`, `pulse`, `size`, `variant` | no `color`, `pulse false`, `size 'sm'`, `'solid'` |

`color` is a Cladd `Color` token; omitted, the dot is the quiet neutral (`fg-softer`), which reads as
"present, nothing to report" or, hollow, "absent / unknown". `size` is `xs` (5px), `sm` (6px) or `md`
(8px). `variant` is `solid` or `hollow` (a 1px inset ring). `pulse` breathes the dot while a state is
in progress. Types: `StatusDotProps`, `StatusDotDefaultProps`, `StatusDotSize`, `StatusDotVariant`.
Reads `CladdProvider` defaults under `StatusDot`. Native attributes forward to the root.

## Semantics

Renders `span.cladd-status-dot`. With `label` it is `role="img"` named by `label`; without it, it is
`aria-hidden="true"` and the surrounding text must say the state. `data-color`, `data-variant` and
`data-pulse` reflect the props for styling and tests.

## Keyboard behavior

None. The dot is not focusable and has no interaction.

## State

Stateless and controlled.

## Composition

```
<row>
├── StatusDot (color, variant)
└── text that names the state
```

## Styling

| Part   | Solid                       | Hollow                                   |
| ------ | --------------------------- | ---------------------------------------- |
| Accent | `bg-cladd-primary`          | `ring-1 ring-inset ring-cladd-primary`   |
| Quiet  | `bg-cladd-fg-softer`        | `ring-1 ring-inset ring-cladd-fg-softer` |
| Shape  | `rounded-full`, `shrink-0`  | same                                     |
| Pulse  | `motion-safe:animate-pulse` | same                                     |

The accent hue comes from the active `cladd-color-*` scope, so a consumer that maps accents to
meanings (danger, success, warning, live) gets the right hue without new tokens.

## Performance

One element, one computed class string, no watchers, timers or listeners. The pulse is a CSS
animation and stops under `prefers-reduced-motion`.

## Tests

`tests/components/statusDot.test.ts` covers: decorative default (hidden, quiet fill, small size),
labelled `img` role with accent scope, hollow ring for quiet and accent, the three sizes,
motion-safe pulse, forwarded classes and attributes, and provider defaults.

## Evidence

Validated with `vp check` and the package tests. Visual reference: the Capubridge device manager
and screen column (device online, target attached, stream live / stopped), consumed through the
vendored package.

## Provenance

Cladd extension, not an upstream port. Reuses Cladd colour scopes, ink tokens and the
reduced-motion convention. Composition research: Primer, Linear, macOS status marks, WAI-ARIA `img`
(inventory only, no source copied).
