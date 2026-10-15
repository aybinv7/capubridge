import type { ReasoningOwner } from "@/types/automation.types";

export interface ReasoningOwnerLease {
  taskId: string;
  owner: ReasoningOwner;
  connectionId: string | null;
  claimedAt: number;
  expiresAt: number;
}

export interface ReasoningOwnerCoordinator {
  claim(taskId: string, owner: ReasoningOwner, connectionId: string | null): ReasoningOwnerLease;
  heartbeat(
    taskId: string,
    owner: ReasoningOwner,
    connectionId: string | null,
  ): ReasoningOwnerLease;
  release(taskId: string, owner: ReasoningOwner, connectionId: string | null): void;
  handoff(taskId: string, owner: ReasoningOwner, connectionId: string | null): ReasoningOwnerLease;
  current(taskId: string): ReasoningOwnerLease | null;
}

export function createReasoningOwnerCoordinator(
  now: () => number = Date.now,
  leaseDurationMs = 30_000,
): ReasoningOwnerCoordinator {
  const leases = new Map<string, ReasoningOwnerLease>();

  function current(taskId: string): ReasoningOwnerLease | null {
    const lease = leases.get(taskId);
    if (lease === undefined) return null;
    if (lease.expiresAt <= now()) {
      leases.delete(taskId);
      return null;
    }
    return lease;
  }

  function claim(
    taskId: string,
    owner: ReasoningOwner,
    connectionId: string | null,
  ): ReasoningOwnerLease {
    const existing = current(taskId);
    if (existing !== null && (existing.owner !== owner || existing.connectionId !== connectionId)) {
      throw new Error(`task ${taskId} is owned by ${existing.owner}`);
    }
    const claimedAt = now();
    const lease = {
      taskId,
      owner,
      connectionId,
      claimedAt,
      expiresAt: claimedAt + leaseDurationMs,
    };
    leases.set(taskId, lease);
    return lease;
  }

  function heartbeat(
    taskId: string,
    owner: ReasoningOwner,
    connectionId: string | null,
  ): ReasoningOwnerLease {
    const existing = current(taskId);
    if (existing === null || existing.owner !== owner || existing.connectionId !== connectionId) {
      throw new Error(`task ${taskId} has no matching owner lease`);
    }
    const lease = { ...existing, expiresAt: now() + leaseDurationMs };
    leases.set(taskId, lease);
    return lease;
  }

  function release(taskId: string, owner: ReasoningOwner, connectionId: string | null): void {
    const existing = current(taskId);
    if (existing === null) return;
    if (existing.owner !== owner || existing.connectionId !== connectionId) {
      throw new Error(`task ${taskId} is owned by ${existing.owner}`);
    }
    leases.delete(taskId);
  }

  function handoff(
    taskId: string,
    owner: ReasoningOwner,
    connectionId: string | null,
  ): ReasoningOwnerLease {
    leases.delete(taskId);
    return claim(taskId, owner, connectionId);
  }

  return { claim, heartbeat, release, handoff, current };
}
