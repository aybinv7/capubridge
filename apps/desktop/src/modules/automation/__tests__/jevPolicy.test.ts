import { describe, expect, test, vi } from "vite-plus/test";
import type { JsonValue } from "@/runtime/ipc/contracts/common";
import type { Observation } from "@/types/automation.types";
import { buildCandidates } from "../elementIndex";
import type { Candidate } from "../elementIndex";
import {
  buildJevRequestBody,
  createJevPolicy,
  JEV_DATA_NOTICE,
  JEV_MODEL_VERSION,
} from "../policies/jev";
import type { JevTransport } from "../policies/jev";
import { DEFAULT_DECISION_MODEL_ID, requireDecisionModel } from "../decisions/decisionModels";
import { redactObservation } from "../redact";
import type { RedactedObservation } from "../redact";
import { PolicyDecisionError } from "../policies/types";
import type { PolicyInput, RemotePolicyInput } from "../policies/types";
import "../policies/jev";

const mocks = vi.hoisted(() => ({
  invokeCommand: vi.fn(),
}));

vi.mock("@/runtime/ipc/client", () => ({
  invokeCommand: mocks.invokeCommand,
}));

const invokeMock = mocks.invokeCommand;

function observationWithSecrets(): Observation {
  return {
    native: {
      controls: [
        {
          index: 0,
          bounds: [0, 0, 200, 60],
          className: "android.widget.Button",
          text: "native sign in",
          contentDesc: "",
          clickable: true,
          enabled: true,
        },
      ],
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
          text: "login",
          enabled: true,
          visible: true,
          bounds: [10, 20, 100, 40],
          isInput: false,
          inputType: null,
        },
        {
          index: 1,
          cssSelector: "input[name=password]",
          role: "textbox",
          text: "hunter2correct",
          enabled: true,
          visible: true,
          bounds: [10, 70, 200, 40],
          isInput: true,
          inputType: "password",
        },
      ],
    },
    signals: {
      pendingRequests: 0,
      recentErrors: [
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.SflKxRJPs8MaX7mCIfaK3Yxhm5HkyB1ibNXx0k3mE",
      ],
      lastDbWrite: null,
    },
    visual: { screenshotRef: "runs/abc/shot-1.png" },
  };
}

function redactedInput(candidateCount = 1): {
  input: RemotePolicyInput;
  redacted: RedactedObservation;
} {
  const observation = observationWithSecrets();
  if (candidateCount > 2 && observation.webview !== null) {
    observation.webview.elements.push(
      ...Array.from({ length: candidateCount }, (_, index) => ({
        index: 10 + index,
        cssSelector: `#bulk-${index}`,
        role: "button",
        text: `Bulk ${index}`,
        enabled: true,
        visible: true,
        bounds: [(index % 40) * 30, Math.floor(index / 40) * 40, 20, 20] as [
          number,
          number,
          number,
          number,
        ],
        isInput: false,
        inputType: null as string | null,
      })),
    );
  }
  const redacted = redactObservation(observation);
  const candidates: Candidate[] = buildCandidates(observation);
  return {
    input: { goal: "login", observation: redacted, candidates, history: [], stepIndex: 0 },
    redacted,
  };
}

/**
 * A response in the shape the System One API documents: criteria keys come
 * back as strings, and a noul answer carries `noul`, not `probability`.
 */
function wireResponse(
  operation = "tap",
  target: string | number = "0",
  confidence = 0.83,
): JsonValue {
  return {
    model: JEV_MODEL_VERSION,
    answers: {
      operation: { type: "choice", choice: operation, confidence },
      target: { type: "choice", choice: target, confidence },
      text_span: { type: "choice", choice: "login", confidence },
      screen_ready: { type: "noul", noul: 0.9 },
      goal_reached: { type: "noul", noul: 0.1 },
    },
  };
}

function fakeTransport(response: JsonValue): { transport: JevTransport; calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    transport: {
      send: (request) => {
        calls.push(request.body);
        return Promise.resolve(response);
      },
    },
  };
}

describe("jev policy", () => {
  test("a well-formed response maps to the expected decision with confidence preserved", async () => {
    const { input } = redactedInput();
    const { transport } = fakeTransport(wireResponse("tap", 0, 0.83));
    const decision = await createJevPolicy({ transport }).decide(input);
    expect(decision.operation).toBe("tap");
    expect(decision.target).toEqual({ kind: "selector", cssSelector: "#login" });
    expect(decision.confidence).toBe(0.83);
  });

  test("all questions travel in exactly one request carrying the pinned model version", async () => {
    const { input } = redactedInput();
    const { transport, calls } = fakeTransport(wireResponse());
    await createJevPolicy({ transport }).decide(input);
    expect(calls).toHaveLength(1);
    const body = calls[0] as Record<string, JsonValue>;
    expect(body["model"]).toBe(requireDecisionModel(DEFAULT_DECISION_MODEL_ID).openrouterSlug);
    expect(requireDecisionModel(DEFAULT_DECISION_MODEL_ID).typesafeId).toBe(JEV_MODEL_VERSION);
    const questions = body["questions"] as Record<string, JsonValue>;
    expect(Object.keys(questions).sort()).toEqual([
      "goal_reached",
      "operation",
      "screen_ready",
      "target",
      "text_span",
    ]);
  });

  test("a 300-candidate set is capped to 255 options and the trim is recorded", async () => {
    const { input } = redactedInput(300);
    expect(input.candidates.length).toBeGreaterThan(255);
    const build = buildJevRequestBody(input, DEFAULT_DECISION_MODEL_ID);
    const questions = build.body["questions"] as Record<string, JsonValue>;
    const target = questions["target"] as { criteria: Record<string, string> };
    expect(Object.keys(target.criteria).length).toBeLessThanOrEqual(255);
    expect(build.trimmed).toBe(true);
    const state = build.body["state"] as Record<string, JsonValue>;
    expect(state["trimmed"]).toBe(true);
  });

  test("every question declares instructions and criteria, never a bare options list", () => {
    const { input } = redactedInput();
    const build = buildJevRequestBody(input, DEFAULT_DECISION_MODEL_ID);
    const questions = build.body["questions"] as Record<string, Record<string, JsonValue>>;
    for (const [name, question] of Object.entries(questions)) {
      expect(typeof question["type"], `${name}.type`).toBe("string");
      expect(typeof question["instructions"], `${name}.instructions`).toBe("string");
      expect(question["criteria"], `${name}.criteria`).toBeDefined();
      expect(question["options"], `${name}.options`).toBeUndefined();
    }
  });

  test("choice criteria are a map of option to description, not an array", () => {
    const { input } = redactedInput();
    const build = buildJevRequestBody(input, DEFAULT_DECISION_MODEL_ID);
    const questions = build.body["questions"] as Record<string, Record<string, JsonValue>>;
    const operation = questions["operation"]["criteria"] as Record<string, string>;
    expect(Array.isArray(operation)).toBe(false);
    expect(typeof operation["tap"]).toBe("string");
    expect(operation["tap"].length).toBeGreaterThan(0);
    const target = questions["target"]["criteria"] as Record<string, string>;
    expect(Object.keys(target)).toContain("0");
    expect(typeof target["0"]).toBe("string");
  });

  test("non-clickable candidate criteria explicitly carry non-clickable indicator", () => {
    const obs = observationWithSecrets();
    obs.native.controls.push({
      index: 1,
      bounds: [0, 100, 200, 40],
      className: "android.widget.TextView",
      text: "Turn on location",
      contentDesc: "",
      clickable: false,
      enabled: true,
    });
    const input: RemotePolicyInput = {
      goal: "turn on location",
      observation: redactObservation(obs),
      candidates: buildCandidates(obs),
      history: [],
      stepIndex: 0,
    };
    const build = buildJevRequestBody(input, DEFAULT_DECISION_MODEL_ID);
    const questions = build.body["questions"] as Record<string, Record<string, JsonValue>>;
    const target = questions["target"]["criteria"] as Record<string, string>;
    const nonClickableEntry = Object.values(target).find((desc) =>
      desc.includes("Turn on location"),
    );
    expect(nonClickableEntry).toBeDefined();
    expect(nonClickableEntry).toContain("non-clickable text");
  });

  test("a chosen target arrives as a string key and still resolves", async () => {
    const { input } = redactedInput();
    const { transport } = fakeTransport(wireResponse("tap", "0", 0.83));
    const decision = await createJevPolicy({ transport }).decide(input);
    expect(decision.target).toEqual({ kind: "selector", cssSelector: "#login" });
  });

  test("a numeric target is accepted too, so a gateway's serialization cannot break it", async () => {
    const { input } = redactedInput();
    const { transport } = fakeTransport(wireResponse("tap", 0, 0.83));
    const decision = await createJevPolicy({ transport }).decide(input);
    expect(decision.target).toEqual({ kind: "selector", cssSelector: "#login" });
  });

  test("a target outside the sent set is rejected, not executed", async () => {
    const { input } = redactedInput();
    const { transport } = fakeTransport(wireResponse("tap", 999, 0.9));
    const failure = await createJevPolicy({ transport })
      .decide(input)
      .catch((error) => error);
    expect(failure).toBeInstanceOf(PolicyDecisionError);
    expect((failure as PolicyDecisionError).failure).toBe("rejected-target");
  });

  test("readiness and goal signals do not override the selected operation", async () => {
    const { input } = redactedInput();
    const response = wireResponse("tap", 0, 0.83) as Record<string, JsonValue>;
    const answers = response["answers"] as Record<string, JsonValue>;
    answers["screen_ready"] = { type: "noul", noul: 0.01 };
    answers["goal_reached"] = { type: "noul", noul: 0.99 };
    const { transport } = fakeTransport(response);

    const decision = await createJevPolicy({ transport }).decide(input);

    expect(decision.operation).toBe("tap");
  });

  test("a malformed body yields a malformed decision error", async () => {
    const { input } = redactedInput();
    const { transport } = fakeTransport({ nonsense: true });
    const failure = await createJevPolicy({ transport })
      .decide(input)
      .catch((error) => error);
    expect(failure).toBeInstanceOf(PolicyDecisionError);
    expect((failure as PolicyDecisionError).failure).toBe("malformed");
  });

  test("the mapped decision carries the raw answers for display", async () => {
    const { input } = redactedInput();
    const response = wireResponse("tap", 0, 0.83);
    const { transport } = fakeTransport(response);
    const decision = await createJevPolicy({ transport }).decide(input);
    expect(decision.detail).toEqual(response);
  });

  test("an openApp answer is rejected because Jev may not choose packages", async () => {
    const { input } = redactedInput();
    const response = {
      model: JEV_MODEL_VERSION,
      answers: {
        operation: { type: "choice", choice: "openApp", confidence: 0.93 },
        text_span: { type: "choice", choice: "login", confidence: 0.89 },
        screen_ready: { type: "noul", noul: 0.9 },
        goal_reached: { type: "noul", noul: 0.1 },
      },
    };
    const { transport } = fakeTransport(response);
    const failure = await createJevPolicy({ transport })
      .decide(input)
      .catch((error) => error);
    expect(failure).toBeInstanceOf(PolicyDecisionError);
    expect((failure as PolicyDecisionError).failure).toBe("malformed");
  });

  test("dataNotice is non-null and states that data leaves the machine", () => {
    const policy = createJevPolicy();
    expect(policy.isRemote).toBe(true);
    expect(policy.dataNotice).toBe(JEV_DATA_NOTICE);
    expect(JEV_DATA_NOTICE).toMatch(/third-party/);
  });

  test("the full payload build carries neither the password nor the token", () => {
    const { input } = redactedInput();
    const build = buildJevRequestBody(input, DEFAULT_DECISION_MODEL_ID);
    const body = JSON.stringify(build.body);
    expect(body).not.toContain("hunter2correct");
    expect(body).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(body).not.toContain("shot-1.png");
  });

  test("decide rejects a raw observation at the type level", async () => {
    const policy = createJevPolicy({ transport: fakeTransport(wireResponse()).transport });
    const raw: PolicyInput = {
      goal: "login",
      observation: observationWithSecrets(),
      candidates: [],
      history: [],
      stepIndex: 0,
    };
    // @ts-expect-error decide accepts only a redacted observation
    await policy.decide(raw);
  });
});

describe("jev transport mapping", () => {
  test("the default transport nests the body under the payload key", async () => {
    invokeMock.mockResolvedValue(wireResponse("done", "0", 0.9));
    const { input } = redactedInput();
    const expected = buildJevRequestBody(input, DEFAULT_DECISION_MODEL_ID).body;
    await createJevPolicy().decide(input);
    expect(invokeMock).toHaveBeenCalledWith("jev_decide", {
      payload: { body: expected, typesafeModel: JEV_MODEL_VERSION, dangerZone: [] },
    });
    invokeMock.mockReset();
  });

  test("a non-2xx response surfaces a transport failure", async () => {
    invokeMock.mockRejectedValue(new Error("jev-http-500: upstream exploded"));
    const { input } = redactedInput();
    const failure = await createJevPolicy()
      .decide(input)
      .catch((error) => error);
    expect(failure).toBeInstanceOf(PolicyDecisionError);
    expect((failure as PolicyDecisionError).failure).toBe("transport");
    invokeMock.mockReset();
  });

  test("a timeout surfaces a timeout failure", async () => {
    invokeMock.mockRejectedValue(new Error("jev-timeout: Jev decision call timed out"));
    const { input } = redactedInput();
    const failure = await createJevPolicy()
      .decide(input)
      .catch((error) => error);
    expect(failure).toBeInstanceOf(PolicyDecisionError);
    expect((failure as PolicyDecisionError).failure).toBe("timeout");
    invokeMock.mockReset();
  });
});

describe("goal signal visibility", () => {
  test("the decision reason records Jev's goal_reached belief", async () => {
    const { input } = redactedInput();
    const { transport } = fakeTransport(wireResponse("tap", 0, 0.83));
    const decision = await createJevPolicy({ transport }).decide(input);
    expect(decision.reason).toContain("goal_reached 0.1");
  });

  test("a response without goal_reached adds nothing to the reason", async () => {
    const { input } = redactedInput();
    const response = wireResponse("tap", 0, 0.83) as Record<string, JsonValue>;
    const answers = response["answers"] as Record<string, JsonValue>;
    delete answers["goal_reached"];
    const { transport } = fakeTransport(response);
    const decision = await createJevPolicy({ transport }).decide(input);
    expect(decision.reason).not.toContain("goal_reached");
  });
});
