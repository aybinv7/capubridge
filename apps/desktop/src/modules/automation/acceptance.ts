import {
  PRESALIO_ORDER_MILESTONES,
  type AutomationTaskEvent,
  type PresalioAcceptanceReport,
  type RunStatus,
} from "@/types/automation.types";

export { PRESALIO_ORDER_MILESTONES } from "@/types/automation.types";
export type { PresalioMilestone } from "@/types/automation.types";

export interface AcceptanceRunInput {
  mode: PresalioAcceptanceReport["mode"];
  status: RunStatus | "unavailable";
  startedAt: number;
  endedAt: number;
  events: AutomationTaskEvent[];
  runId: string | null;
  unavailableReason?: string;
}

export function buildPresalioAcceptanceReport(input: AcceptanceRunInput): PresalioAcceptanceReport {
  const completedMilestones = input.events
    .filter(
      (event): event is Extract<AutomationTaskEvent, { kind: "acceptance.milestone" }> =>
        event.kind === "acceptance.milestone",
    )
    .map((event) => event.data.milestone)
    .filter((milestone, index, all) => all.indexOf(milestone) === index);
  const actions = input.events.filter((event) => event.kind === "action.dispatched");
  const verification = input.events.filter((event) => event.kind === "verification.completed");
  const unavailable = input.status === "unavailable";
  const passed =
    input.status === "passed" &&
    PRESALIO_ORDER_MILESTONES.every((milestone) => completedMilestones.includes(milestone));
  return {
    version: 1,
    scenario: "presalio-order-v1",
    mode: input.mode,
    availability: unavailable ? "unavailable" : passed ? "completed" : "failed",
    runId: input.runId,
    completedMilestones,
    missingMilestones: PRESALIO_ORDER_MILESTONES.filter(
      (milestone) => !completedMilestones.includes(milestone),
    ),
    durationMs: Math.max(0, input.endedAt - input.startedAt),
    physicalActions: actions.filter((event) => event.data.status === "dispatched").length,
    noOpActions: verification.filter(
      (event) => event.data.status === "unverified" && event.data.outcome === "ok",
    ).length,
    staleTargetFailures: actions.filter((event) => event.data.error?.includes("stale target"))
      .length,
    recoveryEvents: input.events.filter((event) => event.kind === "task.awaiting").length,
    evidenceComplete: passed && completedMilestones.length === PRESALIO_ORDER_MILESTONES.length,
    reason: unavailable
      ? (input.unavailableReason ?? "mode is not configured")
      : passed
        ? null
        : "every declared Presalio milestone needs a verified assertion",
  };
}
