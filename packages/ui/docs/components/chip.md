# Chip

Vue-native port of Cladd `Chip` at pinned commit `fadd8efe935111f31d7c933238db5ce5d3a55d71`.

## Contract

`Chip` is a compact surface-backed label for status, tags and inline metadata. It renders a `span` by default. `button` and `a` roots become clickable automatically.

```vue
<Chip color="green">Active</Chip>
<Chip color="brand" rounded>v1.2.3</Chip>
<Chip :icon="CheckIcon" :icon-props="{ 'aria-hidden': true }">Verified</Chip>
<Chip as="button" size="lg">Add tag</Chip>
```

## API

| Prop               | Type                      | Default    | Vue contract                                                         |
| ------------------ | ------------------------- | ---------- | -------------------------------------------------------------------- |
| `as`               | `string \| Component`     | `span`     | Polymorphic root. `button` and `a` enable interaction automatically. |
| `clickable`        | `boolean`                 | inferred   | Overrides automatic clickable state.                                 |
| `color`            | `UiAccent`                | inherited  | Cladd-compatible accent name.                                        |
| `accent`           | `UiAccent`                | inherited  | Existing Vue alias for `color`. `color` wins when both exist.        |
| `contentClassName` | `string`                  | none       | Class applied to inner content row.                                  |
| `disabled`         | `boolean`                 | `false`    | Reserved and intentionally unused, matching Cladd 0.18.5.            |
| `hoverable`        | `boolean`                 | `false`    | Enables hover overlay. Clickable chips enable it automatically.      |
| `icon`             | `Component`               | none       | Component rendered before default slot.                              |
| `iconProps`        | `Record<string, unknown>` | `{}`       | Props forwarded to icon component.                                   |
| `outline`          | `boolean`                 | `true`     | Surface outline.                                                     |
| `rounded`          | `boolean`                 | `false`    | Full pill radius.                                                    |
| `size`             | `UiSize`                  | `md`       | `2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl`.                          |
| `surfaceLevel`     | `SurfaceLevelInput`       | contextual | Absolute or relative surface level.                                  |
| `variant`          | `SurfaceVariant`          | `gradient` | Surface treatment.                                                   |

Native attributes and listeners fall through to the polymorphic root. Default content uses the default slot. An `icon` slot can replace the component-based icon API.

## Geometry

Root height uses nested sizing: root size minus eight pixels. Font sizes are `6, 8, 10, 10, 12, 12, 12px`. Direct SVG sizes are `6, 10, 12, 14, 16, 16, 16px`. Pressed content scales to `0.95` with `0.75` opacity over 200 milliseconds.

## Upstream evidence

- `src/components/Chip.tsx`
- `src/components/Surface.tsx`
- `src/shared/size-utls.ts`
- `src/styles/font-size.css`
- `src/styles/radius.css`
- `src/styles/spacing.css`
- `https://cladd.io/react/components/chip.md`
