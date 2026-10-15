import { describe, expect, test } from "vite-plus/test";
import type { RunRow } from "../runHistory";
import {
  drawerRows,
  historyEmptyReason,
  isAdHoc,
  notFoundRow,
  parsePermalink,
  permalinkFor,
} from "../runsDrawerState";

function row(overrides: Partial<RunRow> = {}): RunRow {
  return {
    sessionId: "s1",
    label: "Run",
    startedAt: 1000,
    durationMs: 500,
    deviceSerial: null,
    filePath: "/capu/s1.capu",
    incomplete: false,
    runStatus: "passed",
    policyId: "rules",
    flowName: "Flow A",
    goal: null,
    stepCount: 5,
    failedStepIndex: null,
    ...overrides,
  };
}

describe("runsDrawerState", () => {
  test("rows sort newest first across multiple flows", () => {
    const rows = [
      row({ sessionId: "a", startedAt: 100 }),
      row({ sessionId: "b", startedAt: 300 }),
      row({ sessionId: "c", startedAt: 200 }),
    ];
    const sorted = drawerRows(rows);
    expect(sorted.map((r) => r.sessionId)).toEqual(["b", "c", "a"]);
  });

  test("filtering by status returns only matching rows", () => {
    const rows = [row({ runStatus: "passed" }), row({ runStatus: "failed", sessionId: "s2" })];
    const filtered = drawerRows(rows, { status: "failed" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.runStatus).toBe("failed");
  });

  test("a session with no flow id still produces a row titled by its goal and marked ad-hoc", () => {
    const adHoc = row({ flowName: null, goal: "do thing" });
    expect(isAdHoc(adHoc)).toBe(true);
    const rows = drawerRows([adHoc]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.goal).toBe("do thing");
  });

  test("a live run sorts to the top and is marked running", () => {
    const rows = [
      row({ sessionId: "a", startedAt: 100, runStatus: "passed" }),
      row({ sessionId: "b", startedAt: 50, runStatus: "running" }),
    ];
    const sorted = drawerRows(rows);
    expect(sorted[0]?.runStatus).toBe("running");
  });

  test("duration and step count are derived from the run", () => {
    const r = row({ durationMs: 1234, stepCount: 7 });
    expect(r.durationMs).toBe(1234);
    expect(r.stepCount).toBe(7);
  });

  test("the permalink round-trips", () => {
    const link = permalinkFor("run-123", 3);
    const parsed = parsePermalink(link);
    expect(parsed).toEqual({ runId: "run-123", stepIndex: 3 });
  });

  test("a missing session file yields a not-found row", () => {
    const missing = notFoundRow("run-999");
    expect(missing.runStatus).toBe("not-found");
    expect(missing.sessionId).toBe("run-999");
  });
});

describe("historyEmptyReason", () => {
  test("rows present means no empty-state message", () => {
    expect(historyEmptyReason(3, false)).toBeNull();
    expect(historyEmptyReason(3, true)).toBeNull();
  });

  test("an empty list with recording off names recording as the cause", () => {
    const reason = historyEmptyReason(0, false);
    expect(reason).toContain("recording is off");
  });

  test("an empty list with recording on does not blame recording", () => {
    const reason = historyEmptyReason(0, true);
    expect(reason).not.toBeNull();
    expect(reason).not.toContain("recording is off");
  });
});
