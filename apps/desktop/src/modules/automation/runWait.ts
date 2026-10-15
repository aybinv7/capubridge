import type { RunStatus } from "@/types/automation.types";
import type { RunObserver } from "./runObserver";
import type { RunStatusSnapshot, TracePage, TraceRecord } from "./runRegistryTypes";

/** Steps carried in one summary. Older steps are counted, not listed. */
export const MAX_SUMMARY_STEPS = 40;

/** Longest rendering of one target or typed value inside a step line. */
const MAX_VALUE_CHARS = 60;

/**
 * What an outer-loop caller needs to know about a run, in as few tokens as
 * the answer allows. Built only from `readTrace`, which already masks every
 * decision, so the summary inherits the secret boundary instead of
 * re-implementing it.
 */
export interface RunSummary {
  runId: string;
  taskId: string;
  status: RunStatus;
  done: boolean;
  label: string;
  policyId: string;
  failureReason: string | null;
  stepCount: number;
  durationMs: number | null;
  steps: string[];
  omittedSteps: number;
  next: string | null;
}

/** The slice of the run registry a wait needs. */
export interface WaitableRegistry {
  getStatus(runId: string): RunStatusSnapshot;
  subscribe(observer: RunObserver): () => void;
  readTrace(runId: string, offset: number, limit: number): Promise<TracePage>;
}

export interface WaitTimers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const DEFAULT_TIMERS: WaitTimers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Waits for a run to finish, or for `timeoutMs`, and returns its summary.
 *
 * This replaces polling `get_run_status`. For an MCP client every poll is a
 * full model turn that re-reads its whole context, so a run polled every few
 * seconds spends most of its cost asking whether it is done. One wait that
 * resolves on the registry's own finished event costs one turn.
 */
export async function waitForRun(
  registry: WaitableRegistry,
  runId: string,
  timeoutMs: number,
  timers: WaitTimers = DEFAULT_TIMERS,
): Promise<RunSummary> {
  if (isActive(registry.getStatus(runId).status)) {
    await new Promise<void>((resolve) => {
      let released = false;
      let handle: unknown = null;
      const unsubscribe = registry.subscribe((event) => {
        if (event.kind === "finished" && event.runId === runId) {
          release();
        }
      });
      function release(): void {
        if (released) {
          return;
        }
        released = true;
        unsubscribe();
        timers.clearTimeout(handle);
        resolve();
      }
      handle = timers.setTimeout(release, timeoutMs);
    });
  }
  return summarize(registry, runId);
}

/** One compact line per step: id, operation, target, value, outcome. */
export function describeStep(record: TraceRecord): string {
  const parts = [record.stepId, record.operation];
  const target = describeTarget(record.target);
  if (target !== null) {
    parts.push(target);
  }
  if (typeof record.text === "string" && record.text !== "") {
    parts.push(`= ${JSON.stringify(truncate(record.text))}`);
  }
  let outcome = `-> ${record.outcome}`;
  if (record.verificationStatus !== undefined && record.verificationStatus !== "not_run") {
    outcome += ` ${record.verificationStatus}`;
  }
  if (record.error !== null && record.error !== "") {
    outcome += `: ${truncate(record.error)}`;
  }
  parts.push(outcome);
  return parts.join(" ");
}

async function summarize(registry: WaitableRegistry, runId: string): Promise<RunSummary> {
  const status = registry.getStatus(runId);
  const head = await registry.readTrace(runId, 0, 1);
  const offset = Math.max(0, head.total - MAX_SUMMARY_STEPS);
  const page = await registry.readTrace(runId, offset, MAX_SUMMARY_STEPS);
  const done = !isActive(status.status);
  return {
    runId: status.runId,
    taskId: status.taskId,
    status: status.status,
    done,
    label: status.label,
    policyId: status.policyId,
    failureReason: status.failureReason,
    stepCount: head.total,
    durationMs: spanOf([...head.records, ...page.records]),
    steps: page.records.map(describeStep),
    omittedSteps: offset,
    next: done ? null : "still running: call wait_for_run again with the same run_id",
  };
}

/**
 * Earliest start to latest end. Records are not in start order: a goal's own
 * record starts before its discovered steps but is appended after them.
 */
function spanOf(records: TraceRecord[]): number | null {
  if (records.length === 0) {
    return null;
  }
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const record of records) {
    start = Math.min(start, record.startedAt);
    end = Math.max(end, record.endedAt);
  }
  return end - start;
}

function isActive(status: RunStatus): boolean {
  return status === "running" || status === "pending";
}

function describeTarget(target: unknown): string | null {
  if (typeof target !== "object" || target === null) {
    return null;
  }
  const ref = target as Record<string, unknown>;
  switch (ref["kind"]) {
    case "text":
      return typeof ref["text"] === "string" ? JSON.stringify(truncate(ref["text"])) : null;
    case "selector":
      return typeof ref["cssSelector"] === "string" ? truncate(ref["cssSelector"]) : null;
    case "nativeIndex":
      return `native#${String(ref["index"])}`;
    case "point":
      return `(${String(ref["x"])},${String(ref["y"])})`;
    default:
      return null;
  }
}

function truncate(value: string): string {
  return value.length <= MAX_VALUE_CHARS ? value : `${value.slice(0, MAX_VALUE_CHARS - 1)}…`;
}
