import type { Candidate } from "../../src/modules/automation/elementIndex.ts";
import type { DecisionAnswer } from "../../src/modules/automation/decisions/decisionTypes.ts";
import {
  VISUAL_BOX_QUESTION,
  VISUAL_PRESENT_QUESTION,
} from "../../src/modules/automation/policies/jevVisual.ts";
import type { CaseExpectations } from "./cases.ts";

/** One graded answer. Unanswered questions count as wrong: a model that skips is not accurate. */
export interface Grade {
  question: string;
  correct: boolean;
}

/** Grades every expectation the case declares against the answers the model returned. */
export function gradeAnswers(
  expect: CaseExpectations,
  answers: Record<string, DecisionAnswer>,
  sent: readonly Candidate[],
): Grade[] {
  const grades: Grade[] = [];
  if (expect.operation !== undefined) {
    grades.push({
      question: "operation",
      correct: choiceOf(answers["operation"]) === expect.operation,
    });
  }
  if (expect.targetLabel !== undefined) {
    const label = expect.targetLabel;
    const wanted = sent.find((candidate) => candidate.label.startsWith(label));
    grades.push({
      question: "target",
      correct: wanted !== undefined && choiceOf(answers["target"]) === String(wanted.index),
    });
  }
  if (expect.goalReached !== undefined) {
    grades.push({
      question: "goal_reached",
      correct: belief(answers["goal_reached"]) === expect.goalReached,
    });
  }
  if (expect.screenReady !== undefined) {
    grades.push({
      question: "screen_ready",
      correct: belief(answers["screen_ready"]) === expect.screenReady,
    });
  }
  if (expect.visualPresent !== undefined) {
    grades.push({
      question: VISUAL_PRESENT_QUESTION,
      correct: belief(answers[VISUAL_PRESENT_QUESTION]) === expect.visualPresent,
    });
  }
  if (expect.visualBox !== undefined) {
    const box = answers[VISUAL_BOX_QUESTION];
    const target = expect.visualBox;
    const correct =
      box !== undefined &&
      box.type === "box" &&
      inside((box.box.left + box.box.right) / 2, target.left, target.right) &&
      inside((box.box.top + box.box.bottom) / 2, target.top, target.bottom);
    grades.push({ question: VISUAL_BOX_QUESTION, correct });
  }
  return grades;
}

function choiceOf(answer: DecisionAnswer | undefined): string | null {
  return answer !== undefined && answer.type === "choice" ? answer.choice : null;
}

function belief(answer: DecisionAnswer | undefined): boolean | null {
  return answer !== undefined && answer.type === "noul" ? answer.noul >= 0.5 : null;
}

function inside(value: number, low: number, high: number): boolean {
  return value >= low && value <= high;
}

/** The value at a percentile of a sample, by nearest rank. */
export function percentile(values: readonly number[], fraction: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((first, second) => first - second);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[rank] ?? null;
}
