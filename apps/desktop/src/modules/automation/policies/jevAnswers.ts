import type { Decision, DecisionOperation, TargetRef } from "@/types/automation.types";
import type { Candidate } from "../elementIndex";
import type { ChoiceAnswer, DecisionAnswer, DecisionResult } from "../decisions/decisionTypes";
import { isOperation, TARGETING_OPERATIONS, VISUAL_OPERATIONS } from "./jevOperations";
import { visualTarget } from "./jevVisual";
import type { VisualPlan } from "./jevVisual";
import type { JevRequestBuild } from "./jev";
import { PolicyDecisionError } from "./types";

/**
 * Maps one decisions result to a Decision, carrying the model confidence
 * through unchanged. A target outside the sent set is rejected, never
 * executed; a visual target is acted on only past the presence threshold.
 * The goal belief, the serving model when it was a fallback, and why the
 * visual path was off are recorded in the reason, so a trace can explain a
 * run that fails to stop or misses a native dialog.
 */
export function mapJevResponse(
  result: DecisionResult,
  build: JevRequestBuild,
  visual: VisualPlan,
): Decision {
  const decision = decisionFromAnswers(result, build, visual);
  const notes: string[] = [];
  const goal = result.answers["goal_reached"];
  if (goal !== undefined && goal.type === "noul") {
    notes.push(`goal_reached ${Math.round(goal.noul * 100) / 100}`);
  }
  if (result.fallbackFrom !== null) {
    notes.push(`served by ${result.modelId} because ${result.fallbackFrom} had no endpoint`);
  }
  if (visual.kind === "off" && visual.reason !== null) {
    notes.push(`visual off: ${visual.reason}`);
  }
  return notes.length === 0
    ? decision
    : { ...decision, reason: `${decision.reason}, ${notes.join(", ")}` };
}

function decisionFromAnswers(
  result: DecisionResult,
  build: JevRequestBuild,
  visual: VisualPlan,
): Decision {
  const answers = result.answers;
  const operationAnswer = requireChoice(answers, "operation");
  if (!isOperation(operationAnswer.choice)) {
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
  const confidence = operationAnswer.confidence ?? 1;
  const detail = result.raw;
  if (!TARGETING_OPERATIONS.includes(operation)) {
    if (operation === "pressKey") {
      const text = optionalSpan(answers["text_span"], build.textSpans);
      return {
        operation,
        text,
        confidence,
        reason:
          text === undefined
            ? `jev ${operation} (confidence ${confidence})`
            : `jev ${operation} "${text}" (confidence ${confidence})`,
        detail,
      };
    }
    return { operation, confidence, reason: `jev ${operation} (confidence ${confidence})`, detail };
  }
  const candidate = chosenCandidate(answers, build);
  if (candidate === null) {
    if (visual.kind === "on" && VISUAL_OPERATIONS.includes(operation)) {
      return visualDecision(operation, confidence, result, visual);
    }
    return rejectTarget(operation, answers, build);
  }
  const target = candidateTarget(candidate);
  if (operation === "type") {
    const textAnswer = requireChoice(answers, "text_span");
    if (!build.textSpans.includes(textAnswer.choice)) {
      throw new PolicyDecisionError("malformed", "jev answered text outside the goal spans");
    }
    return {
      operation,
      target,
      text: textAnswer.choice,
      confidence,
      reason: `jev ${operation} target ${candidate.index} (confidence ${confidence})`,
      detail,
    };
  }
  return {
    operation,
    target,
    confidence,
    reason: `jev ${operation} target ${candidate.index} (confidence ${confidence})`,
    detail,
  };
}

function visualDecision(
  operation: DecisionOperation,
  confidence: number,
  result: DecisionResult,
  visual: Extract<VisualPlan, { kind: "on" }>,
): Decision {
  const located = visualTarget(result.answers, visual.screen);
  if (!located.ok) {
    throw new PolicyDecisionError(
      "rejected-target",
      `jev answered ${operation} but ${located.reason}`,
    );
  }
  const boxNote = located.boxConfidence === null ? "" : `, box confidence ${located.boxConfidence}`;
  return {
    operation,
    target: located.target,
    confidence,
    reason: `jev ${operation} visual target (presence ${located.presence}${boxNote}, confidence ${confidence})`,
    detail: result.raw,
  };
}

/** The candidate the target answer names, or null when it names none of the sent set. */
function chosenCandidate(
  answers: Record<string, DecisionAnswer>,
  build: JevRequestBuild,
): Candidate | null {
  const answer = answers["target"];
  if (build.sent.length === 0 || answer === undefined || answer.type !== "choice") {
    return null;
  }
  const index = readCandidateIndex(answer.choice);
  return index === null ? null : (build.sent.find((entry) => entry.index === index) ?? null);
}

function rejectTarget(
  operation: DecisionOperation,
  answers: Record<string, DecisionAnswer>,
  build: JevRequestBuild,
): never {
  if (build.sent.length === 0) {
    throw new PolicyDecisionError(
      "rejected-target",
      `jev answered ${operation} but no candidate was on screen to target`,
    );
  }
  const answer = requireChoice(answers, "target");
  throw new PolicyDecisionError(
    "rejected-target",
    `jev chose target ${JSON.stringify(answer.choice)} outside the sent set`,
  );
}

/** Reads one choice answer; a refusal and a wrong shape are distinct failures. */
function requireChoice(answers: Record<string, DecisionAnswer>, name: string): ChoiceAnswer {
  const answer = answers[name];
  if (answer !== undefined && answer.type === "refusal") {
    throw new PolicyDecisionError("refused", `jev refused to answer "${name}"`);
  }
  if (answer === undefined || answer.type !== "choice") {
    throw new PolicyDecisionError("malformed", `jev answer "${name}" is not a choice`);
  }
  return answer;
}

/**
 * Reads an optional text span. Absence or an out-of-spans choice yields
 * undefined rather than malformed: the step then fails in the executor with
 * a recorded "needs text" error instead of vanishing without a trace.
 */
function optionalSpan(answer: DecisionAnswer | undefined, spans: string[]): string | undefined {
  if (answer === undefined || answer.type !== "choice") {
    return undefined;
  }
  return spans.includes(answer.choice) ? answer.choice : undefined;
}

/**
 * Reads a chosen candidate index. Criteria keys are strings on the wire, and
 * the parser keeps a numeric answer as its string form.
 */
function readCandidateIndex(choice: string): number | null {
  if (choice.trim() === "") return null;
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
