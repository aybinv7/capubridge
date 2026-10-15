import { invokeCommand } from "@/runtime/ipc/client";
import type { JsonValue } from "@/runtime/ipc/contracts/common";
import { buildCandidates } from "../elementIndex";
import type { Candidate } from "../elementIndex";
import type { Decision, DecisionOperation, StepRecord, TargetRef } from "@/types/automation.types";
import { PolicyDecisionError, registerPolicy } from "./types";
import type { RemotePolicy, RemotePolicyInput } from "./types";
import { redactText } from "../redact";

/**
 * Pinned Jev model version. Identical prompts are not comparable across
 * versions, so this is a version and never `jev-latest`.
 *
 * Provider slugs differ: TypeSafe's own API takes `jev-1.13`, while
 * OpenRouter's alpha decisions endpoint takes the bare slug without any
 * `~` prefix (verified live: `typesafe/jev-1.13-20260917` answers 200; the
 * `~`-prefixed form is rejected as nonexistent). Set
 * `CAPUBRIDGE_JEV_MODEL` to override this without a rebuild when pointing at
 * a gateway.
 */
export const JEV_MODEL_VERSION = "jev-1.13";

/** Rendered at the point of selection. A remote policy must state what leaves the machine. */
export const JEV_DATA_NOTICE =
  "Jev sends the redacted screen structure to a third-party US-hosted model service. " +
  "Internal and synthetic sessions only until a written DPA exists.";

/** A remote policy can choose from at most this many options in one question. */
export const JEV_MAX_OPTIONS = 255;

/**
 * Operations Jev may answer, extending the step vocabulary with loop control.
 *
 * These are `criteria`, not bare options: the API declares a choice as a map
 * of option to description, and the model reads those descriptions literally.
 * A bare `"wait"` carries no signal about when waiting is the right answer,
 * so each description states the condition that selects it.
 */
const OPERATION_CRITERIA: Record<
  Extract<
    DecisionOperation,
    "tap" | "longPress" | "type" | "pressKey" | "back" | "wait" | "done" | "blocked"
  >,
  string
> = {
  tap: "Press one element once to activate it",
  longPress: "Press and hold one element to open a context action",
  type: "Enter text into the focused or targeted input field",
  pressKey: "Send a hardware or system key such as enter or the keyboard dismiss",
  back: "Go back one screen",
  wait: "Do nothing this step because the screen is still loading or settling",
  done: "Stop stepping because the goal appears to have been achieved",
  blocked: "Stop stepping because the goal cannot be advanced from this screen",
};

/** Operations Jev may answer, derived from the criteria so there is one source of truth. */
const OPERATION_OPTIONS = Object.keys(OPERATION_CRITERIA) as DecisionOperation[];

/** Operations that must resolve a target before they execute. */
const TARGETING_OPERATIONS: DecisionOperation[] = ["tap", "longPress", "type"];

/** One built request plus the choice sets the response is validated against. */
export interface JevRequestBuild {
  body: Record<string, JsonValue>;
  sent: Candidate[];
  sentIndices: number[];
  textSpans: string[];
  trimmed: boolean;
  allowedOperations: DecisionOperation[];
}

/** Transport for one Jev call. Injected in tests; the default calls Rust-side HTTP. */
export interface JevTransport {
  decide(body: Record<string, JsonValue>): Promise<JsonValue>;
}

/** Options for the Jev policy. The API key is never one of them. */
export interface JevPolicyOptions {
  model?: string;
  transport?: JevTransport;
}

/**
 * Jev policy behind the redaction gate. Accepts only a RedactedObservation,
 * so calling it with a raw Observation does not type-check. Sends one
 * request carrying every question; screenshots never leave the machine.
 */
export function createJevPolicy(options: JevPolicyOptions = {}): RemotePolicy {
  const model = options.model ?? JEV_MODEL_VERSION;
  const transport = options.transport ?? defaultTransport;
  return {
    id: "jev",
    label: "Jev",
    isRemote: true,
    dataNotice: JEV_DATA_NOTICE,
    decide: async (input: RemotePolicyInput): Promise<Decision> => {
      const build = buildJevRequestBody(input, model);
      let response: JsonValue;
      try {
        response = await transport.decide(build.body);
      } catch (error) {
        throw mapTransportError(error);
      }
      return mapJevResponse(response, build);
    },
  };
}

/**
 * Builds the single batched request from the redacted observation and a
 * candidate set re-derived from the redacted layers. The caller-passed set
 * is never trusted for labels: re-deriving here keeps exactly one path from
 * raw pixels to remote payload, so even a caller bug cannot leak an
 * unmasked value. Goal words become the text_span options, so the model
 * selects exact spans instead of generating free text.
 */
export function buildJevRequestBody(input: RemotePolicyInput, model: string): JevRequestBuild {
  const derived = buildCandidates({
    native: input.observation.native,
    webview: input.observation.webview,
  });
  const trimmed = derived.length > JEV_MAX_OPTIONS;
  const sent = trimmed ? derived.slice(0, JEV_MAX_OPTIONS) : derived;
  const sentIndices = sent.map((candidate) => candidate.index);
  const textSpans = goalSpans(input.goal);
  const allowedOperations = Object.keys(operationChoices(sent, textSpans)) as DecisionOperation[];
  const history = input.history[input.history.length - 1];
  return {
    body: {
      model,
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
        trimmed,
      },
      questions: buildQuestions(sent, textSpans),
    },
    sent,
    sentIndices,
    textSpans,
    trimmed,
    allowedOperations,
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
function buildQuestions(sent: Candidate[], textSpans: string[]): JsonValue {
  const operationCriteria = operationChoices(sent, textSpans);
  const questions: Record<string, JsonValue> = {
    operation: {
      type: "choice",
      instructions: "Which single device operation should run next to advance the goal?",
      criteria: operationCriteria,
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
  return questions;
}

function operationChoices(sent: Candidate[], textSpans: string[]): Record<string, string> {
  const choices: Record<string, string> = {};
  const hasTarget = sent.length > 0;
  const hasInput = sent.some((candidate) => candidate.isInput);
  for (const [operation, criteria] of Object.entries(OPERATION_CRITERIA)) {
    if ((operation === "tap" || operation === "longPress") && !hasTarget) {
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
 * Maps one Jev response to a Decision, carrying the model confidence
 * through unchanged. A target outside the sent set is rejected, never
 * executed; transport problems become PolicyDecisionErrors, never
 * fabricated decisions.
 */
function mapJevResponse(response: JsonValue, build: JevRequestBuild): Decision {
  const decision = decisionFromResponse(response, build);
  const answers = isRecord(response) && isRecord(response["answers"]) ? response["answers"] : null;
  const goalReached = readNoul(answers === null ? undefined : answers["goal_reached"]);
  return goalReached === null
    ? decision
    : { ...decision, reason: `${decision.reason}, goal_reached ${goalReached}` };
}

/**
 * Reads a noul answer as a probability rounded to two places, or null. The
 * goal belief is recorded in every decision's reason so a run that fails to
 * stop can be diagnosed from its trace: whether Jev believed the goal was
 * met is otherwise invisible.
 */
function readNoul(value: JsonValue | undefined): number | null {
  if (!isRecord(value)) {
    return null;
  }
  const noul = (value as Record<string, JsonValue>)["noul"];
  if (typeof noul !== "number" || !Number.isFinite(noul) || noul < 0 || noul > 1) {
    return null;
  }
  return Math.round(noul * 100) / 100;
}

function decisionFromResponse(response: JsonValue, build: JevRequestBuild): Decision {
  if (!isRecord(response) || !isRecord(response["answers"])) {
    throw new PolicyDecisionError("malformed", "jev response carries no answers object");
  }
  const answers = response["answers"] as Record<string, JsonValue>;
  const operationAnswer = readChoice(answers["operation"], "operation");
  if (typeof operationAnswer.choice !== "string" || !isOperation(operationAnswer.choice)) {
    throw new PolicyDecisionError(
      "malformed",
      `jev answered an unknown operation ${JSON.stringify(operationAnswer.choice)}`,
    );
  }
  const operation = operationAnswer.choice;
  if (!build.allowedOperations.includes(operation)) {
    throw new PolicyDecisionError(
      "malformed",
      `jev answered unsupported operation ${JSON.stringify(operation)} for the current screen`,
    );
  }
  const confidence =
    typeof operationAnswer.confidence === "number" ? operationAnswer.confidence : 1;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new PolicyDecisionError("malformed", "jev operation confidence is outside 0..1");
  }
  if (TARGETING_OPERATIONS.includes(operation)) {
    if (build.sent.length === 0) {
      throw new PolicyDecisionError(
        "rejected-target",
        `jev answered ${operation} but no candidate was on screen to target`,
      );
    }
    const targetAnswer = readChoice(answers["target"], "target");
    const chosenIndex = readCandidateIndex(targetAnswer.choice);
    if (chosenIndex === null || !build.sentIndices.includes(chosenIndex)) {
      throw new PolicyDecisionError(
        "rejected-target",
        `jev chose target ${JSON.stringify(targetAnswer.choice)} outside the sent set`,
      );
    }
    const candidate = build.sent.find((entry) => entry.index === chosenIndex);
    if (candidate === undefined) {
      throw new PolicyDecisionError(
        "rejected-target",
        `jev chose target ${chosenIndex} outside the sent set`,
      );
    }
    const target = candidateTarget(candidate);
    if (operation === "type") {
      const textAnswer = readChoice(answers["text_span"], "text_span");
      if (typeof textAnswer.choice !== "string" || !build.textSpans.includes(textAnswer.choice)) {
        throw new PolicyDecisionError("malformed", "jev answered text outside the goal spans");
      }
      return {
        operation,
        target,
        text: textAnswer.choice,
        confidence,
        reason: `jev ${operation} target ${chosenIndex} (confidence ${confidence})`,
        detail: response,
      };
    }
    return {
      operation,
      target,
      confidence,
      reason: `jev ${operation} target ${chosenIndex} (confidence ${confidence})`,
      detail: response,
    };
  }
  if (operation === "pressKey") {
    const text = readOptionalSpan(answers["text_span"], build.textSpans);
    return {
      operation,
      text,
      confidence,
      reason:
        text === undefined
          ? `jev ${operation} (confidence ${confidence})`
          : `jev ${operation} "${text}" (confidence ${confidence})`,
      detail: response,
    };
  }
  return {
    operation,
    confidence,
    reason: `jev ${operation} (confidence ${confidence})`,
    detail: response,
  };
}

/**
 * Reads an optional text span. Absence or an out-of-spans choice yields
 * undefined rather than malformed: the step then fails in the executor with
 * a recorded "needs text" error instead of vanishing without a trace.
 */
function readOptionalSpan(value: JsonValue | undefined, spans: string[]): string | undefined {
  if (!isRecord(value) || !("choice" in value)) {
    return undefined;
  }
  const choice = (value as Record<string, JsonValue>)["choice"];
  return typeof choice === "string" && spans.includes(choice) ? choice : undefined;
}

/**
 * Reads a chosen candidate index. Criteria keys are strings on the wire, so
 * the answer normally comes back as `"12"`, but a numeric answer is accepted
 * too rather than depending on how a given gateway serializes the key.
 */
function readCandidateIndex(choice: unknown): number | null {
  if (typeof choice === "number") return Number.isInteger(choice) ? choice : null;
  if (typeof choice !== "string" || choice.trim() === "") return null;
  const parsed = Number(choice);
  return Number.isInteger(parsed) ? parsed : null;
}

/**
 * Maps a chosen candidate to the most stable target reference: selector
 * first, native index second, text third, raw point last.
 */
function candidateTarget(candidate: Candidate): TargetRef {
  if (candidate.cssSelector !== null) {
    return { kind: "selector", cssSelector: candidate.cssSelector };
  }
  if (candidate.source === "native" && candidate.nativeIndex !== null) {
    return { kind: "nativeIndex", index: candidate.nativeIndex };
  }
  if (candidate.text !== null) {
    return { kind: "text", text: candidate.text, exact: true };
  }
  return { kind: "point", x: candidate.center.x, y: candidate.center.y };
}

/** Default transport: Rust-side HTTP so no key ever reaches the WebView. */
const defaultTransport: JevTransport = {
  decide: async (body: Record<string, JsonValue>): Promise<JsonValue> =>
    invokeCommand("jev_decide", { payload: { body } }),
};

/**
 * Maps a transport failure to a PolicyDecisionError, preserving the
 * Rust-side classification: non-2xx, timeouts and malformed bodies stay
 * distinct instead of collapsing into one transport error.
 */
function mapTransportError(error: unknown): PolicyDecisionError {
  const text = flattenErrorText(error);
  if (text.includes("jev-timeout:")) {
    return new PolicyDecisionError("timeout", text);
  }
  if (text.includes("jev-malformed:")) {
    return new PolicyDecisionError("malformed", text);
  }
  return new PolicyDecisionError("transport", text);
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

/**
 * Reads one Choice answer, throwing malformed when the shape is wrong.
 */
function readChoice(
  value: JsonValue | undefined,
  name: string,
): { choice: unknown; confidence: unknown } {
  if (!isRecord(value) || !("choice" in value)) {
    throw new PolicyDecisionError("malformed", `jev answer "${name}" is not a choice`);
  }
  const record = value as Record<string, JsonValue>;
  return { choice: record["choice"], confidence: record["confidence"] };
}

/**
 * Reports whether the value names a known operation.
 */
function isOperation(value: string): value is DecisionOperation {
  return (OPERATION_OPTIONS as string[]).includes(value);
}

/**
 * Reports whether the value is a JSON object.
 */
function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Flattens an error and its causes into one searchable text.
 */
function flattenErrorText(error: unknown): string {
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
