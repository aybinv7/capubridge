# SurfaceCut

`SurfaceCut` is the native Vue port of Cladd's recessed surface primitive. It renders the cut fill, its inset outline, an optional hover and press overlay, and a content wrapper, and it publishes a depth one level _shallower_ than its parent so nested surfaces read as sitting inside a cut-out rather than stacked on top of it.

```vue
<script setup lang="ts">
import { Surface, SurfaceCut } from "@capubridge/ui";
</script>

<template>
  <Surface :level="3" variant="gradient" outline>
    <SurfaceCut>
      <!-- resolves back to level 3 -->
      <Surface />
    </SurfaceCut>
  </Surface>
</template>
```

## API

| Prop               | Type                  | Default          | Description                                               |
| ------------------ | --------------------- | ---------------- | --------------------------------------------------------- |
| `as`               | `string \| Component` | `"div"`          | Polymorphic root element or Vue component.                |
| `outline`          | `boolean`             | `true`           | Renders the inset cut outline ring.                       |
| `color`            | `UiAccent`            | inherited accent | Cladd-compatible accent API.                              |
| `accent`           | `UiAccent`            | inherited accent | CapuBridge alias; `color` takes precedence.               |
| `hoverable`        | `boolean`             | `false`          | Enables the hover overlay.                                |
| `clickable`        | `boolean`             | `false`          | Enables press feedback and content scale.                 |
| `pressed`          | `boolean`             | `false`          | Forces the pressed visual state.                          |
| `overlayPosition`  | `"above" \| "below"`  | `"above"`        | Stacks the hover/press overlay over or under the content. |
| `wrapContent`      | `boolean`             | `true`           | Wraps the default slot in the content layer.              |
| `bgClassName`      | `string`              | none             | Extra class for the cut background layer.                 |
| `contentClassName` | `string`              | none             | Extra class for the content layer.                        |
| `overlayClassName` | `string`              | none             | Extra class for the hover/press overlay layer.            |

| Slot            | Purpose                                                                                 |
| --------------- | --------------------------------------------------------------------------------------- |
| `default`       | Cut content, wrapped in the content layer unless `wrapContent` is `false`.              |
| `beforeContent` | Layer rendered between the background and the content, outside the content flex layout. |

`SurfaceCut` has no `level` or `variant` prop: the cut fill is a single treatment and its published depth is always derived from the parent. The component sets `inheritAttrs: false` and forwards remaining attributes and listeners to the polymorphic root. Internal layers render as `<span>` for phrasing `as` values and `<div>` otherwise, so a cut stays valid inside phrasing content.

## Depth

A cut publishes `parentLevel - 1` to its subtree and exposes the level it was cut from as `data-cui-surface-cut-from-level`. It does not clamp that published value, because the nested `Surface` that consumes it clamps on read: a `SurfaceCut` at the root of a tree publishes a negative depth, and the first `Surface` inside it still resolves to level `1`.

```vue
<template>
  <Surface :level="4">
    <!-- data-cui-surface-cut-from-level="4" -->
    <SurfaceCut>
      <!-- level 4 again, so the row does not look stacked on the panel -->
      <Surface hoverable clickable />
    </SurfaceCut>
  </Surface>
</template>
```

Because the cut is one depth step back, the usual composition is panel → cut → rows: the panel supplies the raised level, the cut supplies the recess, and the rows inside resolve to the panel's level.

## Accent scoping

Accent resolution matches `Surface`: `color`, then `accent`, then the accent published by the enclosing surface, then the provider accent. The `cui-accent-{name}` class is only added when this cut sets `color` or `accent` explicitly, so the accent stays scoped to its subtree, while `data-cui-accent` always mirrors the resolved token for descendants reading `useSurface()`.

```vue
<script setup lang="ts">
import { Input, SurfaceCut, UiProvider } from "@capubridge/ui";
</script>

<template>
  <UiProvider accent="brand">
    <SurfaceCut accent="cyan" hoverable>
      <!-- the field inherits cyan through the surface context -->
      <Input placeholder="Filter targets" />
    </SurfaceCut>
  </UiProvider>
</template>
```

`Input`, `Textarea`, and `Button` with `surface="cut"` all build on this primitive, which is why a field's chrome reads as recessed inside its panel.

## Upstream evidence

The contract follows the pinned Cladd `SurfaceCut.tsx` and `SurfaceContext.tsx` sources plus the public [Surface documentation](https://cladd.io/react/components/surface/). The `parentLevel - 1` publication, the `outline` default of `true`, overlay stacking, and press motion keep the upstream values, and React children plus the `beforeContent` node become Vue slots.

Divergences from upstream that are intentional in this package:

- Upstream renders the cut's background, overlay, and content layers as `<div>` unconditionally. This port applies the same phrasing-element swap as `Surface`, so `as="label"` or `as="button"` produces `<span>` layers.
- Accent resolution ends at the provider accent, so `data-cui-accent` always carries a concrete token; upstream publishes an empty region color when no ancestor set one.
- `accent` exists as an alias for `color`; `color` still wins when both are given.
- Styling is expressed as namespaced `cui-*` classes and `data-cui-*` attributes instead of inline Tailwind utility strings.
- The content layer is internal. Upstream exports a separate `SurfaceCutContent` component; here it is produced by `wrapContent` and shaped with `contentClassName`.
- Per-component provider defaults are not implemented. Upstream `SurfaceCut` reads `useComponentDefaults('SurfaceCut', props)`; this port resolves defaults from the component only.
