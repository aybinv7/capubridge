import type { JsonValue } from "@/runtime/ipc/contracts/common";
import { buildCandidates } from "../elementIndex";
import type { Candidate } from "../elementIndex";
import type { Decision, DecisionOperation, StepRecord, TargetRef } from "@/types/automation.types";
import { PolicyDecisionError, registerPolicy } from "./types";
import type { PolicyDecisionFailure, RemotePolicy, RemotePolicyInput } from "./types";
import { redactText } from "../redact";
import { submitDecision } from "../decisions/decisionClient";
import type { DecisionTransport } from "../decisions/decisionClient";
import { findDecisionModel, maxContextTokens } from "../decisions/decisionModels";
import type { DecisionModelDescriptor } from "../decisions/decisionModels";
import { readDecisionModelId } from "../decisions/decisionModelSetting";
import { desktopDecisionTransport } from "../decisions/decisionTransport";
import { DecisionClientError } from "../decisions/decisionTypes";
import type { DecisionQuestion, DecisionRequest, DecisionResult } from "../decisions/decisionTypes";
import { estimateTextTokens, toWireRequest } from "../decisions/decisionWire";
import type { ImageTokenCalibration } from "../decisions/imageCalibration";
import { encodeScreenInWebView } from "../decisions/screenImage";
import type { ScreenEncoder, ScreenImage } from "../decisions/screenImage";
import { mapJevResponse } from "./jevAnswers";
import { OPERATION_CRITERIA } from "./jevOperations";
import { planVisual, visualQuestions } from "./jevVisual";

/**
 * Pinned Jev release, as TypeSafe names it. Identical prompts are not
 * comparable across versions, so this is a release and never `jev-latest`.
 * The capability table maps it to the OpenRouter slug; the decision model
 * setting can choose another table entry.
 */
export const JEV_MODEL_VERSION = "jev-1.14.0";

/** Served only when the pin has no endpoint; it cannot read images or answer box questions. */
export const JEV_FALLBACK_VERSION = "jev-1.13";

/** Rendered at the point of selection. A remote policy must state what leaves the machine. */
export const JEV_DATA_NOTICE =
  "Jev sends the redacted screen structure to a third-party US-hosted model service. " +
  "Internal and synthetic sessions only until a written DPA exists.";

/** Stated beside the model choice when the chosen model can be sent screenshots. */
export const JEV_SCREEN_NOTICE =
  "On screens with no web view, this model is also sent a downscaled screenshot, which cannot be redacted.";

/** A remote policy can choose from at most this many options in one question. */
export const JEV_MAX_OPTIONS = 255;

/** The smallest candidate set kept when trimming a request to a small context. */
const JEV_MIN_OPTIONS = 8;

/** One built request plus the choice sets the response is validated against. */
export interface JevRequestBuild {
  request: DecisionRequest;
  body: Record<string, JsonValue>;
  model: DecisionModelDescriptor;
  sent: Candidate[];
  sentIndices: number[];
  textSpans: string[];
  trimmed: boolean;
  allowedOperations: DecisionOperation[];
  screen: ScreenImage | null;
}

/** Transport for one decisions call. Injected in tests; the default calls Rust-side HTTP. */
export type JevTransport = DecisionTransport;

/** Options for the Jev policy. The API key is never one of them. */
export interface JevPolicyOptions {
  /** A capability-table model id; defaults to the decision model setting, read per step. */
  model?: string;
  transport?: JevTransport;
  encodeScreen?: ScreenEncoder;
  calibration?: Readonly<Record<string, ImageTokenCalibration>>;
}

/**
 * Jev policy behind the redaction gate. Accepts only a RedactedObservation,
 * so calling it with a raw Observation does not type-check. Sends one
 * request carrying every question. A screenshot leaves only on a screen
 * with no DOM, to a model that can locate targets in it and whose image
 * delivery can be verified.
 */
export function createJevPolicy(options: JevPolicyOptions = {}): RemotePolicy {
  const transport = options.transport ?? desktopDecisionTransport;
  const encode = options.encodeScreen ?? encodeScreenInWebView;
  return {
    id: "jev",
    label: "Jev",
    isRemote: true,
    dataNotice: JEV_DATA_NOTICE,
    decide: async (input: RemotePolicyInput): Promise<Decision> => {
      const modelId = options.model ?? readDecisionModelId();
      const model = findDecisionModel(modelId);
      if (model === null) {
        throw new PolicyDecisionError(
          "unsupported",
          `decision model "${modelId}" is not in the capability table`,
        );
      }
      const visual = await planVisual(model, input, encode, options.calibration);
      const build = buildJevRequestBody(
        input,
        model.id,
        visual.kind === "on" ? visual.screen : null,
      );
      let result: DecisionResult;
      try {
        result = await submitDecision(model.id, build.request, {
          transport,
          calibration: options.calibration,
        });
      } catch (error) {
        throw toPolicyError(error);
      }
      return mapJevResponse(result, build, visual);
    },
  };
}

/**
 * Builds the single batched request from the redacted observation and a
 * candidate set re-derived from the redacted layers. The caller-passed set
 * is never trusted for labels: re-deriving here keeps exactly one path from
 * raw layers to remote payload, so even a caller bug cannot leak an
 * unmasked value. Goal words become the text_span options, so the model
 * selects exact spans instead of generating free text. A model with a small
 * context gets fewer candidates rather than a request it would truncate.
 */
export function buildJevRequestBody(
  input: RemotePolicyInput,
  modelId: string,
  screen: ScreenImage | null = null,
): JevRequestBuild {
  const model = findDecisionModel(modelId);
  if (model === null) {
    throw new PolicyDecisionError(
      "unsupported",
      `decision model "${modelId}" is not in the capability table`,
    );
  }
  const derived = buildCandidates({
    native: input.observation.native,
    webview: input.observation.webview,
  });
  const textSpans = goalSpans(input.goal);
  let limit = Math.min(JEV_MAX_OPTIONS, derived.length);
  let built = assembleRequest(input, derived.slice(0, limit), derived.length, textSpans, screen);
  while (limit > JEV_MIN_OPTIONS && estimateTextTokens(built.request) > maxContextTokens(model)) {
    limit = Math.max(JEV_MIN_OPTIONS, Math.floor(limit / 2));
    built = assembleRequest(input, derived.slice(0, limit), derived.length, textSpans, screen);
  }
  const sent = derived.slice(0, limit);
  const preview = toWireRequest(model, built.request, () => "capu-asset-preview");
  return {
    request: built.request,
    body: preview.body,
    model,
    sent,
    sentIndices: sent.map((candidate) => candidate.index),
    textSpans,
    trimmed: sent.length < derived.length,
    allowedOperations: built.allowedOperations,
    screen,
  };
}

function assembleRequest(
  input: RemotePolicyInput,
  sent: Candidate[],
  derivedCount: number,
  textSpans: string[],
  screen: ScreenImage | null,
): { request: DecisionRequest; allowedOperations: DecisionOperation[] } {
  const allowedOperations = Object.keys(
    operationChoices(sent, textSpans, screen !== null),
  ) as DecisionOperation[];
  const history = input.history[input.history.length - 1];
  return {
    allowedOperations,
    request: {
      state: {
        goal: input.goal,
        stepIndex: input.stepIndex,
        stateFingerprint: input.stateFingerprint ?? null,
        lastAction:
          history === undefined ? null : `${history.decision.operation} -> ${history.outcome}`,
        history: input.history.slice(-8).map(describeHistory),
        candidates: sent.map((candidate) => describeCandidate(candidate)),
        signals: {
          pendingRequests: input.observation.signals.pendingRequests,
          recentErrors: input.observation.signals.recentErrors,
          lastDbWrite: input.observation.signals.lastDbWrite,
        },
        trimmed: sent.length < derivedCount,
      },
      questions: buildQuestions(sent, textSpans, screen !== null),
      images: screen === null ? [] : [screen.image],
    },
  };
}

function describeHistory(record: StepRecord): JsonValue {
  return {
    stepId: record.stepId,
    operation: record.decision.operation,
    frameId: record.decision.frameId ?? null,
    target: record.decision.target === undefined ? null : describeTarget(record.decision.target),
    resolvedTarget:
      record.resolvedTarget === null ? null : describeResolvedTarget(record.resolvedTarget),
    outcome: record.outcome,
    screenChanged: record.screenChanged ?? null,
    dispatchStatus: record.dispatchStatus ?? null,
    verificationStatus: record.verificationStatus ?? null,
    beforeFingerprint: record.beforeFingerprint ?? null,
    afterFingerprint: record.afterFingerprint ?? null,
    error: record.error === null ? null : redactText(record.error),
  };
}

function describeTarget(target: TargetRef): JsonValue {
  switch (target.kind) {
    case "selector":
      return { kind: target.kind, cssSelector: target.cssSelector };
    case "text":
      return { kind: target.kind, text: target.text, exact: target.exact };
    case "nativeIndex":
      return { kind: target.kind, index: target.index };
    case "point":
      return { kind: target.kind, x: target.x, y: target.y };
  }
}

function describeResolvedTarget(target: NonNullable<StepRecord["resolvedTarget"]>): JsonValue {
  return {
    x: target.x,
    y: target.y,
    strategy: target.strategy,
    executor: target.executor ?? null,
    frameId: target.frameId ?? null,
  };
}

/**
 * Builds the batched question set in the shape the System One API declares:
 * every question carries `instructions`, and a choice declares `criteria` as
 * a map of option to description rather than a bare list.
 *
 * `target` and `text_span` are omitted when they have nothing to choose from.
 * A choice with no criteria is not a valid question, and an empty one would
 * otherwise invite the model to answer a target that cannot exist.
 */
function buildQuestions(
  sent: Candidate[],
  textSpans: string[],
  visual: boolean,
): Record<string, DecisionQuestion> {
  const questions: Record<string, DecisionQuestion> = {
    operation: {
      type: "choice",
      instructions: "Which single device operation should run next to advance the goal?",
      criteria: operationChoices(sent, textSpans, visual),
    },
    screen_ready: {
      type: "noul",
      instructions: "Has the screen finished loading and settled?",
      criteria: {
        true: "Content is rendered and no work appears to be in flight",
        false: "Still loading, a spinner is showing, or requests are pending",
      },
    },
    goal_reached: {
      type: "noul",
      instructions: "Has the goal been achieved on the current screen?",
      criteria: {
        true: "The screen shows the end state the goal describes",
        false: "More steps are still required",
      },
    },
  };
  if (sent.length > 0) {
    questions["target"] = {
      type: "choice",
      instructions: "Which on-screen element should the operation act on?",
      criteria: targetCriteria(sent),
    };
  }
  if (textSpans.length > 0) {
    questions["text_span"] = {
      type: "choice",
      instructions: "Which exact span of the goal is the text to type?",
      criteria: spanCriteria(textSpans),
    };
  }
  return visual ? { ...questions, ...visualQuestions() } : questions;
}

/**
 * The operations this screen can serve. Pressing needs a candidate or, on a
 * screen sent as an image, a visual target; typing always needs an input
 * candidate and a goal span.
 */
function operationChoices(
  sent: Candidate[],
  textSpans: string[],
  visual: boolean,
): Record<string, string> {
  const choices: Record<string, string> = {};
  const canPress = sent.length > 0 || visual;
  const hasInput = sent.some((candidate) => candidate.isInput);
  for (const [operation, criteria] of Object.entries(OPERATION_CRITERIA)) {
    if ((operation === "tap" || operation === "longPress") && !canPress) {
      continue;
    }
    if (operation === "type" && (!hasInput || textSpans.length === 0)) {
      continue;
    }
    choices[operation] = criteria;
  }
  return choices;
}

/**
 * Describes each candidate for the target choice, keyed by its index as a
 * string because criteria keys are strings on the wire. The description is
 * what the model actually selects on, so a bare index would give it nothing
 * to reason about.
 */
function targetCriteria(sent: Candidate[]): Record<string, string> {
  const criteria: Record<string, string> = {};
  for (const candidate of sent) {
    criteria[String(candidate.index)] = describeCandidateLabel(candidate);
  }
  return criteria;
}

/** One human-readable line per candidate: what it is and where it came from. */
function describeCandidateLabel(candidate: Candidate): string {
  const parts = [candidate.label];
  if (candidate.text !== null && candidate.text !== candidate.label) {
    parts.push(`text ${JSON.stringify(candidate.text)}`);
  }
  if (!candidate.clickable) {
    parts.push("non-clickable text");
  }
  parts.push(candidate.source === "webview" ? "in the web view" : "native control");
  return parts.join(", ");
}

/** Goal spans are their own descriptions: the model selects the span verbatim. */
function spanCriteria(textSpans: string[]): Record<string, string> {
  const criteria: Record<string, string> = {};
  for (const span of textSpans) {
    criteria[span] = span;
  }
  return criteria;
}

/**
 * Maps a decisions-client failure to a policy failure, keeping each kind
 * distinct so the trace says whether a model could not serve the step, an
 * image went unread, or the network failed.
 */
function toPolicyError(error: unknown): PolicyDecisionError {
  if (error instanceof PolicyDecisionError) {
    return error;
  }
  if (!(error instanceof DecisionClientError)) {
    return new PolicyDecisionError(
      "transport",
      error instanceof Error ? error.message : String(error),
    );
  }
  const failure: Record<DecisionClientError["kind"], PolicyDecisionFailure> = {
    unsupported: "unsupported",
    unverified: "unverified",
    unavailable: "transport",
    malformed: "malformed",
    timeout: "timeout",
    transport: "transport",
  };
  return new PolicyDecisionError(failure[error.kind], error.message);
}

/**
 * Describes one candidate for the request state.
 */
function describeCandidate(candidate: Candidate): JsonValue {
  const described: Record<string, JsonValue> = {
    index: candidate.index,
    source: candidate.source,
    label: candidate.label,
    clickable: candidate.clickable,
    isInput: candidate.isInput,
  };
  if (candidate.cssSelector !== null) {
    described["selector"] = candidate.cssSelector;
  }
  if (candidate.text !== null) {
    described["text"] = candidate.text;
  }
  return described;
}

/**
 * Splits the goal into exact spans the model may select. Never free text.
 */
function goalSpans(goal: string): string[] {
  const words = goal.split(/\s+/).filter((span) => span !== "");
  const spans: string[] = [];
  for (let size = Math.min(4, words.length); size >= 1; size -= 1) {
    for (let start = 0; start + size <= words.length; start += 1) {
      const span = words.slice(start, start + size).join(" ");
      if (!spans.includes(span)) {
        spans.push(span);
      }
      if (spans.length >= JEV_MAX_OPTIONS) {
        return spans;
      }
    }
  }
  return spans.length > 0 ? spans : [""];
}

registerPolicy("jev", (options?: unknown) => createJevPolicy(readJevOptions(options)));

/**
 * Reads registry factory options without throwing.
 */
function readJevOptions(options: unknown): JevPolicyOptions {
  if (typeof options !== "object" || options === null) {
    return {};
  }
  const record = options as Record<string, unknown>;
  return typeof record["model"] === "string" ? { model: record["model"] } : {};
}
