# Switch

`Switch` is the native Vue port of Cladd's immediate-effect toggle. It preserves Cladd's track/thumb depth, filled on-state, sliding thumb, animated cross-to-check glyph, and `sm` / `md` dimensions.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Switch } from "@capubridge/ui";

const notifications = ref(false);
</script>

<template>
  <Switch v-model="notifications" color="brand" />
</template>
```

## API

| Prop                                                | Type                    | Default                      | Description                                                       |
| --------------------------------------------------- | ----------------------- | ---------------------------- | ----------------------------------------------------------------- |
| `v-model`                                           | `boolean`               | `false`                      | Vue equivalent of Cladd's controlled `checked` / `onChange` pair. |
| `checked`                                           | `boolean`               | —                            | Controlled state alias; listen for `update:checked` or `change`.  |
| `as`                                                | `string \| Component`   | `"label"`                    | Root element.                                                     |
| `input`                                             | `boolean`               | `true`                       | Enables native input; false enables ARIA keyboard mode.           |
| `color`                                             | `UiAccent`              | provider accent              | Checked thumb-fill accent.                                        |
| `accent`                                            | `UiAccent`              | provider accent              | CapuBridge alias; `color` takes precedence.                       |
| `size`                                              | `"sm" \| "md"`          | `"md"`                       | Track and thumb dimensions.                                       |
| `disabled`                                          | `boolean`               | `false`                      | Blocks interaction and dims the thumb only.                       |
| `readOnly`                                          | `boolean`               | `false`                      | Blocks interaction without dimming.                               |
| `hoverable`, `focusable`                            | `boolean`               | computed                     | Override hover and focus affordances.                             |
| `outline`, `variant`, `surfaceLevel`                | surface props           | `true`, `"solid"`, `"+1"`    | Track surface options.                                            |
| `thumbOutline`, `thumbVariant`, `thumbSurfaceLevel` | surface props           | `true`, `"gradient"`, `"+2"` | Thumb surface options.                                            |
| `#icon`                                             | slot prop `{ checked }` | animated glyph               | Vue equivalent of Cladd's static/render-function `icon` prop.     |

Native attributes such as `name`, `value`, `required`, and `inputId` are forwarded when `input` is enabled. The component emits `change(checked, event?)` and `update:checked`.

## Upstream evidence

The contract follows the pinned Cladd `Switch.tsx` source and public [Switch documentation](https://cladd.io/react/components/switch/). Vue uses a scoped slot for Cladd's renderable icon API while retaining the source geometry and motion values.
