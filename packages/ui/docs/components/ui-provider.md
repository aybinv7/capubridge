# UiProvider

`UiProvider` is the native Vue port of Cladd's provider. It renders the theme root element and publishes the color scheme and the app-wide accent to every descendant through Vue provide/inject, so surfaces and controls can resolve their default accent and every token can be scoped to a theme.

```vue
<script setup lang="ts">
import { UiProvider, Surface } from "@capubridge/ui";
import "@capubridge/ui/styles.css";
</script>

<template>
  <UiProvider accent="brand" theme="dark">
    <Surface variant="gradient" outline>Application shell</Surface>
  </UiProvider>
</template>
```

## API

| Prop     | Type                  | Default   | Description                                       |
| -------- | --------------------- | --------- | ------------------------------------------------- |
| `as`     | `string \| Component` | `"div"`   | Polymorphic root element or Vue component.        |
| `theme`  | `UiTheme`             | `"dark"`  | Color scheme published to descendants.            |
| `accent` | `UiAccent`            | `"brand"` | App-wide accent used as the default accent token. |

| Slot      | Purpose                       |
| --------- | ----------------------------- |
| `default` | Application subtree to theme. |

Both props are reactive: changing `theme` or `accent` updates the published context and the rendered root without remounting the subtree. The component sets `inheritAttrs: false` and forwards remaining attributes and listeners to the root element, so `id`, `class`, and `style` land on the theme root.

## Rendered root

The root element carries the class `cui-theme`, the accent class `cui-accent-{accent}`, and the attributes `data-cui-theme` and `data-cui-accent`. That element is the styling anchor for the package:

- `styles/tokens.css` and `styles/motion.css` define their custom properties on `:where(:root, .cui-theme)`, so dark tokens resolve even without a provider.
- Light mode is only selected by `.cui-theme[data-cui-theme="light"]`, so a light region requires a provider (or an equivalent hand-written root) — setting `theme` alone on a component does nothing.
- `color-scheme` is set from `data-cui-theme`, which is what makes native scrollbars and form chrome match.

Import `@capubridge/ui/styles.css` once in the application entry; the provider does not inject styles.

## Reading the context

`useUiContext()` returns readonly refs for the current `{ accent, theme }`. Outside any provider it falls back to `accent: "brand"` and `theme: "dark"`, so components mount without injection warnings.

```vue
<script setup lang="ts">
import { useUiContext } from "@capubridge/ui";

const ui = useUiContext();
</script>

<template>
  <span>{{ ui.theme }} / {{ ui.accent }}</span>
</template>
```

Components resolve their own accent as explicit prop, then enclosing surface accent, then this provider accent. `useSurface()` is the surface-level counterpart and reports depth plus the scoped surface accent.

## Nested providers

Providers nest, and each one re-roots the theme for its subtree. That is the supported way to render a light region inside a dark application, or to run an isolated accent for a tool panel.

```vue
<script setup lang="ts">
import { UiProvider, Surface } from "@capubridge/ui";
</script>

<template>
  <UiProvider theme="dark" accent="brand">
    <Surface variant="gradient" outline>Dark shell</Surface>

    <UiProvider as="section" theme="light" accent="cyan">
      <Surface variant="gradient" outline>Light inspector</Surface>
    </UiProvider>
  </UiProvider>
</template>
```

## Upstream evidence

The contract follows the pinned Cladd `CladdProvider.tsx` and `ThemeContext.tsx` sources plus the public [provider documentation](https://cladd.io/react/getting-started/). The `dark` theme default, the `brand` accent default, and the role of the accent as the default color for interactive components are unchanged; React context becomes typed symbol injection with readonly refs.

Divergences from upstream that are intentional or not yet implemented in this package:

- **No per-component default props.** Upstream accepts `defaults={{ Button: { outline: false, size: 'lg' } }}` and every component reads it through `useComponentDefaults`. `UiProvider` has no `defaults` prop, and no component in this package consults one, so an app-wide default has to be applied by the consumer (a local wrapper component, for example). This is the one upstream provider capability that is missing rather than reshaped.
- Upstream `accentColor` is named `accent` here, matching the `accent` prop used across this package.
- There is no provider-level overlay root. Upstream `CladdProvider` takes `overlaysRoot` and mounts shared dialog and toast portals; in this package the overlay components own their portal target and re-apply the `cui-theme` root on their portaled content, and the provider renders no portals of its own.
- The provider renders a real element (`as`, default `div`) because the `cui-theme` class and `data-cui-theme` attribute are the CSS anchor for tokens and `color-scheme`. Upstream's provider renders no element: its stylesheet keys light and dark tokens off `.light` / `.dark` classes that the application puts on its own element, separately from the React context.
