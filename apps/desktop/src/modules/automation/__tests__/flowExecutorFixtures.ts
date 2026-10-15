/**
 * Shared fixtures for the flow executor suites.
 *
 * Extracted when `flowExecutor.test.ts` passed the source-size limit. The
 * suites were split by behaviour; every assertion is unchanged.
 */
import { vi } from "vite-plus/test";
import type { Assertion, Decision, Flow, Observation } from "@/types/automation.types";
import type { AssertionResult } from "../assertions";
import { createFakeDeviceActions } from "../deviceActions";
import type { DeviceActions } from "../deviceActions";
import { buildCandidates, resolveTarget } from "../elementIndex";
import type { ExecutorDeps, RunLimits } from "../flowExecutor";
import type { LocalPolicy } from "../policies/types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.reject(new Error("no tauri backend in tests"))),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

export const LIMITS: RunLimits = { maxSteps: 10, maxDurationMs: 60000, maxConsecutiveFailures: 3 };

export const PASSING_ASSERTION: Assertion = {
  kind: "visible",
  target: { kind: "selector", cssSelector: "#login" },
  source: "dom",
};

export function observation(): Observation {
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
          cssSelector: "#a",
          role: "button",
          text: "Alpha",
          enabled: true,
          visible: true,
          bounds: [0, 0, 100, 40],
          isInput: false,
          inputType: null,
        },
        {
          index: 1,
          cssSelector: "#name",
          role: "textbox",
          text: "",
          enabled: true,
          visible: true,
          bounds: [0, 50, 200, 40],
          isInput: true,
          inputType: "text",
        },
      ],
    },
    signals: { pendingRequests: 0, recentErrors: [], lastDbWrite: null },
    visual: { screenshotRef: "shot-1" },
  };
}

export function passingEvaluation(): AssertionResult {
  return { passed: true, assertion: PASSING_ASSERTION, elapsedMs: 0, attempts: 1, observed: "ok" };
}

export function deps(overrides: Partial<ExecutorDeps> = {}): ExecutorDeps {
  return {
    deviceSerial: "serial-1",
    observe: () => Promise.resolve(observation()),
    actions: createFakeDeviceActions(),
    resolveTarget,
    buildCandidates,
    evaluateAssertion: () => Promise.resolve(passingEvaluation()),
    evidence: {
      queryDom: () => Promise.resolve(null),
      currentUrl: () => Promise.resolve("https://example.com/"),
      dbRow: () => Promise.resolve(null),
      recentNetwork: () => Promise.resolve([]),
      recentConsole: () => Promise.resolve([]),
    },
    readbackText: () => Promise.resolve(null),
    now: () => 0,
    sleep: () => Promise.resolve(),
    settleTimeoutMs: 1000,
    settlePollMs: 10,
    assertionTimeoutMs: 100,
    assertionPollMs: 10,
    ...overrides,
  };
}

export function policyWith(decisions: Decision[]): LocalPolicy {
  let cursor = 0;
  return {
    id: "rules",
    label: "Test rules",
    isRemote: false,
    dataNotice: null,
    decide: () => {
      const decision = decisions[Math.min(cursor, decisions.length - 1)];
      cursor += 1;
      return Promise.resolve(decision ?? { operation: "done", confidence: 1, reason: "empty" });
    },
  };
}

export function waitDecision(): Decision {
  return { operation: "wait", confidence: 1, reason: "settle" };
}

export function flow(): Flow {
  return {
    version: 1,
    id: "flow-1",
    name: "Three steps",
    appPackage: "com.example.app",
    steps: [
      { id: "s1", op: "tap", target: { kind: "selector", cssSelector: "#a" } },
      {
        id: "s2",
        op: "type",
        target: { kind: "selector", cssSelector: "#name" },
        text: "hello",
        verifyReadback: true,
      },
      { id: "s3", op: "back" },
    ],
  };
}

export function flakyActions(failuresBeforeSuccess: number): { actions: DeviceActions } {
  const state = { taps: 0 };
  const base = createFakeDeviceActions();
  return {
    actions: {
      ...base,
      tap: async (serial, x, y) => {
        state.taps += 1;
        if (state.taps <= failuresBeforeSuccess) {
          throw new Error("tap missed");
        }
        await base.tap(serial, x, y);
      },
    },
  };
}
