# Shortcut

`Shortcut` is the native Vue port of Cladd's keyboard-hint row. It splits whitespace-delimited text into key surfaces, transforms recognized tokens into keyboard glyphs, and applies platform-aware `cmd`, `ctrl`, and `alt` labels.

```vue
<script setup lang="ts">
import { Shortcut } from "@capubridge/ui";
</script>

<template>
  <Shortcut color="brand">cmd shift k</Shortcut>
</template>
```

## API

| Prop                  | Type                  | Default         | Description                                       |
| --------------------- | --------------------- | --------------- | ------------------------------------------------- |
| `as`                  | `string \| Component` | `"div"`         | Root element or Vue component.                    |
| `size`                | `UiSize`              | `"md"`          | Key height, width, radius, font, and glyph scale. |
| `color`               | `UiAccent`            | provider accent | Cladd-compatible accent for every key.            |
| `accent`              | `UiAccent`            | provider accent | CapuBridge alias; `color` takes precedence.       |
| `variant`             | `SurfaceVariant`      | `"gradient"`    | Surface treatment for every key.                  |
| `outline`             | `boolean`             | `true`          | Toggles each key outline.                         |
| `surfaceLevel`        | `string \| number`    | `"+2"`          | Relative or absolute surface depth.               |
| `iconClassName`       | `string`              | none            | Extra class on recognized-token SVG glyphs.       |
| `keyClassName`        | `string`              | none            | Extra class on each key surface.                  |
| `keyContentClassName` | `string`              | none            | Extra class on every key content layer.           |

Whitespace-delimited text tokens are recognized case-insensitively: `cmd`, `ctrl`, `alt`, `shift`, `enter`, `return`, `tab`, `space`, `esc`, `escape`, `backspace`, `delete`, `del`, `up`, `down`, `left`, and `right`. Other text is uppercased. Non-text Vue slot nodes render in one key each.

## Upstream evidence

The contract follows the pinned Cladd `Shortcut.tsx` source and the public [Shortcut documentation](https://cladd.io/react/components/shortcut/). The Vue port keeps Cladd's `2xs`–`2xl` geometry, glyph paths, platform behavior, and fill/non-fill color treatment.
