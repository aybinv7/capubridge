# Checkbox

`Checkbox` is the native Vue port of Cladd's selectable control. Its checked state uses the same filled-gradient thumb, check glyph, focus treatment, and `xs` / `sm` / `md` geometry.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Checkbox } from "@capubridge/ui";

const subscribed = ref(false);
</script>

<template>
  <Checkbox v-model="subscribed" color="green" name="newsletter" value="weekly" />
</template>
```

## API

| Prop                     | Type                   | Default         | Description                                                       |
| ------------------------ | ---------------------- | --------------- | ----------------------------------------------------------------- |
| `v-model`                | `boolean`              | `false`         | Vue equivalent of Cladd's controlled `checked` / `onChange` pair. |
| `checked`                | `boolean`              | —               | Controlled state alias; listen for `update:checked` or `change`.  |
| `as`                     | `string \| Component`  | `"label"`       | Root element.                                                     |
| `input`                  | `boolean`              | `true`          | Enables native form input; false enables ARIA keyboard mode.      |
| `inputId`                | `string`               | —               | Native input id. `id` remains a compatibility alias.              |
| `color`                  | `UiAccent`             | provider accent | Checked-state accent.                                             |
| `accent`                 | `UiAccent`             | provider accent | CapuBridge alias; `color` takes precedence.                       |
| `size`                   | `"xs" \| "sm" \| "md"` | `"sm"`          | Thumb and glyph dimension.                                        |
| `disabled`               | `boolean`              | `false`         | Dims and blocks interaction.                                      |
| `readOnly`               | `boolean`              | `false`         | Blocks interaction without dimming.                               |
| `required`               | `boolean`              | `false`         | Native or ARIA required state.                                    |
| `name`, `value`          | `string`               | —               | Native form semantics.                                            |
| `hoverable`, `focusable` | `boolean`              | computed        | Override interaction and focus affordances.                       |
| `thumbOutline`           | `boolean`              | `true`          | Toggles the thumb outline.                                        |
| `checkClassName`         | `string`               | —               | Extra class on the check SVG.                                     |

`input="false"` renders `role="checkbox"`, `aria-checked`, and keyboard Space/Enter toggling. The component emits `change(checked, event?)` and `update:checked`; ordinary `v-model` is the recommended Vue contract.

## Upstream evidence

The contract follows the pinned Cladd `Checkbox.tsx` source and the public [Checkbox documentation](https://cladd.io/react/components/checkbox/). Vue maps the React controlled pair to `v-model` while preserving the native-input and ARIA fallback modes.
