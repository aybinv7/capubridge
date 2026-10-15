import type { AutomationTaskEvent, AutomationTaskEventBase } from "@/types/automation.types";
import { createAutomationTaskEvent } from "../taskRuntime";
import type { CreateAutomationTaskEventInput } from "../taskRuntime";
import type { ReasoningProviderId } from "./providerTypes";

export type ReasoningStreamPhase =
  | "started"
  | "text"
  | "tool-call"
  | "tool-result"
  | "usage"
  | "retry"
  | "failed"
  | "cancelled";

export interface ReasoningStreamRecord {
  provider: ReasoningProviderId;
  modelId: string;
  phase: ReasoningStreamPhase;
  detail: string | null;
}

type ReasoningStreamEventBase = Pick<
  AutomationTaskEventBase,
  "id" | "taskId" | "runId" | "sequence" | "occurredAt" | "origin" | "principalId" | "connectionId"
>;

export function createReasoningStreamEvent(
  base: ReasoningStreamEventBase,
  record: ReasoningStreamRecord,
): Extract<AutomationTaskEvent, { kind: "reasoning.streamed" }> {
  const input: CreateAutomationTaskEventInput<"reasoning.streamed"> = {
    ...base,
    kind: "reasoning.streamed",
    data: {
      ...record,
      detail: redactProviderSecret(record.detail),
    },
  };
  return createAutomationTaskEvent(input);
}

export function redactProviderSecret(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  return value
    .replace(/\b(?:Bearer|api[_-]?key)\s+(?:sk-)?[A-Za-z0-9._-]{8,}\b/gi, "[redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]");
}
