# Extension specification: `Field` family

Cladd extension — not an upstream port. Reuses Cladd design tokens, surface density, accent
scoping, size ladder, and motion roles. Composition research: WAI-ARIA Authoring Practices form
guidance and shadcn field/input-group inventory (inventory only, no source copied).

## Purpose

One accessible layout, identification, description, and validation contract around current and
future form controls. `Field` owns the control/label/description/error ID graph so consumers stop
hand-wiring `for`, `aria-describedby`, and `aria-invalid` per control.

Non-goals: business validation, submission, value formatting, and option-data ownership. Controls
keep their own value contracts; `Field` only carries identification and state.

## Public API

| Name               | Kind      | Props                                                                          | Defaults                                                                                                           |
| ------------------ | --------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `Field`            | component | `as`, `controlId`, `density`, `disabled`, `invalid`, `orientation`, `required` | `as 'div'`, `density 'comfortable'`, `disabled false`, `invalid false`, `orientation 'vertical'`, `required false` |
| `FieldGroup`       | component | `as`, `label`                                                                  | `as 'div'`, `label ''`                                                                                             |
| `FieldLabel`       | component | `as`, `controlId`                                                              | `as 'label'`                                                                                                       |
| `FieldDescription` | component | `as`, `descriptionId`                                                          | `as 'p'`                                                                                                           |
| `FieldError`       | component | `as`, `errorId`, `live`                                                        | `as 'p'`, `live false`                                                                                             |
| `FieldSet`         | component | `disabled`, `legend`                                                           | `disabled false`                                                                                                   |
| `FieldLegend`      | component | `as`                                                                           | `as 'legend'`                                                                                                      |

Events: none. Slots: `default` everywhere, plus `legend` on `FieldSet`. Types: `FieldProps`,
`FieldGroupProps`, `FieldLabelProps`, `FieldDescriptionProps`, `FieldErrorProps`,
`FieldSetProps`, `FieldLegendProps`, matching `*DefaultProps`, `FieldOrientation`
(`'horizontal' | 'vertical'`), `FieldDensity` (`'comfortable' | 'compact'`). All Vue-only idioms.

## Semantics

`Field` renders a `div[data-slot="field"]` with `data-disabled`/`data-invalid` state hooks.
`FieldLabel` renders `label[for]` targeting the field control ID with matching `id` on itself.
`FieldDescription` renders `p[data-slot="field-description"]`; `FieldError` renders
`p[data-slot="field-error"]`. `FieldSet` renders a native `fieldset[disabled]` so the platform
disables every nested native control; `FieldLegend` renders a native `legend`. `FieldGroup`
renders `div[role="group"]` with `aria-labelledby` when a title is supplied through the consumer.

Explicit consumer IDs win: `controlId` on `Field`, `descriptionId` on `FieldDescription`,
`errorId` on `FieldError` override generated IDs. Generated IDs use Vue `useId()` and are unique
per mounted field.

## Keyboard behavior

No key bindings. `FieldLabel[for]` activates the associated native control through the platform.
No roving focus, no global listeners, no watchers beyond prop-derived computed state.

## State

`Field` provides `invalid`, `required`, `disabled`, `orientation`, and `density` to descendants
through injection. `FieldDescription` and `FieldError` register their IDs on mount and unregister
on unmount; `describedBy` is the registered description IDs plus the error IDs when `invalid`.
Errors join descriptions instead of replacing instructions.

`FieldError` with `live` renders `role="alert"`. Initially rendered errors must keep `live`
unset so assistive technology does not force-announce the page; a dynamically shown `FieldError`
may opt into `live` for announcement.

## Composition

`FieldLabel`, `FieldDescription`, and `FieldError` must be used inside a `Field` and throw
outside one. Fields nest: inner fields generate their own ID graph. `FieldSet` provides disabled
state downward without owning field IDs. `Input`, `Textarea`, `Checkbox`, `Radio`, and `Switch`
consume the context opt-in: their explicit `inputId`/`id`, `disabled`, `required`, and `valid`
props win, otherwise they resolve the control ID, disabled (including fieldset), required,
`aria-describedby`, and `aria-invalid` from the field. `Select`, `NumberField`, and `OTPField`
do not consume field context yet; wrap them in `Field` for layout and wire their accessible
attributes manually until the follow-up lands.

## Styling

`text-cladd-xs` labels, `text-cladd-2xs` descriptions, error text in the primary accent tone.
Vertical stack (`flex-col gap-1.5`, `gap-1` compact) or horizontal (`flex-row gap-3`).
`FieldSet` is unstyled natively; disabled groups dim to 70% opacity. No motion.

## Performance

Computed-only derivation, no listeners, no observers, no timers. Render cost is linear in the
supplied children. Description/error registries are small arrays replaced on change.

## Tests

`tests/components/field.test.ts` covers label activation, explicit IDs winning, `aria-invalid`
with joined description IDs, multiple descriptions, dynamic `live` errors, duplicate-ID freedom,
disabled fieldsets, nested groups, addon logical placement, and standalone-control stability.

## Evidence

Validated with `vp run cladd-vue#check` and `vp run cladd-vue#test -- --run`. Browser zoom, RTL,
and forced-colors paths are unit-asserted through logical properties and have no recorded
browser capture yet.

## Provenance

Cladd extension — not an upstream port. Reuses Cladd text tokens (`text-cladd-xs/2xs`),
foreground tones, density scale, and disabled opacity conventions. Composition research: WAI-ARIA
form practices and shadcn field/input-group inventory (inventory only, no source copied).

## Migration from manual association

Replace hand-wired `id`/`for`/`aria-describedby` triples with a `Field` wrapper: move the label
text into `FieldLabel`, help text into `FieldDescription`, and validation text into `FieldError`.
Drop the manual `aria-invalid` on the control; `invalid` on `Field` plus `valid` on the control
now derives it. Boolean controls (`Checkbox`, `Radio`, `Switch`) keep their root-label markup;
inside a `Field`, prefer `as="div"` on the control when a separate `FieldLabel` is used so labels
do not nest.
