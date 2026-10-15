import type { Flow, FlowStep, FlowStepOp, TargetRef } from "@/types/automation.types";
import { parseFlow, serializeFlow, validateStep } from "./flowSchema";
import { STEP_OPS } from "./flowShared";

/** Step operations the editor can add. Goal steps stay out until the canvas workbench authors them. */
export const EDITABLE_STEP_OPS: readonly FlowStepOp[] = STEP_OPS.filter((op) => op !== "goal");

/** How strongly a target anchors a step. Point-only steps break on any layout shift. */
export type TargetStrength = "strong" | "fair" | "weak";

/** Whether a flow can run, and which step blocks it when it cannot. */
export interface FlowRunnability {
  runnable: boolean;
  reason: string | null;
}

/**
 * Creates a valid default step for the operation. Every default passes
 * validateStep, so adding never produces a broken flow.
 */
export function createStep(op: FlowStepOp): FlowStep {
  const id = createStepId();
  switch (op) {
    case "tap":
      return { id, op, target: { kind: "selector", cssSelector: "#selector" } };
    case "longPress":
      return { id, op, target: { kind: "selector", cssSelector: "#selector" } };
    case "type":
      return {
        id,
        op,
        target: { kind: "selector", cssSelector: "input" },
        text: "",
        verifyReadback: true,
      };
    case "swipe":
      return { id, op, from: { x: 0, y: 0 }, to: { x: 0, y: 100 } };
    case "scroll":
      return { id, op, direction: "down" };
    case "pressKey":
      return { id, op, keycode: "KEYCODE_ENTER" };
    case "back":
      return { id, op };
    case "openApp":
      return { id, op, packageName: "com.example.app" };
    case "wait":
      return { id, op, durationMs: 1000 };
    case "assert":
      return {
        id,
        op,
        assertion: {
          kind: "visible",
          target: { kind: "selector", cssSelector: "#selector" },
          source: "dom",
        },
      };
  }
  throw new Error("goal steps are built by createGoalStep, not the step factory");
}

/**
 * Moves a step within the list, preserving ids. Out-of-range moves return
 * the list unchanged.
 */
export function moveStep(steps: FlowStep[], from: number, to: number): FlowStep[] {
  if (from < 0 || from >= steps.length || to < 0 || to >= steps.length || from === to) {
    return [...steps];
  }
  const reordered = [...steps];
  const [moved] = reordered.splice(from, 1);
  if (moved === undefined) {
    return [...steps];
  }
  reordered.splice(to, 0, moved);
  return reordered;
}

/**
 * Deletes the step at the index, leaving the rest in order.
 */
export function deleteStep(steps: FlowStep[], index: number): FlowStep[] {
  return steps.filter((_, position) => position !== index);
}

/**
 * Replaces the step at the index.
 */
export function replaceStep(steps: FlowStep[], index: number, step: FlowStep): FlowStep[] {
  return steps.map((entry, position) => (position === index ? step : entry));
}

/**
 * Duplicates a flow with a new id and an unchanged step list.
 */
export function duplicateFlow(flow: Flow): Flow {
  const copy = JSON.parse(serializeFlow(flow)) as Record<string, unknown>;
  copy["id"] = createStepId();
  copy["name"] = `${flow.name} copy`;
  const parsed = parseFlow(copy);
  if (!parsed.ok) {
    throw new Error("cannot duplicate an invalid flow");
  }
  return parsed.flow;
}

/**
 * Reports whether a flow can run. An invalid step blocks the run, and the
 * reason names the step position so the editor can reveal it.
 */
export function flowRunnability(flow: Flow): FlowRunnability {
  if (flow.steps.length === 0) {
    return { runnable: false, reason: "flow has no steps" };
  }
  for (let index = 0; index < flow.steps.length; index += 1) {
    const errors = validateStep(flow.steps[index]);
    if (errors.length > 0) {
      const first = errors[0];
      return {
        runnable: false,
        reason: `step ${index + 1} is invalid: ${first === undefined ? "unknown error" : first.message}`,
      };
    }
  }
  return { runnable: true, reason: null };
}

/**
 * Rates how strongly a target anchors its step. Selector-anchored steps
 * survive layout shifts; raw points do not.
 */
export function targetStrength(target: TargetRef | undefined): TargetStrength | null {
  if (target === undefined) {
    return null;
  }
  switch (target.kind) {
    case "selector":
      return "strong";
    case "text":
    case "nativeIndex":
      return "fair";
    case "point":
      return "weak";
  }
}

/**
 * Generates a step id without any runtime dependency.
 */
export function createStepId(): string {
  const host = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (host.crypto !== undefined && typeof host.crypto.randomUUID === "function") {
    return host.crypto.randomUUID();
  }
  return `step-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}
