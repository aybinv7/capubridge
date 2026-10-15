import { describe, expect, test } from "vite-plus/test";
import type { AutomationCapuEvent, RustSessionListItem } from "@/types/replay.types";
import {
  assertionsFor,
  failingStepIndex,
  filterRunRows,
  parseAutomationTrack,
  policyProvenance,
  replayTimestampMs,
  runDurationMs,
  screenshotEntryFor,
  sortRunRows,
  stepCountOf,
  toRunRow,
} from "../runHistory";

function listItem(overrides: Partial<RustSessionListItem> = {}): RustSessionListItem {
  return {
    sessionId: "s1",
    label: "run",
    startedAt: 2000,
    duration: 5000,
    deviceSerial: "serial-1",
    targetUrl: null,
    filePath: "/sessions/s1.capu",
    fileSizeBytes: 10,
    incomplete: false,
    missingTracks: [],
    automation: {
      runStatus: "passed",
      policyId: "rules",
      flowName: "Sign in",
      goal: null,
      stepCount: 3,
      failedStepIndex: null,
    },
    ...overrides,
  };
}

function automationNdjson(): string {
  const events: AutomationCapuEvent[] = [0, 1, 2].map((index) => ({
    t: index * 1000,
    data: {
      stepId: `s${index}`,
      decision: { operation: "tap", confidence: 1, reason: "test" },
      resolvedTarget: null,
      outcome: index === 2 ? "failed" : "ok",
      error: index === 2 ? "missed" : null,
      screenshot: index === 1 ? "attachments/shot-s1.png" : null,
      policyId: "rules",
      confidence: 1,
      assertions:
        index === 0
          ? [
              {
                passed: true,
                assertion: { kind: "urlMatches", pattern: "^https://" },
                elapsedMs: 5,
                attempts: 1,
                observed: "matched",
              },
            ]
          : [],
    },
  }));
  return events.map((event) => JSON.stringify(event)).join("\n");
}

describe("run history", () => {
  test("run list sorts by start time and filters by status", () => {
    const sorted = sortRunRows(
      [
        toRunRow(listItem({ sessionId: "old", startedAt: 1000 })),
        toRunRow(listItem({ sessionId: "new", startedAt: 3000 })),
      ].filter((row) => row !== null),
    );
    expect(sorted.map((row) => row.sessionId)).toEqual(["new", "old"]);
    const failed = filterRunRows(sorted, "failed");
    expect(failed).toEqual([]);
    const all = filterRunRows(sorted, "all");
    expect(all).toHaveLength(2);
  });

  test("non-automation sessions stay out of the run list", () => {
    expect(toRunRow(listItem({ automation: null }))).toBeNull();
  });

  test("a failed run reports its failing step index; a passed run reports none", () => {
    const events = parseAutomationTrack(automationNdjson());
    expect(failingStepIndex(events)).toBe(2);
    const passing = events.map((event) => ({
      ...event,
      data: { ...event.data, outcome: "ok" as const, error: null },
    }));
    expect(failingStepIndex(passing)).toBeNull();
  });

  test("selecting a step yields the replay timestamp from its t offset", () => {
    const events = parseAutomationTrack(automationNdjson());
    const second = events[1];
    if (second === undefined) {
      throw new Error("fixture needs a second event");
    }
    expect(replayTimestampMs(second)).toBe(1000);
  });

  test("a step with no screenshot renders an absent state", () => {
    const events = parseAutomationTrack(automationNdjson());
    expect(screenshotEntryFor(events[0] as AutomationCapuEvent)).toBeNull();
    expect(screenshotEntryFor(events[1] as AutomationCapuEvent)).toBe("attachments/shot-s1.png");
  });

  test("assertion results group under their step", () => {
    const events = parseAutomationTrack(automationNdjson());
    expect(assertionsFor(events[0] as AutomationCapuEvent)).toHaveLength(1);
    expect(assertionsFor(events[1] as AutomationCapuEvent)).toHaveLength(0);
  });

  test("a partial session still lists and opens with the steps it has", () => {
    const row = toRunRow(listItem({ incomplete: true }));
    expect(row?.incomplete).toBe(true);
    expect(row?.stepCount).toBe(3);
    const events = parseAutomationTrack(`${automationNdjson()}\n{"broken": `);
    expect(events).toHaveLength(3);
  });

  test("duration and step count derive instead of duplicating", () => {
    expect(runDurationMs({ duration: 5000 })).toBe(5000);
    expect(stepCountOf(parseAutomationTrack(automationNdjson()))).toBe(3);
  });

  test("provenance names the data boundary per policy", () => {
    expect(policyProvenance("jev")).toContain("third-party");
    expect(policyProvenance("rules")).toContain("nothing left the machine");
    expect(policyProvenance("mystery")).toContain("unverified");
  });
});
