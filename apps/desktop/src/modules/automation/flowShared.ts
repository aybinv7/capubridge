import type { Assertion, FlowStepOp } from "@/types/automation.types";
import type { PolicyId } from "@/modules/automation/policies/types";

/** One schema violation, located by a path such as `steps[2].target`. */
export interface FlowParseError {
  path: string;
  message: string;
}

/** Step operations understood by the schema. */
export const STEP_OPS: readonly FlowStepOp[] = [
  "tap",
  "longPress",
  "type",
  "swipe",
  "scroll",
  "pressKey",
  "back",
  "openApp",
  "wait",
  "assert",
  "goal",
];

/** Policy ids understood by the schema. */
export const POLICY_IDS: readonly PolicyId[] = ["rules", "jev", "embedded"];

/** Assertion kinds understood by the schema. */
export const ASSERTION_KINDS: readonly Assertion["kind"][] = [
  "visible",
  "notVisible",
  "textEquals",
  "textContains",
  "urlMatches",
  "dbRowExists",
  "networkStatus",
  "consoleClean",
];

/** Scroll directions understood by the schema. */
export const SCROLL_DIRECTIONS: readonly string[] = ["up", "down", "left", "right"];

/**
 * Reads a non-empty string value. Returns null when the value does not qualify.
 */
export function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Reports whether the value is a finite number.
 */
export function isFiniteNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Reports whether the value is a positive finite number.
 */
export function isPositiveNumber(value: unknown): boolean {
  return isFiniteNumber(value) && (value as number) > 0;
}

/**
 * Reports whether the value is a non-negative finite number.
 */
export function isNonNegativeNumber(value: unknown): boolean {
  return isFiniteNumber(value) && (value as number) >= 0;
}

/**
 * Reports whether the value is a positive integer.
 */
export function isPositiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Reports whether the value is a non-negative integer.
 */
export function isNonNegativeInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Formats an unknown value for an error message without throwing.
 */ export function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

/**
 * Renders an unknown failure for an error message without throwing.
 */
export function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown error";
}

/**
 * Default sleep between polls and retries.
 */
export function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
