# Input

`Input` is the native Vue port of Cladd's single-line text field. A recessed `SurfaceCut` supplies the chrome, a `FocusRing` supplies the focus and invalid treatment, and the value is edited in a real `<input>` element so native form submission, validation attributes, and autofill keep working.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Input } from "@capubridge/ui";

const filter = ref("");
</script>

<template>
  <Input v-model="filter" placeholder="Filter targets" clearable info-message="Package name" />
</template>
```

## API

| Prop             | Type                                                                                  | Default         | Description                                                |
| ---------------- | ------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------- |
| `v-model`        | `string`                                                                              | `""`            | Vue equivalent of Cladd's `value` / `onChange` pair.       |
| `size`           | `FieldSize`                                                                           | `"lg"`          | Height, padding, and radius token.                         |
| `accent`         | `UiAccent`                                                                            | provider accent | Focus ring and info-message accent.                        |
| `type`           | `string`                                                                              | `"text"`        | Native input type.                                         |
| `placeholder`    | `string`                                                                              | —               | Native placeholder.                                        |
| `name`           | `string`                                                                              | —               | Native name used for form submission.                      |
| `id`             | `string`                                                                              | generated       | Id of the inner `<input>`; wire an external `<label for>`. |
| `required`       | `boolean`                                                                             | `false`         | Native required state.                                     |
| `disabled`       | `boolean`                                                                             | `false`         | Dims the field to 50% and removes pointer interaction.     |
| `readonly`       | `boolean`                                                                             | `false`         | Non-editable but focusable; drops hover and focus ring.    |
| `autofocus`      | `boolean`                                                                             | `false`         | Native autofocus.                                          |
| `autocomplete`   | `string`                                                                              | —               | Native autocomplete token.                                 |
| `inputMode`      | `"decimal" \| "email" \| "none" \| "numeric" \| "search" \| "tel" \| "text" \| "url"` | —               | Mobile keyboard hint.                                      |
| `min`, `max`     | `number \| string`                                                                    | —               | Native range attributes for numeric and date types.        |
| `step`           | `number \| string`                                                                    | —               | Native step attribute.                                     |
| `maxlength`      | `number`                                                                              | —               | Native maximum length.                                     |
| `pattern`        | `string`                                                                              | —               | Native validation pattern.                                 |
| `clearable`      | `boolean`                                                                             | `false`         | Renders the trailing clear control.                        |
| `clearLabel`     | `string`                                                                              | `"Clear"`       | Label text forwarded to the clear control.                 |
| `valid`          | `boolean`                                                                             | `true`          | `false` turns the focus ring red and shows `errorMessage`. |
| `errorMessage`   | `string`                                                                              | —               | Always-visible message shown while `valid` is `false`.     |
| `infoMessage`    | `string`                                                                              | —               | Floating label revealed on focus while valid and editable. |
| `rounded`        | `boolean`                                                                             | `false`         | Uses pill corners instead of size radii.                   |
| `tightFocusRing` | `boolean`                                                                             | `false`         | Keeps the focus ring flush with the field.                 |

| Slot     | Purpose                                              |
| -------- | ---------------------------------------------------- |
| `prefix` | Content before the control, inside the field chrome. |
| `icon`   | Leading icon rendered inside the field chrome.       |
| `suffix` | Content after the control, inside the field chrome.  |

| Emit    | Payload      | Fired when                      |
| ------- | ------------ | ------------------------------- |
| `focus` | `FocusEvent` | The inner input gains focus.    |
| `blur`  | `FocusEvent` | The inner input loses focus.    |
| `clear` | none         | The clear control is activated. |

The component sets `inheritAttrs: false` and forwards every remaining attribute and listener to the inner `<input>`, not to the root. That is how `@keydown`, `aria-label`, `data-testid`, and any other native input attribute reach the control. Clicking anywhere in the field chrome focuses the control unless the field is disabled.

`FieldSize` is `"sm" | "md" | "lg" | "xl" | "2xl"` and is exported together with the `fieldSizes` list.

## Instance methods

`defineExpose` publishes `focus()` and `select()`, so a template ref can drive the control directly.

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Input } from "@capubridge/ui";

const value = ref("");
const field = ref<InstanceType<typeof Input>>();

onMounted(() => field.value?.select());
</script>

<template>
  <Input ref="field" v-model="value" />
</template>
```

## Validation and messages

`errorMessage` renders only while `valid` is `false`, and it is permanently visible. `infoMessage` renders while the field is valid and not `readonly`, and it animates in on focus. Both are rendered as one message element whose id is derived from the field id and referenced by `aria-describedby`; `aria-invalid` is set while `valid` is `false`, and the focus ring switches to the red accent and is forced visible in that state.

```vue
<script setup lang="ts">
import { computed, ref } from "vue";
import { Input } from "@capubridge/ui";

const serial = ref("");
const valid = computed(() => serial.value.length > 0);
</script>

<template>
  <Input
    v-model="serial"
    :valid="valid"
    error-message="Device serial is required"
    info-message="Device serial"
    name="serial"
    required
  />
</template>
```

## Clearing

`clearable` renders a rounded, square clear button sized one step below the field (`sm` → `2xs`, `md` → `xs`, `lg` → `sm`, `xl` → `md`, `2xl` → `lg`). It stays mounted while the field is empty but is disabled, `aria-hidden`, removed from the tab order, and visually collapsed. Activating it sets the model to an empty string, emits `clear`, and returns focus to the control.

## Upstream evidence

The contract follows the pinned Cladd `Input.tsx` source plus the public [Input documentation](https://cladd.io/react/components/input/). The `lg` default size, the size-to-radius mapping, the clear-button size mapping, the info and error message behavior, the red invalid focus ring, and the `SurfaceCut` chrome keep the upstream values.

Divergences from upstream:

- `v-model` replaces `value` plus `onChange(value, event)`. The Vue component does not emit a `change` event; use `v-model` or `update:modelValue`.
- Native-facing props use native casing: `readonly`, `maxlength`, `autofocus`, and `id` instead of upstream `readOnly`, `maxLength`, `autoFocus`, and `inputId`.
- `clearable` replaces upstream `clearButton`, and `accent` replaces upstream `color`.
- The clear control renders whenever `clearable` is set. Upstream also requires the field to be neither disabled nor read-only; here a disabled field is inert because the root is `pointer-events: none`, but a `readonly` field still exposes a working clear control.
- `clearLabel` is forwarded to the clear control as a `label` attribute rather than as `aria-label`, so the clear control has no accessible name today. Upstream sets `aria-label={clearLabel}`.
- No `displayValue`. Upstream can render a formatted node in place of the raw value while unfocused or read-only.
- No `inputComponent` / `inputComponentProps`. The control is always a native `<input>`; a masked-input library cannot be swapped in.
- No `as` polymorphic root, and no `className`, `contentClassName`, `inputClassName`, or `iconClassName` escape hatches. Extra classes go on the root through normal Vue class binding, and inner layers are styled through the `cui-input__*` selectors.
- Keyboard handling is not a prop. Upstream takes `onKeyDown`; here native listeners are forwarded to the control through attributes.
- `prefix`, `suffix`, and `icon` are slots rather than node props, and the icon is laid out in the field's flex row instead of being absolutely positioned with size-specific offsets.
- Per-component provider defaults are not implemented; upstream `Input` reads `useComponentDefaults('Input', props)`.
