/**
 * Builds the initial durable runtime state for a task run.
 *
 * Lifted out of `createRunRegistry` for source size. It closes over no
 * registry state — every input arrives through its argument — which is what
 * made it safe to move without changing behaviour.
 */
import type {
  AutomationPrincipal,
  AutomationTask,
  AutomationTaskOrigin,
  AutomationTaskRun,
} from "@/types/automation.types";
import type { PolicyId } from "./policies/types";
import { ownerForPolicy } from "./runRegistryHelpers";
import type { AutomationTaskRuntimeState } from "./taskRuntime";
import { appendAutomationTaskEvent, createAutomationTaskEvent } from "./taskRuntime";
import { authorizationScopeForGoal } from "./taskAuthorization";
import type { ManagedRun } from "./runRegistryTypes";

export function createRuntimeState(input: {
  runId: string;
  kind: ManagedRun["kind"];
  label: string;
  policyId: PolicyId;
  goal: string | null;
  deviceSerial: string;
  startedAt: number;
  appPackage?: string | null;
  taskId?: string;
  attempt?: number;
  principal?: AutomationPrincipal;
}): AutomationTaskRuntimeState {
  const owner = ownerForPolicy(input.policyId);
  const principal = input.principal ?? {
    id: "principal-capubridge-local",
    label: "Capubridge",
    kind: "local" as const,
    connectionId: null,
    clientName: null,
  };
  const origin: AutomationTaskOrigin =
    principal.kind === "mcp" ? "mcp" : input.kind === "flow" ? "flow" : "local-chat";
  const taskId = input.taskId ?? `task-${input.runId}`;
  const task: AutomationTask = {
    schemaVersion: 1,
    id: taskId,
    conversationId: null,
    origin,
    principal,
    originalGoal: input.goal ?? input.label,
    appPackage: input.appPackage ?? null,
    deviceSerial: input.deviceSerial,
    reasoningOwner: owner,
    authorizationScope:
      input.goal === null
        ? null
        : authorizationScopeForGoal(
            input.goal,
            input.deviceSerial,
            input.appPackage ?? null,
            input.startedAt,
          ),
    status: "created",
    activeRunId: null,
    terminalReason: null,
    createdAt: input.startedAt,
    updatedAt: input.startedAt,
  };
  const run: AutomationTaskRun = {
    schemaVersion: 1,
    id: input.runId,
    taskId,
    attempt: input.attempt ?? 1,
    status: "pending",
    reasoningOwner: owner,
    principalId: task.principal.id,
    deviceLease: null,
    startedAt: null,
    endedAt: null,
  };
  let state: AutomationTaskRuntimeState = { task, run, events: [] };
  state = appendAutomationTaskEvent(
    state,
    createAutomationTaskEvent({
      id: `event-${input.runId}-1`,
      taskId,
      runId: input.runId,
      sequence: 1,
      occurredAt: input.startedAt,
      origin,
      principalId: task.principal.id,
      connectionId: task.principal.connectionId,
      kind: "task.created",
      data: {
        goal: task.originalGoal,
        appPackage: task.appPackage,
        deviceSerial: task.deviceSerial,
      },
    }),
  );
  return appendAutomationTaskEvent(
    state,
    createAutomationTaskEvent({
      id: `event-${input.runId}-2`,
      taskId,
      runId: input.runId,
      sequence: 2,
      occurredAt: input.startedAt,
      origin,
      principalId: task.principal.id,
      connectionId: task.principal.connectionId,
      kind: "run.started",
      data: { attempt: run.attempt, owner, lease: null },
    }),
  );
}
