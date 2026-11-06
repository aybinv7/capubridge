import { describe, expect, test } from "vite-plus/test";
import type { JsonValue } from "@/runtime/ipc/contracts/common";
import { submitDecision, servedBy } from "../decisionClient";
import type { DecisionTransport } from "../decisionClient";
import { requireDecisionModel } from "../decisionModels";
import { DecisionClientError } from "../decisionTypes";
import type { DecisionImage, DecisionRequest, DecisionWireRequest } from "../decisionTypes";
import { capabilityProblems, toWireRequest } from "../decisionWire";
import type { ImageTokenCalibration } from "../imageCalibration";

const CALIBRATION: Record<string, ImageTokenCalibration> = {
  "typesafe/jev-1.14": {
    textTokensPerChar: 0.25,
    imageTokensBase: 100,
    imageTokensPerMegapixel: 1_000,
    measuredOn: "2026-11-06",
  },
};

function image(width = 720, height = 1280): DecisionImage {
  return { slot: "screen", format: "jpeg", base64: "AAAA", width, height };
}

function textRequest(): DecisionRequest {
  return {
    state: { goal: "open settings" },
    questions: {
      operation: { type: "choice", instructions: "Which?", criteria: { tap: "Tap", back: "Back" } },
    },
    images: [],
  };
}

function visualRequest(): DecisionRequest {
  return {
    state: { goal: "allow notifications" },
    questions: {
      present: { type: "noul", instructions: "Is Allow visible in `screen`?" },
      where: { type: "box", instructions: "Locate Allow in `screen`." },
    },
    images: [image()],
  };
}

function recordingTransport(responses: Array<JsonValue | Error>): {
  transport: DecisionTransport;
  sent: DecisionWireRequest[];
} {
  const sent: DecisionWireRequest[] = [];
  return {
    sent,
    transport: {
      send: (request) => {
        sent.push(request);
        const next = responses.shift();
        if (next === undefined) {
          return Promise.reject(new Error("no scripted response"));
        }
        return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
      },
    },
  };
}

function answered(model: string, inputTokens: number): JsonValue {
  return {
    model,
    answers: {
      present: { type: "noul", noul: 0.93 },
      where: {
        type: "box",
        box: { top: 0.48, bottom: 0.54, left: 0.14, right: 0.86 },
        confidence: 0.8,
      },
      operation: { type: "choice", choice: "tap", confidence: 0.9, probabilities: { tap: 0.9 } },
    },
    usage: { input_tokens: inputTokens, output_tokens: 0, cost: 0.00001 },
  };
}

async function failureOf(promise: Promise<unknown>): Promise<DecisionClientError> {
  const error = await promise.then(
    () => null,
    (cause: unknown) => cause,
  );
  expect(error).toBeInstanceOf(DecisionClientError);
  return error as DecisionClientError;
}

describe("capability checks before sending", () => {
  test("a box question to a model without box fails with a plain message and sends nothing", async () => {
    const { transport, sent } = recordingTransport([]);
    const error = await failureOf(
      submitDecision(
        "openai/gpt-6-luna-decisions",
        { ...visualRequest(), images: [] },
        { transport },
      ),
    );
    expect(error.kind).toBe("unsupported");
    expect(error.message).toContain('cannot answer "box" questions');
    expect(sent).toHaveLength(0);
  });

  test("an image to a text-only model is refused before sending", () => {
    const problems = capabilityProblems(requireDecisionModel("typesafe/jev-1.13"), {
      ...textRequest(),
      images: [image()],
    });
    expect(problems.join(" ")).toContain("does not read images");
  });

  test("an image outside Jev's side limits is refused", () => {
    const model = requireDecisionModel("typesafe/jev-1.14");
    expect(capabilityProblems(model, { ...textRequest(), images: [image(1000, 1600)] })).toEqual([
      expect.stringContaining("each side at most 1568 px"),
    ]);
    expect(capabilityProblems(model, { ...textRequest(), images: [image(200, 400)] })).toEqual([
      expect.stringContaining("each side at least 256 px"),
    ]);
  });

  test("more images than the model's cap are refused", () => {
    const model = requireDecisionModel("cloudflare/clef");
    const request = { ...textRequest(), images: [1, 2, 3, 4, 5].map(() => image(400, 400)) };
    expect(capabilityProblems(model, request).join(" ")).toContain("at most 4 images");
  });

  test("text past the model's usable context is refused", () => {
    const model = requireDecisionModel("cloudflare/clef");
    const request = { ...textRequest(), state: { blob: "x".repeat(20_000) } };
    expect(capabilityProblems(model, request).join(" ")).toContain("reads at most 2000");
  });

  test("an unknown model id fails before sending", async () => {
    const { transport, sent } = recordingTransport([]);
    const error = await failureOf(submitDecision("acme/oracle", textRequest(), { transport }));
    expect(error.kind).toBe("unsupported");
    expect(sent).toHaveLength(0);
  });

  test("an image request to a model with no measured image cost is refused before sending", async () => {
    const { transport, sent } = recordingTransport([]);
    const error = await failureOf(
      submitDecision("typesafe/jev-1.14", visualRequest(), { transport, calibration: {} }),
    );
    expect(error.kind).toBe("unsupported");
    expect(error.message).toContain("no measured image token cost");
    expect(sent).toHaveLength(0);
  });
});

describe("wire shape", () => {
  test("Jev reads an image reference nested in the state object", () => {
    const wire = toWireRequest(
      requireDecisionModel("typesafe/jev-1.14"),
      visualRequest(),
      () => "k1",
    );
    expect(wire.body["state"]).toEqual({ goal: "allow notifications", screen: "k1" });
    expect(wire.body["assets"]).toEqual({
      k1: { type: "image", format: "jpg", data_base64: "AAAA" },
    });
    expect(wire.dangerZone).toEqual(["images"]);
    expect(wire.typesafeModel).toBe("jev-1.14.0");
  });

  test("other providers get the reference as a whole top-level state string", () => {
    const request: DecisionRequest = {
      ...visualRequest(),
      questions: { present: { type: "noul", instructions: "Is Allow visible in `screen`?" } },
    };
    const wire = toWireRequest(requireDecisionModel("liquid/d1"), request, () => "k1");
    const state = wire.body["state"] as JsonValue[];
    expect(state[1]).toBe("k1");
    expect(JSON.parse(state[0] as string)).toEqual({
      goal: "allow notifications",
      images_in_order: ["screen"],
    });
    expect(wire.dangerZone).toEqual([]);
  });

  test("a text request keeps its state object and asks for no opt-in feature", () => {
    const wire = toWireRequest(requireDecisionModel("typesafe/jev-1.14"), textRequest());
    expect(wire.body["state"]).toEqual({ goal: "open settings" });
    expect(wire.body["assets"]).toBeUndefined();
    expect(wire.dangerZone).toEqual([]);
  });
});

describe("image delivery guard", () => {
  test("usage that barely moves fails closed instead of returning answers", async () => {
    const { transport } = recordingTransport([answered("typesafe/jev-1.14", 120)]);
    const error = await failureOf(
      submitDecision("typesafe/jev-1.14", visualRequest(), { transport, calibration: CALIBRATION }),
    );
    expect(error.kind).toBe("unverified");
    expect(error.message).toContain("likely dropped the image");
  });

  test("usage carrying the image cost returns the box and presence answers", async () => {
    const { transport } = recordingTransport([answered("typesafe/jev-1.14-20261014", 1_400)]);
    const result = await submitDecision("typesafe/jev-1.14", visualRequest(), {
      transport,
      calibration: CALIBRATION,
    });
    expect(result.answers["present"]).toEqual({ type: "noul", noul: 0.93 });
    expect(result.answers["where"]).toMatchObject({ type: "box", confidence: 0.8 });
  });

  test("an image answer without usage cannot prove delivery and fails closed", async () => {
    const response = answered("typesafe/jev-1.14", 0) as Record<string, JsonValue>;
    delete response["usage"];
    const { transport } = recordingTransport([response]);
    const error = await failureOf(
      submitDecision("typesafe/jev-1.14", visualRequest(), { transport, calibration: CALIBRATION }),
    );
    expect(error.kind).toBe("unverified");
  });
});

describe("fallback and served model", () => {
  test("the pin without an endpoint falls back to 1.13 with box and image removed", async () => {
    const { transport, sent } = recordingTransport([
      new Error('jev-http-404: {"error":{"message":"No endpoints found for typesafe/jev-1.14"}}'),
      answered("typesafe/jev-1.13-20260917", 40),
    ]);
    const result = await submitDecision(
      "typesafe/jev-1.14",
      {
        ...visualRequest(),
        questions: { ...visualRequest().questions, ...textRequest().questions },
      },
      { transport, calibration: CALIBRATION },
    );
    expect(result.modelId).toBe("typesafe/jev-1.13");
    expect(result.fallbackFrom).toBe("typesafe/jev-1.14");
    expect(sent).toHaveLength(2);
    const retried = sent.at(1)?.body ?? {};
    expect(Object.keys(retried["questions"] as Record<string, JsonValue>).sort()).toEqual([
      "operation",
      "present",
    ]);
    expect(retried["assets"]).toBeUndefined();
  });

  test("a model the owner picked is never swapped silently", async () => {
    const { transport, sent } = recordingTransport([new Error("jev-http-404: No endpoints found")]);
    const error = await failureOf(submitDecision("liquid/d1", textRequest(), { transport }));
    expect(error.kind).toBe("unavailable");
    expect(sent).toHaveLength(1);
  });

  test("an answer from a different model is discarded", async () => {
    const { transport } = recordingTransport([answered("openai/gpt-6-luna-decisions", 40)]);
    const error = await failureOf(
      submitDecision("typesafe/jev-1.14", textRequest(), { transport }),
    );
    expect(error.kind).toBe("unverified");
  });

  test("dated and TypeSafe names count as the same model, a neighbour release does not", () => {
    const jev = requireDecisionModel("typesafe/jev-1.14");
    expect(servedBy(jev, "typesafe/jev-1.14-20261014")).toBe(true);
    expect(servedBy(jev, "jev-1.14.0")).toBe(true);
    expect(servedBy(jev, "typesafe/jev-1.13-20260917")).toBe(false);
    expect(servedBy(requireDecisionModel("typesafe/jev-1.13"), "typesafe/jev-1.13")).toBe(true);
  });

  test("a refusal is parsed as its own answer, not a guess", async () => {
    const { transport } = recordingTransport([
      { model: "typesafe/jev-1.14", answers: { operation: { type: "refusal" } } },
    ]);
    const result = await submitDecision("typesafe/jev-1.14", textRequest(), { transport });
    expect(result.answers["operation"]).toEqual({ type: "refusal" });
  });
});
