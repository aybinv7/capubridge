# ADR 004: Supervised device sessions

Status: Accepted

## Context

One managed ADB server connection avoids process overhead and Windows error-dialog problems, but long blocking operations and a global transport lock can delay cancellation and unrelated devices.

## Decision

A supervisor owns each device session, queue, leases, port allocations, cancellation registry, and terminal cleanup. Stop, cancellation, disconnect, and health work can preempt background scans. Every blocking operation has a timeout or cancellation path. The managed ADB server remains singular and commands never spawn separate ADB processes.

## Consequences

Queue policy and resource ownership become testable. Multi-device work can progress fairly while transport access remains synchronized only for the minimum required duration.
