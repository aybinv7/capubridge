import type { Flow, FlowStep, StepOutcome } from "@/types/automation.types";
import type { RunViewStep } from "./runSource";
import type { PolicyId } from "./policies/types";
import type { RunLimits } from "./flowExecutor";
import { targetStrength } from "./flowEditorState";
import type { TargetStrength } from "./flowEditorState";

/** One row in the step canvas, shaped from a flow step and an optional run view. */
export interface StepRow {
  stepId: string;
  step: FlowStep;
  index: number;
  operation: string;
  targetSummary: string;
  targetStrength: TargetStrength | null;
  outcome: StepOutcome | null;
  error: string | null;
  durationMs: number | null;
  goalStepId: string | null;
  isGoal: boolean;
  confidence: number | null;
  verificationStatus: RunViewStep["verificationStatus"] | null;
  nestedRows: StepRow[];
}

/** The flattened list the virtualizer consumes, with nesting depth. */
export interface FlatRow {
  row: StepRow;
  depth: number;
}

/** Builds StepRow[] from a flow and an optional run view. */
export function buildStepRows(flow: Flow, runSteps: RunViewStep[] | null): StepRow[] {
  const runMap = new Map<string, RunViewStep>();
  if (runSteps !== null) {
    for (const step of runSteps) {
      runMap.set(step.stepId, step);
    }
  }

  const goalChildren = new Map<string, StepRow[]>();
  const rows: StepRow[] = [];
  const flowStepIds = new Set<string>();

  for (let index = 0; index < flow.steps.length; index += 1) {
    const step = flow.steps[index];
    if (step === undefined) {
      continue;
    }
    flowStepIds.add(step.id);
    const runStep = runMap.get(step.id) ?? null;
    const row = shapeRow(step, index, runStep);
    if (row.goalStepId !== null) {
      const children = goalChildren.get(row.goalStepId);
      if (children !== undefined) {
        children.push(row);
      } else {
        goalChildren.set(row.goalStepId, [row]);
      }
    } else {
      rows.push(row);
    }
  }

  if (runSteps !== null) {
    for (const runStep of runSteps) {
      if (flowStepIds.has(runStep.stepId)) {
        continue;
      }
      const goalId = runStep.goalStepId;
      if (goalId !== null && goalId !== undefined) {
        const step = findOrCreateFallback(runStep);
        const childRow = shapeRow(step, rows.length, runStep);
        const children = goalChildren.get(goalId);
        if (children !== undefined) {
          children.push(childRow);
        } else {
          goalChildren.set(goalId, [childRow]);
        }
      }
    }
  }

  for (const row of rows) {
    if (row.isGoal) {
      row.nestedRows = goalChildren.get(row.stepId) ?? [];
    }
  }

  return rows;
}

/** Flattens StepRow[] into a list for the virtualizer, with depth. */
export function flattenRows(rows: StepRow[]): FlatRow[] {
  const result: FlatRow[] = [];
  for (const row of rows) {
    result.push({ row, depth: 0 });
    for (const nested of row.nestedRows) {
      result.push({ row: nested, depth: 1 });
    }
  }
  return result;
}

/** Identifies the first failing row, or null when all passed. */
export function failingRowIndex(rows: StepRow[]): number | null {
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index]?.outcome === "failed") {
      return index;
    }
  }
  return null;
}

/**
 * Synthesizes a display flow from run steps for agent runs that have no
 * saved flow. A leading goal step with the run's goal id parents every
 * discovered step, so the canvas nests exactly like a flow run. The result
 * is for rendering only, never persisted.
 */
export function flowFromRunSteps(
  steps: RunViewStep[],
  options: {
    name: string;
    goal: string;
    goalStepId: string;
    policyId: PolicyId;
    limits: RunLimits;
  },
): Flow {
  const goalStep: FlowStep = {
    id: options.goalStepId,
    op: "goal",
    goal: options.goal,
    policyId: options.policyId,
    limits: options.limits,
    acknowledgedNotice: true,
  };
  const seen = new Set<string>([options.goalStepId]);
  const rest: FlowStep[] = [];
  for (const step of steps) {
    if (seen.has(step.stepId)) {
      continue;
    }
    seen.add(step.stepId);
    rest.push(findOrCreateFallback(step));
  }
  return {
    version: 1,
    id: `run-${options.goalStepId}`,
    name: options.name,
    appPackage: "",
    steps: [goalStep, ...rest],
  };
}

/** Classifies the strength of a step's target for the badge. */
export function rowTargetStrength(row: StepRow): TargetStrength | null {
  return row.targetStrength;
}

function shapeRow(step: FlowStep, index: number, runStep: RunViewStep | null): StepRow {
  const strength =
    step.op === "tap" || step.op === "longPress" || step.op === "type"
      ? targetStrength(step.target)
      : step.op === "swipe"
        ? "weak"
        : null;
  return {
    stepId: step.id,
    step,
    index,
    operation: step.op,
    targetSummary: summarizeTarget(step),
    targetStrength: strength,
    outcome: runStep?.outcome ?? null,
    error: runStep?.error ?? null,
    durationMs: runStep !== null ? ((runStep as { durationMs?: number }).durationMs ?? null) : null,
    goalStepId: step.op === "goal" ? null : (runStep?.goalStepId ?? null),
    isGoal: step.op === "goal",
    confidence: runStep?.decision.confidence ?? null,
    verificationStatus: runStep?.verificationStatus ?? null,
    nestedRows: [],
  };
}

function summarizeTarget(step: FlowStep): string {
  switch (step.op) {
    case "tap":
    case "longPress":
    case "type": {
      const target = step.target;
      if (target.kind === "selector") {
        return target.cssSelector;
      }
      if (target.kind === "text") {
        return `"${target.text}"`;
      }
      if (target.kind === "nativeIndex") {
        return `#${target.index}`;
      }
      return `${target.x},${target.y}`;
    }
    case "swipe":
      return `swipe ${step.from.x},${step.from.y} → ${step.to.x},${step.to.y}`;
    case "scroll":
      return step.direction;
    case "pressKey":
      return step.keycode;
    case "back":
      return "back";
    case "openApp":
      return step.packageName;
    case "wait":
      return `${step.durationMs}ms`;
    case "assert":
      return step.assertion.kind;
    case "goal":
      return step.goal;
  }
}

function findOrCreateFallback(runStep: RunViewStep): FlowStep {
  const op = runStep.decision.operation;
  const base = { id: runStep.stepId };
  switch (op) {
    case "tap":
      return {
        ...base,
        op: "tap" as const,
        target: runStep.decision.target ?? { kind: "point" as const, x: 0, y: 0 },
      };
    case "longPress":
      return {
        ...base,
        op: "longPress" as const,
        target: runStep.decision.target ?? { kind: "point" as const, x: 0, y: 0 },
      };
    case "type":
      return {
        ...base,
        op: "type" as const,
        target: runStep.decision.target ?? { kind: "point" as const, x: 0, y: 0 },
        text: runStep.decision.text ?? "",
      };
    case "back":
      return { ...base, op: "back" as const };
    case "openApp":
      return { ...base, op: "openApp" as const, packageName: runStep.decision.text ?? "" };
    case "pressKey":
      return { ...base, op: "pressKey" as const, keycode: runStep.decision.text ?? "" };
    case "wait":
      return { ...base, op: "wait" as const, durationMs: 0 };
    default:
      return { ...base, op: "back" as const };
  }
}

/** Which way a step moves in the canvas. */
export type MoveDirection = "up" | "down";

/** A resolved reorder, as the index pair `moveStepBy` takes. */
export interface RowMoveTarget {
  from: number;
  to: number;
}

/**
 * Resolves a reorder request to an index pair, or null when it is a no-op.
 *
 * Null covers every refusal the canvas must handle without erroring: the
 * first step moving up, the last moving down, an unknown id, and any step
 * produced inside a goal. Produced steps exist only in the run view, never in
 * `flow.steps`, so they are not found here and are therefore not reorderable
 * — a goal step always moves as one unit.
 */
export function moveTargetFor(
  flow: Flow,
  stepId: string,
  direction: MoveDirection,
): RowMoveTarget | null {
  const from = flow.steps.findIndex((step) => step.id === stepId);
  if (from < 0) {
    return null;
  }
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= flow.steps.length) {
    return null;
  }
  return { from, to };
}

/**
 * Whether the canvas may reorder or delete steps. A run in flight and a
 * recorded run are both read-only: the first because the executor is walking
 * the list, the second because a run is evidence and editing it would make
 * the trace describe a flow that never ran.
 */
export function canEditStructure(state: { isRunning: boolean; hasRun: boolean }): boolean {
  return !state.isRunning && !state.hasRun;
}
