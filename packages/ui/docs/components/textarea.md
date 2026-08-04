# Textarea

Multi-line text editor for dense forms. Ported from `reference/cladd/src/components/Textarea.tsx`.

It reuses the field chrome of `Input` — a recessed `SurfaceCut`, a multiline `FocusRing`, the same
message treatment — but the editable area is a `contenteditable` element, not a native `<textarea>`,
matching upstream. Consequences are deliberate and load-bearing:

- It does not participate in form submission or `form.reset()`. There is no `name` prop, exactly as
  upstream has none. Read the value through `v-model`.
- `maxlength` is enforced in JavaScript, because the platform does not enforce it on `contenteditable`.
  Clamping restores the caret to the end of the content.
- Paste is intercepted and re-inserted as plain text, so pasted markup never enters the editor.
- The placeholder is a separate overlay layer, since `::placeholder` does not apply.
- There are no `rows` or `resize` props; upstream has neither, and height comes from `size`.

## Props

| Prop                    | Type                                    | Default   | Notes                                                                |
| ----------------------- | --------------------------------------- | --------- | -------------------------------------------------------------------- |
| `v-model`               | `string`                                | `""`      | Editor content.                                                      |
| `as`                    | `string \| Component`                   | `"div"`   | Root element of the surface.                                         |
| `size`                  | `"sm" \| "md" \| "lg" \| "xl" \| "2xl"` | `"lg"`    | Drives min-height, padding, radius.                                  |
| `placeholder`           | `string`                                | —         | Overlay layer shown while the editor is empty.                       |
| `maxlength`             | `number`                                | —         | Enforced in JavaScript with caret restoration.                       |
| `disabled`              | `boolean`                               | `false`   | Removes `contenteditable` and dims the control.                      |
| `readonly`              | `boolean`                               | `false`   | Removes `contenteditable`, keeps content selectable.                 |
| `rounded`               | `boolean`                               | `false`   | Pill radii compatible with multi-line content.                       |
| `valid`                 | `boolean`                               | `true`    | `false` forces a red focus ring and `aria-invalid`.                  |
| `infoMessage`           | `string`                                | —         | Shown while focused and not read-only, wired via `aria-describedby`. |
| `errorMessage`          | `string`                                | —         | Shown when `valid` is `false`, wired via `aria-describedby`.         |
| `updateContentOnChange` | `boolean`                               | `true`    | Write external model changes back into the editor DOM.               |
| `tightFocusRing`        | `boolean`                               | `false`   | Ring flush against the element instead of offset outside it.         |
| `accent` / `color`      | `UiAccent`                              | context   | `color` wins, then `accent`, then the provider accent.               |
| `contentClassName`      | `string`                                | —         | Classes for the inner content row.                                   |
| `inputClassName`        | `string`                                | —         | Classes for the editor element.                                      |
| `placeholderClassName`  | `string`                                | —         | Classes for the placeholder layer.                                   |
| `iconClassName`         | `string`                                | —         | Classes for the icon wrapper.                                        |
| `id`                    | `string`                                | generated | Applied to the editor element.                                       |

Attributes land on the surface root. Pass `aria-labelledby` to name the control — `<label for>` does not
associate with a `contenteditable` element.

## Slots

| Slot     | Purpose                              |
| -------- | ------------------------------------ |
| `icon`   | Leading icon inside the content row. |
| `prefix` | Content before the editor.           |
| `suffix` | Content after the editor.            |

## Events and exposed methods

| Name      | Payload         | Notes                                 |
| --------- | --------------- | ------------------------------------- |
| `focus`   | `FocusEvent`    | From the editor element.              |
| `blur`    | `FocusEvent`    | From the editor element.              |
| `keydown` | `KeyboardEvent` | From the editor element.              |
| `focus()` | —               | Exposed method; no-op while inactive. |

## Usage

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Textarea } from "@capubridge/ui";

const notes = ref("");
</script>

<template>
  <span id="notes-label">Release notes</span>
  <Textarea
    v-model="notes"
    aria-labelledby="notes-label"
    info-message="Shown in the session report"
    :maxlength="280"
    placeholder="What changed?"
    size="lg"
  />
</template>
```

## Divergences from upstream

- `v-model` replaces upstream's `value` plus `onChange(value, event)`.
- Native-cased `readonly` / `maxlength` / `id` instead of `readOnly` / `maxLength` / `inputId`.
- `accent` is an alias for `color`; `color` wins when both are set.
- Provider-level per-component defaults (`useComponentDefaults`) are not implemented package-wide.
- `role="textbox"` and `aria-multiline` are added; upstream sets neither. Kept because a
  `contenteditable` element carries no implicit textbox semantics. Registered rather than reverted.
