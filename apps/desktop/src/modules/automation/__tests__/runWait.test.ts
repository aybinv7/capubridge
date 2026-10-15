import { describe, expect, test } from "vite-plus/test";
import type { RunStatus } from "@/types/automation.types";
import type { RunEvent, RunObserver } from "../runObserver";
import type { RunStatusSnapshot, TracePage, TraceRecord } from "../runRegistryTypes";
import { MAX_SUMMARY_STEPS, describeStep, waitForRun } from "../runWait";
import type { WaitableRegistry } from "../runWait";

function traceRecord(stepId: string, overrides: Partial<TraceRecord> = {}): TraceRecord {
  return {
    stepId,
    startedAt: 1_000,
    endedAt: 1_500,
    operation: "tap",
    target: { kind: "text", text: "Stock" },
    text: null,
    confidence: 1,
    reason: "flow step",
    resolvedTarget: null,
    outcome: "ok",
    error: null,
    screenshot: null,
    assertions: [],
    verificationStatus: "verified",
    ...overrides,
  };
}

/**
 * A registry double that records subscriptions, so the suite can prove the
 * wait resolves on the event it is waiting for and never leaks an observer.
 */
function fakeRegistry(initial: RunStatus, records: TraceRecord[] = []) {
  const observers = new Set<RunObserver>();
  const state = { status: initial, records, traceReads: 0 };
  const registry: WaitableRegistry = {
    getStatus: (runId): RunStatusSnapshot => {
      if (runId !== "run-1") {
        throw new Error(`unknown run ${runId}`);
      }
      return {
        runId,
        taskId: "task-1",
        status: state.status,
        currentStep: state.records.length,
        stepCount: state.records.length,
        policyId: "jev",
        label: "Open stock",
        failureReason: state.status === "failed" ? "step s2 failed: missed" : null,
        filePath: null,
      };
    },
    subscribe: (observer) => {
      observers.add(observer);
      return () => {
        observers.delete(observer);
      };
    },
    readTrace: (_runId, offset, limit): Promise<TracePage> => {
      state.traceReads += 1;
      return Promise.resolve({
        total: state.records.length,
        offset,
        limit,
        records: state.records.slice(offset, offset + limit),
      });
    },
  };
  function emit(event: RunEvent): void {
    for (const observer of observers) {
      observer(event);
    }
  }
  return { registry, state, observers, emit };
}

function manualTimers() {
  const pending: Array<() => void> = [];
  return {
    timers: {
      setTimeout: (fn: () => void) => {
        pending.push(fn);
        return pending.length;
      },
      clearTimeout: () => {
        pending.length = 0;
      },
    },
    fire: () => {
      const due = [...pending];
      pending.length = 0;
      for (const fn of due) {
        fn();
      }
    },
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("waitForRun", () => {
  test("a finished run returns at once without subscribing", async () => {
    const { registry, observers } = fakeRegistry("passed", [traceRecord("s1")]);
    const summary = await waitForRun(registry, "run-1", 30_000);
    expect(summary.done).toBe(true);
    expect(summary.status).toBe("passed");
    expect(summary.steps).toHaveLength(1);
    expect(observers.size).toBe(0);
  });

  test("a running run resolves on its own finished event and unsubscribes", async () => {
    const { registry, state, observers, emit } = fakeRegistry("running");
    const { timers } = manualTimers();
    let settled = false;
    const pending = waitForRun(registry, "run-1", 30_000, timers).then((summary) => {
      settled = true;
      return summary;
    });
    await flush();
    expect(settled).toBe(false);
    expect(observers.size).toBe(1);

    state.status = "passed";
    state.records = [traceRecord("s1"), traceRecord("s2")];
    emit({ kind: "finished", runId: "run-1", status: "passed", failureReason: null, endedAt: 2 });
    const summary = await pending;
    expect(summary.done).toBe(true);
    expect(summary.steps).toHaveLength(2);
    expect(observers.size).toBe(0);
  });

  test("another run finishing does not release the wait", async () => {
    const { registry, emit } = fakeRegistry("running");
    const { timers } = manualTimers();
    let settled = false;
    void waitForRun(registry, "run-1", 30_000, timers).then(() => {
      settled = true;
    });
    await flush();
    emit({ kind: "finished", runId: "run-9", status: "passed", failureReason: null, endedAt: 2 });
    await flush();
    expect(settled).toBe(false);
  });

  test("the timeout returns a not-done summary telling the caller to wait again", async () => {
    const { registry, observers } = fakeRegistry("running", [traceRecord("s1")]);
    const { timers, fire } = manualTimers();
    const pending = waitForRun(registry, "run-1", 30_000, timers);
    await flush();
    fire();
    const summary = await pending;
    expect(summary.done).toBe(false);
    expect(summary.status).toBe("running");
    expect(summary.next).toContain("wait_for_run");
    expect(observers.size).toBe(0);
  });

  test("an unknown run rejects rather than waiting out the timeout", async () => {
    const { registry } = fakeRegistry("running");
    await expect(waitForRun(registry, "run-missing", 30_000)).rejects.toThrow("unknown run");
  });

  test("a long run reports only its tail steps and says how many it left out", async () => {
    const records = Array.from({ length: MAX_SUMMARY_STEPS + 12 }, (_, index) =>
      traceRecord(`s${index}`),
    );
    const { registry } = fakeRegistry("passed", records);
    const summary = await waitForRun(registry, "run-1", 30_000);
    expect(summary.steps).toHaveLength(MAX_SUMMARY_STEPS);
    expect(summary.omittedSteps).toBe(12);
    expect(summary.steps.at(-1)).toContain(`s${MAX_SUMMARY_STEPS + 11}`);
  });

  test("duration spans the earliest start to the latest end, whatever the record order", async () => {
    const { registry } = fakeRegistry("halted", [
      traceRecord("goal.0", { startedAt: 5_000, endedAt: 5_001 }),
      traceRecord("goal", { startedAt: 1_000, endedAt: 9_000 }),
    ]);
    const summary = await waitForRun(registry, "run-1", 30_000);
    expect(summary.durationMs).toBe(8_000);
  });

  test("a failed run carries its failure reason", async () => {
    const { registry } = fakeRegistry("failed", [
      traceRecord("s1"),
      traceRecord("s2", { outcome: "failed", error: 'no candidate matches text "Save"' }),
    ]);
    const summary = await waitForRun(registry, "run-1", 30_000);
    expect(summary.failureReason).toContain("s2");
    expect(summary.steps[1]).toContain("no candidate matches");
  });
});

describe("describeStep", () => {
  test("one compact line carries the operation, target, outcome and verification", () => {
    expect(describeStep(traceRecord("s3", { target: { kind: "text", text: "search" } }))).toBe(
      's3 tap "search" -> ok verified',
    );
  });

  test("a typed value is shown as the trace already redacted it", () => {
    const line = describeStep(
      traceRecord("s4", {
        operation: "type",
        target: { kind: "selector", cssSelector: "#password" },
        text: "[redacted]",
      }),
    );
    expect(line).toBe('s4 type #password = "[redacted]" -> ok verified');
  });

  test("a long value is truncated so one step cannot bloat the summary", () => {
    const line = describeStep(
      traceRecord("s5", { target: { kind: "text", text: "x".repeat(400) } }),
    );
    expect(line.length).toBeLessThan(160);
  });
});
