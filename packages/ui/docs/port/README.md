# Port manifests

A port manifest is the diff-checkable record of how one `@capubridge/ui` component was derived from
its pinned Cladd counterpart. `THIRD_PARTY_NOTICES.md` records which upstream files were used; a
manifest records what happened to each prop and each literal inside them, with line references on
both sides.

The manifest exists so a reviewer can re-verify a port without re-deriving it, and so a later
re-derivation shows up as a documented deviation rather than as silent drift.

## When a manifest is mandatory

- Every newly ported component, in the same change that adds the component.
- Every change to an existing ported component that touches a prop, an emitted event, a slot, a
  copied literal, a DOM node, or a CSS value.
- Every change that rebases a component onto a newer pinned commit.

A change that adds or edits a component without its manifest is incomplete. A manifest that
disagrees with the source is a defect.

## Prerequisites

Run `vp run reference:cladd` first. It vendors `https://github.com/cladd-ui/cladd` at the commit
recorded in `THIRD_PARTY_NOTICES.md` into `reference/cladd/` and verifies the SHA. Every line
reference in a manifest must be read out of that checkout, never from memory or from published
documentation.

## Required structure

Each manifest is `docs/port/<Component>.md` and contains, in this order:

1. **Header** — upstream files with their repo-relative paths, the pinned commit, the Vue files
   under review, and the date the diff was performed.
2. **Prop table** — one row per upstream prop, plus one row per Vue-only prop.
3. **Copied literals** — every value copied by value, with its upstream `file:line`.
4. **Deviations** — one line per `deviated` verdict, restating the reason.
5. **Verification** — what was actually compared, and what was not.

### Prop table columns

| Column          | Contents                                                                     |
| --------------- | ---------------------------------------------------------------------------- |
| `Upstream prop` | Name as declared in the upstream TSX. `—` for a Vue-only prop.               |
| `Upstream ref`  | `<file>:<line>` of the declaration, and of the default when it differs.      |
| `Vue surface`   | Prop, event, slot, attribute, or CSS class the prop became. `—` when absent. |
| `Vue ref`       | `<file>:<line>` in `packages/ui`.                                            |
| `Default`       | `upstream → Vue`, or a single value when identical.                          |
| `Verdict`       | `ported`, `transposed`, or `deviated`.                                       |
| `Note`          | Free text. Mandatory when the verdict is `deviated`.                         |

### Verdict vocabulary

- **`ported`** — copied by value. Name, type domain, default, and effect are the upstream ones. The
  only permitted mechanical change is the `cladd-*` to `cui-*` namespace rename.
- **`transposed`** — a React construct rewritten in Vue with its semantics preserved: `ReactNode`
  prop to slot, `onX` callback to emitted event, `className` to `class`, `ElementType` to
  `<component :is>`, `useEffect` to a lifecycle hook, context to an `InjectionKey`, a Tailwind
  utility string to the equivalent scoped CSS declaration. The rendered result and the observable
  behavior must be unchanged; only the mechanism differs.
- **`deviated`** — anything else, including a renamed prop, a changed default, an added prop, a
  dropped prop, a dropped attribute, a different literal value, added behavior upstream does not
  have, and a Vue-only hardening guard. A reason is mandatory and must state what differs and why.

`transposed` is not a place to hide a behavior change. If the observable result differs for any
input, the verdict is `deviated`.

### Copied literals section

List every value copied out of upstream, one row each, with columns `Value`, `Upstream ref`, and
`Vue ref`. This covers constant tables, size and spacing maps, radii, durations, easings, transform
values, z-indices, colors, formulas, and CSS custom-property definitions. A literal that appears in
the Vue source without an upstream reference is either a deviation or a bug.

Constant tables belong in `*.contracts.ts`, not inline in an SFC, so that value-lock tests can
import them. Record an inline table as a `ported` literal with the extraction gap called out in the
note.
