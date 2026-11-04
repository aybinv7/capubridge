# Slider

`Slider` is the native Vue port of Cladd's single-value range control. It supports the thin thumb presentation and the substantial track presentation, with the same value mapping, motion, focus feedback, and surface composition.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Slider } from 'cladd-vue';

const volume = ref(40);
</script>

<template>
  <Slider v-model="volume" color="brand" />
</template>
```

## API

| Prop                        | Type                           | Default                | Description                                         |
| --------------------------- | ------------------------------ | ---------------------- | --------------------------------------------------- |
| `v-model`                   | `number`                       | `0`                    | Vue controlled value contract.                      |
| `value` / `defaultValue`    | `number`                       | — / `0`                | Explicit controlled or initial uncontrolled value.  |
| `min`, `max`, `step`        | `number`                       | `0`, `100`, `1`        | Value space and output snapping.                    |
| `scale`                     | `"linear" \| "log" \| mapping` | `"linear"`             | Value-position mapping.                             |
| `variant`                   | `"thumb" \| "track"`           | `"thumb"`              | Thin thumb or thick track presentation.             |
| `size`                      | `"xs" \| "sm" \| "md"`         | `"sm"`                 | Track and thumb dimensions.                         |
| `color`                     | `Color`                        | theme accent for thumb | Accent of the thumb/range.                          |
| `rounded`                   | `boolean`                      | `false`                | Makes track-variant ends fully rounded.             |
| `rangeFill`, `rangeOutline` | `boolean`                      | `false`, `true`        | Track-variant range presentation.                   |
| `thumbOutline`              | `boolean`                      | `true`                 | Thumb outline.                                      |
| `disabled`, `readOnly`      | `boolean`                      | `false`                | Disabled dims; read-only preserves appearance.      |
| `tightFocusRing`            | `boolean`                      | `false`                | Keeps focus treatment flush to the control.         |
| `debounce`, `throttle`      | `number`                       | `0`                    | Change-event scheduling; throttle takes precedence. |

The component emits `change(value, event?)`, `update:value`, and the standard `update:modelValue` produced by `v-model`. `input` remains accepted for parity but the native range input is always rendered, as in Cladd.

## Upstream evidence

The contract follows the pinned Cladd `Slider.tsx` source and public [Slider documentation](https://cladd.io/react/components/slider/). Vue replaces React controlled state with `v-model` and retains the source’s scale, scheduling, and visual state rules.
