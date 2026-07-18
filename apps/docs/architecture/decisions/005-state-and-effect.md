# ADR 005: Explicit state and Effect ownership

Status: Accepted

## Context

Direct invokes, Pinia, TanStack Query, local component state, and duplicate Effect layers currently overlap.

## Decision

TanStack Query owns cached remote data. Setup Pinia stores own durable domain and workflow state. Components own ephemeral presentation state. One typed runtime client owns invokes and subscriptions. Effect is used only for scoped cancellation, retries, resource lifetime, or dependency boundaries and has one live implementation.

## Consequences

Components do not invent device truth or orchestrate transport through watchers. Duplicate runtime layers are removed as features migrate to the single client.
