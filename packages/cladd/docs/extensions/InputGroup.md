# Extension specification: `InputGroup` family

Cladd extension — not an upstream port. Reuses Cladd design tokens, Button sizing and surface
behavior, density scale, and foreground tones. Composition research: WAI-ARIA Authoring Practices
and shadcn input-group inventory (inventory only, no source copied).

## Purpose

One flex row that joins a text control with leading/trailing addons and buttons without stealing
the control's accessible name. Covers currency affixes, units, inline actions, and password
toggles around `Input` and `Textarea`.

Non-goals: validation, value transformation, and option lists. State stays in the wrapped
control and the surrounding `Field`.

## Public API

| Name                 | Kind                        | Props                                                                                 | Defaults                                                                   |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `InputGroup`         | component                   | `as`, `disabled`                                                                      | `as 'div'`, `disabled false`                                               |
| `InputGroupAddon`    | component                   | `as`, `decorative`, `interactive`, `side`                                             | `as 'span'`, `decorative true`, `interactive false`, `side 'inline-start'` |
| `InputGroupButton`   | component                   | `as`, `color`, `disabled`, `label`, `size`, `variant`                                 | `size 'xs'`, `variant 'solid'`                                             |
| `InputGroupInput`    | component, `v-model` string | `disabled`, `inputId`, `name`, `placeholder`, `readOnly`, `required`, `type`, `valid` | `type 'text'`, `valid true`                                                |
| `InputGroupTextarea` | component, `v-model` string | `disabled`, `placeholder`, `readOnly`, `valid`                                        | `valid true`                                                               |

Events: `change` on `InputGroupInput` and `InputGroupTextarea`. Slots: `default` everywhere.
Types: `InputGroupProps`, `InputGroupAddonProps`, `InputGroupAddonSide`
(`'inline-start' | 'inline-end'`), `InputGroupButtonProps`, `InputGroupInputProps`,
`InputGroupTextareaProps`, matching `*DefaultProps`. All Vue-only idioms.

## Semantics

`InputGroup` renders `div[data-slot="input-group"]` with `data-disabled`. Addons render
`span[data-slot="input-group-addon"][data-side]`; decorative non-interactive addons carry
`aria-hidden="true"` so affix text never becomes the control's name. Interactive addons keep
their own semantics. `InputGroupButton` renders the package `Button` with an explicit
`aria-label` hook through `label`. Controls render through `Input`/`Textarea` with
`data-slot="input-group-control"`.

## Keyboard behavior

No key bindings of its own. Tab order follows DOM order: addon content (when interactive),
control, trailing action. Buttons keep native Button keyboard behavior.

## State

`InputGroup` provides disabled state and a fallback control ID. `InputGroupInput` resolves its
`inputId` from its own prop, then the surrounding `Field`, then the group. Disabled resolves
from its own prop, then the group, then the field. `invalid` derives from `valid` plus field
state and flows into the wrapped control.

## Composition

Usable standalone or inside `Field`. `InputGroupInput` and `InputGroupTextarea` wrap the
package controls and inherit their contracts. Addons use logical `order-first`/`order-last`
placement so `side="inline-start"` stays leading under RTL without prop changes.

## Styling

Flex row with stretched items; the wrapped control flexes (`min-w-0 flex-1`). Addons use
`text-cladd-xs text-cladd-fg-softer` with inline padding. Buttons reuse Button `xs`/`sm` sizing
and surface variants. Disabled groups dim to 70% opacity. No motion.

## Performance

Computed-only derivation, no listeners, no observers. Render cost is linear in children.

## Tests

Covered in `tests/components/field.test.ts`: RTL logical placement, addon name isolation,
button sizing passthrough, and control ID inheritance through `Field`.

## Evidence

Validated with `vp run cladd-vue#check` and `vp run cladd-vue#test -- --run`. No recorded
browser capture yet.

## Provenance

Cladd extension — not an upstream port. Reuses Cladd Button sizing/surfaces, text and
foreground tokens, and density conventions. Composition research: shadcn input-group inventory
(inventory only, no source copied).
