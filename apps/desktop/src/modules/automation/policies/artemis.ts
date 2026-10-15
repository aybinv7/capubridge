import type { Decision } from "@/types/automation.types";
import { PolicyDecisionError, registerPolicy } from "./types";
import type { LocalPolicy, PolicyInput } from "./types";

/** ARTEMIS execution model. Flash reacts every ~5 s; Pro plans every ~30 s. */
export type ArtemisModel = "flash" | "pro";

/** Terminal and live states of one ARTEMIS task. */
export type ArtemisTaskState = "running" | "completed" | "failed" | "cancelled" | "unknown";

/** Status of one ARTEMIS task behind the injected transport. */
export interface ArtemisTaskStatus {
  state: ArtemisTaskState;
  elapsedSeconds: number;
  summary: string | null;
  error: string | null;
}

export interface ArtemisTraceAction {
  id: string;
  name: string;
  status: string;
  error: string | null;
}

/**
 * Calls into the locally configured ARTEMIS MCP server. Injected so tests
 * never touch a device or the server. Mirrors mobile_run_task (submit),
 * mobile_manage_task status (poll) and mobile_manage_task stop (teardown).
 */
export interface ArtemisTransport {
  startTask(goal: string, deviceSerial: string | null, model: ArtemisModel): Promise<string>;
  taskStatus(traceId: string): Promise<ArtemisTaskStatus>;
  listActions?(traceId: string): Promise<ArtemisTraceAction[]>;
  stopTask(traceId: string): Promise<void>;
}

/** Options for the ARTEMIS policy. */
export interface ArtemisPolicyOptions {
  transport: ArtemisTransport;
  model?: ArtemisModel;
  deviceSerial?: string | null;
  onActions?: (traceId: string, actions: ArtemisTraceAction[]) => void;
}

/**
 * Confidence for supervision decisions. ARTEMIS exposes no per-step
 * confidence; these decisions report the factual task state (running,
 * finished), never a guess about goal success, so they carry full
 * confidence without inventing a number.
 */
export const ARTEMIS_SUPERVISION_CONFIDENCE = 1;

/**
 * Suggested run limits per model for the run panel. Flash steps average
 * ~5 s, Pro turns ~30 s, so a duration limit tuned for Jev would kill an
 * ARTEMIS run immediately.
 */
export const ARTEMIS_SUGGESTED_LIMITS = {
  flash: { maxSteps: 60, maxDurationMs: 10 * 60_000, maxConsecutiveFailures: 5 },
  pro: { maxSteps: 40, maxDurationMs: 30 * 60_000, maxConsecutiveFailures: 3 },
} as const;

/**
 * ARTEMIS policy as session supervision. ARTEMIS owns whole tasks through
 * its own loop, so per-step relay is not supportable: mirroring its actions
 * as decisions would act twice, once by ARTEMIS and once by the executor.
 * Instead the first decide starts one ARTEMIS task, later decides answer
 * wait while it runs, and its terminal state becomes done (verified by
 * assertions, never by the policy) or blocked naming the failure.
 */
export function createArtemisPolicy(
  options: ArtemisPolicyOptions,
): LocalPolicy & { dispose(): Promise<void> } {
  const model = options.model ?? "flash";
  const deviceSerial = options.deviceSerial ?? null;
  let traceId: string | null = null;
  let tornDown = false;
  let ended = false;

  async function teardown(): Promise<void> {
    if (traceId === null || tornDown) {
      return;
    }
    tornDown = true;
    try {
      await options.transport.stopTask(traceId);
    } catch {
      return;
    }
  }

  return {
    id: "artemis",
    label: "Artemis",
    isRemote: false,
    dataNotice: null,
    decide: async (input: PolicyInput): Promise<Decision> => {
      if (ended) {
        return {
          operation: "done",
          confidence: ARTEMIS_SUPERVISION_CONFIDENCE,
          reason: "artemis supervision already ended; verifying what the device shows",
        };
      }
      if (traceId === null) {
        try {
          traceId = await options.transport.startTask(input.goal, deviceSerial, model);
        } catch (error) {
          throw new PolicyDecisionError("transport", messageOf(error));
        }
        return {
          operation: "wait",
          confidence: ARTEMIS_SUPERVISION_CONFIDENCE,
          reason: `artemis task ${traceId} started`,
        };
      }
      let status: ArtemisTaskStatus;
      try {
        status = await options.transport.taskStatus(traceId);
        const actions = await options.transport.listActions?.(traceId);
        if (actions !== undefined) options.onActions?.(traceId, actions);
      } catch (error) {
        ended = true;
        await teardown();
        throw new PolicyDecisionError("transport", messageOf(error));
      }
      switch (status.state) {
        case "running":
          return {
            operation: "wait",
            confidence: ARTEMIS_SUPERVISION_CONFIDENCE,
            reason: `artemis task ${traceId} running (${status.elapsedSeconds}s)${summarize(status)}`,
          };
        case "completed":
          ended = true;
          await teardown();
          return {
            operation: "done",
            confidence: ARTEMIS_SUPERVISION_CONFIDENCE,
            reason: `artemis task ${traceId} completed; verifying against assertions`,
          };
        case "failed":
        case "cancelled":
        case "unknown":
          ended = true;
          await teardown();
          return {
            operation: "blocked",
            confidence: ARTEMIS_SUPERVISION_CONFIDENCE,
            reason: `artemis task ${traceId} ${status.state}${describeFailure(status)}`,
          };
      }
    },
    dispose: async (): Promise<void> => {
      ended = true;
      await teardown();
    },
  };
}

/**
 * Appends the human progress excerpt to a supervision reason when present.
 */
function summarize(status: ArtemisTaskStatus): string {
  return status.summary === null || status.summary === "" ? "" : `: ${status.summary}`;
}

/**
 * Names the ARTEMIS-side failure for a blocked reason. No outcome without
 * a Decision equivalent is ever silently dropped.
 */
function describeFailure(status: ArtemisTaskStatus): string {
  if (status.error !== null && status.error !== "") {
    return `: ${status.error}`;
  }
  return summarize(status);
}

/**
 * Renders an unknown failure for an error message without throwing.
 */
function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown error";
}

registerPolicy("artemis", (options?: unknown) => createArtemisPolicy(readArtemisOptions(options)));

/**
 * Reads registry factory options without throwing on shape alone. A missing
 * or partial transport throws a clear error pointing at
 * createArtemisPolicy instead of failing later mid-run.
 */
function readArtemisOptions(options: unknown): ArtemisPolicyOptions {
  if (typeof options !== "object" || options === null) {
    throw new PolicyDecisionError(
      "transport",
      "artemis needs an injected transport: build it with createArtemisPolicy",
    );
  }
  const record = options as {
    transport?: Partial<ArtemisTransport>;
    model?: unknown;
    deviceSerial?: unknown;
  };
  const transport = record.transport;
  if (
    transport === undefined ||
    typeof transport.startTask !== "function" ||
    typeof transport.taskStatus !== "function" ||
    typeof transport.stopTask !== "function"
  ) {
    throw new PolicyDecisionError(
      "transport",
      "artemis needs an injected transport: build it with createArtemisPolicy",
    );
  }
  return {
    transport: transport as ArtemisTransport,
    model: record.model === "pro" ? "pro" : "flash",
    deviceSerial: typeof record.deviceSerial === "string" ? record.deviceSerial : null,
    onActions: undefined,
  };
}
