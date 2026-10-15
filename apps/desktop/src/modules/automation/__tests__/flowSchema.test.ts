import { describe, expect, test } from "vite-plus/test";
import type { Flow, FlowStep } from "@/types/automation.types";
import {
  createEmptyFlow,
  createGoalStep,
  goalStepNeedsAcknowledgement,
  parseFlow,
  serializeFlow,
  validateStep,
} from "../flowSchema";

/** Builds a flow carrying one step of every supported op. */
function buildFullFlow(): Flow {
  const steps: FlowStep[] = [
    { id: "s-tap", op: "tap", target: { kind: "selector", cssSelector: "#login" } },
    { id: "s-long-press", op: "longPress", target: { kind: "text", text: "Hold me", exact: true } },
    {
      id: "s-type",
      op: "type",
      target: { kind: "selector", cssSelector: "input[name=password]" },
      text: "s3cret",
      verifyReadback: true,
    },
    { id: "s-swipe", op: "swipe", from: { x: 100, y: 800 }, to: { x: 100, y: 200 } },
    { id: "s-scroll", op: "scroll", direction: "down", distance: 400 },
    { id: "s-press-key", op: "pressKey", keycode: "KEYCODE_ENTER" },
    { id: "s-back", op: "back" },
    { id: "s-open-app", op: "openApp", packageName: "com.example.app" },
    { id: "s-wait", op: "wait", durationMs: 1500 },
    {
      id: "s-assert",
      op: "assert",
      assertion: {
        kind: "visible",
        target: { kind: "selector", cssSelector: ".cart" },
        source: "dom",
      },
    },
  ];
  return {
    version: 1,
    id: "flow-full",
    name: "Full flow",
    appPackage: "com.example.app",
    description: "covers every op",
    steps,
  };
}

describe("parseFlow", () => {
  test("a valid flow with one step of each op parses and round-trips without loss", () => {
    const flow = buildFullFlow();
    const parsed = parseFlow(flow);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.flow).toEqual(flow);

    const reparsed = parseFlow(JSON.parse(serializeFlow(flow)) as unknown);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) {
      return;
    }
    expect(reparsed.flow).toEqual(flow);
  });

  test("an unknown op produces one error naming the offending step index", () => {
    const flow = buildFullFlow();
    const steps = [...flow.steps];
    steps[4] = { id: "s-bad", op: "explode" } as unknown as FlowStep;
    const result = parseFlow({ ...flow, steps });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.path).toBe("steps[4].op");
  });

  test("a type step missing text reports a precise path", () => {
    const result = parseFlow({
      version: 1,
      id: "f",
      name: "n",
      appPackage: "com.example.app",
      steps: [{ id: "s-type", op: "type", target: { kind: "selector", cssSelector: "input" } }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.map((entry) => entry.path)).toContain("steps[0].text");
  });

  test("a tap step missing target reports a precise path", () => {
    const result = parseFlow({
      version: 1,
      id: "f",
      name: "n",
      appPackage: "com.example.app",
      steps: [{ id: "s-tap", op: "tap" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.map((entry) => entry.path)).toContain("steps[0].target");
  });

  test("a swipe step missing an endpoint reports a precise path", () => {
    const result = parseFlow({
      version: 1,
      id: "f",
      name: "n",
      appPackage: "com.example.app",
      steps: [{ id: "s-swipe", op: "swipe", from: { x: 1, y: 2 } }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.map((entry) => entry.path)).toContain("steps[0].to");
  });

  test("non-object inputs return ok false instead of throwing", () => {
    for (const input of [42, null, ["steps"], "flow", undefined, true]) {
      expect(parseFlow(input).ok).toBe(false);
    }
  });

  test("a flow with version 2 is rejected with a version error", () => {
    const result = parseFlow({ ...buildFullFlow(), version: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.map((entry) => entry.path)).toContain("version");
  });

  test("a type step without verifyReadback defaults it to true", () => {
    const result = parseFlow({
      version: 1,
      id: "f",
      name: "n",
      appPackage: "com.example.app",
      steps: [
        {
          id: "s-type",
          op: "type",
          target: { kind: "selector", cssSelector: "input" },
          text: "hello",
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const step = result.flow.steps[0];
    expect(step?.op).toBe("type");
    if (step?.op === "type") {
      expect(step.verifyReadback).toBe(true);
    }
  });
});

describe("validateStep", () => {
  test("a good step returns an empty array", () => {
    expect(
      validateStep({ id: "s-tap", op: "tap", target: { kind: "point", x: 10, y: 20 } }),
    ).toEqual([]);
  });

  test("a bad step reports errors without throwing", () => {
    const errors = validateStep({ id: "", op: "wait" });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("Presalio acceptance flows", () => {
  test("requires the selected Presalio package and assertion-only checkpoints", () => {
    const result = parseFlow({
      version: 1,
      id: "presalio",
      name: "Presalio benchmark",
      appPackage: "com.presalio.app",
      acceptanceScenario: "presalio-order-v1",
      steps: [
        {
          id: "assert-home",
          op: "assert",
          acceptanceMilestone: "app-opened",
          assertion: {
            kind: "visible",
            source: "native",
            target: { kind: "text", text: "Home", exact: true },
          },
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.flow.steps[0]?.acceptanceMilestone).toBe("app-opened");
  });

  test("rejects a checkpoint outside the benchmark scenario", () => {
    const result = parseFlow({
      version: 1,
      id: "not-benchmark",
      name: "Normal flow",
      appPackage: "com.example.app",
      steps: [
        {
          id: "assert-home",
          op: "assert",
          acceptanceMilestone: "app-opened",
          assertion: {
            kind: "visible",
            source: "native",
            target: { kind: "text", text: "Home", exact: true },
          },
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.map((error) => error.path)).toContain("acceptanceScenario");
  });
});

describe("serializeFlow", () => {
  test("output is byte-identical across two calls on the same flow", () => {
    const flow = buildFullFlow();
    expect(serializeFlow(flow)).toBe(serializeFlow(flow));
  });
});

describe("createEmptyFlow", () => {
  test("creates a versioned flow with no steps", () => {
    const flow = createEmptyFlow("My flow", "com.example.app");
    expect(flow.version).toBe(1);
    expect(flow.name).toBe("My flow");
    expect(flow.appPackage).toBe("com.example.app");
    expect(flow.steps).toEqual([]);
    expect(parseFlow(flow).ok).toBe(true);
  });
});

describe("goal steps", () => {
  test("a flow with one goal step round-trips unchanged", () => {
    const flow = buildFullFlow();
    flow.steps.push({
      id: "s-goal",
      op: "goal",
      goal: "sign in and open the cart",
      policyId: "rules",
      limits: { maxSteps: 40, maxDurationMs: 300000, maxConsecutiveFailures: 3 },
      acknowledgedNotice: false,
    });
    const reparsed = parseFlow(JSON.parse(serializeFlow(flow)) as unknown);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) {
      return;
    }
    expect(reparsed.flow).toEqual(flow);
  });

  test("a goal step with empty goal text errors with the step index", () => {
    const result = parseFlow({
      version: 1,
      id: "f",
      name: "n",
      appPackage: "com.example.app",
      steps: [
        { id: "s-tap", op: "tap", target: { kind: "point", x: 1, y: 2 } },
        {
          id: "s-goal",
          op: "goal",
          goal: "",
          policyId: "rules",
          limits: { maxSteps: 40, maxDurationMs: 300000, maxConsecutiveFailures: 3 },
          acknowledgedNotice: false,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.map((entry) => entry.path)).toContain("steps[1].goal");
  });

  test("an unknown policyId errors with a precise path", () => {
    const result = parseFlow({
      version: 1,
      id: "f",
      name: "n",
      appPackage: "com.example.app",
      steps: [
        {
          id: "s-goal",
          op: "goal",
          goal: "do it",
          policyId: "oracle",
          limits: { maxSteps: 40, maxDurationMs: 300000, maxConsecutiveFailures: 3 },
          acknowledgedNotice: false,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.map((entry) => entry.path)).toContain("steps[0].policyId");
  });

  test("a zero or negative limit errors with a precise path", () => {
    const result = parseFlow({
      version: 1,
      id: "f",
      name: "n",
      appPackage: "com.example.app",
      steps: [
        {
          id: "s-goal",
          op: "goal",
          goal: "do it",
          policyId: "rules",
          limits: { maxSteps: 0, maxDurationMs: -5, maxConsecutiveFailures: 3 },
          acknowledgedNotice: false,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    const paths = result.errors.map((entry) => entry.path);
    expect(paths).toContain("steps[0].limits.maxSteps");
    expect(paths).toContain("steps[0].limits.maxDurationMs");
  });

  test("a jev goal step without acknowledgement parses but needs it", () => {
    const step = {
      id: "s-goal",
      op: "goal",
      goal: "do it",
      policyId: "jev",
      limits: { maxSteps: 40, maxDurationMs: 300000, maxConsecutiveFailures: 5 },
      acknowledgedNotice: false,
    };
    expect(parseFlow({ version: 1, id: "f", name: "n", appPackage: "a.b", steps: [step] }).ok).toBe(
      true,
    );
    expect(goalStepNeedsAcknowledgement(step)).toBe(true);
    expect(goalStepNeedsAcknowledgement({ ...step, policyId: "rules" })).toBe(false);
    expect(goalStepNeedsAcknowledgement({ ...step, acknowledgedNotice: true })).toBe(false);
    expect(goalStepNeedsAcknowledgement({ id: "x", op: "tap" })).toBe(false);
  });

  test("createGoalStep validates and the ARTEMIS duration exceeds the Jev default", () => {
    const artemis = createGoalStep("drive", "artemis");
    const jev = createGoalStep("drive", "jev");
    expect(validateStep(artemis)).toEqual([]);
    expect(validateStep(jev)).toEqual([]);
    if (artemis.op !== "goal" || jev.op !== "goal") {
      throw new Error("createGoalStep must build goal steps");
    }
    expect(artemis.limits.maxDurationMs).toBeGreaterThan(jev.limits.maxDurationMs);
  });

  test("a pre-existing flow with no goal step serializes byte-identically", () => {
    const flow = buildFullFlow();
    const before = serializeFlow(flow);
    const reparsed = parseFlow(JSON.parse(before) as unknown);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) {
      return;
    }
    expect(serializeFlow(reparsed.flow)).toBe(before);
    expect(reparsed.flow).toEqual(flow);
  });
});
