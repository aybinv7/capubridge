import { invokeCommand, listenEvent } from "@/runtime/ipc/client";
import type {
  AutomationTask,
  AutomationTaskEvent,
  AutomationTaskRun,
  ReasoningOwner,
} from "@/types/automation.types";
import { isRemovedArtemis, REMOVED_ARTEMIS_ID, REMOVED_ARTEMIS_LABEL } from "./removedPolicies";

export interface AutomationTaskEventPayload {
  event: AutomationTaskEvent;
}

/**
 * A reasoning owner as read back from disk. Tasks run before Artemis was
 * removed may still name it; no new task can.
 */
export type StoredReasoningOwner = ReasoningOwner | typeof REMOVED_ARTEMIS_ID;

/** A task as read back from disk, with the owners older builds could write. */
export type PersistedAutomationTask = Omit<AutomationTask, "reasoningOwner"> & {
  reasoningOwner: StoredReasoningOwner | null;
};

/** A task attempt as read back from disk, with the owners older builds could write. */
export type PersistedAutomationTaskRun = Omit<AutomationTaskRun, "reasoningOwner"> & {
  reasoningOwner: StoredReasoningOwner;
};

export interface PersistedAutomationTaskSnapshot {
  task: PersistedAutomationTask;
  runs: PersistedAutomationTaskRun[];
  events: AutomationTaskEvent[];
}

/**
 * Names the reasoning owner of a stored task, saying plainly when it was the
 * removed Artemis agent or when the task never recorded one.
 */
export function describeStoredOwner(owner: StoredReasoningOwner | null): string {
  if (owner === null) {
    return "owner undisclosed";
  }
  return isRemovedArtemis(owner) ? REMOVED_ARTEMIS_LABEL : owner;
}

export function subscribeAutomationTaskEvents(
  onEvent: (event: AutomationTaskEvent) => void,
): Promise<() => void> {
  return listenEvent("capubridge:automation-task-event", (payload) => onEvent(payload.event));
}

export function loadPersistedAutomationTasks(): Promise<PersistedAutomationTaskSnapshot[]> {
  return invokeCommand("automation_tasks_list");
}
