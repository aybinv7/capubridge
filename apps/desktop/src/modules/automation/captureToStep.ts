import type { FlowStep, TargetRef } from "@/types/automation.types";
import type { Observation } from "@/types/automation.types";
import { buildCandidates } from "./elementIndex";
import type { Candidate } from "./elementIndex";
import { createStepId } from "./flowEditorState";

export interface CapturePoint {
  x: number;
  y: number;
  nonce: number;
}

export interface CaptureResult {
  step: FlowStep;
  warning: string | null;
}

function containingCandidates(point: CapturePoint, observation: Observation): Candidate[] {
  const candidates = buildCandidates(observation);
  return candidates.filter((c) => {
    const [x1, y1, x2, y2] = c.bounds;
    return point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2;
  });
}

function innermost(candidates: Candidate[]): Candidate | null {
  if (candidates.length === 0) {
    return null;
  }
  let best = candidates[0]!;
  let bestArea = (best.bounds[2] - best.bounds[0]) * (best.bounds[3] - best.bounds[1]);
  for (const c of candidates.slice(1)) {
    const area = (c.bounds[2] - c.bounds[0]) * (c.bounds[3] - c.bounds[1]);
    if (area < bestArea) {
      best = c;
      bestArea = area;
    }
  }
  return best;
}

export function captureToStep(point: CapturePoint, observation: Observation): CaptureResult {
  const containing = containingCandidates(point, observation);
  const best = innermost(containing);
  if (best === null) {
    return {
      step: { id: createStepId(), op: "tap", target: { kind: "point", x: point.x, y: point.y } },
      warning: "point target will break on layout shift",
    };
  }
  if (best.cssSelector !== null) {
    return {
      step: {
        id: createStepId(),
        op: "tap",
        target: { kind: "selector", cssSelector: best.cssSelector },
      },
      warning: null,
    };
  }
  if (best.text !== null && best.text.trim() !== "") {
    return {
      step: {
        id: createStepId(),
        op: "tap",
        target: { kind: "text", text: best.text, exact: false },
      },
      warning: null,
    };
  }
  if (best.nativeIndex !== null) {
    return {
      step: {
        id: createStepId(),
        op: "tap",
        target: { kind: "nativeIndex", index: best.nativeIndex },
      },
      warning: "native index shifts across builds",
    };
  }
  return {
    step: { id: createStepId(), op: "tap", target: { kind: "nativeIndex", index: best.index } },
    warning: "native index shifts across builds",
  };
}

export function coalesceKeystrokes(chars: string[], target: TargetRef): FlowStep {
  return { id: createStepId(), op: "type", target, text: chars.join(""), verifyReadback: true };
}
