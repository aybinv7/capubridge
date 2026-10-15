import { describe, expect, test } from "vite-plus/test";
import { PASSING_ASSERTION, deps, observation } from "./flowExecutorFixtures";
import type { Flow, Observation } from "@/types/automation.types";
import { createFakeDeviceActions } from "../deviceActions";
import type { DeviceActions } from "../deviceActions";
import { runFlow } from "../flowExecutor";

/**
 * Every observation costs a full `uiautomator dump`, ~2.6 s on a real device.
 * These suites pin that a quiescent settled observation is reused as the next
 * step's before-snapshot instead of being read a second time, and pin every
 * case where reuse would decide on a stale screen.
 */

function tapFlow(ids: string[]): Flow {
  return {
    version: 1,
    id: "carry-flow",
    name: "Carry",
    appPackage: "com.example.app",
    steps: ids.map((id) => ({ id, op: "tap", target: { kind: "selector", cssSelector: "#a" } })),
  };
}

function countingObserve(make: (call: number) => Observation = () => observation()) {
  const counter = { calls: 0 };
  return {
    counter,
    observe: () => {
      counter.calls += 1;
      return Promise.resolve(make(counter.calls));
    },
  };
}

function changingScreen(pendingRequests: number) {
  return (call: number): Observation => {
    const base = observation();
    return {
      ...base,
      signals: { ...base.signals, pendingRequests, lastDbWrite: `write-${call}` },
    };
  };
}

describe("settled observation carry-forward", () => {
  test("a quiescent settle is reused, so each step reads the device once", async () => {
    const { counter, observe } = countingObserve();
    const result = await runFlow(
      tapFlow(["s1", "s2", "s3"]),
      deps({ observe }),
      new AbortController().signal,
    );
    expect(result.status).toBe("passed");
    expect(counter.calls).toBe(4);
  });

  test("a carried step decides on exactly the screen the previous step settled on", async () => {
    const { observe } = countingObserve(changingScreen(0));
    const result = await runFlow(
      tapFlow(["s1", "s2", "s3"]),
      deps({ observe }),
      new AbortController().signal,
    );
    const [first, second, third] = result.records;
    expect(second?.beforeFingerprint).toBe(first?.afterFingerprint);
    expect(third?.beforeFingerprint).toBe(second?.afterFingerprint);
  });

  test("a screen still loading when it changed is read again rather than reused", async () => {
    const { counter, observe } = countingObserve(changingScreen(2));
    await runFlow(tapFlow(["s1", "s2", "s3"]), deps({ observe }), new AbortController().signal);
    expect(counter.calls).toBe(6);
  });

  test("a settled observation older than the freshness bound is not reused", async () => {
    const { counter, observe } = countingObserve();
    let clock = 0;
    await runFlow(
      tapFlow(["s1", "s2", "s3"]),
      deps({
        observe,
        now: () => {
          clock += 2_000;
          return clock;
        },
      }),
      new AbortController().signal,
    );
    expect(counter.calls).toBe(6);
  });

  test("an assert step produces no carry, so the step after it reads fresh", async () => {
    const { counter, observe } = countingObserve();
    const mixed: Flow = {
      version: 1,
      id: "carry-assert",
      name: "Carry assert",
      appPackage: "com.example.app",
      steps: [
        { id: "s1", op: "tap", target: { kind: "selector", cssSelector: "#a" } },
        { id: "s2", op: "assert", assertion: PASSING_ASSERTION },
        { id: "s3", op: "tap", target: { kind: "selector", cssSelector: "#a" } },
      ],
    };
    const result = await runFlow(mixed, deps({ observe }), new AbortController().signal);
    expect(result.status).toBe("passed");
    expect(counter.calls).toBe(4);
  });

  test("a retry after a failed dispatch always re-reads the device", async () => {
    const { counter, observe } = countingObserve();
    const base = createFakeDeviceActions();
    let taps = 0;
    const actions: DeviceActions = {
      ...base,
      tap: async (serial, x, y) => {
        taps += 1;
        if (taps === 2) {
          throw new Error("tap missed");
        }
        await base.tap(serial, x, y);
      },
    };
    const retrying: Flow = {
      ...tapFlow(["s1"]),
      steps: [
        { id: "s1", op: "tap", target: { kind: "selector", cssSelector: "#a" } },
        {
          id: "s2",
          op: "tap",
          target: { kind: "selector", cssSelector: "#a" },
          retry: { maxAttempts: 2, delayMs: 0 },
        },
      ],
    };
    const result = await runFlow(
      retrying,
      deps({ observe, actions }),
      new AbortController().signal,
    );
    expect(result.status).toBe("passed");
    expect(counter.calls).toBe(4);
  });
});
