import { invokeCommand } from "@/runtime/ipc/client";
import type { AssertionResult } from "./assertions";
import type {
  AutomationTaskId,
  AutomationTaskOrigin,
  AutomationTaskRunId,
  Flow,
  StepRecord,
} from "@/types/automation.types";
import type { RunResult } from "./flowExecutor";
import type { AutomationCapuEventData, SessionManifest } from "@/types/replay.types";
import { useSessionWriter } from "@/composables/useSessionWriter";
import { redactDecision } from "./redact";

/** What the run recording needs to describe the run in its manifest. */
export interface AutomationRunInfo {
  taskId?: AutomationTaskId;
  taskRunId?: AutomationTaskRunId;
  taskOrigin?: AutomationTaskOrigin;
  label: string;
  policyId: string;
  flow: Flow | null;
  goal: string | null;
  deviceSerial: string | null;
  appPackage: string | null;
}

/** How a recording ends. Partial sessions stay usable; nothing throws away a failed run. */
export interface FinishedRunRecording {
  filePath: string | null;
  partial: boolean;
  sessionId: string;
}

/**
 * An open run recording. Accumulates step records during the run and
 * converts them to automation track events on the manifest clock, so a
 * step marker lands next to the console error and the request it caused.
 */
export interface RunRecording {
  sessionId: string;
  startedAt: number;
  recordStep(record: StepRecord, assertions?: AssertionResult[]): void;
  attachScreenshot(stepId: string, base64Png: string): Promise<string>;
  finish(result: RunResult): Promise<FinishedRunRecording>;
}

/**
 * Kill-switch for session recording. While false, runs execute normally but
 * write no .capu: no session start, no step appends, no attachments, no
 * finish. Re-enable when the replay/run-history surface needs recordings
 * again. Typed boolean (not a literal) so call-site ternaries keep both
 * branches type-checking.
 */
export const RECORDING_ENABLED: boolean = false;

/**
 * Starts one recording session for an automation run, reusing the existing
 * recording pipeline. There is no second recorder.
 */
export async function startRunRecording(info: AutomationRunInfo): Promise<RunRecording> {
  const sessionId = generateRunSessionId();
  const startedAt = Date.now();
  await invokeCommand("recording_session_start", { sessionId });
  const writer = useSessionWriter(sessionId, startedAt);
  writer.start();
  const attachments = new Map<string, string>();
  const pendingAttachments: Promise<void>[] = [];

  return {
    sessionId,
    startedAt,
    recordStep(record: StepRecord, assertions: AssertionResult[] = []): void {
      const data: AutomationCapuEventData = {
        stepId: record.stepId,
        decision: redactDecision(record.decision),
        resolvedTarget: record.resolvedTarget,
        outcome: record.outcome,
        error: record.error,
        screenshot: screenshotEntryFor(record, sessionId, attachments, pendingAttachments),
        policyId: info.policyId,
        confidence: record.decision.confidence,
        assertions,
        signals: record.signals,
        timings: record.timings,
        beforeFingerprint: record.beforeFingerprint,
        afterFingerprint: record.afterFingerprint,
        screenChanged: record.screenChanged,
        dispatchStatus: record.dispatchStatus,
        verificationStatus: record.verificationStatus,
      };
      writer.pushAt("automation", data, record.startedAt);
    },
    attachScreenshot: async (stepId: string, base64Png: string): Promise<string> => {
      const name = `shot-${sanitizeAttachmentName(stepId)}.png`;
      await invokeCommand("recording_session_attach", {
        sessionId,
        name,
        base64Data: base64Png,
      });
      const entry = `attachments/${name}`;
      attachments.set(stepId, entry);
      return entry;
    },
    finish: async (result: RunResult): Promise<FinishedRunRecording> => {
      await Promise.allSettled(pendingAttachments);
      try {
        await writer.stop();
      } catch {
        return finishPartial(result, info, sessionId, startedAt, "automation flush failed");
      }
      const cancelled = result.status === "cancelled";
      const manifest = runManifest(info, sessionId, startedAt, result, cancelled);
      try {
        const filePath = await invokeCommand("recording_session_stop", {
          sessionId,
          manifestJson: JSON.stringify(manifest),
        });
        return { filePath, partial: cancelled, sessionId };
      } catch (error) {
        return finishPartial(
          result,
          info,
          sessionId,
          startedAt,
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  };
}

/**
 * Builds the session manifest, writing the run status, the policy id and
 * the flow or goal alongside the existing fields. A cancelled run is
 * incomplete but preserved; a failed run is complete — the failure is the
 * result, not a recording defect.
 */
function runManifest(
  info: AutomationRunInfo,
  sessionId: string,
  startedAt: number,
  result: RunResult,
  partial: boolean,
): SessionManifest {
  const manifest: SessionManifest = {
    version: 1,
    sessionId,
    label: info.label,
    startedAt,
    duration: Math.max(0, result.endedAt - startedAt),
    deviceSerial: info.deviceSerial,
    targetUrl: null,
    appPackage: info.appPackage,
    tracks: { rrweb: false, network: false, console: false, automation: true },
    automation: {
      runStatus: result.status,
      policyId: info.policyId,
      flowId: info.flow?.id ?? null,
      flowName: info.flow?.name ?? null,
      goal: info.goal,
      taskId: info.taskId,
      taskRunId: info.taskRunId,
      taskOrigin: info.taskOrigin,
      flowSnapshot: info.flow ?? null,
    },
  };
  if (partial) {
    manifest.incomplete = {
      errors: [`run ${result.status} with its recording preserved`],
      missingTracks: [],
    };
  }
  return manifest;
}

/**
 * Finalizes a partial session without throwing. A lost recording of a
 * failed run is the worst possible outcome here, so finalization reports
 * instead of raising.
 */
async function finishPartial(
  result: RunResult,
  info: AutomationRunInfo,
  sessionId: string,
  startedAt: number,
  cause: string,
): Promise<FinishedRunRecording> {
  const manifest = runManifest(info, sessionId, startedAt, result, true);
  manifest.incomplete = { errors: [cause], missingTracks: [] };
  try {
    const filePath = await invokeCommand("recording_session_stop", {
      sessionId,
      manifestJson: JSON.stringify(manifest),
    });
    return { filePath, partial: true, sessionId };
  } catch {
    return { filePath: null, partial: true, sessionId };
  }
}

/**
 * Resolves a step screenshot reference to an archive entry name. Inline
 * payloads are dropped, never inlined into the NDJSON.
 */
function screenshotEntryFor(
  record: StepRecord,
  sessionId: string,
  attachments: Map<string, string>,
  pendingAttachments: Promise<void>[],
): string | null {
  const ref = record.screenshotRef;
  if (ref === "") {
    return null;
  }
  for (const name of attachments.values()) {
    if (ref === name || ref.endsWith(`/${name}`)) {
      return name;
    }
  }
  if (ref.startsWith("data:") || looksLikeInlineBase64(ref)) {
    const name = `shot-${sanitizeAttachmentName(record.stepId)}.png`;
    const entry = `attachments/${name}`;
    attachments.set(record.stepId, entry);
    pendingAttachments.push(
      invokeCommand("recording_session_attach", {
        sessionId,
        name,
        base64Data: ref.startsWith("data:") ? ref.replace(/^data:image\/png;base64,/, "") : ref,
      }).then(() => undefined),
    );
    return entry;
  }
  return ref;
}

/**
 * Reports whether a reference looks like an inline base64 payload rather
 * than an archive entry name.
 */
function looksLikeInlineBase64(ref: string): boolean {
  return ref.length > 512 && /^[A-Za-z0-9+/=\s]+$/.test(ref);
}

/**
 * Sanitizes a step id into an attachment file stem.
 */
function sanitizeAttachmentName(stepId: string): string {
  const cleaned = stepId.replace(/[^A-Za-z0-9_-]/g, "_").replace(/_+/g, "_");
  return cleaned === "" ? "step" : cleaned;
}

/**
 * Generates a recording session id without any runtime dependency.
 */
export function generateRunSessionId(): string {
  const host = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (host.crypto !== undefined && typeof host.crypto.randomUUID === "function") {
    return `run-${host.crypto.randomUUID()}`;
  }
  return `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}
