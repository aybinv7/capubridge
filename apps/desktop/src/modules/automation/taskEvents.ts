import { invokeCommand, listenEvent } from "@/runtime/ipc/client";
import type {
  AutomationTask,
  AutomationTaskEvent,
  AutomationTaskRun,
} from "@/types/automation.types";

export interface AutomationTaskEventPayload {
  event: AutomationTaskEvent;
}

export interface PersistedAutomationTaskSnapshot {
  task: AutomationTask;
  runs: AutomationTaskRun[];
  events: AutomationTaskEvent[];
}

export function subscribeAutomationTaskEvents(
  onEvent: (event: AutomationTaskEvent) => void,
): Promise<() => void> {
  return listenEvent("capubridge:automation-task-event", (payload) => onEvent(payload.event));
}

export function loadPersistedAutomationTasks(): Promise<PersistedAutomationTaskSnapshot[]> {
  return invokeCommand("automation_tasks_list");
}
