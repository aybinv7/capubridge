# @capubridge/ui

Reusable Vue 3 UI primitives for dense application interfaces.

This package ports Cladd's surface, sizing, accent, motion, DOM, and interaction contracts into a Vue-native library. Styling follows the pinned Cladd baseline, which is Tailwind v4. It does not depend on React, Reka UI, shadcn-vue, Pinia, Tauri, or CapuBridge application code.

## Status

Surface, action, data-display, feedback, form, and overlay foundations are available. The package includes `UiProvider`, surface primitives, dense controls, native form families, `Dialog`, `Popover`, and `Tooltip`. Native elements and focused Vue composables own keyboard, pointer, focus, form, positioning, and dismissal behavior.

## Boundaries

- Vue 3.5 and TypeScript public API
- Native DOM semantics with package-owned Vue interaction composables
- Tailwind v4 styling ported from upstream, namespaced under `cui-`
- Dark-first theme with light-theme support
- Five contextual surface levels
- Seven control sizes with nested controls eight pixels smaller
- Eleven scoped accent regions
- CSS-driven motion with reduced-motion support
- No imports from applications or other CapuBridge packages

## Workspace usage

```json
{
  "dependencies": {
    "@capubridge/ui": "workspace:*"
  }
}
```

```ts
import "@capubridge/ui/styles.css";
```

```vue
<script setup lang="ts">
import { Button, Checkbox, Input, Surface, UiProvider } from "@capubridge/ui";
import "@capubridge/ui/styles.css";
</script>

<template>
  <UiProvider theme="dark" accent="brand">
    <Surface :level="1" variant="gradient" outline>
      <Input name="query" placeholder="Filter targets" />
      <Checkbox name="offline" value="yes" />
      <Button accent="green" variant="gradient-fill">Save</Button>
    </Surface>
  </UiProvider>
</template>
```

## Commands

Use Vite+ from the repository root.

```bash
vp run ui#check
vp run ui#test
vp run ui#build
```

Do not run package-manager binaries or underlying tools directly.

## Governance

Implementation rules live in [`CLAUDE.md`](./CLAUDE.md). Durable architecture lives in [`docs/architecture.md`](./docs/architecture.md). Cladd attribution and upstream baseline live in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
