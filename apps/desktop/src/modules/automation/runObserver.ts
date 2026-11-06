import type { AutomationTaskOrigin, Flow, RunStatus, StepRecord } from "@/types/automation.types";
import type { PolicyId } from "./policies/types";
import type { RunView } from "./runSource";
import { fromLiveRecords } from "./runSource";

/**
 * Maximum runs held in the observed set. Finished runs evict oldest first;
 * a running run is never evicted, so a long agent run cannot be dropped out
 * from under the surface watching it.
 */
export const MAX_TRACKED_RUNS = 20;

/** A run entered the registry, whatever started it. */
export interface RunStartedEvent {
  kind: "started";
  runId: string;
  taskId: string;
  origin: AutomationTaskOrigin;
  label: string;
  policyId: PolicyId;
  deviceSerial: string;
  flow: Flow | null;
  goal: string | null;
  startedAt: number;
}

/** One executed step of a run. */
export interface RunStepEvent {
  kind: "step";
  runId: string;
  record: StepRecord;
}

/** A run reached a terminal status. */
export interface RunFinishedEvent {
  kind: "finished";
  runId: string;
  status: RunStatus;
  failureReason: string | null;
  endedAt: number;
}

export type RunEvent = RunStartedEvent | RunStepEvent | RunFinishedEvent;

/** Anything watching the registry. Observers must not throw. */
export type RunObserver = (event: RunEvent) => void;

/** One run as the workbench sees it, sourced only from registry events. */
export interface ActiveRun {
  runId: string;
  taskId: string;
  origin: AutomationTaskOrigin;
  label: string;
  policyId: PolicyId;
  deviceSerial: string;
  flow: Flow | null;
  goal: string | null;
  startedAt: number;
  endedAt: number | null;
  status: RunStatus;
  failureReason: string | null;
  records: StepRecord[];
}

/**
 * Folds one registry event into the observed run set, returning a new map.
 * Unknown-run steps are dropped rather than inventing a run, and a step
 * arriving after a terminal status is dropped rather than resurrecting it:
 * a run's status is owned by the registry, never inferred from traffic.
 */
export function applyRunEvent(
  runs: ReadonlyMap<string, ActiveRun>,
  event: RunEvent,
): Map<string, ActiveRun> {
  const next = new Map(runs);
  switch (event.kind) {
    case "started": {
      if (next.has(event.runId)) {
        return next;
      }
      next.set(event.runId, {
        runId: event.runId,
        taskId: event.taskId,
        origin: event.origin,
        label: event.label,
        policyId: event.policyId,
        deviceSerial: event.deviceSerial,
        flow: event.flow,
        goal: event.goal,
        startedAt: event.startedAt,
        endedAt: null,
        status: "running",
        failureReason: null,
        records: [],
      });
      return evict(next);
    }
    case "step": {
      const run = next.get(event.runId);
      if (run === undefined || run.status !== "running") {
        return next;
      }
      const records = [...run.records, event.record].sort(
        (left, right) => left.startedAt - right.startedAt,
      );
      next.set(event.runId, { ...run, records });
      return next;
    }
    case "finished": {
      const run = next.get(event.runId);
      if (run === undefined) {
        return next;
      }
      next.set(event.runId, {
        ...run,
        status: event.status,
        failureReason: event.failureReason,
        endedAt: event.endedAt,
      });
      return evict(next);
    }
  }
}

/** Returns one observed run, or null when the id is unknown. */
export function activeRunOf(runs: ReadonlyMap<string, ActiveRun>, runId: string): ActiveRun | null {
  return runs.get(runId) ?? null;
}

/** Normalizes an observed run to the shared run view the canvas renders. */
export function runViewOf(run: ActiveRun): RunView {
  return fromLiveRecords(run.records, run.flow);
}

/**
 * Returns the running run that the local UI did not start, or null. This is
 * what makes an MCP-driven run visible as somebody else's: it is rendered,
 * but it is not presented as the user's own.
 */
export function foreignActiveRun(
  runs: ReadonlyMap<string, ActiveRun>,
  localRunId: string | null,
): ActiveRun | null {
  for (const run of runs.values()) {
    if (run.status === "running" && run.runId !== localRunId) {
      return run;
    }
  }
  return null;
}

/**
 * Explains why a start is refused while another run holds the device, or
 * null when nothing blocks. The reason names the run so the user can find
 * it rather than facing a disabled control with no cause.
 */
export function startReason(
  runs: ReadonlyMap<string, ActiveRun>,
  localRunId: string | null,
): string | null {
  const foreign = foreignActiveRun(runs, localRunId);
  if (foreign === null) {
    return null;
  }
  return `${describeOrigin(foreign.origin)} is already running "${foreign.label}" (${foreign.runId}) on ${foreign.deviceSerial}`;
}

/** Human-readable owner of a run, used wherever origin is shown. */
export function describeOrigin(origin: AutomationTaskOrigin): string {
  switch (origin) {
    case "mcp":
      return "An MCP client";
    case "flow":
    case "local-chat":
      return "This workbench";
  }
}

function evict(runs: Map<string, ActiveRun>): Map<string, ActiveRun> {
  if (runs.size <= MAX_TRACKED_RUNS) {
    return runs;
  }
  const finished = [...runs.values()]
    .filter((run) => run.status !== "running")
    .sort((left, right) => left.startedAt - right.startedAt);
  for (const run of finished) {
    if (runs.size <= MAX_TRACKED_RUNS) {
      break;
    }
    runs.delete(run.runId);
  }
  return runs;
}

/**
 * The single reason a start is refused, or null when it may proceed. A busy
 * device is reported first: it is the one condition the user cannot fix by
 * editing the flow, and it is the case that used to present as an
 * unexplained disabled control while an MCP client held the device.
 */
export function workbenchStartReason(input: {
  flow: Flow | null;
  deviceSerial: string | null;
  runnable: boolean;
  invalidReason: string | null;
  runs: ReadonlyMap<string, ActiveRun>;
  localRunId: string | null;
}): string | null {
  const busy = startReason(input.runs, input.localRunId);
  if (busy !== null) {
    return busy;
  }
  if (input.flow === null) {
    return "no flow selected";
  }
  if (input.deviceSerial === null) {
    return "no device connected";
  }
  if (!input.runnable) {
    return input.invalidReason ?? "flow is not runnable";
  }
  return null;
}
