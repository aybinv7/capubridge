import { DEFAULT_DECISION_MODEL_ID, findDecisionModel } from "./decisionModels";

const STORAGE_KEY = "capubridge.automation.decision-model.v1";

/**
 * The decision model the agent policy runs on. An unset, unreadable or
 * no-longer-listed value falls back to the pinned default, so a stale setting
 * can never send a request to a model the capability table does not know.
 */
export function readDecisionModelId(): string {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    return stored !== null && findDecisionModel(stored) !== null
      ? stored
      : DEFAULT_DECISION_MODEL_ID;
  } catch {
    return DEFAULT_DECISION_MODEL_ID;
  }
}

/**
 * Persists the choice. Returns false when storage refused the write, so the
 * caller can say the choice will not survive a restart.
 */
export function writeDecisionModelId(id: string): boolean {
  if (findDecisionModel(id) === null) {
    return false;
  }
  try {
    if (id === DEFAULT_DECISION_MODEL_ID) {
      globalThis.localStorage.removeItem(STORAGE_KEY);
    } else {
      globalThis.localStorage.setItem(STORAGE_KEY, id);
    }
    return true;
  } catch {
    return false;
  }
}
