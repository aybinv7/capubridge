# Button

`Button` is a native Vue surface-backed action control with Cladd's geometry, variants, state behavior, focus treatment, and loading transition.

```vue
<script setup lang="ts">
import { Button } from 'cladd-vue';
</script>

<template>
  <Button color="brand" size="lg">Save changes</Button>
  <Button as="a" href="/docs" variant="transparent" :outline="false"
    >Docs</Button
  >
</template>
```

## API

| Prop               | Type                  | Default         | Description                                            |
| ------------------ | --------------------- | --------------- | ------------------------------------------------------ |
| `as`               | `string \| Component` | `"button"`      | Polymorphic root element or Vue component.             |
| `size`             | `UiSize`              | `"md"`          | Height, radius, padding, icon, and spinner scale.      |
| `color`            | `Color`               | provider accent | Cladd-compatible accent API.                           |
| `variant`          | `SurfaceVariant`      | `"gradient"`    | Surface treatment.                                     |
| `surface`          | `"surface" \| "cut"`  | `"surface"`     | Standard or recessed surface primitive.                |
| `surfaceLevel`     | `string \| number`    | inherited       | Absolute or relative surface depth.                    |
| `outline`          | `boolean`             | `true`          | Renders the surface outline.                           |
| `rounded`          | `boolean`             | `false`         | Uses pill corners.                                     |
| `multiline`        | `boolean`             | `false`         | Uses minimum height and allows wrapped content.        |
| `square`           | `boolean`             | `false`         | Uses a square footprint and removes inline padding.    |
| `loading`          | `boolean`             | `false`         | Scales content out and centers a size-matched spinner. |
| `disabled`         | `boolean`             | `false`         | Blocks interaction and dims content to 40%.            |
| `readOnly`         | `boolean`             | `false`         | Blocks interaction without dimming content.            |
| `pressed`          | `boolean`             | `false`         | Forces the pressed visual state.                       |
| `clickable`        | `boolean`             | `true`          | Enables press feedback while active.                   |
| `hoverable`        | `boolean`             | `true`          | Enables hover feedback while active.                   |
| `focusable`        | `boolean`             | `true`          | Renders keyboard focus treatment while active.         |
| `focused`          | `boolean`             | `false`         | Forces the focus ring visible.                         |
| `tightFocusRing`   | `boolean`             | `false`         | Keeps the focus ring flush with the root.              |
| `contentClassName` | `string`              | none            | Extra class for the inner content layer.               |

Vue attributes and listeners are forwarded to the polymorphic root. Use `aria-label` directly for icon-only buttons. `loading` is visual only; pair it with `readOnly` or `disabled` when repeat activation must be prevented.

Direct SVG children render at `12px` for `2xs` and `xs`, then `16px` for `sm` through `2xl`. Loading preserves the button footprint and uses the same spinner mapping as Cladd.

## Upstream evidence

The contract follows the pinned Cladd `Button.tsx` source and the public [Button documentation](https://cladd.io/react/components/button/). Vue slots replace React children, native attributes replace React polymorphic props, and all documented visual and behavioral values remain aligned.
