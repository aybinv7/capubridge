import type { DecisionOperation } from "@/types/automation.types";

/**
 * Operations Jev may answer, extending the step vocabulary with loop control.
 *
 * These are `criteria`, not bare options: the API declares a choice as a map
 * of option to description, and the model reads those descriptions literally.
 * A bare `"wait"` carries no signal about when waiting is the right answer,
 * so each description states the condition that selects it.
 */
export const OPERATION_CRITERIA: Record<
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
export const TARGETING_OPERATIONS: readonly DecisionOperation[] = ["tap", "longPress", "type"];

/** Operations a visual box can target: a point can be pressed, never typed into. */
export const VISUAL_OPERATIONS: readonly DecisionOperation[] = ["tap", "longPress"];

/** Reports whether the value names a known operation. */
export function isOperation(value: string): value is DecisionOperation {
  return (OPERATION_OPTIONS as string[]).includes(value);
}
