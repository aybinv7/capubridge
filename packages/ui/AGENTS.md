# Package agent instructions

Read and follow `CLAUDE.md`, `docs/architecture.md`, `../../plans/vue-ui-package.md`, and `THIRD_PARTY_NOTICES.md` before changing this package.

The package must remain Vue-native, dependency-light, app-agnostic, CSS-namespaced, tree-shakeable, accessible, and free of React, Reka UI, shadcn-vue, Pinia, Tauri, and cross-workspace imports. Styling mirrors the pinned Cladd baseline, which is Tailwind v4 — see `../../plans/tailwind-realignment.md`. Native DOM behavior and focused Vue composables must follow the pinned Cladd source contract.
