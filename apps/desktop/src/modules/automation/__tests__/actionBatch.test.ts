import { describe, expect, test } from "vite-plus/test";
import type { Assertion, Observation } from "@/types/automation.types";
import { buildCandidates, resolveTarget } from "../elementIndex";
import { createFakeDeviceActions } from "../deviceActions";
import type { ExecutorDeps } from "../flowExecutor";
import { executeActionBatch } from "../actionBatch";
import { observationFingerprint } from "../observation";

function observation(): Observation {
  return {
    native: {
      controls: [],
      packageName: "com.example.app",
      activity: "MainActivity",
      systemUi: { keyboardVisible: false, dialogPresent: false },
    },
    webview: {
      elements: [
        {
          index: 0,
          cssSelector: "#go",
          role: "button",
          text: "Go",
          enabled: true,
          visible: true,
          bounds: [0, 0, 100, 40],
          isInput: false,
          inputType: null,
        },
      ],
    },
    signals: { pendingRequests: 0, recentErrors: [], lastDbWrite: null },
    visual: { screenshotRef: "" },
  };
}

function deps(nextObservation: Observation = observation()): ExecutorDeps {
  return {
    deviceSerial: "serial-1",
    observe: () => Promise.resolve(nextObservation),
    actions: createFakeDeviceActions(),
    resolveTarget,
    buildCandidates,
    evaluateAssertion: async (assertion: Assertion) => ({
      passed: assertion.kind === "visible",
      assertion,
      elapsedMs: 0,
      attempts: 1,
      observed: assertion.kind === "visible" ? "visible" : "not verified",
    }),
    evidence: {
      queryDom: () => Promise.resolve(null),
      currentUrl: () => Promise.resolve("https://example.test/"),
      dbRow: () => Promise.resolve(null),
      recentNetwork: () => Promise.resolve([]),
      recentConsole: () => Promise.resolve([]),
    },
    readbackText: () => Promise.resolve(null),
    now: () => 0,
    sleep: () => Promise.resolve(),
  };
}

const target = { kind: "selector" as const, cssSelector: "#go" };

function batch(fingerprint: string, actions = 1) {
  return {
    id: "batch-1",
    precondition: { fingerprint },
    maxActions: 4,
    timeoutMs: 1000,
    postconditions: [],
    actions: Array.from({ length: actions }, (_, index) => ({
      id: `action-${index}`,
      decision: { operation: "tap" as const, target, confidence: 1, reason: "test" },
    })),
  };
}

describe("action batches", () => {
  test("rejects a stale opening precondition without dispatch", async () => {
    const result = await executeActionBatch(batch("stale"), deps(), new AbortController().signal);
    expect(result.reason).toBe("stale-precondition");
    expect(result.records).toHaveLength(0);
  });

  test("stops duplicate action identity before a second dispatch", async () => {
    const current = observation();
    const fingerprint = observationFingerprint(current);
    const result = await executeActionBatch(
      batch(fingerprint, 2),
      deps(current),
      new AbortController().signal,
    );
    expect(result.reason).toBe("unchanged-action-identity");
    expect(result.records).toHaveLength(1);
  });

  test("settles and verifies declared postconditions", async () => {
    const current = observation();
    const fingerprint = observationFingerprint(current);
    const result = await executeActionBatch(
      { ...batch(fingerprint), postconditions: [{ kind: "visible", source: "dom", target }] },
      deps(current),
      new AbortController().signal,
    );
    expect(result.status).toBe("completed");
    expect(result.reason).toBe("completed");
    expect(result.records[0]?.verificationStatus).toBe("verified");
  });

  test("does not treat a changed screen as success without evidence", async () => {
    const current = observation();
    let observations = 0;
    const result = await executeActionBatch(
      batch(observationFingerprint(current)),
      {
        ...deps(current),
        observe: () => {
          observations += 1;
          return Promise.resolve(
            observations === 1
              ? current
              : { ...current, native: { ...current.native, activity: "NextActivity" } },
          );
        },
      },
      new AbortController().signal,
    );
    expect(result.status).toBe("failed");
    expect(result.reason).toBe("verification-failed");
  });

  test("halts on an exact type readback mismatch", async () => {
    const current = observation();
    const typeTarget = { kind: "selector" as const, cssSelector: "#go" };
    const result = await executeActionBatch(
      {
        ...batch(observationFingerprint(current)),
        postconditions: [{ kind: "visible", source: "dom", target: typeTarget }],
        actions: [
          {
            id: "type-1",
            decision: {
              operation: "type" as const,
              target: typeTarget,
              text: "expected",
              confidence: 1,
              reason: "test",
            },
          },
        ],
      },
      { ...deps(current), readbackText: () => Promise.resolve("actual") },
      new AbortController().signal,
    );
    expect(result.status).toBe("failed");
    expect(result.reason).toBe("verification-failed");
  });
});
