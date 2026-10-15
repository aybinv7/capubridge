import type { FlowStep, TargetRef } from "@/types/automation.types";
import type { AssertionResult } from "./assertions";
import type { RunViewStep } from "./runSource";
import { validateStepAt } from "./flowValidate";
import type { FlowParseError } from "./flowShared";

/** Draft vs run mode, derived from selection. */
export type InspectorMode = "draft" | "run";

/** Assertion row exposing expected vs observed. */
export interface InspectorAssertionRow {
  kind: string;
  expected: string | null;
  observed: string;
  passed: boolean;
}

/** Screenshot state, absent rather than broken. */
export interface InspectorScreenshot {
  present: boolean;
  ref: string | null;
}

/** Details for run mode. */
export interface InspectorRunDetail {
  decision: string;
  confidence: number;
  resolvedTarget: string | null;
  strategy: string | null;
  error: string | null;
  assertions: InspectorAssertionRow[];
  screenshot: InspectorScreenshot;
  replayHref: string | null;
  fallbackLabel: string | null;
  rawAnswer: string | null;
  signals: RunViewStep["signals"];
  timings: RunViewStep["timings"];
  dispatchStatus: RunViewStep["dispatchStatus"] | null;
  verificationStatus: RunViewStep["verificationStatus"] | null;
  screenChanged: boolean | null;
  beforeFingerprint: string | null;
  afterFingerprint: string | null;
}

/** Full inspector state, no leaking between selections. */
export interface InspectorState {
  mode: InspectorMode;
  step: FlowStep | null;
  errors: FlowParseError[];
  runDetail: InspectorRunDetail | null;
}

export function inspectorMode(step: FlowStep | null, runStep: RunViewStep | null): InspectorMode {
  if (runStep !== null) {
    return "run";
  }
  if (step === null) {
    return "draft";
  }
  return "draft";
}

export function inspectorState(
  step: FlowStep | null,
  runStep: RunViewStep | null,
  filePath: string | null,
): InspectorState {
  const mode = inspectorMode(step, runStep);
  if (mode === "run" && runStep !== null) {
    return {
      mode,
      step,
      errors: [],
      runDetail: runDetailFor(runStep, filePath),
    };
  }
  const errors = step === null ? [] : validateStepAt(step, "step");
  return { mode: "draft", step, errors, runDetail: null };
}

export function withTarget(step: FlowStep, target: TargetRef | undefined): FlowStep {
  if (step.op === "tap" || step.op === "longPress" || step.op === "type") {
    if (target === undefined) {
      return { ...step, target: { kind: "point", x: 0, y: 0 } } as FlowStep;
    }
    return { ...step, target } as FlowStep;
  }
  return step;
}

export function replayHref(filePath: string | null, tMs: number | null): string | null {
  if (filePath === null || tMs === null || !Number.isFinite(tMs)) {
    return null;
  }
  return `/replay?file=${encodeURIComponent(filePath)}&t=${Math.max(0, Math.round(tMs))}`;
}

export function runDetailFor(runStep: RunViewStep, filePath: string | null): InspectorRunDetail {
  const decision = runStep.decision.operation;
  const confidence = runStep.decision.confidence;
  const resolvedTarget =
    runStep.resolvedTarget === null
      ? null
      : `${runStep.resolvedTarget.strategy} (${runStep.resolvedTarget.x}, ${runStep.resolvedTarget.y})${runStep.resolvedTarget.executor === undefined ? "" : ` · ${runStep.resolvedTarget.executor}`}`;
  const strategy = runStep.resolvedTarget?.strategy ?? null;
  const fallbackLabel = fallbackFor(runStep);
  const assertions = runStep.assertions.map(assertionRow);
  const screenshot: InspectorScreenshot =
    runStep.screenshotRef === ""
      ? { present: false, ref: null }
      : { present: true, ref: runStep.screenshotRef };
  const replayOffset = runStep.replayOffsetMs ?? null;
  return {
    decision,
    confidence,
    resolvedTarget,
    strategy,
    error: runStep.error,
    assertions,
    screenshot,
    replayHref: replayHref(filePath, replayOffset),
    fallbackLabel,
    rawAnswer:
      runStep.decision.detail === null || runStep.decision.detail === undefined
        ? null
        : JSON.stringify(runStep.decision.detail, null, 2),
    signals: runStep.signals,
    timings: runStep.timings,
    dispatchStatus: runStep.dispatchStatus ?? null,
    verificationStatus: runStep.verificationStatus ?? null,
    screenChanged: runStep.screenChanged ?? null,
    beforeFingerprint: runStep.beforeFingerprint ?? null,
    afterFingerprint: runStep.afterFingerprint ?? null,
  };
}

function fallbackFor(runStep: RunViewStep): string | null {
  const strategy = runStep.resolvedTarget?.strategy ?? null;
  if (strategy === null) {
    return null;
  }
  if (strategy === "selector") {
    return "selector match";
  }
  if (strategy === "text") {
    return "text fallback";
  }
  if (strategy === "nativeIndex") {
    return "native index fallback";
  }
  return "point fallback";
}

function assertionRow(result: AssertionResult): InspectorAssertionRow {
  const assertion = result.assertion as Record<string, unknown>;
  let expected: string | null = null;
  if (typeof assertion["expected"] === "string") {
    expected = assertion["expected"] as string;
  } else if (typeof assertion["substring"] === "string") {
    expected = assertion["substring"] as string;
  } else if (typeof assertion["pattern"] === "string") {
    expected = assertion["pattern"] as string;
  }
  return {
    kind: typeof assertion["kind"] === "string" ? (assertion["kind"] as string) : "unknown",
    expected,
    observed: result.observed,
    passed: result.passed,
  };
}
