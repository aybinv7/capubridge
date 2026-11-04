# Extension specifications

A Cladd extension is a new component family that does not exist in the pinned Cladd checkout at `1aaad0ac5b13541823ed876a227949fcc806ca5e`. Extensions reuse Cladd foundations — `@theme` tokens, surface levels and variants, density, accent and size scoping, motion — but they are **not** ports and must not be described as ports. Each extension ships only when it is listed in `reviewedExtensions` in `tests/parity/upstreamExports.test.ts` and has a matching `docs/extensions/<Component>.md` spec. An extra public export that is neither an upstream export nor a reviewed extension fails parity, and a reviewed extension without a spec also fails.

## When a specification is mandatory

- Every new extension family, in the same change that adds the family.
- Every change to an existing extension that touches props, events, slots, semantics, keyboard behavior, state, composition, styling, or motion.

A change that adds or edits an extension without its spec is incomplete. A spec that disagrees with the source is a defect.

## Inventory note: shadcn

`shadcn` and `shadcn-vue` are **inventory and composition research only**. They may inform API shape and ergonomics during design, but no `shadcn` source is copied into this package. Any future decision to copy `shadcn` source would require a separate attribution review and an entry in `THIRD_PARTY_NOTICES.md` before it ships.

## Required structure

Each specification is `docs/extensions/<Component>.md` and contains, in this order:

1. **Purpose** — what the family does, where it is used, and what it explicitly does not do.
2. **Public API** — exported names, props, events, slots, `v-model` bindings, and types, with defaults.
3. **Semantics** — rendered elements, roles, states, attributes, and accessible names.
4. **Keyboard behavior** — key bindings, focus movement, roving focus, and shortcut handling.
5. **State** — controlled and uncontrolled modes, derived state, and emission contracts.
6. **Composition** — allowed children, slots, and contextual providers it participates in.
7. **Styling** — tokens, surface/accent/size integration, variants, selectors, and density rules it follows.
8. **Performance** — mounting strategy, expensive work, and any measurement or virtualization boundary.
9. **Tests** — contract, interaction, and accessibility coverage that must exist.
10. **Evidence** — what was compared or validated and what was not, including design references consulted.
11. **Provenance** — origin of the design, foundations reused from Cladd, and explicit statement that the family is a Cladd extension, not an upstream port. If composition research referenced `shadcn` or another source, list it here with the note that no source was copied unless separately attributed.

### Section guidance

- **Purpose** — one paragraph on the job to be done, one on non-goals or out-of-scope usage.
- **Public API** — table of props/events/slots mirroring the port manifest style: name, type, default, and note. Mark Vue-only idioms explicitly.
- **Semantics** — element and ARIA mapping, labeling requirements, disabled and loading states.
- **Keyboard behavior** — exhaustive key table with focus and selection outcome, including Escape and outside interaction.
- **State** — controlled vs uncontrolled, `v-model` shape, and cancellation or validation semantics.
- **Composition** — slot and provider diagram, and any constraints on nesting.
- **Styling** — token and variant table, surface level handling, and motion roles with reduced-motion outcome.
- **Performance** — what is lazy or eager, what is measured, and cost notes for large collections.
- **Tests** — checklist of contract, keyboard, focus, and reduced-motion tests that must pass.
- **Evidence** — references consulted, prototypes measured, and gaps still open.
- **Provenance** — `Cladd extension — not an upstream port. Reuses Cladd <tokens/surfaces/density/motion>. Composition research: <sources> (inventory only, no source copied).` plus any separate attribution if source was copied.
