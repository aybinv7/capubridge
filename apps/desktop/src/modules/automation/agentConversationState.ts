import type { AgentPanelRunState, FeedEntry } from "./agentPanelState";
import type { RunViewStep } from "./runSource";
import type { RunStatus } from "@/types/automation.types";

export type AgentConversationTurn =
  | { id: string; kind: "request"; text: string }
  | {
      id: string;
      kind: "action";
      operation: string;
      outcome: string;
      confidence: number | null;
      detail: string | null;
    }
  | {
      id: string;
      kind: "status";
      state: Exclude<AgentPanelRunState, "idle" | "running">;
      text: string;
    };

export function requestTurn(id: string, text: string): AgentConversationTurn {
  return { id, kind: "request", text };
}

export function actionTurn(id: string, entry: FeedEntry): AgentConversationTurn {
  return {
    id,
    kind: "action",
    operation: entry.operation,
    outcome: entry.outcome,
    confidence: entry.confidence,
    detail: entry.detail,
  };
}

export function statusTurn(
  id: string,
  state: Exclude<AgentPanelRunState, "idle" | "running">,
  failureReason: string | null,
): AgentConversationTurn {
  if (failureReason !== null) {
    return { id, kind: "status", state, text: failureReason };
  }
  return {
    id,
    kind: "status",
    state,
    text: state === "passed" ? "Run completed." : "Run stopped without a failure reason.",
  };
}

export function archivedConversationTurns(
  runId: string,
  goal: string,
  steps: RunViewStep[],
  status: RunStatus,
): AgentConversationTurn[] {
  const terminal = archivedTerminalStatus(status);
  const failureReason = steps.find((step) => step.outcome === "failed")?.error ?? null;
  return [
    requestTurn(`${runId}-request`, goal),
    ...steps.map((step, index) => ({
      id: `${runId}-action-${index}`,
      kind: "action" as const,
      operation: step.decision.operation,
      outcome: step.verificationStatus ?? step.outcome,
      confidence: step.decision.confidence,
      detail: step.error ?? step.decision.reason,
    })),
    statusTurn(`${runId}-status`, terminal, failureReason),
  ];
}

function archivedTerminalStatus(
  status: RunStatus,
): Exclude<AgentPanelRunState, "idle" | "running"> {
  switch (status) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "halted":
    case "cancelled":
      return "halted";
    case "pending":
    case "running":
      return "failed";
  }
}
