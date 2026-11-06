import { isRemovedArtemis } from "./removedPolicies";

/** The note a flow carries after its Artemis goal steps moved to Jev. */
export const ARTEMIS_MIGRATION_NOTE =
  "Artemis was removed, so this flow's goal steps now use Jev. Unlike Artemis, Jev sends a redacted copy of the screen structure off this machine while the flow runs.";

/**
 * Upgrades a stored flow document before it is parsed. Goal steps pinned to
 * the removed Artemis policy move to Jev with their notice unacknowledged,
 * because Artemis ran locally and Jev does not, and the flow gains a note
 * saying so. Anything that is not a flow with such a step returns unchanged.
 */
export function migrateStoredFlow(input: unknown): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return input;
  }
  const record = input as Record<string, unknown>;
  const steps = record["steps"];
  if (!Array.isArray(steps) || !steps.some(isArtemisGoalStep)) {
    return input;
  }
  return {
    ...record,
    steps: steps.map((step: unknown) =>
      isArtemisGoalStep(step) ? { ...step, policyId: "jev", acknowledgedNotice: false } : step,
    ),
    migrationNote: ARTEMIS_MIGRATION_NOTE,
  };
}

function isArtemisGoalStep(step: unknown): step is Record<string, unknown> {
  if (typeof step !== "object" || step === null || Array.isArray(step)) {
    return false;
  }
  const record = step as Record<string, unknown>;
  return record["op"] === "goal" && isRemovedArtemis(record["policyId"]);
}
