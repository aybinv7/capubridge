import { describe, expect, test } from "vite-plus/test";
import fixtureText from "../__fixtures__/task-runtime-v1.json?raw";
import type {
  AutomationTask,
  AutomationTaskEvent,
  AutomationTaskRun,
} from "@/types/automation.types";
import {
  appendAutomationTaskEvent,
  createAutomationTaskEvent,
  eventsForStepRecord,
  isTerminalTaskStatus,
  pageAutomationTaskEvents,
  terminalStatusFromRunStatus,
  type AutomationTaskRuntimeState,
} from "../taskRuntime";

interface RuntimeFixture {
  task: AutomationTask;
  run: AutomationTaskRun;
  events: AutomationTaskEvent[];
}

function fixture(): RuntimeFixture {
  return JSON.parse(fixtureText) as RuntimeFixture;
}

function state(): AutomationTaskRuntimeState {
  const value = fixture();
  return {
    task: { ...value.task, status: "created", activeRunId: null },
    run: { ...value.run, status: "pending", startedAt: null },
    events: [],
  };
}

function appendFixtureEvents(): AutomationTaskRuntimeState {
  return fixture().events.reduce(appendAutomationTaskEvent, state());
}

describe("task runtime", () => {
  test("shared fixture serializes through TypeScript without shape changes", () => {
    expect(JSON.parse(JSON.stringify(fixture()))).toEqual(fixture());
  });

  test("requires created then started events in ascending sequence", () => {
    const runtime = appendFixtureEvents();
    expect(runtime.task.status).toBe("running");
    expect(runtime.run.status).toBe("running");
    expect(runtime.events.map((event) => event.sequence)).toEqual([1, 2]);
  });

  test("rejects duplicate terminal outcomes and later events", () => {
    const runtime = appendFixtureEvents();
    const terminal = createAutomationTaskEvent({
      id: "event-terminal",
      taskId: runtime.task.id,
      runId: runtime.run.id,
      sequence: 3,
      occurredAt: 1200,
      origin: "local-chat",
      principalId: runtime.task.principal.id,
      connectionId: runtime.task.principal.connectionId,
      kind: "task.terminal",
      data: { status: "completed", reason: null },
    });
    const finished = appendAutomationTaskEvent(runtime, terminal);
    expect(isTerminalTaskStatus(finished.task.status)).toBe(true);
    expect(() =>
      appendAutomationTaskEvent(finished, { ...terminal, id: "event-after", sequence: 4 }),
    ).toThrow(/terminal task outcome/);
  });

  test("rejects gaps, backward clocks and foreign task events", () => {
    const runtime = appendFixtureEvents();
    const base = runtime.events[1] as AutomationTaskEvent;
    expect(() => appendAutomationTaskEvent(runtime, { ...base, id: "gap", sequence: 4 })).toThrow(
      /sequence 3/,
    );
    expect(() =>
      appendAutomationTaskEvent(runtime, { ...base, id: "past", sequence: 3, occurredAt: 1 }),
    ).toThrow(/ordered by occurrence time/);
    expect(() =>
      appendAutomationTaskEvent(runtime, {
        ...base,
        id: "foreign",
        sequence: 3,
        taskId: "task-other",
      }),
    ).toThrow(/does not belong/);
  });

  test("maps legacy step records into redacted canonical evidence", () => {
    const runtime = appendFixtureEvents();
    const events = eventsForStepRecord({
      taskId: runtime.task.id,
      runId: runtime.run.id,
      origin: "local-chat",
      principalId: runtime.task.principal.id,
      connectionId: runtime.task.principal.connectionId,
      owner: "embedded",
      firstSequence: 3,
      idForSequence: (sequence) => `event-${sequence}`,
      record: {
        stepId: "step-1",
        startedAt: 1200,
        endedAt: 1250,
        decision: {
          operation: "tap",
          target: { kind: "text", text: "Next stop", exact: true },
          confidence: 0.9,
          reason: "visible target",
        },
        resolvedTarget: { x: 10, y: 20, strategy: "text" },
        outcome: "ok",
        error: null,
        screenshotRef: "attachments/step-1.png",
        dispatchStatus: "dispatched",
        verificationStatus: "verified",
        beforeFingerprint: "before",
        afterFingerprint: "after",
        screenChanged: true,
      },
    });
    expect(events.map((event) => event.kind)).toEqual([
      "reasoning.decision",
      "action.dispatched",
      "observation.captured",
      "verification.completed",
    ]);
    expect(events[2]?.data).toMatchObject({ evidence: { kind: "trace", field: "screenshotRef" } });
    expect(JSON.stringify(events)).not.toContain("attachments/step-1.png");
  });

  test("pages events with a bounded opaque cursor", () => {
    const events = fixture().events;
    expect(pageAutomationTaskEvents(events, null, 1)).toMatchObject({ nextCursor: "1" });
    expect(pageAutomationTaskEvents(events, "1", 1000).events).toHaveLength(1);
    expect(pageAutomationTaskEvents(events, "bad", 1).events).toHaveLength(1);
  });

  test("maps legacy terminal statuses without guessing", () => {
    expect(terminalStatusFromRunStatus("passed")).toBe("completed");
    expect(terminalStatusFromRunStatus("halted")).toBe("blocked");
    expect(terminalStatusFromRunStatus("running")).toBeNull();
  });
});
