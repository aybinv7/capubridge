import { describe, expect, test } from "vite-plus/test";
import type { Flow } from "@/types/automation.types";
import { parseFlowDsl, serializeFlowDsl } from "../flowDsl";

const base: Flow = {
  version: 1,
  id: "flow-1",
  name: "Checkout",
  appPackage: "",
  steps: [],
};

describe("flow DSL", () => {
  test("parses readable deterministic steps and keeps flow metadata", () => {
    const result = parseFlowDsl(
      [
        'tap selector "#login"',
        'type selector "input[name=email]" "user@example.com"',
        "scroll down 400",
        'assert textContains selector "#status" "Done"',
        "wait 500",
      ].join("\n"),
      base,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.flow.id).toBe(base.id);
    expect(result.flow.steps.map((step) => step.op)).toEqual([
      "tap",
      "type",
      "scroll",
      "assert",
      "wait",
    ]);
    expect(result.flow.steps[1]).toMatchObject({
      op: "type",
      text: "user@example.com",
      verifyReadback: true,
    });
  });

  test("supports quoted text and text target payloads", () => {
    const result = parseFlowDsl('type text "Email field" "a b c" no-readback', base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.flow.steps[0]).toMatchObject({
      op: "type",
      target: { kind: "text", text: "Email field", exact: true },
      text: "a b c",
      verifyReadback: false,
    });
  });

  test("returns line diagnostics for malformed commands", () => {
    const result = parseFlowDsl("tap selector\nwait nope", base);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((error) => error.path)).toEqual(["line 1", "line 2"]);
    expect(result.errors[0]?.message).toContain("missing selector");
    expect(result.errors[1]?.message).toContain("duration must be a number");
  });

  test("serializes a flow into stable source that parses back", () => {
    const source = serializeFlowDsl({
      ...base,
      steps: [
        { id: "s1", op: "tap", target: { kind: "selector", cssSelector: "#a" } },
        { id: "s2", op: "wait", durationMs: 250 },
      ],
    });
    const result = parseFlowDsl(source, base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.flow.steps).toMatchObject([
      { op: "tap", target: { kind: "selector", cssSelector: "#a" } },
      { op: "wait", durationMs: 250 },
    ]);
  });

  test("allows a flow to run against the already foregrounded app", () => {
    const result = parseFlowDsl("back", base);
    expect(result.ok).toBe(true);
  });

  test("parses an embedded provider goal", () => {
    const result = parseFlowDsl('goal embedded "Check the current screen" 20 120000 3', base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.flow.steps[0]).toMatchObject({ op: "goal", policyId: "embedded" });
  });
});
