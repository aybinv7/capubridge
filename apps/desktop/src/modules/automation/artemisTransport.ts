import { invokeCommand } from "@/runtime/ipc/client";
import type { ArtemisTaskStatus, ArtemisTraceAction, ArtemisTransport } from "./policies/artemis";
import { artemisDiagnosticMessage } from "./artemisDiagnostics";

type ArtemisTrace = {
  status?: unknown;
  elapsed_seconds?: unknown;
  summary?: unknown;
  error?: unknown;
  result?: unknown;
};

const PROVIDER_UNAVAILABLE_RETRY_LIMIT = 3;

export function createArtemisTransport(lockedAppPackage: string | null = null): ArtemisTransport {
  const latestSteps = new Map<string, unknown>();
  return {
    async startTask(goal, deviceSerial, model) {
      try {
        const result = await invokeCommand("artemis_start_task", {
          payload: { goal, deviceSerial, model, lockedAppPackage },
        });
        return result.traceId;
      } catch (error) {
        try {
          throw new Error(artemisDiagnosticMessage(await invokeCommand("artemis_diagnose")));
        } catch (diagnosticError) {
          if (
            diagnosticError instanceof Error &&
            diagnosticError.message !== "ARTEMIS diagnostics are unavailable."
          )
            throw diagnosticError;
          throw error;
        }
      }
    },
    async taskStatus(traceId): Promise<ArtemisTaskStatus> {
      const trace = (await invokeCommand("artemis_get_trace", {
        payload: { traceId },
      })) as ArtemisTrace;
      const steps = await invokeCommand("artemis_get_steps", { payload: { traceId } });
      latestSteps.set(traceId, steps);
      const providerError = providerUnavailableError(steps);
      const raw = typeof trace.status === "string" ? trace.status : "unknown";
      return {
        state: providerError === null ? normalizeState(raw) : "failed",
        elapsedSeconds: typeof trace.elapsed_seconds === "number" ? trace.elapsed_seconds : 0,
        summary: readSummary(trace),
        error: providerError ?? (typeof trace.error === "string" ? trace.error : null),
      };
    },
    async stopTask(traceId) {
      await invokeCommand("artemis_stop_task", { payload: { traceId } });
    },
    async listActions(traceId): Promise<ArtemisTraceAction[]> {
      const steps =
        latestSteps.get(traceId) ??
        (await invokeCommand("artemis_get_steps", { payload: { traceId } }));
      return actionRows(steps);
    },
  };
}

function providerUnavailableError(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const errors = value.flatMap(providerRetryErrors);
  if (errors.length < PROVIDER_UNAVAILABLE_RETRY_LIMIT) return null;
  return `ARTEMIS provider unavailable after ${errors.length} retries: ${errors[0]}`;
}

function providerRetryErrors(step: unknown): string[] {
  if (typeof step !== "object" || step === null) return [];
  const tools = (step as { generic_tools?: unknown }).generic_tools;
  if (!Array.isArray(tools)) return [];
  return tools.flatMap((tool) => {
    if (typeof tool !== "object" || tool === null) return [];
    const row = tool as { type?: unknown; status?: unknown; payload?: unknown };
    if (row.type !== "llm_call" || (row.status !== "failed" && row.status !== "retrying"))
      return [];
    const error = toolError(row.payload);
    return error !== null && isProviderUnavailable(error) ? [error] : [];
  });
}

function toolError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const error = (payload as { error?: unknown }).error;
  return typeof error === "string" ? error : null;
}

function isProviderUnavailable(error: string): boolean {
  return (
    /\b(429|500|502|503|504)\b/.test(error) || /unavailable|high demand|rate limit/i.test(error)
  );
}

function actionRows(value: unknown): ArtemisTraceAction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((step) => {
    if (typeof step !== "object" || step === null) return [];
    const tools = (step as { generic_tools?: unknown }).generic_tools;
    if (!Array.isArray(tools)) return [];
    return tools.flatMap((tool): ArtemisTraceAction[] => {
      if (typeof tool !== "object" || tool === null) return [];
      const row = tool as {
        trace_id?: unknown;
        type?: unknown;
        name?: unknown;
        status?: unknown;
        error?: unknown;
      };
      if (row.type !== "action" || typeof row.trace_id !== "string" || typeof row.name !== "string")
        return [];
      return [
        {
          id: row.trace_id,
          name: row.name,
          status: typeof row.status === "string" ? row.status : "unknown",
          error: typeof row.error === "string" ? row.error : null,
        },
      ];
    });
  });
}

function normalizeState(status: string): ArtemisTaskStatus["state"] {
  if (status === "running" || status === "queued" || status === "pending" || status === "paused")
    return "running";
  if (status === "completed") return "completed";
  if (status === "failed" || status === "rejected") return "failed";
  if (status === "cancelled" || status === "stopped") return "cancelled";
  return "unknown";
}

function readSummary(trace: ArtemisTrace): string | null {
  if (typeof trace.summary === "string") return trace.summary;
  if (typeof trace.result === "string") return trace.result;
  return null;
}
