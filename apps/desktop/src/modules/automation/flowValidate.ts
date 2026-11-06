import {
  PRESALIO_ORDER_MILESTONES,
  type Assertion,
  type FlowStepOp,
} from "@/types/automation.types";
import type { PolicyId } from "@/modules/automation/policies/types";
import type { FlowParseError } from "./flowShared";
import { isRemovedArtemis, REMOVED_ARTEMIS_MESSAGE } from "./removedPolicies";
import {
  ASSERTION_KINDS,
  POLICY_IDS,
  SCROLL_DIRECTIONS,
  STEP_OPS,
  formatValue,
  isFiniteNumber,
  isNonNegativeInteger,
  isNonNegativeNumber,
  isPositiveInteger,
  isPositiveNumber,
  readNonEmptyString,
} from "./flowShared";

/**
 * Validates one step value, locating errors under the given base path.
 */
export function validateStepAt(step: unknown, path: string): FlowParseError[] {
  const errors: FlowParseError[] = [];
  if (typeof step !== "object" || step === null || Array.isArray(step)) {
    return [{ path, message: "step must be an object" }];
  }
  const record = step as Record<string, unknown>;

  const id = readNonEmptyString(record["id"]);
  if (id === null) {
    errors.push({ path: `${path}.id`, message: "step id must be a non-empty string" });
  }
  if (record["label"] !== undefined && typeof record["label"] !== "string") {
    errors.push({ path: `${path}.label`, message: "step label must be a string when present" });
  }
  if (record["timeoutMs"] !== undefined && !isPositiveNumber(record["timeoutMs"])) {
    errors.push({
      path: `${path}.timeoutMs`,
      message: "step timeoutMs must be a positive number when present",
    });
  }
  errors.push(...validateRetry(record["retry"], `${path}.retry`));
  if (
    record["continueOnFailure"] !== undefined &&
    typeof record["continueOnFailure"] !== "boolean"
  ) {
    errors.push({
      path: `${path}.continueOnFailure`,
      message: "step continueOnFailure must be a boolean when present",
    });
  }

  const acceptanceMilestone = record["acceptanceMilestone"];
  if (
    acceptanceMilestone !== undefined &&
    (typeof acceptanceMilestone !== "string" ||
      !PRESALIO_ORDER_MILESTONES.includes(
        acceptanceMilestone as (typeof PRESALIO_ORDER_MILESTONES)[number],
      ))
  ) {
    errors.push({
      path: `${path}.acceptanceMilestone`,
      message: "unknown Presalio acceptance milestone",
    });
  }

  const op = record["op"];
  if (typeof op !== "string" || !STEP_OPS.includes(op as FlowStepOp)) {
    errors.push({ path: `${path}.op`, message: `unknown step op ${formatValue(op)}` });
    return errors;
  }

  switch (op as FlowStepOp) {
    case "tap":
    case "longPress": {
      errors.push(...validateTarget(record["target"], `${path}.target`));
      if (
        op === "longPress" &&
        record["durationMs"] !== undefined &&
        !isPositiveNumber(record["durationMs"])
      ) {
        errors.push({
          path: `${path}.durationMs`,
          message: "longPress durationMs must be a positive number when present",
        });
      }
      break;
    }
    case "type": {
      errors.push(...validateTarget(record["target"], `${path}.target`));
      if (typeof record["text"] !== "string") {
        errors.push({ path: `${path}.text`, message: "type step text must be a string" });
      }
      if (record["verifyReadback"] !== undefined && typeof record["verifyReadback"] !== "boolean") {
        errors.push({
          path: `${path}.verifyReadback`,
          message: "type step verifyReadback must be a boolean when present",
        });
      }
      break;
    }
    case "swipe": {
      errors.push(...validatePoint(record["from"], `${path}.from`));
      errors.push(...validatePoint(record["to"], `${path}.to`));
      if (record["durationMs"] !== undefined && !isPositiveNumber(record["durationMs"])) {
        errors.push({
          path: `${path}.durationMs`,
          message: "swipe durationMs must be a positive number when present",
        });
      }
      break;
    }
    case "scroll": {
      if (
        typeof record["direction"] !== "string" ||
        !SCROLL_DIRECTIONS.includes(record["direction"])
      ) {
        errors.push({
          path: `${path}.direction`,
          message: `scroll direction must be one of ${SCROLL_DIRECTIONS.join(", ")}`,
        });
      }
      if (record["distance"] !== undefined && !isPositiveNumber(record["distance"])) {
        errors.push({
          path: `${path}.distance`,
          message: "scroll distance must be a positive number when present",
        });
      }
      if (record["target"] !== undefined) {
        errors.push(...validateTarget(record["target"], `${path}.target`));
      }
      break;
    }
    case "pressKey": {
      if (readNonEmptyString(record["keycode"]) === null) {
        errors.push({
          path: `${path}.keycode`,
          message: "pressKey keycode must be a non-empty string",
        });
      }
      break;
    }
    case "back": {
      break;
    }
    case "openApp": {
      if (readNonEmptyString(record["packageName"]) === null) {
        errors.push({
          path: `${path}.packageName`,
          message: "openApp packageName must be a non-empty string",
        });
      }
      break;
    }
    case "wait": {
      if (!isPositiveNumber(record["durationMs"])) {
        errors.push({
          path: `${path}.durationMs`,
          message: "wait durationMs must be a positive number",
        });
      }
      break;
    }
    case "assert": {
      errors.push(...validateAssertion(record["assertion"], `${path}.assertion`));
      break;
    }
    case "goal": {
      if (readNonEmptyString(record["goal"]) === null) {
        errors.push({ path: `${path}.goal`, message: "goal step goal must be a non-empty string" });
      }
      if (isRemovedArtemis(record["policyId"])) {
        errors.push({ path: `${path}.policyId`, message: REMOVED_ARTEMIS_MESSAGE });
      } else if (
        typeof record["policyId"] !== "string" ||
        !POLICY_IDS.includes(record["policyId"] as PolicyId)
      ) {
        errors.push({
          path: `${path}.policyId`,
          message: `unknown policy ${formatValue(record["policyId"])}`,
        });
      }
      errors.push(...validateRunLimits(record["limits"], `${path}.limits`));
      if (typeof record["acknowledgedNotice"] !== "boolean") {
        errors.push({
          path: `${path}.acknowledgedNotice`,
          message: "goal acknowledgedNotice must be a boolean",
        });
      }
      break;
    }
  }
  if (acceptanceMilestone !== undefined && op !== "assert") {
    errors.push({
      path: `${path}.acceptanceMilestone`,
      message: "acceptance milestones require an assert step",
    });
  }
  return errors;
}

/**
 * Validates a retry policy value. Absence is valid; presence must be well-formed.
 */
function validateRetry(value: unknown, path: string): FlowParseError[] {
  if (value === undefined) {
    return [];
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [{ path, message: "step retry must be an object when present" }];
  }
  const record = value as Record<string, unknown>;
  const errors: FlowParseError[] = [];
  if (!isPositiveInteger(record["maxAttempts"])) {
    errors.push({
      path: `${path}.maxAttempts`,
      message: "retry maxAttempts must be a positive integer",
    });
  }
  if (record["delayMs"] !== undefined && !isNonNegativeNumber(record["delayMs"])) {
    errors.push({
      path: `${path}.delayMs`,
      message: "retry delayMs must be a non-negative number when present",
    });
  }
  return errors;
}

/**
 * Validates per-goal run limits. Every bound must be positive.
 */
function validateRunLimits(value: unknown, path: string): FlowParseError[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [{ path, message: "goal limits must be an object" }];
  }
  const record = value as Record<string, unknown>;
  const errors: FlowParseError[] = [];
  for (const field of ["maxSteps", "maxDurationMs", "maxConsecutiveFailures"] as const) {
    if (!isPositiveNumber(record[field])) {
      errors.push({
        path: `${path}.${field}`,
        message: `goal limits ${field} must be a positive number`,
      });
    }
  }
  return errors;
}

/**
 * Validates a target reference. Selector first, point last in the union.
 */
function validateTarget(value: unknown, path: string): FlowParseError[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [{ path, message: "step target is required and must be an object" }];
  }
  const record = value as Record<string, unknown>;
  switch (record["kind"]) {
    case "selector":
      if (readNonEmptyString(record["cssSelector"]) === null) {
        return [
          {
            path: `${path}.cssSelector`,
            message: "selector target cssSelector must be a non-empty string",
          },
        ];
      }
      return [];
    case "text":
      if (typeof record["text"] !== "string") {
        return [{ path: `${path}.text`, message: "text target text must be a string" }];
      }
      if (typeof record["exact"] !== "boolean") {
        return [{ path: `${path}.exact`, message: "text target exact must be a boolean" }];
      }
      return [];
    case "nativeIndex":
      if (!isNonNegativeInteger(record["index"])) {
        return [
          {
            path: `${path}.index`,
            message: "nativeIndex target index must be a non-negative integer",
          },
        ];
      }
      return [];
    case "point":
      return validatePoint(value, path);
    default:
      return [
        { path: `${path}.kind`, message: `unknown target kind ${formatValue(record["kind"])}` },
      ];
  }
}

/**
 * Validates a screen point value.
 */
function validatePoint(value: unknown, path: string): FlowParseError[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [{ path, message: "point must be an object with numeric x and y" }];
  }
  const record = value as Record<string, unknown>;
  const errors: FlowParseError[] = [];
  if (!isFiniteNumber(record["x"])) {
    errors.push({ path: `${path}.x`, message: "point x must be a finite number" });
  }
  if (!isFiniteNumber(record["y"])) {
    errors.push({ path: `${path}.y`, message: "point y must be a finite number" });
  }
  return errors;
}

/**
 * Validates one assertion value against every known variant.
 */
function validateAssertion(value: unknown, path: string): FlowParseError[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [{ path, message: "assert step assertion is required and must be an object" }];
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record["kind"] !== "string" ||
    !ASSERTION_KINDS.includes(record["kind"] as Assertion["kind"])
  ) {
    return [
      { path: `${path}.kind`, message: `unknown assertion kind ${formatValue(record["kind"])}` },
    ];
  }
  switch (record["kind"] as Assertion["kind"]) {
    case "visible":
    case "notVisible": {
      const errors = validateTarget(record["target"], `${path}.target`);
      if (record["source"] !== "dom" && record["source"] !== "native") {
        errors.push({ path: `${path}.source`, message: "assertion source must be dom or native" });
      }
      return errors;
    }
    case "textEquals": {
      const errors = validateTarget(record["target"], `${path}.target`);
      if (typeof record["expected"] !== "string") {
        errors.push({ path: `${path}.expected`, message: "textEquals expected must be a string" });
      }
      return errors;
    }
    case "textContains": {
      const errors = validateTarget(record["target"], `${path}.target`);
      if (typeof record["substring"] !== "string") {
        errors.push({
          path: `${path}.substring`,
          message: "textContains substring must be a string",
        });
      }
      return errors;
    }
    case "urlMatches": {
      if (readNonEmptyString(record["pattern"]) === null) {
        return [
          { path: `${path}.pattern`, message: "urlMatches pattern must be a non-empty string" },
        ];
      }
      return [];
    }
    case "dbRowExists": {
      const errors: FlowParseError[] = [];
      for (const field of ["database", "store", "key"] as const) {
        if (readNonEmptyString(record[field]) === null) {
          errors.push({
            path: `${path}.${field}`,
            message: `dbRowExists ${field} must be a non-empty string`,
          });
        }
      }
      return errors;
    }
    case "networkStatus": {
      const errors: FlowParseError[] = [];
      if (readNonEmptyString(record["urlPattern"]) === null) {
        errors.push({
          path: `${path}.urlPattern`,
          message: "networkStatus urlPattern must be a non-empty string",
        });
      }
      if (!isNonNegativeInteger(record["status"])) {
        errors.push({
          path: `${path}.status`,
          message: "networkStatus status must be a non-negative integer",
        });
      }
      if (record["method"] !== undefined && typeof record["method"] !== "string") {
        errors.push({
          path: `${path}.method`,
          message: "networkStatus method must be a string when present",
        });
      }
      return errors;
    }
    case "consoleClean": {
      const errors: FlowParseError[] = [];
      if (record["level"] !== "warn" && record["level"] !== "error") {
        errors.push({ path: `${path}.level`, message: "consoleClean level must be warn or error" });
      }
      if (record["ignorePatterns"] !== undefined) {
        if (
          !Array.isArray(record["ignorePatterns"]) ||
          !(record["ignorePatterns"] as unknown[]).every(
            (entry: unknown) => typeof entry === "string",
          )
        ) {
          errors.push({
            path: `${path}.ignorePatterns`,
            message: "consoleClean ignorePatterns must be an array of strings when present",
          });
        }
      }
      return errors;
    }
  }
}
