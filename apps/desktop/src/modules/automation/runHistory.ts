import type { AssertionResult } from "./assertions";
import type {
  AutomationCapuEvent,
  RustSessionListItem,
  SessionManifest,
} from "@/types/replay.types";

/** One automation run for the list, shaped from a session list item. */
export interface RunRow {
  sessionId: string;
  label: string;
  startedAt: number;
  durationMs: number;
  deviceSerial: string | null;
  filePath: string;
  incomplete: boolean;
  runStatus: string;
  policyId: string;
  flowName: string | null;
  goal: string | null;
  stepCount: number;
  failedStepIndex: number | null;
}

/** Render cap for the run list. Bounded streaming, logcat precedent. */
export const RUN_LIST_RENDER_LIMIT = 100;

/** Session list item as it arrives on the wire, tolerating both casings. */
interface RawSessionListItem {
  sessionId?: string;
  session_id?: string;
  label?: string;
  startedAt?: number;
  started_at?: number;
  duration?: number;
  deviceSerial?: string | null;
  device_serial?: string | null;
  filePath?: string;
  file_path?: string;
  incomplete?: boolean;
  automation?: RawAutomationSummary | null;
}

interface RawAutomationSummary {
  runStatus?: string;
  run_status?: string;
  policyId?: string;
  policy_id?: string;
  flowName?: string | null;
  flow_name?: string | null;
  goal?: string | null;
  stepCount?: number;
  step_count?: number;
  failedStepIndex?: number | null;
  failed_step_index?: number | null;
}

/**
 * Shapes a session list item into a run row. Returns null for sessions
 * without an automation summary, which stay in Replay rather than here.
 */
export function toRunRow(item: RustSessionListItem): RunRow | null {
  const raw = item as unknown as RawSessionListItem;
  const summary = raw.automation ?? null;
  if (summary === null) {
    return null;
  }
  const filePath = raw.filePath ?? raw.file_path;
  const sessionId = raw.sessionId ?? raw.session_id;
  if (!filePath || !sessionId) {
    return null;
  }
  return {
    sessionId,
    label: raw.label ?? "",
    startedAt: raw.startedAt ?? raw.started_at ?? 0,
    durationMs: raw.duration ?? 0,
    deviceSerial: raw.deviceSerial ?? raw.device_serial ?? null,
    filePath,
    incomplete: raw.incomplete ?? false,
    runStatus: summary.runStatus ?? summary.run_status ?? "unknown",
    policyId: summary.policyId ?? summary.policy_id ?? "unknown",
    flowName: summary.flowName ?? summary.flow_name ?? null,
    goal: summary.goal ?? null,
    stepCount: summary.stepCount ?? summary.step_count ?? 0,
    failedStepIndex: summary.failedStepIndex ?? summary.failed_step_index ?? null,
  };
}

/**
 * Sorts run rows newest first.
 */
export function sortRunRows(rows: RunRow[]): RunRow[] {
  return [...rows].sort((left, right) => right.startedAt - left.startedAt);
}

/**
 * Filters run rows by run status. "all" keeps everything.
 */
export function filterRunRows(rows: RunRow[], status: string): RunRow[] {
  if (status === "all") {
    return [...rows];
  }
  return rows.filter((row) => row.runStatus === status);
}

/**
 * Parses automation track NDJSON into events. Blank lines are skipped and
 * malformed lines are dropped so a partial session still opens with the
 * steps it has.
 */
export function parseAutomationTrack(ndjson: string): AutomationCapuEvent[] {
  const events: AutomationCapuEvent[] = [];
  for (const line of ndjson.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    let value: unknown;
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      continue;
    }
    if (!isAutomationEvent(value)) {
      continue;
    }
    events.push(value);
  }
  return events;
}

/**
 * Reports whether a parsed line is an automation event envelope.
 */
function isAutomationEvent(value: unknown): value is AutomationCapuEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (!Number.isFinite(record["t"])) {
    return false;
  }
  const data = record["data"];
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return false;
  }
  const stepId = (data as Record<string, unknown>)["stepId"];
  const decision = (data as Record<string, unknown>)["decision"];
  return (
    typeof stepId === "string" &&
    typeof decision === "object" &&
    decision !== null &&
    typeof (decision as Record<string, unknown>)["operation"] === "string"
  );
}

/**
 * Returns the index of the first step whose outcome is not ok, or null
 * when every step passed. A failed run opens on this step.
 */
export function failingStepIndex(events: AutomationCapuEvent[]): number | null {
  for (let index = 0; index < events.length; index += 1) {
    if (events[index]?.data.outcome !== "ok") {
      return index;
    }
  }
  return null;
}

/**
 * Maps a step selection to the replay timestamp: the automation event's
 * `t` offset already is milliseconds from the manifest epoch, which is
 * exactly the replay clock.
 */
export function replayTimestampMs(event: AutomationCapuEvent): number {
  return event.t;
}

/**
 * Returns the screenshot archive entry for a step, or null for the absent
 * state. Inline payloads never occur here; the writer drops them.
 */
export function screenshotEntryFor(event: AutomationCapuEvent): string | null {
  return event.data.screenshot;
}

/**
 * Groups assertion results under their step.
 */
export function assertionsFor(event: AutomationCapuEvent): AssertionResult[] {
  return Array.isArray(event.data.assertions) ? event.data.assertions : [];
}

/**
 * Derives the run duration from the manifest, never stored twice.
 */
export function runDurationMs(manifest: Pick<SessionManifest, "duration">): number {
  return manifest.duration;
}

/**
 * Derives the step count from the parsed events, never stored twice.
 */
export function stepCountOf(events: AutomationCapuEvent[]): number {
  return events.length;
}

/**
 * Describes where a run's data went, from the policy that drove it. Part
 * of the run's permanent record.
 */
export function policyProvenance(policyId: string): string {
  if (policyId === "jev") {
    return "Remote policy: the redacted screen structure was sent to a third-party service during this run.";
  }
  if (policyId === "rules" || policyId === "artemis") {
    return "Local policy: nothing left the machine during this run.";
  }
  return `Unknown policy "${policyId}": treat its data boundary as unverified.`;
}
