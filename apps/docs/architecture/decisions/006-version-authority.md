# ADR 006: Root application version authority

Status: Accepted

## Context

Root, desktop, Cargo, Tauri, documentation, and tags have represented different application versions.

## Decision

Root `package.json` is the application version source of truth. Desktop package, Cargo manifest, Tauri configuration, visible status, release notes, and annotated release tag must match it. A version check runs before builds and releases.

## Consequences

Version changes land in a dedicated commit before an annotated `vX.Y.Z` tag. CI rejects manifest or tag drift.
