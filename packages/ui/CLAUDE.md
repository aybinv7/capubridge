# CLAUDE.md

This file governs all work inside `packages/ui`.

## Mission

Build a reusable Vue 3 UI package for dense, long-lived application interfaces. Port the pinned Cladd visual hierarchy, sizing, DOM structure, motion, public behavior, and interaction quality into native Vue.

Read these files before implementation:

1. `docs/architecture.md`
2. `../../plans/vue-ui-package.md`
3. `THIRD_PARTY_NOTICES.md`
4. Relevant Cladd source in `reference/cladd/` at the repo root, the pinned upstream baseline
5. `docs/port/README.md`, then the manifest for the component under change

- Run `vp run reference:cladd` before porting. It clones the pinned commit into `reference/cladd/`, verifies the checked-out SHA, and prints the path.
- Never port from memory, from a temporary directory, or from published Cladd documentation. Read `reference/cladd/`.
- Cite `reference/cladd/<file>:<lines>` for every copied value in the implementing change and in `docs/port/<Component>.md`.

## Hard boundaries

- Depend directly on Vue only for UI runtime behavior.
- Never add React, React DOM, Reka UI, shadcn-vue, Radix Vue, Pinia, Tauri, or application packages.
- Styling mirrors the pinned Cladd baseline, which is Tailwind v4 with `clsx` and `tailwind-merge`. Copy upstream utility strings, `@theme` blocks, and custom variants instead of re-authoring them. See `../../plans/tailwind-realignment.md`.
- Never import from `apps/*` or from another `packages/*` workspace.
- Never copy CapuBridge feature behavior into this package.
- Pinned Cladd source decides the DOM. Where upstream uses a native element, use it; where upstream uses custom interaction, port that instead of substituting a native element. Every choice must be traced to upstream and locked by contract tests.
- Never introduce a general headless component runtime.
- Never add inline code comments. Use clear names and focused files. Public API documentation belongs in Markdown.
- Never place unrelated primitives in one file. One component family, composable, contract, or style concern per file.
- Never use `npm`, `pnpm`, `npx`, Vitest, ESLint, Oxfmt, or Vue TSC directly. Use `vp` commands.
- Never run a dev server or application build from this package task unless the user explicitly requests it.

## Public API

- Export consumers' API only through `src/index.ts` and documented subpath exports.
- Use stable generic component names such as `Surface`, `Button`, and `Dialog`.
- Prefix CSS classes, data attributes, keyframes, and variables with `cui-`.
- Keep Vue as the only UI peer dependency to prevent duplicate runtimes.
- Keep imports tree-shakeable. Avoid registration of every component through a global plugin.
- Treat changes to exported props, events, slots, types, tokens, and CSS selectors as API changes.
- Add a migration note before removing or renaming a public contract.

## Vue rules

- Use Vue 3 Composition API with `<script setup lang="ts">`.
- Prefer templates over render functions.
- Use typed props, emits, slots, and `defineModel` where two-way state is part of the component contract.
- Preserve controlled and uncontrolled usage when the component category needs both.
- Forward native attributes deliberately; do not leak implementation-only attributes.
- Use typed symbol injection keys for contextual surface, theme, accent, and size state.
- Prefer `shallowRef` for DOM nodes, external instances, and large opaque values.
- Derive state with `computed`; avoid deep watchers and hidden composable side effects.
- Clean up global listeners, observers, animation frames, and timers during unmount.

## Component rules

- Use native elements and focused Vue composables for dialogs, popovers, tooltips, menus, selects, tabs, accordions, collapsibles, checkboxes, radios, switches, sliders, calendars, and focus management.
- Keep visual styling and animation owned by this package.
- Support keyboard, pointer, and touch interaction from first implementation.
- Preserve focus visibility and accessible names in every state.
- Expose named slots for meaningful composition points instead of Boolean-prop explosions.
- Avoid component abstraction inside very large repeated lists when it creates measurable render cost.
- Do not add global state for local component behavior.

## Styling rules

- Styling is ported from the pinned Cladd source: utility strings from the upstream component, `@theme` token blocks, and custom variants, copied by value.
- Record the upstream file and lines for every copied style in the implementing change.
- Rename `cladd-*` class hooks and `--cladd-*` tokens to `cui-*` and `--cui-*`, keeping upstream values and formulas unchanged.
- Keep all selectors and custom properties namespaced.
- Build variants from shared tokens instead of one-off colors, radii, shadows, or timings.
- Surfaces use contextual levels one through five and scoped accent inheritance.
- Default control height is 28 pixels. Nested controls are eight pixels smaller at the same size token.
- Prefer inset outlines and surface contrast over decorative drop shadows.
- Animate `transform` and `opacity` where possible. Layout animation requires measurement evidence and cleanup.
- Dragging and scrubbing must disable transition latency while pointer movement is active.
- Every motion path must honor `prefers-reduced-motion`.

## Performance rules

- Do not add a general animation runtime for effects achievable with CSS and Vue transitions.
- Avoid eager portals, observers, event listeners, and timers.
- Mount expensive overlay content only while needed and preserve exit motion safely.
- Keep dependencies minimal and justify every new runtime dependency in the implementation plan.
- Validate tree shaking and ensure Vue is externalized from published output.
- Long lists remain consumer-owned; this package may provide primitives but must not silently render unbounded collections.

## Accessibility rules

- Pinned Cladd behavior and native platform semantics are the baseline.
- Test keyboard navigation, focus return, escape handling, outside interaction, labeling, disabled state, and screen-reader semantics.
- Do not remove focus outlines without an equally visible replacement.
- Do not use color alone to communicate state.
- Touch targets may be visually dense but must retain an adequate interaction target where the platform allows it.

## Testing and validation

- Add contract tests with each public component.
- Test controlled and uncontrolled state where supported.
- Test emitted values and cancellation behavior.
- Test keyboard interaction and focus restoration for overlays.
- Test reduced-motion behavior for animated components.
- Test package exports and consumer-style imports.
- Run `vp run ui#check` and `vp run ui#test` for focused validation.
- Run `vp run check:versions` when package metadata changes.
- Run `git diff --check` before handoff.
- Do not claim build, browser, accessibility-tool, or device evidence unless that validation actually ran.

## Licensing

- Cladd is MIT licensed and is a design and implementation reference.
- Keep `THIRD_PARTY_NOTICES.md` current when copying or substantially adapting Cladd code.
- Record upstream file paths and pinned commit in the implementing change.
- Do not use Cladd branding in exported package names, selectors, or public components.

## Delivery discipline

- Work phase-by-phase from `../../plans/vue-ui-package.md`.
- Each phase must produce a usable, testable consumer path.
- Do not implement the full catalog in one change.
- Keep commits feature-focused and request user permission before committing.
- Update plan checkboxes only with evidence.
