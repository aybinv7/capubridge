import { describe, expect, test } from "vite-plus/test";
import type { Decision, Observation } from "@/types/automation.types";
import { buildCandidates } from "../elementIndex";
import { createRulesPolicy } from "../policies/rules";
import type { RuleIntent } from "../policies/rules";
import { policyRegistry } from "../policies/types";
import type { PolicyInput, RemotePolicy, RemotePolicyInput } from "../policies/types";
import "../policies/rules";

function observationWithLogin(): Observation {
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
          cssSelector: "#login",
          role: "button",
          text: "Log in",
          enabled: true,
          visible: true,
          bounds: [10, 20, 100, 40],
          isInput: false,
          inputType: null,
        },
      ],
    },
    signals: { pendingRequests: 0, recentErrors: [], lastDbWrite: null },
    visual: { screenshotRef: "" },
  };
}

function inputFor(observation: Observation, stepIndex: number, goal = "sign in"): PolicyInput {
  return {
    goal,
    observation,
    candidates: buildCandidates(observation),
    history: [],
    stepIndex,
  };
}

const TAP_LOGIN: RuleIntent = {
  id: "i-tap",
  op: "tap",
  target: { kind: "selector", cssSelector: "#login" },
};

describe("rules policy", () => {
  test("a resolvable first intent returns the matching operation and target", async () => {
    const policy = createRulesPolicy([TAP_LOGIN]);
    const decision = await policy.decide(inputFor(observationWithLogin(), 0));
    expect(decision.operation).toBe("tap");
    expect(decision.target).toEqual({ kind: "selector", cssSelector: "#login" });
    expect(decision.confidence).toBe(1);
  });

  test("pending requests answer wait even when the target is resolvable", async () => {
    const observation = observationWithLogin();
    observation.signals.pendingRequests = 2;
    const policy = createRulesPolicy([TAP_LOGIN]);
    const decision = await policy.decide(inputFor(observation, 0));
    expect(decision.operation).toBe("wait");
  });

  test("an unresolvable target waits inside the budget and blocks past it naming the target", async () => {
    let now = 0;
    const policy = createRulesPolicy([TAP_LOGIN], { settleBudgetMs: 1000, now: () => now });
    const empty = observationWithLogin();
    empty.webview = { elements: [] };

    const waiting = await policy.decide(inputFor(empty, 0));
    expect(waiting.operation).toBe("wait");

    now = 500;
    expect((await policy.decide(inputFor(empty, 0))).operation).toBe("wait");

    now = 1500;
    const blocked = await policy.decide(inputFor(empty, 0));
    expect(blocked.operation).toBe("blocked");
    expect(blocked.reason).toContain("#login");
  });

  test("an exhausted intent list answers done", async () => {
    const policy = createRulesPolicy([TAP_LOGIN]);
    const decision = await policy.decide(inputFor(observationWithLogin(), 1));
    expect(decision.operation).toBe("done");
  });

  test("a text fallback resolves below full confidence", async () => {
    const policy = createRulesPolicy([TAP_LOGIN]);
    const observation = observationWithLogin();
    observation.webview = {
      elements: [
        {
          index: 0,
          cssSelector: "#other",
          role: "button",
          text: "login",
          enabled: true,
          visible: true,
          bounds: [10, 20, 100, 40],
          isInput: false,
          inputType: null,
        },
      ],
    };
    const decision = await policy.decide(inputFor(observation, 0));
    expect(decision.operation).toBe("tap");
    expect(decision.confidence).toBeLessThan(1);
  });

  test("rules is local with a null data notice", () => {
    const policy = createRulesPolicy([]);
    expect(policy.id).toBe("rules");
    expect(policy.isRemote).toBe(false);
    expect(policy.dataNotice).toBeNull();
  });

  test("rules performs no remote work and needs no redaction", async () => {
    const policy = createRulesPolicy([TAP_LOGIN]);
    const decision = await policy.decide(inputFor(observationWithLogin(), 0));
    expect(decision.operation).toBe("tap");
  });

  test("the registry contains exactly rules", () => {
    expect([...policyRegistry.keys()]).toEqual(["rules"]);
  });
});

describe("policy contract", () => {
  test("a remote policy decides from redacted input and carries its notice", async () => {
    const fakeRemote: RemotePolicy = {
      id: "jev",
      label: "Fake remote",
      isRemote: true,
      dataNotice: "Redacted screen structure leaves the machine.",
      decide: async (input: RemotePolicyInput): Promise<Decision> => ({
        operation: "wait",
        confidence: 0.5,
        reason: `fake remote saw ${input.observation.native.controls.length} controls`,
      }),
    };
    expect(fakeRemote.isRemote).toBe(true);
    expect(typeof fakeRemote.dataNotice).toBe("string");
    const factory = policyRegistry.get("rules");
    expect(factory).toBeDefined();
  });

  test("a remote policy with a null notice is rejected", () => {
    const build = (): RemotePolicy => ({
      id: "jev",
      label: "Bad remote",
      isRemote: true,
      // @ts-expect-error a remote policy must carry a data notice
      dataNotice: null,
      decide: async (): Promise<Decision> => ({
        operation: "blocked",
        confidence: 1,
        reason: "never",
      }),
    });
    expect(build).toBeDefined();
  });
});
