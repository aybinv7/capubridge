import { describe, expect, test } from "vite-plus/test";
import type { AutomationTaskEvent } from "@/types/automation.types";
import { buildPresalioAcceptanceReport, PRESALIO_ORDER_MILESTONES } from "../acceptance";

const base = {
  schemaVersion: 1 as const,
  taskId: "task-1",
  runId: "run-1",
  sequence: 1,
  occurredAt: 100,
  origin: "local-chat" as const,
  principalId: "local",
  connectionId: null,
};

function milestoneEvents(): AutomationTaskEvent[] {
  return PRESALIO_ORDER_MILESTONES.map((milestone, index) => ({
    ...base,
    id: `milestone-${milestone}`,
    sequence: index + 1,
    kind: "acceptance.milestone" as const,
    data: { scenario: "presalio-order-v1" as const, milestone, stepId: `assert-${milestone}` },
  }));
}

describe("Presalio acceptance report", () => {
  test("never calls screen activity a completed order", () => {
    const events: AutomationTaskEvent[] = [
      {
        ...base,
        id: "action",
        kind: "action.dispatched",
        data: { stepId: "tap", operation: "tap", status: "dispatched", target: null, error: null },
      },
    ];
    const report = buildPresalioAcceptanceReport({
      mode: "embedded",
      status: "passed",
      startedAt: 0,
      endedAt: 100,
      events,
      runId: "run-1",
    });
    expect(report.availability).toBe("failed");
    expect(report.evidenceComplete).toBe(false);
  });

  test("records a missing provider as unavailable", () => {
    const report = buildPresalioAcceptanceReport({
      mode: "chatgpt-mcp",
      status: "unavailable",
      startedAt: 0,
      endedAt: 0,
      events: [],
      runId: null,
      unavailableReason: "MCP tunnel not configured",
    });
    expect(report).toMatchObject({
      availability: "unavailable",
      reason: "MCP tunnel not configured",
    });
  });

  test("requires verified checkpoint events for every milestone", () => {
    const report = buildPresalioAcceptanceReport({
      mode: "deterministic",
      status: "passed",
      startedAt: 0,
      endedAt: 100,
      events: milestoneEvents(),
      runId: "run-1",
    });
    expect(report).toMatchObject({ availability: "completed", evidenceComplete: true });
  });
});
