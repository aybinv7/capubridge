# ADR 003: Mechanically verified IPC contract

Status: Accepted

## Context

Manually maintained command notes and direct invokes drift from registered Rust commands. Opaque string failures prevent reliable recovery behavior.

## Decision

Command names, inputs, results, events, and structured errors come from one generated or mechanically checked contract. Frontend code invokes commands through one typed runtime client. Registration and binding drift fail before runtime.

## Consequences

Command migrations include contract, Rust registration, typed client, UI behavior, and tests in one slice. Errors retain stable categories while internal detail can evolve.
