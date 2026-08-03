# Textarea

`Textarea` is the native Vue port of Cladd's multi-line text field. It reuses the field chrome of `Input` — a recessed `SurfaceCut`, a multiline `FocusRing`, and the same message treatment — but the editable area is a real `<textarea>`, so length limits, rows, resizing, and form submission are handled by the platform.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Textarea } from "@capubridge/ui";

const notes = ref("");
</script>

<template>
  <Textarea v-model="notes" :rows="4" placeholder="Session notes" info-message="Notes" />
</template>
```

## API

| Prop             | Type                                             | Default         | Description                                                   |
| ---------------- | ------------------------------------------------ | --------------- | ------------------------------------------------------------- |
| `v-model`        | `string`                                         | `""`            | Vue equivalent of Cladd's `value` / `onChange` pair.          |
| `size`           | `FieldSize`                                      | `"lg"`          | Minimum height, padding, and radius token.                    |
| `rows`           | `number`                                         | `3`             | Native visible row count.                                     |
| `resize`         | `"both" \| "horizontal" \| "none" \| "vertical"` | `"vertical"`    | Native CSS resize affordance on the control.                  |
| `accent`         | `UiAccent`                                       | provider accent | Focus ring and info-message accent.                           |
| `placeholder`    | `string`                                         | —               | Native placeholder.                                           |
| `name`           | `string`                                         | —               | Native name used for form submission.                         |
| `id`             | `string`                                         | generated       | Id of the inner `<textarea>`; wire an external `<label for>`. |
| `required`       | `boolean`                                        | `false`         | Native required state.                                        |
| `disabled`       | `boolean`                                        | `false`         | Dims the field to 50% and removes pointer interaction.        |
| `readonly`       | `boolean`                                        | `false`         | Non-editable but focusable; drops hover and focus ring.       |
| `autofocus`      | `boolean`                                        | `false`         | Native autofocus.                                             |
| `maxlength`      | `number`                                         | —               | Native maximum length, enforced by the browser.               |
| `valid`          | `boolean`                                        | `true`          | `false` turns the focus ring red and shows `errorMessage`.    |
| `errorMessage`   | `string`                                         | —               | Always-visible message shown while `valid` is `false`.        |
| `infoMessage`    | `string`                                         | —               | Floating label revealed on focus while valid and editable.    |
| `rounded`        | `boolean`                                        | `false`         | Uses pill corners instead of size radii.                      |
| `tightFocusRing` | `boolean`                                        | `false`         | Keeps the focus ring flush with the field.                    |

| Slot     | Purpose                                              |
| -------- | ---------------------------------------------------- |
| `prefix` | Content before the control, inside the field chrome. |
| `icon`   | Leading icon rendered inside the field chrome.       |
| `suffix` | Content after the control, inside the field chrome.  |

| Emit    | Payload      | Fired when                      |
| ------- | ------------ | ------------------------------- |
| `focus` | `FocusEvent` | The inner textarea gains focus. |
| `blur`  | `FocusEvent` | The inner textarea loses focus. |

The component sets `inheritAttrs: false` and forwards every remaining attribute and listener to the inner `<textarea>`, not to the root, so `@keydown`, `aria-label`, `wrap`, and `data-*` attributes reach the control. Clicking anywhere in the field chrome focuses the control unless the field is disabled, and `defineExpose` publishes `focus()` for template refs.

`FieldSize` is `"sm" | "md" | "lg" | "xl" | "2xl"` and is exported together with the `fieldSizes` list.

## Validation and messages

Message behavior matches `Input`: `errorMessage` is permanently visible while `valid` is `false`, `infoMessage` is shown while the field is valid and not `readonly` and animates in on focus, both render through one message element whose id is referenced by `aria-describedby`, and `aria-invalid` is set while `valid` is `false`. The focus ring is rendered in multiline mode so it tracks the field's grown height.

```vue
<script setup lang="ts">
import { computed, ref } from "vue";
import { Textarea } from "@capubridge/ui";

const summary = ref("");
const valid = computed(() => summary.value.trim().length >= 10);
</script>

<template>
  <Textarea
    v-model="summary"
    :maxlength="280"
    :rows="5"
    error-message="Describe the issue in at least 10 characters"
    info-message="Summary"
    name="summary"
    required
    :valid="valid"
  />
</template>
```

## Upstream evidence

The contract follows the pinned Cladd `Textarea.tsx` source plus the public [Textarea documentation](https://cladd.io/react/components/textarea/). The `lg` default size, the size-to-radius and padding mapping, the message behavior, the red invalid focus ring, and the `SurfaceCut` chrome keep the upstream values.

Divergences from upstream:

- **Native `<textarea>` instead of a `contenteditable` editor.** Upstream renders a `contenteditable` `<div>`: it enforces `maxLength` by hand on every input event, restores the caret to the end after clamping, intercepts paste to insert plain text through `document.execCommand`, tracks its own text state, syncs `value` back into `innerText`, and renders a separate placeholder layer because a `contenteditable` element has none. This port delegates all of that to the platform. The practical differences are that `maxlength` is enforced by the browser without caret repositioning, the placeholder is the native one, rich-text paste is handled by native `<textarea>` semantics (plain text only), and the value round-trips through `v-model` without a DOM sync step.
- Consequently there is no `updateContentOnChange`, no `placeholderClassName`, and no `inputClassName`; those props exist upstream only to manage the `contenteditable` DOM.
- `rows` and `resize` have no upstream equivalent. They are native `<textarea>` affordances this port exposes.
- `v-model` replaces `value` plus `onChange(value, event)`. The Vue component does not emit a `change` event.
- Native-facing props use native casing: `readonly`, `maxlength`, `autofocus`, and `id` instead of upstream `readOnly`, `maxLength`, `autoFocus`, and an editor id.
- `accent` replaces upstream `color`.
- No `as` polymorphic root, and no `className`, `contentClassName`, or `iconClassName` escape hatches. Extra classes go on the root through normal Vue class binding, and inner layers are styled through the `cui-textarea__*` selectors.
- Keyboard handling is not a prop. Upstream takes `onKeyDown`; here native listeners are forwarded to the control through attributes.
- `prefix`, `suffix`, and `icon` are slots rather than node props, and the icon is laid out in the field's flex row instead of being absolutely positioned with size-specific offsets.
- The native context menu is preserved. Upstream suppresses `contextmenu` on the field wrapper.
- Upstream's reserved, unused `inputPadding` prop is not ported.
- Per-component provider defaults are not implemented; upstream `Textarea` reads `useComponentDefaults('Textarea', props)`.
