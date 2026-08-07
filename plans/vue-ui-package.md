# Plan: Vue application UI package

> Source PRD: Conversation requesting a reusable Vue package that ports pinned Cladd source and documentation contracts without React or a headless component runtime.

## Architectural decisions

> Current parity status: the package exports 19 components. Cladd 0.18.5 documents 37 application components plus compound parts and hooks. Completed phase checkboxes below prove implemented semantic slices, not full public-API or pixel parity.
>
> Reviewed 2026-08-03. Checkbox corrections and their evidence are recorded in `ui-package-review.md`; port-fidelity findings in `port-fidelity-audit.md`; the styling decision in `tailwind-realignment.md`. `vp run ui#test` and `vp run ui#check` pass. `vp run ui#build` fails, so no phase depending on published output can be closed.

- **Package**: `@capubridge/ui` is a publishable workspace package and the only owner of reusable UI primitives.
- **Framework**: Vue 3.5 with Composition API, `<script setup lang="ts">`, and strict TypeScript.
- **Behavior layer**: Native HTML and focused Vue composables implement pinned Cladd DOM, form, focus, positioning, dismissal, and lifecycle contracts.
- **Prohibited dependencies**: React, React DOM, shadcn-vue, Radix Vue, Pinia, Tauri, application packages, and feature modules.
- **Styling**: Tailwind v4 with `clsx` and `tailwind-merge`, mirroring the pinned Cladd baseline, with `cui-` namespacing and an explicit `styles.css` export. See `tailwind-realignment.md`.
- **Theming**: Dark-first, light supported, eleven scoped accents, consumer-overridable CSS custom properties.
- **Surfaces**: Five contextual levels using typed provide/inject inheritance and recessed cuts.
- **Sizing**: Seven root sizes with nested content exactly eight pixels smaller.
- **Motion**: CSS-first 120/200/300/500 millisecond roles, lifecycle-aware exit states, transform/opacity preference, and reduced-motion support.
- **State**: Local controlled and uncontrolled contracts. No global package store.
- **Packaging**: ESM, declarations, tree-shakeable named exports, with Vue as the only UI peer dependency and external.
- **Licensing**: Cladd MIT baseline pinned in `THIRD_PARTY_NOTICES.md`; derived implementations record upstream source paths.
- **Migration**: CapuBridge adopts components through narrow consumer slices while legacy components remain available until parity is proven.

## Cladd parity release gate

A component is not parity-complete until all applicable upstream contracts are recorded and verified:

- [ ] Every applicable style, geometry, and motion value is recorded as copied from `<upstream file>:<lines>` at `fadd8ef`, not asserted as matching by inspection.
- [ ] Public props, events, slots, controlled and uncontrolled modes, and compound exports are mapped.
- [ ] Every documented size, color, surface variant, disabled, read-only, loading, validation, and custom-content state is represented in the kitchen sink.
- [ ] Enter, opened, pressed, focused, closing, and closed animation phases match upstream duration, easing, transform origin, and reduced-motion behavior.
- [ ] Geometry, typography, icon path, nested surface structure, color tokens, outline, and backdrop values are compared against pinned source and live computed rendering.
- [ ] Keyboard, pointer, touch, form submission, focus restoration, nested-overlay, and error paths have interaction evidence.
- [ ] Focused tests lock semantic behavior and DOM structure; browser evidence locks computed visual values.

Current family status:

| Family                                           | Implemented                                                                                               | Full Cladd API parity                                           | Pixel and motion parity                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Foundations and surfaces                         | Yes                                                                                                       | Partial                                                         | Partial. Tokens copied faithfully; `(hover: hover)` guard and `SurfaceColorReset` missing |
| Button, Spinner, Chip, Shortcut                  | Yes                                                                                                       | Partial                                                         | Partial. Button, Spinner, and focus-ring geometry verified against upstream               |
| Input, Textarea, Checkbox, Radio, Switch, Slider | Yes                                                                                                       | Partial                                                         | Partial. Slider verified; Textarea DOM deviates from upstream `contenteditable`           |
| Dialog, Popover, Tooltip                         | Yes                                                                                                       | No. Popover props re-designed; overlay phase machine not ported | No                                                                                        |
| Dense navigation                                 | Only `Select`, ported without its upstream `List`, `ListButton`, `SearchField`, `SectionTitle` primitives | No                                                              | No                                                                                        |
| Advanced controls and feedback                   | No                                                                                                        | No                                                              | No                                                                                        |

---

## Phase 1: Surface foundation consumer slice

**User stories**: A Vue application can import package CSS, render nested surfaces, switch theme, scope an accent, and observe automatic depth without application-specific setup.

### What to build

Deliver provider/context contracts, `Surface`, and `SurfaceCut` as a complete package-to-consumer path. Include a small isolated fixture showing nested, transparent, filled, and recessed surfaces in dark and light themes.

### Acceptance criteria

- [x] Nested surfaces resolve and clamp levels one through five.
- [x] Transparent grouping preserves parent depth.
- [x] Accent context scopes without leaking to sibling regions.
- [ ] Dark and light themes meet documented contrast targets.
- [ ] Package root and CSS subpath imports work from a consumer fixture.
- [ ] Vue is absent from bundled output.
- [x] Contract, rendering, and CSS-token tests pass.

---

## Phase 2: Primary action slice

**User stories**: A user can trigger a primary, secondary, destructive, loading, disabled, icon-only, or shortcut-labelled action with consistent nesting and press feedback.

### What to build

Deliver `Button`, `Spinner`, `Chip`, and `Shortcut` together because they prove root and nested sizing, accent variants, loading replacement, keyboard focus, and pointer/touch press motion end-to-end.

### Acceptance criteria

- [x] Every size produces stable root and nested geometry.
- [x] Loading preserves control dimensions and accessible name.
- [x] Disabled controls block activation and expose correct semantics.
- [x] Icon-only controls require an accessible label.
- [x] Press feedback belongs to the deepest active control.
- [ ] Reduced motion removes scale animation without removing state feedback. Implemented as a token collapse in `motion.css`; unverified, no test asserts it.
- [x] Consumer fixture demonstrates composition inside each surface level.

---

## Phase 3: Form interaction slice

**User stories**: A user can enter text and change common boolean or ranged values with consistent validation, focus, keyboard, pointer, and touch behavior.

### What to build

Deliver `Input`, `Textarea`, `Checkbox`, `RadioGroup`, `Switch`, and `Slider` with native form controls and pinned Cladd state structure. Cover labels, descriptions, errors, disabled/read-only state, controlled values, and form integration.

`Select` is excluded from form integration: upstream renders a button plus popover with no `name` and no hidden input, so it never participates in submission. Matching that is correct.

### Acceptance criteria

- [x] Native form names, values, disabled state, and submission behavior remain intact.
- [x] Labels and error descriptions are programmatically associated.
- [x] Controlled and uncontrolled contracts emit stable typed values.
- [x] Keyboard and touch interactions match component semantics.
- [x] Slider drag removes transition latency during active movement.
- [x] Focus remains visible across every surface and accent combination.
- [x] Consumer fixture verifies form submission and reset behavior. `fixtures/forms/FormFixture.vue` plus six tests lock native submission, omission of unchecked and disabled controls, reset, and post-reset state agreement. Scope of the claim: reset re-derives each control from its bound model, which is what Vue's attribute mirroring makes possible — it does not restore a pristine initial value after interaction. `Textarea` is excluded pending `ui-package-review.md` R3, and `Select` is not form-associated, matching upstream.
- [ ] Every documented Cladd form prop, icon path, size, state, and transition is mapped and verified.

---

## Phase 4: Overlay lifecycle slice

**User stories**: A user can open and dismiss dialogs, popovers, and tooltips with correct focus, collision positioning, nested-overlay behavior, and polished enter/exit motion.

### What to build

Deliver native `Dialog`, `Popover`, and `Tooltip` plus focused overlay lifecycle, focus, dismissal, and anchor-positioning composables. Preserve content through exit motion, return focus correctly, and support controlled state without introducing a global store.

### Acceptance criteria

- [ ] Escape, backdrop, outside interaction, and focus restoration follow documented contracts. Escape, backdrop, and outside interaction work; focus restoration is defective and the upstream drag-out guard is missing. See `ui-package-review.md` H4.
- [x] Nested overlays do not dismiss their parent incorrectly.
- [x] Dialog labeling and description remain valid with slot-based content.
- [ ] Popovers remain inside viewport boundaries and expose transform origin. No per-position transform origin is emitted, upstream `viewportMargin` is absent, and happy-dom cannot evidence viewport behavior.
- [ ] Exit callbacks run after visual completion and also complete under reduced motion. Vue `<Transition>` hooks stand in for the upstream phase machine, so an overlay unmounted mid-close never fires `closed`. See `port-fidelity-audit.md` finding 2.
- [ ] No orphan portals, listeners, timers, or inert containers remain after unmount. No unmount-leak test exists.
- [x] Consumer fixture covers keyboard-only and nested-overlay journeys.
- [ ] Dialog, Popover, and Tooltip match every Cladd public prop, compound API, visual state, and lifecycle frame.

---

## Phase 5: Dense navigation slice

**User stories**: A user can navigate dense editor and dashboard controls through toolbars, tabs, segmented choices, accordions, collapsibles, searchable lists, and menus.

### What to build

Deliver `Toolbar`, `Tabs`, `Segmented`, `Accordion`, `Collapsible`, `List`, `SearchField`, and menu/select families as a coherent application-shell vocabulary.

`Select` already shipped ahead of this phase with its option list, search field, and section titles inlined, because these primitives did not exist. Re-cut it onto them here, and replace the playground's hand-rolled `PlaygroundSegmented` and `PlaygroundSwitchControl` with the real components.

### Acceptance criteria

- [ ] Arrow-key, home/end, escape, and typeahead behavior follows relevant patterns.
- [ ] Selection and focus are distinct visually and semantically.
- [ ] Collapsible height motion handles dynamic content and reduced motion.
- [ ] Lists expose composition primitives without owning unbounded data rendering.
- [ ] Search announces result changes when consumers opt into live feedback.
- [ ] Consumer fixture demonstrates sidebar, toolbar, and inspector composition.

---

## Phase 6: Advanced control slice

**User stories**: A user can edit numeric, date, OTP, and color values and receive app-grade toast or popup feedback without custom one-off controls.

### What to build

Deliver `NumberField`, `NumberScrubber`, `Calendar`, `DatePicker`, `OTPField`, `ColorPicker`, `ColorEditor`, `Toast`, and `Popup` in small family-level changes while maintaining one demoable advanced-control workspace.

### Acceptance criteria

- [ ] Numeric controls support keyboard increments, bounds, precision, and pointer scrubbing.
- [ ] Date controls support locale-aware values and keyboard navigation.
- [ ] OTP input supports paste, correction, focus movement, and accessible grouping.
- [ ] Color controls preserve valid values across supported color representations.
- [ ] Toast stacking and popup stacking remain bounded and lifecycle-safe.
- [ ] Advanced controls add no general animation runtime.
- [ ] Each family includes focused contract and interaction tests.

---

## Phase 7: CapuBridge pilot adoption

**User stories**: A CapuBridge user experiences the new surface hierarchy and interaction language in one coherent workflow without losing existing functionality.

### What to build

Adopt package foundation, primary actions, and overlays in one representative desktop workflow containing navigation, dense data, and a modal interaction. Keep legacy components outside the pilot unchanged.

### Acceptance criteria

- [ ] Desktop consumes `@capubridge/ui` through `workspace:*` and imports package CSS once.
- [ ] Pilot workflow preserves every existing action and state.
- [ ] Theme and accent values bridge through documented public tokens only.
- [ ] No package import points back into desktop code.
- [ ] Interaction and render performance are measured against the legacy workflow.
- [ ] Keyboard, contrast, reduced-motion, and resizing checks pass.
- [ ] Pilot can be reverted without affecting unrelated workflows.

---

## Phase 8: Migration and publication readiness

**User stories**: CapuBridge and another Vue consumer can adopt the library through stable documented exports without carrying legacy UI or monorepo-only assumptions.

### What to build

Complete feature-oriented migration, remove replaced desktop primitives only after parity, validate a second consumer, finalize API documentation, and prepare package publication metadata.

### Acceptance criteria

- [ ] All migrated workflows use package exports rather than deep paths.
- [ ] Legacy components are removed only when no consumers remain.
- [ ] A second Vue consumer installs and renders package components without CapuBridge code.
- [ ] Published artifact contains ESM, declarations, CSS, license, notices, and no forbidden runtime.
- [ ] Tree-shaking and bundle inspection confirm unused component families are excluded.
- [ ] Public API, theming, accessibility, migration, and release documentation are complete.
- [ ] Full permitted repository validation passes before release approval.
