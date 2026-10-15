import type { Flow } from "@/types/automation.types";
import type { ManagedRun, RunRegistryDeps } from "./runRegistryTypes";
import type { RunEvent, RunObserver } from "./runObserver";

/**
 * Observer fan-out for one registry. Kept beside the registry rather than
 * inside it so the registry's own size stays bounded, and so the publishing
 * rules are testable without constructing a registry.
 */
export function createRunObservers() {
  const observers = new Set<RunObserver>();

  /**
   * Publishes one event to every observer. A throwing observer is isolated:
   * a broken surface must never abort a run driving a real device.
   */
  function notify(event: RunEvent): void {
    for (const observer of observers) {
      try {
        observer(event);
      } catch {
        continue;
      }
    }
  }

  return {
    /** Registers an observer and returns its unsubscribe. */
    subscribe: (observer: RunObserver): (() => void) => {
      observers.add(observer);
      return () => {
        observers.delete(observer);
      };
    },

    notify,

    notifyStarted: (managed: ManagedRun, flow: Flow | null): void => {
      notify({
        kind: "started",
        runId: managed.runId,
        taskId: managed.taskId,
        origin: managed.taskRuntime.task.origin,
        label: managed.label,
        policyId: managed.policyId,
        deviceSerial: managed.deviceSerial,
        flow,
        goal: managed.goal,
        startedAt: managed.startedAt,
      });
    },

    notifyFinished: (managed: ManagedRun): void => {
      notify({
        kind: "finished",
        runId: managed.runId,
        status: managed.status,
        failureReason: managed.failureReason,
        endedAt: managed.endedAt ?? Date.now(),
      });
    },
  };
}

export type RunObservers = ReturnType<typeof createRunObservers>;

/** Resolves an optional flow id to a flow, for runs that may not have one. */
export function flowOrNull(
  deps: Pick<RunRegistryDeps, "loadFlow">,
  flowId: string | null | undefined,
): Flow | null {
  return flowId === undefined || flowId === null ? null : deps.loadFlow(flowId);
}
