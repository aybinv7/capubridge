# Surface

`Surface` is the native Vue port of Cladd's depth primitive. It renders the layered background, hover and press overlay, and content wrapper, then publishes its depth level and accent to every nested surface through Vue provide/inject.

```vue
<script setup lang="ts">
import { Surface } from "@capubridge/ui";
</script>

<template>
  <Surface variant="gradient" outline class="cui-panel">
    <Surface level="+1" hoverable clickable>Nested row</Surface>
  </Surface>
</template>
```

## API

| Prop               | Type                  | Default            | Description                                               |
| ------------------ | --------------------- | ------------------ | --------------------------------------------------------- |
| `as`               | `string \| Component` | `"div"`            | Polymorphic root element or Vue component.                |
| `level`            | `SurfaceLevelInput`   | parent level `+ 1` | Absolute or relative surface depth, clamped to `1`–`5`.   |
| `variant`          | `SurfaceVariant`      | `"solid"`          | Background treatment.                                     |
| `outline`          | `boolean`             | `false`            | Renders the inset outline ring on the background layer.   |
| `color`            | `UiAccent`            | inherited accent   | Cladd-compatible accent API.                              |
| `accent`           | `UiAccent`            | inherited accent   | CapuBridge alias; `color` takes precedence.               |
| `hoverable`        | `boolean`             | `false`            | Enables the hover overlay.                                |
| `clickable`        | `boolean`             | `false`            | Enables press feedback and content scale.                 |
| `pressed`          | `boolean`             | `false`            | Forces the pressed visual state.                          |
| `overlayPosition`  | `"above" \| "below"`  | `"above"`          | Stacks the hover/press overlay over or under the content. |
| `wrapContent`      | `boolean`             | `true`             | Wraps the default slot in the content layer.              |
| `bgClassName`      | `string`              | none               | Extra class for the background layer.                     |
| `contentClassName` | `string`              | none               | Extra class for the content layer.                        |
| `overlayClassName` | `string`              | none               | Extra class for the hover/press overlay layer.            |

| Slot            | Purpose                                                                                 |
| --------------- | --------------------------------------------------------------------------------------- |
| `default`       | Surface content, wrapped in the content layer unless `wrapContent` is `false`.          |
| `beforeContent` | Layer rendered between the background and the content, outside the content flex layout. |

The component sets `inheritAttrs: false` and forwards every remaining attribute and listener to the polymorphic root, so `type`, `role`, `aria-*`, and `@click` land on the element produced by `as`. `variant` values `solid-fill` and `gradient-fill` also add the fill class, which inverts foreground color and switches the outline to the fill-aware token.

The internal layers render as `<span>` when `as` is a phrasing element such as `a`, `button`, `kbd`, `code`, or `label`, and as `<div>` otherwise, so a surface stays valid inside phrasing content.

## Levels

Depth is resolved against the nearest enclosing surface context, which reports `0` when no surface is above it. `level` accepts an absolute number or numeric string, a relative `"+1"` / `"-1"` offset against the parent level, or `undefined` to mean one level deeper than the parent. Every result is clamped to `1`–`5`.

```vue
<template>
  <Surface>
    <!-- level 1 -->
    <Surface level="+2">
      <!-- level 3 -->
      <Surface level="+20"><!-- clamped to level 5 --></Surface>
      <Surface level="2"><!-- absolute level 2 --></Surface>
    </Surface>
  </Surface>
</template>
```

`variant="transparent"` publishes `currentLevel - 1` to its descendants, so a transparent grouping wrapper does not consume a depth step and its children render at the same depth as the transparent surface itself.

```vue
<template>
  <Surface :level="3">
    <Surface variant="transparent">
      <!-- level 4, and its children also resolve to level 4 -->
      <Surface />
    </Surface>
  </Surface>
</template>
```

The resolved values are observable on the DOM as `data-cui-surface-level`, `data-cui-surface-variant`, and the `cui-surface-level-{n}` class. `resolveSurfaceLevel` and `clampSurfaceLevel` are exported for consumers that need the same arithmetic outside a component, and `useSurface()` returns the current `{ level, accent }` refs.

## Accent scoping

The effective accent is `color`, then `accent`, then the accent published by the enclosing surface, then the provider accent from `UiProvider`. The `cui-accent-{name}` class is only applied when this surface sets `color` or `accent` explicitly, which keeps an accent scoped to its own subtree instead of leaking to siblings. The resolved value is always mirrored on `data-cui-accent`, and it is what descendants read through the surface context.

```vue
<script setup lang="ts">
import { Surface, UiProvider } from "@capubridge/ui";
</script>

<template>
  <UiProvider accent="brand" theme="dark">
    <Surface accent="red">
      <!-- inherits red through the surface context -->
      <Surface />
    </Surface>
    <!-- still brand -->
    <Surface />
  </UiProvider>
</template>
```

## Upstream evidence

The contract follows the pinned Cladd `Surface.tsx`, `SurfaceContent.tsx`, and `SurfaceContext.tsx` sources plus the public [Surface documentation](https://cladd.io/react/components/surface/). React children and the `beforeContent` node become Vue slots, and the level arithmetic, transparent grouping rule, clamping, overlay stacking, and phrasing-element swap keep the upstream values.

Divergences from upstream that are intentional in this package:

- Accent resolution ends at the provider accent, so `data-cui-accent` always carries a concrete token. Upstream publishes an empty region color when no ancestor set one.
- `accent` exists as an alias for `color` across this package; `color` still wins when both are given.
- Styling is expressed as namespaced `cui-*` classes and `data-cui-*` attributes instead of inline Tailwind utility strings, with the upstream values moved into `styles/surfaces.css`.
- The content layer is internal. Upstream exports a separate `SurfaceContent` component; here it is produced by `wrapContent` and shaped with `contentClassName`.
- There is no exported region-accent reset for portal boundaries. Overlay components re-apply the theme root on their own portal content instead.
- Per-component provider defaults are not implemented. Upstream `Surface` reads `useComponentDefaults('Surface', props)`, so app-wide `defaults={{ Surface: … }}` changes its built-in defaults; this port resolves defaults from the component only.
