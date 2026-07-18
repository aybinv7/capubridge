# ADR 002: Self-contained frontend modules

Status: Accepted

## Context

Feature directories exist, but global routes, stores, composables, types, and cross-feature component imports obscure ownership and make changes spread across the application.

## Decision

Each module owns its routes, components, composables, services, setup stores, types, locales, and tests. It exposes a narrow `public.ts` surface to the application registry. Modules cannot import another module's internal files. Generic shared primitives live outside modules and cannot own feature state.

## Consequences

Cross-feature workflows are composed by the application shell or through shared contracts. Existing violations are tracked in a shrinking baseline; new violations fail the quality gate immediately.
