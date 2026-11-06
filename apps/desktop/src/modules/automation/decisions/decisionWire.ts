import type { JsonValue } from "@/runtime/ipc/contracts/common";
import { maxContextTokens, supportsQuestionType } from "./decisionModels";
import type { DecisionModelDescriptor } from "./decisionModels";
import { DecisionClientError } from "./decisionTypes";
import type {
  BoxEdges,
  DangerZoneFeature,
  DecisionAnswer,
  DecisionImage,
  DecisionQuestion,
  DecisionRequest,
  DecisionUsage,
  DecisionWireRequest,
} from "./decisionTypes";

/** Rough text tokens per character for the pre-send context check. */
const CHARS_PER_TOKEN = 4;

/** Estimates the text tokens a serialized request costs, images excluded. */
export function estimateTextTokens(request: DecisionRequest): number {
  const text = JSON.stringify({ state: request.state, questions: request.questions });
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Lists every reason the model cannot serve the request, in plain words. An
 * empty list means it can. Checked before sending, so a request a model would
 * reject or silently degrade never leaves the machine.
 */
export function capabilityProblems(
  model: DecisionModelDescriptor,
  request: DecisionRequest,
): string[] {
  const problems: string[] = [];
  const types = new Set(Object.values(request.questions).map((question) => question.type));
  for (const type of types) {
    if (!supportsQuestionType(model, type)) {
      const names = Object.entries(request.questions)
        .filter(([, question]) => question.type === type)
        .map(([name]) => name);
      problems.push(
        `${model.label} cannot answer "${type}" questions (asked: ${names.join(", ")}).`,
      );
    }
  }
  problems.push(...imageProblems(model, request.images));
  const tokens = estimateTextTokens(request);
  const limit = maxContextTokens(model);
  if (tokens > limit) {
    problems.push(
      `This request is about ${tokens} tokens of text; ${model.label} reads at most ${limit}.`,
    );
  }
  return problems;
}

function imageProblems(model: DecisionModelDescriptor, images: DecisionImage[]): string[] {
  if (images.length === 0) {
    return [];
  }
  const support = model.images;
  if (support === null) {
    return [`${model.label} does not read images.`];
  }
  const problems: string[] = [];
  if (images.length > support.maxPerRequest) {
    problems.push(
      `${model.label} reads at most ${support.maxPerRequest} images per request; this one has ${images.length}.`,
    );
  }
  for (const image of images) {
    if (!support.formats.includes(image.format)) {
      problems.push(`${model.label} does not read ${image.format} images (${image.slot}).`);
    }
    const shortSide = Math.min(image.width, image.height);
    const longSide = Math.max(image.width, image.height);
    if (support.minSide !== null && shortSide < support.minSide) {
      problems.push(
        `Image ${image.slot} is ${image.width}x${image.height}; ${model.label} needs each side at least ${support.minSide} px.`,
      );
    }
    if (support.maxSide !== null && longSide > support.maxSide) {
      problems.push(
        `Image ${image.slot} is ${image.width}x${image.height}; ${model.label} takes each side at most ${support.maxSide} px.`,
      );
    }
    if (support.maxPixels !== null && image.width * image.height > support.maxPixels) {
      problems.push(
        `Image ${image.slot} has ${image.width * image.height} pixels; ${model.label} takes at most ${support.maxPixels}.`,
      );
    }
  }
  return problems;
}

/** Throws one unsupported error carrying every problem, or returns quietly. */
export function assertServable(model: DecisionModelDescriptor, request: DecisionRequest): void {
  const problems = capabilityProblems(model, request);
  if (problems.length > 0) {
    throw new DecisionClientError("unsupported", problems.join(" "));
  }
}

/**
 * Shapes a request for one model: its slug, where image references sit, and
 * which opt-in features it needs. Asset keys are random so a reference can
 * never collide with ordinary text in the state.
 */
export function toWireRequest(
  model: DecisionModelDescriptor,
  request: DecisionRequest,
  newKey: () => string = () => `capu-${globalThis.crypto.randomUUID()}`,
): DecisionWireRequest {
  const keys = request.images.map((image) => ({ image, key: newKey() }));
  const body: Record<string, JsonValue> = {
    model: model.openrouterSlug,
    state: wireState(model, request.state, keys),
    questions: wireQuestions(request.questions),
  };
  if (keys.length > 0) {
    const assets: Record<string, JsonValue> = {};
    for (const { image, key } of keys) {
      assets[key] = {
        type: "image",
        format: image.format === "jpeg" ? "jpg" : "png",
        data_base64: image.base64,
      };
    }
    body["assets"] = assets;
  }
  const estimatedTextTokens = estimateTextTokens(request);
  return {
    body,
    typesafeModel: model.typesafeId,
    dangerZone: dangerZoneFor(model, request, estimatedTextTokens),
    estimatedTextTokens,
  };
}

function wireState(
  model: DecisionModelDescriptor,
  state: Record<string, JsonValue>,
  keys: { image: DecisionImage; key: string }[],
): JsonValue {
  if (keys.length === 0) {
    return state;
  }
  if (model.images?.placement === "nested") {
    const nested: Record<string, JsonValue> = { ...state };
    for (const { image, key } of keys) {
      nested[image.slot] = key;
    }
    return nested;
  }
  const described = { ...state, images_in_order: keys.map(({ image }) => image.slot) };
  return [JSON.stringify(described), ...keys.map(({ key }) => key)];
}

function wireQuestions(questions: Record<string, DecisionQuestion>): JsonValue {
  const wire: Record<string, JsonValue> = {};
  for (const [name, question] of Object.entries(questions)) {
    switch (question.type) {
      case "box":
        wire[name] = { type: "box", instructions: question.instructions };
        break;
      case "choice":
        wire[name] = {
          type: "choice",
          instructions: question.instructions,
          criteria: question.criteria,
        };
        break;
      case "noul":
        wire[name] =
          question.criteria === undefined
            ? { type: "noul", instructions: question.instructions }
            : { type: "noul", instructions: question.instructions, criteria: question.criteria };
        break;
    }
  }
  return wire;
}

function dangerZoneFor(
  model: DecisionModelDescriptor,
  request: DecisionRequest,
  estimatedTextTokens: number,
): DangerZoneFeature[] {
  if (!model.dangerZone) {
    return [];
  }
  const features: DangerZoneFeature[] = [];
  const hasBox = Object.values(request.questions).some((question) => question.type === "box");
  if (request.images.length > 0 || hasBox) {
    features.push("images");
  }
  if (model.longContextTokens !== null && estimatedTextTokens > model.contextTokens) {
    features.push("long-context");
  }
  return features;
}

/** Parses the answers object; an answer of an unknown shape is malformed, never guessed. */
export function parseAnswers(raw: JsonValue): Record<string, DecisionAnswer> {
  if (!isRecord(raw) || !isRecord(raw["answers"])) {
    throw new DecisionClientError("malformed", "the decisions response carries no answers object");
  }
  const parsed: Record<string, DecisionAnswer> = {};
  for (const [name, value] of Object.entries(raw["answers"])) {
    parsed[name] = parseAnswer(name, value);
  }
  return parsed;
}

function parseAnswer(name: string, value: JsonValue): DecisionAnswer {
  if (!isRecord(value)) {
    throw new DecisionClientError("malformed", `answer "${name}" is not an object`);
  }
  if (value["type"] === "refusal") {
    return { type: "refusal" };
  }
  if ("box" in value) {
    return {
      type: "box",
      box: readBox(name, value["box"]),
      confidence: readConfidence(name, value["confidence"]),
    };
  }
  if ("choice" in value) {
    const choice = value["choice"];
    if (typeof choice !== "string" && typeof choice !== "number") {
      throw new DecisionClientError("malformed", `answer "${name}" has no usable choice`);
    }
    return {
      type: "choice",
      choice: String(choice),
      confidence: readConfidence(name, value["confidence"]),
      probabilities: readProbabilities(value["probabilities"]),
    };
  }
  if ("noul" in value) {
    const noul = readUnit(value["noul"]);
    if (noul === null) {
      throw new DecisionClientError("malformed", `answer "${name}" has a noul outside 0..1`);
    }
    return { type: "noul", noul };
  }
  throw new DecisionClientError("malformed", `answer "${name}" has an unknown shape`);
}

function readBox(name: string, value: JsonValue | undefined): BoxEdges {
  if (!isRecord(value)) {
    throw new DecisionClientError("malformed", `answer "${name}" has no box`);
  }
  const top = readUnit(value["top"]);
  const bottom = readUnit(value["bottom"]);
  const left = readUnit(value["left"]);
  const right = readUnit(value["right"]);
  if (top === null || bottom === null || left === null || right === null) {
    throw new DecisionClientError("malformed", `answer "${name}" has a box edge outside 0..1`);
  }
  if (left >= right || top >= bottom) {
    throw new DecisionClientError("malformed", `answer "${name}" has an empty or inverted box`);
  }
  return { top, bottom, left, right };
}

/** An absent confidence is null; a present one outside 0..1 is malformed, never clamped. */
function readConfidence(name: string, value: JsonValue | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  const unit = readUnit(value);
  if (unit === null) {
    throw new DecisionClientError("malformed", `answer "${name}" has a confidence outside 0..1`);
  }
  return unit;
}

function readProbabilities(value: JsonValue | undefined): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }
  const probabilities: Record<string, number> = {};
  for (const [option, probability] of Object.entries(value)) {
    const unit = readUnit(probability);
    if (unit !== null) {
      probabilities[option] = unit;
    }
  }
  return probabilities;
}

/** Reads usage, or null when the response carries none. */
export function parseUsage(raw: JsonValue): DecisionUsage | null {
  if (!isRecord(raw) || !isRecord(raw["usage"])) {
    return null;
  }
  const usage = raw["usage"];
  const inputTokens = usage["input_tokens"];
  const outputTokens = usage["output_tokens"];
  if (typeof inputTokens !== "number" || !Number.isFinite(inputTokens)) {
    return null;
  }
  const cost = usage["cost"];
  return {
    inputTokens,
    outputTokens: typeof outputTokens === "number" ? outputTokens : 0,
    costUsd: typeof cost === "number" && Number.isFinite(cost) ? cost : null,
  };
}

/** Reads the model the gateway says served the call. */
export function parseServedModel(raw: JsonValue): string | null {
  return isRecord(raw) && typeof raw["model"] === "string" ? raw["model"] : null;
}

function readUnit(value: JsonValue | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}

/** Reports whether the value is a JSON object. */
export function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
