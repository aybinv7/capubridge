import type { RunRow } from "./runHistory";
import { filterRunRows, sortRunRows } from "./runHistory";

export function drawerRows(
  rows: RunRow[],
  options: { status?: string; flowId?: string | null } = {},
): RunRow[] {
  let result = sortRunRows(rows);
  if (options.status !== undefined && options.status !== "all") {
    result = filterRunRows(result, options.status);
  }
  if (options.flowId !== undefined && options.flowId !== null) {
    result = result.filter(
      (row) => row.flowName === options.flowId || row.sessionId === options.flowId,
    );
  }
  const live = result.filter((row) => row.runStatus === "running");
  const rest = result.filter((row) => row.runStatus !== "running");
  return [...live, ...rest];
}

export function permalinkFor(runId: string, stepIndex: number): string {
  return `/automation/runs/${runId}/step/${stepIndex}`;
}

export function parsePermalink(path: string): { runId: string; stepIndex: number } | null {
  const match = path.match(/^\/automation\/runs\/([^/]+)\/step\/(\d+)$/);
  if (match === null) {
    return null;
  }
  return { runId: match[1] ?? "", stepIndex: Number(match[2]) };
}

export function isAdHoc(row: RunRow): boolean {
  return row.flowName === null && row.goal !== null;
}

export function notFoundRow(runId: string): RunRow {
  return {
    sessionId: runId,
    label: "Not found",
    startedAt: 0,
    durationMs: 0,
    deviceSerial: null,
    filePath: "",
    incomplete: false,
    runStatus: "not-found",
    policyId: "unknown",
    flowName: null,
    goal: null,
    stepCount: 0,
    failedStepIndex: null,
  };
}

/**
 * Explains an empty history rather than rendering a bare empty list. While
 * recording is off no run writes a session file, so the drawer is correctly
 * empty and must say so: an empty list that looks identical to a broken one
 * is how a disabled subsystem gets mistaken for a bug.
 */
export function historyEmptyReason(rowCount: number, recordingEnabled: boolean): string | null {
  if (rowCount > 0) {
    return null;
  }
  if (!recordingEnabled) {
    return "Run recording is off, so no run is saved to history. Live runs are still visible in the workbench while they execute.";
  }
  return "No runs recorded yet.";
}
