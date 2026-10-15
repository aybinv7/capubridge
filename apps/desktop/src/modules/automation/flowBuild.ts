import type {
  Assertion,
  FlowStep,
  FlowStepBase,
  FlowStepOp,
  PresalioMilestone,
  RetryPolicy,
  RunLimits,
  ScreenPoint,
  TargetRef,
} from "@/types/automation.types";
import type { PolicyId } from "@/modules/automation/policies/types";
import {
  POLICY_IDS,
  SCROLL_DIRECTIONS,
  STEP_OPS,
  isFiniteNumber,
  isNonNegativeInteger,
  isNonNegativeNumber,
  isPositiveInteger,
  isPositiveNumber,
  readNonEmptyString,
} from "./flowShared";

/**
 * Builds a typed step from a value that already passed validation. Returns
 * null when the value cannot be shaped, keeping parseFlow total.
 */
export function buildStep(record: Record<string, unknown>): FlowStep | null {
  const op = record["op"] as FlowStepOp;
  const id = readNonEmptyString(record["id"]);
  if (id === null || !STEP_OPS.includes(op)) {
    return null;
  }
  const base = readBase(record, id);
  switch (op) {
    case "tap": {
      const target = readTarget(record["target"]);
      return target === null ? null : { ...base, op, target };
    }
    case "longPress": {
      const target = readTarget(record["target"]);
      if (target === null) {
        return null;
      }
      const step: FlowStep = { ...base, op, target };
      if (isPositiveNumber(record["durationMs"]) && step.op === "longPress") {
        step.durationMs = record["durationMs"] as number;
      }
      return step;
    }
    case "type": {
      const target = readTarget(record["target"]);
      if (target === null || typeof record["text"] !== "string") {
        return null;
      }
      return {
        ...base,
        op,
        target,
        text: record["text"],
        verifyReadback:
          typeof record["verifyReadback"] === "boolean" ? record["verifyReadback"] : true,
      };
    }
    case "swipe": {
      const from = readPoint(record["from"]);
      const to = readPoint(record["to"]);
      if (from === null || to === null) {
        return null;
      }
      const step: FlowStep = { ...base, op, from, to };
      if (isPositiveNumber(record["durationMs"]) && step.op === "swipe") {
        step.durationMs = record["durationMs"] as number;
      }
      return step;
    }
    case "scroll": {
      if (
        typeof record["direction"] !== "string" ||
        !SCROLL_DIRECTIONS.includes(record["direction"])
      ) {
        return null;
      }
      const step: FlowStep = {
        ...base,
        op,
        direction: record["direction"] as "up" | "down" | "left" | "right",
      };
      if (isPositiveNumber(record["distance"]) && step.op === "scroll") {
        step.distance = record["distance"] as number;
      }
      if (step.op === "scroll" && record["target"] !== undefined) {
        const target = readTarget(record["target"]);
        if (target === null) {
          return null;
        }
        step.target = target;
      }
      return step;
    }
    case "pressKey": {
      const keycode = readNonEmptyString(record["keycode"]);
      return keycode === null ? null : { ...base, op, keycode };
    }
    case "back": {
      return { ...base, op };
    }
    case "openApp": {
      const packageName = readNonEmptyString(record["packageName"]);
      return packageName === null ? null : { ...base, op, packageName };
    }
    case "wait": {
      if (!isPositiveNumber(record["durationMs"])) {
        return null;
      }
      return { ...base, op, durationMs: record["durationMs"] as number };
    }
    case "assert": {
      const assertion = readAssertion(record["assertion"]);
      return assertion === null ? null : { ...base, op, assertion };
    }
    case "goal": {
      const goal = readNonEmptyString(record["goal"]);
      const policyId = readPolicyId(record["policyId"]);
      const limits = readRunLimits(record["limits"]);
      if (goal === null || policyId === null || limits === null) {
        return null;
      }
      return {
        ...base,
        op,
        goal,
        policyId,
        limits,
        acknowledgedNotice:
          typeof record["acknowledgedNotice"] === "boolean" ? record["acknowledgedNotice"] : false,
      };
    }
  }
  return null;
}

/**
 * Reads the fields every step carries.
 */
function readBase(record: Record<string, unknown>, id: string): FlowStepBase {
  const base: FlowStepBase = { id };
  if (typeof record["label"] === "string") {
    base.label = record["label"];
  }
  if (isPresalioMilestone(record["acceptanceMilestone"])) {
    base.acceptanceMilestone = record["acceptanceMilestone"];
  }
  if (isPositiveNumber(record["timeoutMs"])) {
    base.timeoutMs = record["timeoutMs"] as number;
  }
  const retry = readRetry(record["retry"]);
  if (retry !== null) {
    base.retry = retry;
  }
  if (typeof record["continueOnFailure"] === "boolean") {
    base.continueOnFailure = record["continueOnFailure"];
  }
  return base;
}

function isPresalioMilestone(value: unknown): value is PresalioMilestone {
  return [
    "app-opened",
    "location-obstacle-cleared",
    "next-stop-opened",
    "three-products-selected",
    "quantities-set-to-two",
    "order-reviewed",
    "order-confirmed",
    "report-returned",
  ].includes(value as string);
}

/**
 * Reads a retry policy value. Returns null when absent or malformed.
 */
function readRetry(value: unknown): RetryPolicy | null {
  if (value === undefined || typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!isPositiveInteger(record["maxAttempts"])) {
    return null;
  }
  const retry: RetryPolicy = { maxAttempts: record["maxAttempts"] as number };
  if (isNonNegativeNumber(record["delayMs"])) {
    retry.delayMs = record["delayMs"] as number;
  }
  return retry;
}

/**
 * Reads a policy id value. Returns null when malformed.
 */
function readPolicyId(value: unknown): PolicyId | null {
  if (typeof value !== "string") {
    return null;
  }
  const policyId = value as PolicyId;
  return POLICY_IDS.includes(policyId) ? policyId : null;
}

/**
 * Reads per-goal run limits. Returns null when absent or malformed.
 */
function readRunLimits(value: unknown): RunLimits | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    !isPositiveNumber(record["maxSteps"]) ||
    !isPositiveNumber(record["maxDurationMs"]) ||
    !isPositiveNumber(record["maxConsecutiveFailures"])
  ) {
    return null;
  }
  return {
    maxSteps: record["maxSteps"] as number,
    maxDurationMs: record["maxDurationMs"] as number,
    maxConsecutiveFailures: record["maxConsecutiveFailures"] as number,
  };
}

/**
 * Reads a target reference value. Returns null when malformed.
 */
function readTarget(value: unknown): TargetRef | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  switch (record["kind"]) {
    case "selector": {
      const cssSelector = readNonEmptyString(record["cssSelector"]);
      return cssSelector === null ? null : { kind: "selector", cssSelector };
    }
    case "text": {
      if (typeof record["text"] !== "string" || typeof record["exact"] !== "boolean") {
        return null;
      }
      return { kind: "text", text: record["text"], exact: record["exact"] };
    }
    case "nativeIndex": {
      if (!isNonNegativeInteger(record["index"])) {
        return null;
      }
      return { kind: "nativeIndex", index: record["index"] as number };
    }
    case "point": {
      const point = readPoint(value);
      return point === null ? null : { kind: "point", x: point.x, y: point.y };
    }
    default:
      return null;
  }
}

/**
 * Reads a screen point value. Returns null when malformed.
 */
function readPoint(value: unknown): ScreenPoint | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!isFiniteNumber(record["x"]) || !isFiniteNumber(record["y"])) {
    return null;
  }
  return { x: record["x"] as number, y: record["y"] as number };
}

/**
 * Reads an assertion value. Returns null when malformed.
 */
function readAssertion(value: unknown): Assertion | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const kind = record["kind"] as Assertion["kind"];
  switch (kind) {
    case "visible":
    case "notVisible": {
      const target = readTarget(record["target"]);
      const source = record["source"];
      if (target === null || (source !== "dom" && source !== "native")) {
        return null;
      }
      return { kind, target, source };
    }
    case "textEquals": {
      const target = readTarget(record["target"]);
      if (target === null || typeof record["expected"] !== "string") {
        return null;
      }
      return { kind: "textEquals", target, expected: record["expected"] };
    }
    case "textContains": {
      const target = readTarget(record["target"]);
      if (target === null || typeof record["substring"] !== "string") {
        return null;
      }
      return { kind: "textContains", target, substring: record["substring"] };
    }
    case "urlMatches": {
      const pattern = readNonEmptyString(record["pattern"]);
      return pattern === null ? null : { kind: "urlMatches", pattern };
    }
    case "dbRowExists": {
      const database = readNonEmptyString(record["database"]);
      const store = readNonEmptyString(record["store"]);
      const key = readNonEmptyString(record["key"]);
      return database === null || store === null || key === null
        ? null
        : { kind: "dbRowExists", database, store, key };
    }
    case "networkStatus": {
      const urlPattern = readNonEmptyString(record["urlPattern"]);
      if (urlPattern === null || !isNonNegativeInteger(record["status"])) {
        return null;
      }
      const assertion: Assertion = {
        kind: "networkStatus",
        urlPattern,
        status: record["status"] as number,
      };
      if (typeof record["method"] === "string" && assertion.kind === "networkStatus") {
        assertion.method = record["method"];
      }
      return assertion;
    }
    case "consoleClean": {
      if (record["level"] !== "warn" && record["level"] !== "error") {
        return null;
      }
      const assertion: Assertion = { kind: "consoleClean", level: record["level"] };
      if (Array.isArray(record["ignorePatterns"]) && assertion.kind === "consoleClean") {
        const patterns = record["ignorePatterns"] as unknown[];
        if (patterns.every((entry: unknown) => typeof entry === "string")) {
          assertion.ignorePatterns = patterns as string[];
        } else {
          return null;
        }
      }
      return assertion;
    }
    default:
      return null;
  }
}
