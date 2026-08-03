# Radio

`Radio` is the native Vue port of Cladd's single-select indicator. It uses the same recessed thumb, filled-gradient checked state, native input mode, ARIA fallback, and `xs` / `sm` / `md` geometry as the source component.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Radio } from "@capubridge/ui";

const listView = ref(true);
</script>

<template>
  <Radio v-model="listView" name="view" value="list" color="brand" />
</template>
```

## API

| Prop                        | Type                   | Default         | Description                                                       |
| --------------------------- | ---------------------- | --------------- | ----------------------------------------------------------------- |
| `v-model`                   | `boolean`              | `false`         | Vue equivalent of Cladd's controlled `checked` / `onChange` pair. |
| `checked`                   | `boolean`              | —               | Controlled state alias; listen for `update:checked` or `change`.  |
| `as`                        | `string \| Component`  | `"label"`       | Root element.                                                     |
| `input`                     | `boolean`              | `true`          | Enables native form input; false enables ARIA keyboard mode.      |
| `inputId`                   | `string`               | —               | Native input id. `id` remains a compatibility alias.              |
| `color`                     | `UiAccent`             | provider accent | Checked-state accent.                                             |
| `accent`                    | `UiAccent`             | provider accent | CapuBridge alias; `color` takes precedence.                       |
| `size`                      | `"xs" \| "sm" \| "md"` | `"sm"`          | Thumb and dot dimension.                                          |
| `disabled`                  | `boolean`              | `false`         | Dims and blocks interaction.                                      |
| `readOnly`                  | `boolean`              | `false`         | Blocks interaction without dimming.                               |
| `required`, `name`, `value` | native values          | —               | Form metadata.                                                    |
| `hoverable`, `focusable`    | `boolean`              | computed        | Override interaction and focus affordances.                       |
| `thumbOutline`              | `boolean`              | `true`          | Toggles the thumb outline.                                        |

`RadioGroup` remains as a Vue convenience for shared value selection. It supplies a shared model, name, disabled state, and required state to nested radios; `Radio` itself does not require it.

## Upstream evidence

The contract follows the pinned Cladd `Radio.tsx` source and public [Radio documentation](https://cladd.io/react/components/radio/). Vue maps React's controlled props to `v-model` without changing the component’s DOM, state geometry, or accessibility modes.
