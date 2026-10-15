import type { AssertionResult } from "./assertions";
import type {
  Decision,
  Flow,
  FlowStep,
  RunStatus,
  StepRecord,
  TargetRef,
} from "@/types/automation.types";
import { createStepId } from "./flowEditorState";
import { parseFlow, serializeFlow } from "./flowSchema";
import type { AutomationCapuEvent } from "@/types/replay.types";

/** One recorded step eligible for promotion, with its assertion results. */
export interface PromotableStep {
  record: StepRecord;
  assertions: AssertionResult[];
  step?: FlowStep;
}

/** A recorded run distilled to promotable steps. */
export interface RunTrace {
  runId: string;
  status: RunStatus;
  policyId: string;
  steps: PromotableStep[];
}

/** Options for promoting a run. */
export interface PromoteOptions {
  name: string;
  appPackage: string;
}

/** Options for promoting a subset of a run. */
export interface SubsetPromoteOptions extends PromoteOptions {
  stepIds: string[];
}

/** Why a promoted step needs attention, or what was left out. */
export interface PromoteWarning {
  stepId: string;
  kind: "point-target" | "unstable-target" | "dropped" | "incomplete";
  message: string;
}

/** A promoted flow plus the warnings that tell the user where it may break. */
export interface PromoteResult {
  flow: Flow;
  warnings: PromoteWarning[];
}

/** Milliseconds of auto-wait budget granted per collapsed wait decision. */
const WAIT_COLLAPSE_MS = 1000;

/**
 * Converts a recorded run into a valid manual flow. Target preference is
 * strict: the CSS selector the step resolved through, then text, then
 * native index, then a point. Consecutive waits collapse into the following
 * step's timeout instead of emitting sleeps; retried duplicates keep only
 * the last attempt; assertion results come forward as assert steps.
 */
export function promoteRun(run: RunTrace, options: PromoteOptions): PromoteResult {
  const warnings: PromoteWarning[] = [];
  const steps: FlowStep[] = [];
  const seen = new Map<string, PromotableStep>();
  for (const step of run.steps) {
    if (seen.has(step.record.stepId)) {
      warnings.push({
        stepId: step.record.stepId,
        kind: "dropped",
        message: `superseded attempt of step ${step.record.stepId} dropped`,
      });
    }
    seen.set(step.record.stepId, step);
  }
  let pendingWaitMs = 0;
  let pendingWaits = 0;
  for (const step of seen.values()) {
    if (step.record.decision.operation === "wait") {
      pendingWaits += 1;
      pendingWaitMs += step.step?.op === "wait" ? step.step.durationMs : WAIT_COLLAPSE_MS;
      continue;
    }
    if (step.record.decision.operation === "done") {
      continue;
    }
    const promoted = promoteStep(step);
    if (promoted === null) {
      warnings.push({
        stepId: step.record.stepId,
        kind: "dropped",
        message: `step ${step.record.stepId} carries no actionable target and was dropped`,
      });
      continue;
    }
    if (pendingWaitMs > 0) {
      promoted.step.timeoutMs = Math.max(promoted.step.timeoutMs ?? 0, pendingWaitMs);
      pendingWaitMs = 0;
      pendingWaits = 0;
    }
    steps.push(promoted.step);
    warnings.push(...promoted.warnings);
    for (const [index, assertion] of step.assertions.entries()) {
      steps.push({
        id: `${step.record.stepId}-assert-${index}`,
        op: "assert",
        assertion: assertion.assertion,
      });
    }
  }
  if (pendingWaits > 0) {
    warnings.push({
      stepId: "",
      kind: "dropped",
      message: `${pendingWaits} trailing wait decisions dropped`,
    });
  }
  if (run.status === "cancelled" || run.status === "halted") {
    warnings.push({
      stepId: "",
      kind: "incomplete",
      message: `run ${run.status}; promoted the completed prefix`,
    });
  }
  const flow: Flow = {
    version: 1,
    id: createStepId(),
    name: options.name,
    appPackage: options.appPackage,
    steps,
  };
  const parsed = parseFlow(JSON.parse(serializeFlow(flow)) as unknown);
  if (!parsed.ok) {
    throw new Error(
      `promoted flow does not validate: ${parsed.errors.map((error) => error.path).join(", ")}`,
    );
  }
  return { flow: parsed.flow, warnings };
}

/**
 * Promotes only the records whose stepId appears in `stepIds`, preserving
 * the original order. Waits immediately before the first kept step raise
 * that step's timeout; trailing waits are dropped with a warning. The
 * result validates through parseFlow.
 */
export function promoteSteps(run: RunTrace, options: SubsetPromoteOptions): PromoteResult {
  const keep = new Set(options.stepIds);
  const warnings: PromoteWarning[] = [];
  const steps: FlowStep[] = [];
  const seen = new Map<string, PromotableStep>();
  let leadingWaitMs = 0;
  let leadingWaits = 0;
  let seenFirstKept = false;
  for (const step of run.steps) {
    if (!keep.has(step.record.stepId)) {
      if (!seenFirstKept && step.record.decision.operation === "wait") {
        leadingWaits += 1;
        leadingWaitMs += step.step?.op === "wait" ? step.step.durationMs : WAIT_COLLAPSE_MS;
      }
      continue;
    }
    seenFirstKept = true;
    if (seen.has(step.record.stepId)) {
      warnings.push({
        stepId: step.record.stepId,
        kind: "dropped",
        message: `superseded attempt of step ${step.record.stepId} dropped`,
      });
    }
    seen.set(step.record.stepId, step);
  }
  let pendingWaitMs = leadingWaitMs;
  let pendingWaits = leadingWaits;
  for (const step of seen.values()) {
    if (step.record.decision.operation === "wait") {
      pendingWaits += 1;
      pendingWaitMs += step.step?.op === "wait" ? step.step.durationMs : WAIT_COLLAPSE_MS;
      continue;
    }
    if (step.record.decision.operation === "done") {
      continue;
    }
    const promoted = promoteStep(step);
    if (promoted === null) {
      warnings.push({
        stepId: step.record.stepId,
        kind: "dropped",
        message: `step ${step.record.stepId} carries no actionable target and was dropped`,
      });
      continue;
    }
    if (pendingWaitMs > 0) {
      promoted.step.timeoutMs = Math.max(promoted.step.timeoutMs ?? 0, pendingWaitMs);
      pendingWaitMs = 0;
      pendingWaits = 0;
    }
    steps.push(promoted.step);
    warnings.push(...promoted.warnings);
    for (const [index, assertion] of step.assertions.entries()) {
      steps.push({
        id: `${step.record.stepId}-assert-${index}`,
        op: "assert",
        assertion: assertion.assertion,
      });
    }
  }
  if (pendingWaits > 0) {
    warnings.push({
      stepId: "",
      kind: "dropped",
      message: `${pendingWaits} trailing wait decisions dropped`,
    });
  }
  if (run.status === "cancelled" || run.status === "halted") {
    warnings.push({
      stepId: "",
      kind: "incomplete",
      message: `run ${run.status}; promoted the completed prefix`,
    });
  }
  const flow: Flow = {
    version: 1,
    id: createStepId(),
    name: options.name,
    appPackage: options.appPackage,
    steps,
  };
  const parsed = parseFlow(JSON.parse(serializeFlow(flow)) as unknown);
  if (!parsed.ok) {
    throw new Error(
      `promoted flow does not validate: ${parsed.errors.map((error) => error.path).join(", ")}`,
    );
  }
  return { flow: parsed.flow, warnings };
}
export function runTraceFromEvents(
  runId: string,
  status: RunStatus,
  policyId: string,
  events: AutomationCapuEvent[],
): RunTrace {
  return {
    runId,
    status,
    policyId,
    steps: events.map((event) => ({
      record: {
        stepId: event.data.stepId,
        startedAt: event.t,
        endedAt: event.t,
        decision: event.data.decision,
        resolvedTarget: event.data.resolvedTarget,
        outcome: event.data.outcome,
        error: event.data.error,
        screenshotRef: event.data.screenshot ?? "",
      },
      assertions: event.data.assertions,
    })),
  };
}

/** One promoted action step plus its warnings. */
interface PromotedStep {
  step: FlowStep;
  warnings: PromoteWarning[];
}

/**
 * Promotes one recorded step to a flow step. Returns null when the step
 * carries nothing actionable.
 */
function promoteStep(step: PromotableStep): PromotedStep | null {
  const { record } = step;
  if (step.step !== undefined && step.step.op === record.decision.operation) {
    return { step: { ...step.step, id: record.stepId }, warnings: [] };
  }
  const base = { id: record.stepId, label: record.decision.reason } as const;
  switch (record.decision.operation) {
    case "tap":
    case "longPress":
    case "type": {
      const target = promoteTarget(record);
      if (target === null) {
        return null;
      }
      const warnings: PromoteWarning[] = [...target.warnings];
      if (record.decision.operation === "tap") {
        return { step: { ...base, op: "tap", target: target.ref }, warnings };
      }
      if (record.decision.operation === "longPress") {
        return { step: { ...base, op: "longPress", target: target.ref }, warnings };
      }
      return {
        step: {
          ...base,
          op: "type",
          target: target.ref,
          text: record.decision.text ?? "",
          verifyReadback: true,
        },
        warnings,
      };
    }
    case "pressKey":
      if (record.decision.text === undefined || record.decision.text === "") {
        return null;
      }
      return { step: { ...base, op: "pressKey", keycode: record.decision.text }, warnings: [] };
    case "back":
      return { step: { ...base, op: "back" }, warnings: [] };
    case "openApp":
      if (record.decision.text === undefined || record.decision.text === "") {
        return null;
      }
      return {
        step: { ...base, op: "openApp", packageName: record.decision.text },
        warnings: [],
      };
    case "swipe":
    case "scroll":
    case "wait":
    case "assert":
    case "done":
    case "blocked":
    case "goal":
      return null;
  }
}

/** A promoted target plus its warnings. */
interface PromotedTarget {
  ref: TargetRef;
  warnings: PromoteWarning[];
}

/**
 * Selects the most stable target the run actually used: the selector the
 * step resolved through, then text, then native index, then the recorded
 * point. Points and index-only matches warn because they break first.
 */
function promoteTarget(record: StepRecord): PromotedTarget | null {
  const decision: Decision = record.decision;
  const warnings: PromoteWarning[] = [];
  if (decision.target !== undefined) {
    switch (decision.target.kind) {
      case "selector":
        return {
          ref: decision.target,
          warnings: selectorWarnings(record, decision.target.cssSelector),
        };
      case "text":
        return { ref: decision.target, warnings };
      case "nativeIndex":
        warnings.push({
          stepId: record.stepId,
          kind: "unstable-target",
          message: `step ${record.stepId} targets native index ${decision.target.index}, which shifts across builds`,
        });
        return { ref: decision.target, warnings };
      case "point":
        break;
    }
  }
  if (record.resolvedTarget !== null) {
    warnings.push({
      stepId: record.stepId,
      kind: "point-target",
      message: `step ${record.stepId} resolved only to a point and will break on any layout shift`,
    });
    return {
      ref: { kind: "point", x: record.resolvedTarget.x, y: record.resolvedTarget.y },
      warnings,
    };
  }
  return null;
}

/**
 * Warns on selector shapes that look generated: hashed class names, scoped
 * style attributes, positional pseudo-classes and hex-suffixed ids.
 */
function selectorWarnings(record: StepRecord, cssSelector: string): PromoteWarning[] {
  if (
    /\.css-[0-9a-z]+/.test(cssSelector) ||
    /\[data-v-[0-9a-f]+\]/.test(cssSelector) ||
    /:nth-child\(\d+\)/.test(cssSelector) ||
    /#[a-z]+-[0-9a-f]{4,}/.test(cssSelector)
  ) {
    return [
      {
        stepId: record.stepId,
        kind: "unstable-target",
        message: `step ${record.stepId} selector "${cssSelector}" looks generated`,
      },
    ];
  }
  return [];
}
