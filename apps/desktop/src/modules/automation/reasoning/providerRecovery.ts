import type { AutomationTaskEvent, AutomationTaskEventBase } from "@/types/automation.types";
import { createAutomationTaskEvent } from "../taskRuntime";
import { ReasoningProviderError } from "./providerTypes";

type ProviderAwaitingEventBase = Pick<
  AutomationTaskEventBase,
  "id" | "taskId" | "runId" | "sequence" | "occurredAt" | "origin" | "principalId" | "connectionId"
>;

export function createProviderAwaitingEvent(
  base: ProviderAwaitingEventBase,
  error: ReasoningProviderError,
): Extract<AutomationTaskEvent, { kind: "task.awaiting" }> {
  return createAutomationTaskEvent({
    ...base,
    kind: "task.awaiting",
    data: {
      status: "awaiting-reasoner",
      reason: `${error.kind}:${error.message}`,
    },
  });
}

export function canRetryReasoningProvider(error: ReasoningProviderError): boolean {
  return error.resumable;
}
