import type { JsonValue } from "@/runtime/ipc/contracts/common";
import {
  DEFAULT_DECISION_MODEL_ID,
  FALLBACK_DECISION_MODEL_ID,
  findDecisionModel,
} from "./decisionModels";
import type { DecisionModelDescriptor } from "./decisionModels";
import { DecisionClientError } from "./decisionTypes";
import type { DecisionRequest, DecisionResult, DecisionWireRequest } from "./decisionTypes";
import {
  assertServable,
  parseAnswers,
  parseServedModel,
  parseUsage,
  toWireRequest,
} from "./decisionWire";
import { IMAGE_TOKEN_CALIBRATION } from "./imageCalibration";
import type { ImageTokenCalibration } from "./imageCalibration";
import { verifyImageDelivery } from "./imageGuard";

/** Sends one shaped request. The desktop transport is Rust-side HTTP; the benchmark uses fetch. */
export interface DecisionTransport {
  send(request: DecisionWireRequest): Promise<JsonValue>;
}

export interface DecisionClientOptions {
  transport: DecisionTransport;
  calibration?: Readonly<Record<string, ImageTokenCalibration>>;
  newKey?: () => string;
}

/**
 * Submits one decisions request to the chosen model.
 *
 * Fails before sending when the model cannot serve the request. When the
 * pinned default has no endpoint, retries once on the fallback with the
 * questions and images the fallback cannot serve removed; any other model
 * fails as asked, never silently swapped. An image answer is kept only when
 * the usage proves the image was read.
 */
export async function submitDecision(
  modelId: string,
  request: DecisionRequest,
  options: DecisionClientOptions,
): Promise<DecisionResult> {
  const model = findDecisionModel(modelId);
  if (model === null) {
    throw new DecisionClientError(
      "unsupported",
      `Decision model "${modelId}" is not in the capability table. Pick one in the agent settings.`,
    );
  }
  try {
    return await submitTo(model, request, options, null);
  } catch (error) {
    const fallback = findDecisionModel(FALLBACK_DECISION_MODEL_ID);
    if (
      !(error instanceof DecisionClientError) ||
      error.kind !== "unavailable" ||
      model.id !== DEFAULT_DECISION_MODEL_ID ||
      fallback === null
    ) {
      throw error;
    }
    return submitTo(fallback, reduceFor(fallback, request), options, model.id);
  }
}

async function submitTo(
  model: DecisionModelDescriptor,
  request: DecisionRequest,
  options: DecisionClientOptions,
  fallbackFrom: string | null,
): Promise<DecisionResult> {
  assertServable(model, request);
  const calibration = (options.calibration ?? IMAGE_TOKEN_CALIBRATION)[model.id] ?? null;
  if (request.images.length > 0 && calibration === null) {
    throw new DecisionClientError(
      "unsupported",
      `${model.label} has no measured image token cost, so an image sent to it could not be verified. Run the decisions benchmark with --calibrate first.`,
    );
  }
  const wire = toWireRequest(model, request, options.newKey);
  let raw: JsonValue;
  try {
    raw = await options.transport.send(wire);
  } catch (error) {
    throw classifyTransportError(error);
  }
  const servedModel = parseServedModel(raw);
  if (servedModel !== null && !servedBy(model, servedModel)) {
    throw new DecisionClientError(
      "unverified",
      `Asked ${model.label} but ${servedModel} answered, so the answer was discarded.`,
    );
  }
  const usage = parseUsage(raw);
  verifyImageDelivery(model, wire.body, request.images, usage, calibration);
  return {
    modelId: model.id,
    servedModel,
    answers: parseAnswers(raw),
    usage,
    fallbackFrom,
    raw,
  };
}

/**
 * Keeps only what the model can serve. Used for the fallback alone, where
 * the caller already treats image and box answers as optional.
 */
export function reduceFor(
  model: DecisionModelDescriptor,
  request: DecisionRequest,
): DecisionRequest {
  const questions = Object.fromEntries(
    Object.entries(request.questions).filter(([, question]) =>
      model.questionTypes.includes(question.type),
    ),
  );
  return { state: request.state, questions, images: model.images === null ? [] : request.images };
}

/**
 * Whether the served model is the one asked for. Gateways append a release
 * date to the slug, so a dated form of the same name matches; an alias moves
 * by design and is not checked.
 */
export function servedBy(model: DecisionModelDescriptor, served: string): boolean {
  if (model.alias) {
    return true;
  }
  const names = [model.openrouterSlug, model.id, model.typesafeId].filter(
    (name): name is string => name !== null,
  );
  return names.some(
    (name) => served === name || served.startsWith(`${name}-`) || name.startsWith(`${served}-`),
  );
}

/**
 * Maps a transport failure onto a decision failure, keeping the Rust-side
 * prefixes distinct. A model with no endpoint is `unavailable`, the only
 * failure the fallback answers.
 */
export function classifyTransportError(error: unknown): DecisionClientError {
  if (error instanceof DecisionClientError) {
    return error;
  }
  const text = flattenErrorText(error);
  if (text.includes("jev-timeout:")) {
    return new DecisionClientError("timeout", text);
  }
  if (text.includes("jev-malformed:")) {
    return new DecisionClientError("malformed", text);
  }
  if (text.includes("jev-http-404") || /no endpoints found/i.test(text)) {
    return new DecisionClientError("unavailable", text);
  }
  if (text.includes("jev-unsupported:")) {
    return new DecisionClientError("unsupported", text);
  }
  return new DecisionClientError("transport", text);
}

/** Flattens an error and its causes into one searchable text. */
export function flattenErrorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  while (current !== null && current !== undefined) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = (current as { cause?: unknown }).cause;
      continue;
    }
    if (typeof current === "string") {
      parts.push(current);
      break;
    }
    parts.push(JSON.stringify(current) ?? "unknown error");
    break;
  }
  return parts.join(" | ");
}
