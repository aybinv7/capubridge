# Spinner

`Spinner` is the native Vue port of Cladd's inline loading indicator. It preserves the same ring path, accent behavior, seven-size scale, and rotation timing.

```vue
<script setup lang="ts">
import { Spinner } from "@capubridge/ui";
</script>

<template>
  <Spinner size="lg" color="brand" />
</template>
```

## API

| Prop     | Type            | Default         | Description                                 |
| -------- | --------------- | --------------- | ------------------------------------------- |
| `size`   | `UiSize`        | `"sm"`          | Ring dimension from `2xs` through `2xl`.    |
| `color`  | `UiAccent`      | provider accent | Cladd-compatible accent API.                |
| `accent` | `UiAccent`      | provider accent | CapuBridge alias; `color` takes precedence. |
| `class`  | Vue class value | none            | Extra classes forwarded to the root span.   |

The component forwards normal Vue attributes to its root span. It renders one `20 × 20` SVG using Cladd's exact path and rotates it linearly once every `1.5s`.

Use the same size token as a surrounding button. Inside a chip, use a spinner one size smaller than the chip.

## Upstream evidence

The contract follows the pinned Cladd `Spinner.tsx` source and the public [Spinner documentation](https://cladd.io/react/components/spinner/). The Vue port changes only framework syntax and keeps the source geometry and animation values.
