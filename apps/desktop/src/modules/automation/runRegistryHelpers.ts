/**
 * Standalone helpers behind `createRunRegistry`.
 *
 * Split out of `runRegistry.ts`, which had grown past the repository's
 * source-size limit. Everything here takes its inputs explicitly and closes
 * over no registry state, which is what made this the safe seam to cut first.
 */
import type {
  AutomationPrincipal,
  AutomationTask,
  Flow,
  FlowStepOp,
  PresalioAcceptanceReport,
  ReasoningOwner,
  StepRecord,
} from "@/types/automation.types";
import type { ExecutorDeps } from "./flowExecutor";
import type { LocalPolicy, PolicyId, RemotePolicy } from "./policies/types";
import type { RuleIntent } from "./policies/rules";
import { createRulesPolicy } from "./policies/rules";
import { createJevPolicy } from "./policies/jev";
import { createEmbeddedReasoningPolicy } from "./policies/embedded";
import { createArtemisPolicy } from "./policies/artemis";
import type { ArtemisTraceAction } from "./policies/artemis";
import { createArtemisTransport } from "./artemisTransport";
import type { ReasoningStreamRecord } from "./reasoning/streamEvents";
import type { ManagedRun, RunRegistryDeps } from "./runRegistryTypes";
import type { PresalioMilestone } from "./acceptance";
import { parseAutomationTrack } from "./runHistory";
import type { AutomationCapuEvent } from "@/types/replay.types";
import { terminalStatusFromRunStatus } from "./taskRuntime";

export async function launchSelectedApp(
  managed: ManagedRun,
  executor: ExecutorDeps,
): Promise<StepRecord | null> {
  const appPackage = managed.taskRuntime.task.appPackage;
  if (appPackage === null || appPackage === "") return null;
  const startedAt = Date.now();
  try {
    await executor.authorizeAction?.(
      { operation: "openApp", text: appPackage, confidence: 1, reason: "launch selected app" },
      "bootstrap.open-app",
    );
    await executor.actions.openApp(managed.deviceSerial, appPackage);
    return {
      stepId: "bootstrap.open-app",
      startedAt,
      endedAt: Date.now(),
      decision: {
        operation: "openApp",
        text: appPackage,
        confidence: 1,
        reason: "launch selected app",
      },
      resolvedTarget: null,
      outcome: "ok",
      error: null,
      screenshotRef: "",
      attempts: 1,
      goalStepId: null,
      dispatchStatus: "dispatched",
      verificationStatus: "not_run",
    };
  } catch (error) {
    return {
      stepId: "bootstrap.open-app",
      startedAt,
      endedAt: Date.now(),
      decision: {
        operation: "openApp",
        text: appPackage,
        confidence: 1,
        reason: "launch selected app",
      },
      resolvedTarget: null,
      outcome: "failed",
      error: error instanceof Error ? error.message : String(error),
      screenshotRef: "",
      attempts: 1,
      goalStepId: null,
      dispatchStatus: "failed",
      verificationStatus: "unverified",
    };
  }
}

/**
 * Builds the policy for an MCP goal run. Rules replays a saved flow's
 * steps as intents; jev and artemis take the free-prose goal.
 */
export function buildRegistryPolicy(
  policyId: PolicyId,
  flowId: string | null,
  deps: RunRegistryDeps,
  onReasoningActivity?: (record: ReasoningStreamRecord) => void,
  onArtemisActions?: (traceId: string, actions: ArtemisTraceAction[]) => void,
  deviceSerial?: string | null,
  appPackage?: string | null,
): LocalPolicy | RemotePolicy {
  switch (policyId) {
    case "rules": {
      if (flowId === null) {
        throw new Error("policy 'rules' needs a flowId whose steps become its intents");
      }
      const flow = deps.loadFlow(flowId);
      if (flow === null) {
        throw new Error(`unknown flow ${flowId}`);
      }
      const intents = flow.steps.filter((step): step is RuleIntent => step.op !== "assert");
      if (intents.length === 0) {
        throw new Error(`flow ${flowId} yields no actionable intents`);
      }
      return createRulesPolicy(intents);
    }
    case "jev":
      return createJevPolicy();
    case "embedded":
      return createEmbeddedReasoningPolicy({ onActivity: onReasoningActivity });
    case "artemis":
      return createArtemisPolicy({
        transport: createArtemisTransport(appPackage ?? null),
        deviceSerial: deviceSerial ?? null,
        onActions: onArtemisActions,
      });
  }
}

export function artemisOperation(name: string): FlowStepOp {
  const normalized = name.toLowerCase();
  if (normalized.includes("launch")) return "openApp";
  if (normalized.includes("type") || normalized.includes("input")) return "type";
  if (normalized.includes("scroll")) return "scroll";
  if (normalized.includes("swipe")) return "swipe";
  if (normalized.includes("back")) return "back";
  if (normalized.includes("wait")) return "wait";
  return "tap";
}

/**
 * Reads an optional dispose hook without changing the policy contract.
 */
export function asDisposable(policy: LocalPolicy | RemotePolicy): (() => Promise<void>) | null {
  const candidate = policy as Partial<{ dispose(): Promise<void> }>;
  if (typeof candidate.dispose === "function") {
    const dispose = candidate.dispose.bind(policy);
    return () => dispose();
  }
  return null;
}

/** Maps existing policies to their canonical task reasoning owner. */
export function ownerForPolicy(policyId: PolicyId): ReasoningOwner {
  switch (policyId) {
    case "rules":
      return "deterministic";
    case "artemis":
      return "artemis";
    case "jev":
      return "embedded";
    case "embedded":
      return "embedded";
  }
}

/** Gives legacy run results a durable, inspectable terminal reason. */
export function terminalReason(
  status: ReturnType<typeof terminalStatusFromRunStatus>,
): AutomationTask["terminalReason"] {
  switch (status) {
    case "failed":
      return "execution-failed";
    case "blocked":
      return "verification-failed";
    case "cancelled":
      return "cancelled-by-user";
    case "completed":
    case null:
      return null;
  }
}

/**
 * Backfills assertion results from the finished .capu once, so trace reads
 * carry what the run verified without re-reading the archive per page.
 */
export async function backfillAssertions(run: ManagedRun, deps: RunRegistryDeps): Promise<void> {
  if (run.assertionsLoaded || run.filePath === null) {
    return;
  }
  run.assertionsLoaded = true;
  try {
    const session = await deps.readSessionFile(run.filePath);
    const events: AutomationCapuEvent[] = parseAutomationTrack(session.automationNdjson);
    for (const event of events) {
      run.assertionsByStep.set(event.data.stepId, event.data.assertions);
    }
  } catch {
    return;
  }
}

export function acceptanceMilestonesForFlow(flow: Flow | null): Map<string, PresalioMilestone> {
  if (flow?.acceptanceScenario !== "presalio-order-v1") {
    return new Map();
  }
  return new Map(
    flow.steps.flatMap((step) =>
      step.op === "assert" && step.acceptanceMilestone !== undefined
        ? [[step.id, step.acceptanceMilestone] as const]
        : [],
    ),
  );
}

export function acceptanceModeForPolicy(
  policyId: PolicyId,
  principal: AutomationPrincipal,
): PresalioAcceptanceReport["mode"] {
  if (policyId === "artemis") {
    return "artemis-pro";
  }
  if (principal.kind === "mcp") {
    return principal.clientName?.toLowerCase().includes("claude") ? "claude-mcp" : "chatgpt-mcp";
  }
  return policyId === "embedded" ? "embedded" : "deterministic";
}

export function acceptanceUnavailableReason(reason: string | null): string | null {
  if (reason === null) {
    return null;
  }
  return /provider unavailable|credentials|MCP tunnel/i.test(reason) ? reason : null;
}

/**
 * Resolves the one app a goal may act in: the caller's, else its flow's.
 * Refuses at start when neither names one. The authorization scope is built
 * from this value, and an empty scope denies every action, so an unscoped
 * goal would otherwise spend an observation and a policy call only to fail
 * its first tap with a misleading no-progress halt.
 */
export function requireGoalApp(
  appPackage: string | null | undefined,
  flowId: string | null | undefined,
  deps: Pick<RunRegistryDeps, "loadFlow">,
): string {
  const resolved =
    appPackage ??
    (flowId === undefined || flowId === null ? null : deps.loadFlow(flowId)?.appPackage);
  if (resolved === undefined || resolved === null || resolved === "") {
    throw new Error(
      "an agent goal needs app_package (or a flow_id whose flow names one): a task may only act inside an app it was authorized for",
    );
  }
  return resolved;
}
