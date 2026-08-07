# UI package architecture

## Dependency direction

```text
Vue application
      |
      v
@capubridge/ui
      |
      v
    Vue 3
```

`@capubridge/ui` cannot depend on any application, Tauri API, feature store, router, transport, analytics system, or other CapuBridge workspace package.

## Ownership

The package owns:

- Public component contracts
- Visual variants and semantic CSS
- Theme, accent, size, surface, and motion foundations
- Native interaction composables
- Local controlled and uncontrolled component state
- Overlay lifecycle coordination
- Accessibility and interaction contract tests

Consumers own:

- Product state and persistence
- Routing and navigation decisions
- Feature-specific copy and validation
- Data fetching and mutations
- Application theme selection and brand-token overrides
- Virtualized data sources
- Toast and dialog business actions

## Foundation contracts

- Sizes: `2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl`
- Default root control height: 28 pixels
- Nested control height: root height minus 8 pixels
- Surface levels: one through five
- Surface variants: transparent, solid, gradient, solid fill, gradient fill
- Accents: neutral, brand, red, pink, purple, blue, cyan, lime, green, yellow, orange
- Overlay phases: closed, opening, opened, closing
- Themes: dark-first and light
- Motion: 120, 200, 300, and 500 millisecond roles with reduced-motion collapse

## Surface context

Surface depth uses typed Vue provide/inject context. A surface without an explicit level resolves one level above its parent and clamps to the supported range. Transparent grouping preserves the parent's visual depth. Accent and size context follow the same scoped inheritance model.

## Native interaction boundary

Native HTML owns form semantics and browser behavior. Focused Vue composables own overlay lifecycle, focus containment, anchored positioning, dismissal, and compound state. Their contracts follow pinned Cladd source and remain private to the package.

Components preserve native keyboard and form behavior before adding package interaction. Custom behavior must expose equivalent roles, states, labels, focus movement, escape handling, and cleanup. No general headless component runtime is allowed.

## Styling boundary

Package styling mirrors the pinned Cladd baseline: Tailwind v4 utilities, `@theme` token blocks, and custom variants, exposed through `@capubridge/ui/styles.css`. All selectors, data attributes, keyframes, and custom properties use the `cui-` namespace. Consumers may override documented `@theme` custom properties without reaching into component DOM structure.

## Motion boundary

CSS handles standard enter, exit, hover, press, selection, spinner, and transform motion. Vue transition hooks handle measured lifecycle coordination. JavaScript animation is reserved for interactions requiring continuous pointer geometry or measured height. Every path has a reduced-motion outcome.

## Packaging boundary

Vue is the only UI peer dependency and build external. Public JavaScript is ESM. Type declarations ship with the package. CSS is an explicit subpath export. Components are individually exported so consumers can tree-shake unused families.

## Compatibility policy

Public contract additions may ship in feature releases. Prop, event, slot, selector, token, or behavior removals require a migration note and coordinated consumer update. Upstream Cladd changes are references to evaluate, never automatic updates to copy blindly.
