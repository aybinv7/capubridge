import type { Flow, FlowStep, RunLimits } from "@/types/automation.types";
import type { PolicyId } from "@/modules/automation/policies/types";
import { buildStep } from "./flowBuild";
import type { FlowParseError } from "./flowShared";
import { formatValue, readNonEmptyString } from "./flowShared";
import { validateStepAt } from "./flowValidate";

export type { FlowParseError } from "./flowShared";

/** Current flow document version. Only this version parses. */
export const FLOW_VERSION = 1;

/** Result of parsing a flow document. Never throws on bad input. */
export type FlowParseResult = { ok: true; flow: Flow } | { ok: false; errors: FlowParseError[] };

/**
 * Parses and validates a flow document. Returns a flow on success or precise
 * errors on failure, and never throws on bad input.
 */
export function parseFlow(input: unknown): FlowParseResult {
  const errors: FlowParseError[] = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: [{ path: "", message: "flow must be an object" }] };
  }
  const record = input as Record<string, unknown>;

  if (record["version"] !== FLOW_VERSION) {
    errors.push({
      path: "version",
      message: `unsupported flow version ${formatValue(record["version"])}, expected ${FLOW_VERSION}`,
    });
  }
  const id = readNonEmptyString(record["id"]);
  if (id === null) {
    errors.push({ path: "id", message: "flow id must be a non-empty string" });
  }
  const name = readNonEmptyString(record["name"]);
  if (name === null) {
    errors.push({ path: "name", message: "flow name must be a non-empty string" });
  }
  const appPackage = typeof record["appPackage"] === "string" ? record["appPackage"] : null;
  if (appPackage === null) {
    errors.push({ path: "appPackage", message: "flow appPackage must be a string" });
  }
  if (
    record["acceptanceScenario"] !== undefined &&
    record["acceptanceScenario"] !== "presalio-order-v1"
  ) {
    errors.push({ path: "acceptanceScenario", message: "unknown acceptance scenario" });
  }
  if (record["acceptanceScenario"] === "presalio-order-v1" && appPackage !== "com.presalio.app") {
    errors.push({
      path: "appPackage",
      message: "the Presalio acceptance scenario requires com.presalio.app",
    });
  }
  if (record["description"] !== undefined && typeof record["description"] !== "string") {
    errors.push({ path: "description", message: "flow description must be a string when present" });
  }
  if (record["migrationNote"] !== undefined && typeof record["migrationNote"] !== "string") {
    errors.push({
      path: "migrationNote",
      message: "flow migrationNote must be a string when present",
    });
  }

  let steps: FlowStep[] = [];
  if (!Array.isArray(record["steps"])) {
    errors.push({ path: "steps", message: "flow steps must be an array" });
  } else {
    const parsed: FlowStep[] = [];
    record["steps"].forEach((entry: unknown, index: number) => {
      const stepErrors = validateStepAt(entry, `steps[${index}]`);
      errors.push(...stepErrors);
      if (stepErrors.length === 0) {
        const step = buildStep(entry as Record<string, unknown>);
        if (step !== null) {
          parsed.push(step);
        }
      }
    });
    steps = parsed;
    const milestoneSteps = steps.filter((step) => step.acceptanceMilestone !== undefined);
    if (record["acceptanceScenario"] !== "presalio-order-v1" && milestoneSteps.length > 0) {
      errors.push({
        path: "acceptanceScenario",
        message: "acceptance milestones require the Presalio acceptance scenario",
      });
    }
    if (record["acceptanceScenario"] === "presalio-order-v1") {
      const duplicates = milestoneSteps
        .map((step) => step.acceptanceMilestone)
        .filter(
          (milestone, index, all) => milestone !== undefined && all.indexOf(milestone) !== index,
        );
      for (const milestone of new Set(duplicates)) {
        errors.push({
          path: "steps",
          message: `acceptance milestone ${milestone} may only be declared once`,
        });
      }
      for (const step of milestoneSteps) {
        if (step.op !== "assert") {
          errors.push({
            path: `steps.${step.id}`,
            message: "acceptance milestones require an assert step",
          });
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  const flow: Flow = {
    version: FLOW_VERSION,
    id: id as string,
    name: name as string,
    appPackage: appPackage as string,
    ...(record["acceptanceScenario"] === "presalio-order-v1"
      ? { acceptanceScenario: "presalio-order-v1" as const }
      : {}),
    steps,
  };
  if (typeof record["description"] === "string") {
    flow.description = record["description"];
  }
  if (typeof record["migrationNote"] === "string" && record["migrationNote"] !== "") {
    flow.migrationNote = record["migrationNote"];
  }
  return { ok: true, flow };
}

/**
 * Validates one step as it is typed in the editor. Returns an empty array
 * for a good step. The path of every error is prefixed with `step`.
 */
export function validateStep(step: unknown): FlowParseError[] {
  return validateStepAt(step, "step");
}

/**
 * Serializes a flow to stable, human-diffable JSON with ordered keys.
 * Byte-identical across calls on the same flow.
 */
export function serializeFlow(flow: Flow): string {
  return `${JSON.stringify(canonicalize(flow), null, 2)}\n`;
}

/**
 * Creates a new empty flow with a generated id.
 */
export function createEmptyFlow(name: string, appPackage: string): Flow {
  return {
    version: FLOW_VERSION,
    id: generateId(),
    name,
    appPackage,
    steps: [],
  };
}

/** Default per-goal run limits by policy, from the CB-40/CB-47 defaults. */
const GOAL_LIMIT_DEFAULTS: Record<PolicyId, RunLimits> = {
  rules: { maxSteps: 40, maxDurationMs: 300000, maxConsecutiveFailures: 3 },
  jev: { maxSteps: 40, maxDurationMs: 300000, maxConsecutiveFailures: 5 },
  embedded: { maxSteps: 40, maxDurationMs: 300000, maxConsecutiveFailures: 5 },
};

/**
 * Creates a goal step with per-policy default limits and an unacknowledged
 * notice. The caller sets acknowledgedNotice through the CB-61 gate.
 */
export function createGoalStep(goal: string, policyId: PolicyId): FlowStep {
  return {
    id: generateId(),
    op: "goal",
    goal,
    policyId,
    limits: { ...GOAL_LIMIT_DEFAULTS[policyId] },
    acknowledgedNotice: false,
  };
}

/**
 * Reports whether a goal step needs an explicit acknowledgement before it
 * may run. Only a jev step without acknowledgement does; local policies
 * never transfer data. Parsing never rejects on this — the flow is a valid
 * saved artifact and the run is what CB-61 gates.
 */
export function goalStepNeedsAcknowledgement(step: unknown): boolean {
  if (typeof step !== "object" || step === null || Array.isArray(step)) {
    return false;
  }
  const record = step as Record<string, unknown>;
  if (record["op"] !== "goal" || record["policyId"] !== "jev") {
    return false;
  }
  return record["acknowledgedNotice"] !== true;
}

/**
 * Returns the value as a JSON value with object keys in stable sorted order.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry: unknown) => canonicalize(entry));
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const ordered: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const entry = record[key];
      if (entry !== undefined) {
        ordered[key] = canonicalize(entry);
      }
    }
    return ordered;
  }
  return value;
}

/**
 * Generates a flow id without any runtime dependency.
 */
function generateId(): string {
  const host = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (host.crypto !== undefined && typeof host.crypto.randomUUID === "function") {
    return host.crypto.randomUUID();
  }
  return `flow-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}
