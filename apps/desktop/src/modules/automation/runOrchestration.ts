import { computed, ref } from "vue";
import { useSessionStore } from "@/stores/session.store";
import { useTargetsStore } from "@/stores/targets.store";
import {
  appendRunEntry,
  createRunView,
  DEFAULT_POLICY_ID,
  defaultLimitsFor,
  describePolicySelection,
  finishRunView,
  startRunView,
} from "./agentPanelState";
import type {
  AgentPanelRunState,
  FeedEntry,
  PolicyOption,
  RunLimitValues,
} from "./agentPanelState";
import { runFlow, runGoal } from "./flowExecutor";
import type { ExecutorDeps, RunResult } from "./flowExecutor";
import { createDesktopExecutorDeps } from "./runDeps";
import { invokeCommand } from "@/runtime/ipc/client";
import { cachedPackages, setCachedPackageDetails } from "./useInstalledPackages";
import { startRunRecording, RECORDING_ENABLED } from "./runTrace";
import { createJevPolicy } from "./policies/jev";
import { createEmbeddedReasoningPolicy } from "./policies/embedded";
import { JEV_MODEL_VERSION } from "./policies/jev";
import { createRulesPolicy } from "./policies/rules";
import { candidatesFromObservation } from "./authoringCandidates";
import type { RuleIntent } from "./policies/rules";
import type {
  LocalPolicy,
  PolicyId,
  PolicyInput,
  RemotePolicy,
  RemotePolicyInput,
} from "./policies/types";
import type {
  AutomationCandidate,
  Decision,
  Flow,
  RunStatus,
  StepRecord,
} from "@/types/automation.types";
import type { DeviceActions } from "./deviceActions";
import { useFlowStore } from "./flowStore";
import { getRunRegistry } from "./runRegistry";
import { actionTurn, requestTurn, statusTurn } from "./agentConversationState";
import type { AgentConversationTurn } from "./agentConversationState";

export function availablePolicies(): PolicyOption[] {
  const rules = createRulesPolicy([]);
  const jev = createJevPolicy();
  const embedded = createEmbeddedReasoningPolicy();
  return [rules, jev, embedded].map((policy) => ({
    id: policy.id,
    label: policy.label,
    model: policy.id === "jev" ? JEV_MODEL_VERSION : undefined,
    isRemote: policy.isRemote,
    dataNotice: policy.dataNotice,
  }));
}

function mapStatus(
  status: RunStatus,
): Exclude<AgentPanelRunState, "idle" | "running" | "cancelled"> {
  switch (status) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "halted":
      return "halted";
    case "cancelled":
      return "halted";
    case "pending":
    case "running":
      return "failed";
  }
}

export function createRunOrchestration() {
  const sessionStore = useSessionStore();
  const targetsStore = useTargetsStore();
  const flowStore = useFlowStore();
  const policies = availablePolicies();
  const selectedPolicyId = ref<PolicyId>(DEFAULT_POLICY_ID);
  const goal = ref("");
  const selectedFlowId = ref<string | null>(null);
  const selectedAppPackage = ref("");
  const limits = ref<RunLimitValues>(defaultLimitsFor(DEFAULT_POLICY_ID));
  const runView = ref(createRunView());
  const authoringCandidates = ref<AutomationCandidate[]>([]);
  const authoringLoading = ref(false);
  const authoringError = ref<string | null>(null);
  const records = ref<StepRecord[]>([]);
  const conversation = ref<AgentConversationTurn[]>([]);
  let controller: AbortController | null = null;
  let registryRunId: string | null = null;
  let seq = 0;

  const serial = computed<string | null>(() => sessionStore.selectedDevice?.serial ?? null);

  /**
   * The preselected app: the manual flow's package when set, else the App
   * section's selected target. openApp always opens this; Jev's free text
   * never reaches the device.
   */
  const appPackage = computed<string>(() => {
    if (selectedAppPackage.value.trim() !== "") {
      return selectedAppPackage.value.trim();
    }
    const flow = flowStore.flows.find((entry) => entry.id === selectedFlowId.value);
    if (flow !== undefined && flow.appPackage.trim() !== "") {
      return flow.appPackage.trim();
    }
    const target = targetsStore.selectedTarget;
    if (target !== null && target.source === "adb" && (target.packageName ?? "") !== "") {
      return target.packageName ?? "";
    }
    return "";
  });

  const selectedOption = computed<PolicyOption>(
    () =>
      policies.find((policy) => policy.id === selectedPolicyId.value) ?? {
        id: "jev" as PolicyId,
        label: "Jev",
        isRemote: true,
        dataNotice: "Jev policy metadata is unavailable.",
      },
  );

  const selection = computed(() => describePolicySelection(selectedOption.value));
  const needsFlow = computed(() => selectedPolicyId.value === "rules");

  const rulesIntents = computed<RuleIntent[]>(() => {
    const flow = flowStore.flows.find((entry) => entry.id === selectedFlowId.value);
    if (flow === undefined) {
      return [];
    }
    return flow.steps.filter((step): step is RuleIntent => step.op !== "assert");
  });

  const hasGoal = computed(() =>
    needsFlow.value ? rulesIntents.value.length > 0 : goal.value.trim() !== "",
  );

  const canStart = computed(
    () =>
      hasGoal.value &&
      selection.value.runnable &&
      serial.value !== null &&
      appPackage.value !== "" &&
      (runView.value.state === "idle" ||
        runView.value.state === "passed" ||
        runView.value.state === "failed" ||
        runView.value.state === "halted" ||
        runView.value.state === "cancelled"),
  );

  const isRunning = computed(() => runView.value.state === "running");

  if (!flowStore.loaded) {
    flowStore.loadFlows();
  }
  if (selectedFlowId.value === null && flowStore.flows.length > 0) {
    selectedFlowId.value = flowStore.flows[0]?.id ?? null;
  }

  function onPolicyChange(id: string): void {
    if (id !== "rules" && id !== "jev" && id !== "embedded") {
      return;
    }
    selectedPolicyId.value = id;
    limits.value = defaultLimitsFor(id);
    if (id === "rules" && selectedFlowId.value === null && flowStore.flows.length > 0) {
      selectedFlowId.value = flowStore.flows[0]?.id ?? null;
    }
  }

  function setAppPackage(packageName: string): void {
    selectedAppPackage.value = packageName.trim();
  }

  function pushFeed(entry: Omit<FeedEntry, "seq">): void {
    seq += 1;
    const item = { ...entry, seq };
    runView.value = appendRunEntry(runView.value, item);
    if (runView.value.state === "running") {
      conversation.value = [...conversation.value, actionTurn(`action-${seq}`, item)];
    }
  }

  function loggingPolicy(policy: LocalPolicy | RemotePolicy): LocalPolicy | RemotePolicy {
    if (policy.isRemote) {
      const remote = policy;
      return {
        ...remote,
        decide: async (input: RemotePolicyInput): Promise<Decision> => {
          try {
            const decision = await remote.decide(input);
            pushFeed({
              stepId: `step-${input.stepIndex}`,
              operation: decision.operation,
              confidence: decision.confidence,
              outcome: decision.operation,
              detail: decision.reason,
            });
            return decision;
          } catch (error) {
            pushFeed({
              stepId: `step-${input.stepIndex}`,
              operation: "jev",
              confidence: null,
              outcome: "error",
              detail: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        },
      };
    }
    const local = policy;
    return {
      ...local,
      decide: async (input: PolicyInput): Promise<Decision> => {
        try {
          const decision = await local.decide(input);
          pushFeed({
            stepId: `step-${input.stepIndex}`,
            operation: decision.operation,
            confidence: decision.confidence,
            outcome: decision.operation,
            detail: decision.reason,
          });
          return decision;
        } catch (error) {
          pushFeed({
            stepId: `step-${input.stepIndex}`,
            operation: local.id,
            confidence: null,
            outcome: "error",
            detail: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      },
    };
  }

  function loggingActions(actions: DeviceActions): DeviceActions {
    const methods = [
      "tap",
      "longPress",
      "swipe",
      "scroll",
      "inputText",
      "pressKey",
      "back",
      "openApp",
      "screenSize",
    ] as const;
    const wrapped = {} as Record<(typeof methods)[number], (...args: never[]) => Promise<unknown>>;
    for (const method of methods) {
      wrapped[method] = async (...args: never[]): Promise<unknown> => {
        try {
          const result = await (actions[method] as (...callArgs: never[]) => Promise<unknown>)(
            ...args,
          );
          pushFeed({
            stepId: method,
            operation: method,
            confidence: null,
            outcome: "ok",
            detail: null,
          });
          return result;
        } catch (error) {
          pushFeed({
            stepId: method,
            operation: method,
            confidence: null,
            outcome: "error",
            detail: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      };
    }
    return wrapped as unknown as DeviceActions;
  }

  function buildPolicy(): LocalPolicy | RemotePolicy {
    switch (selectedPolicyId.value) {
      case "rules":
        return createRulesPolicy(rulesIntents.value);
      case "jev":
        return createJevPolicy();
      case "embedded":
        return createEmbeddedReasoningPolicy();
    }
  }

  async function disposePolicy(policy: LocalPolicy | RemotePolicy): Promise<void> {
    const disposable = policy as Partial<{ dispose(): Promise<void> }>;
    if (typeof disposable.dispose === "function") {
      await disposable.dispose();
    }
  }

  async function startRun(): Promise<void> {
    const deviceSerial = serial.value;
    if (!canStart.value || deviceSerial === null || controller !== null) {
      return;
    }
    const prompt = goal.value.trim();
    const previousRequest = [...conversation.value]
      .reverse()
      .find(
        (turn): turn is Extract<AgentConversationTurn, { kind: "request" }> =>
          turn.kind === "request",
      );
    const goalText =
      previousRequest === undefined
        ? prompt
        : `Continue this device task: ${previousRequest.text}\n\nFollow-up: ${prompt}`;
    const turnId = `turn-${Date.now()}-${conversation.value.length}`;
    conversation.value = [...conversation.value, requestTurn(turnId, prompt)];
    goal.value = "";
    controller = new AbortController();
    const signal = controller.signal;
    runView.value = startRunView();
    records.value = [];
    if (!needsFlow.value) {
      try {
        const registry = getRunRegistry();
        registryRunId = registry.startGoal(goalText, selectedPolicyId.value, deviceSerial, {
          limits: limits.value,
          acknowledgeDataNotice: true,
          appPackage: appPackage.value === "" ? null : appPackage.value,
        });
        const activeRunId = registryRunId;
        const poll = (): void => {
          if (activeRunId === null) {
            return;
          }
          try {
            const status = registry.getStatus(activeRunId);
            if (status.status === "running" || status.status === "pending") {
              window.setTimeout(poll, 300);
              return;
            }
            const finalState = mapStatus(status.status);
            runView.value = finishRunView(runView.value, finalState, status.failureReason);
            conversation.value = [
              ...conversation.value,
              statusTurn(`${turnId}-status`, finalState, status.failureReason),
            ];
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            runView.value = finishRunView(runView.value, "failed", message);
            conversation.value = [
              ...conversation.value,
              statusTurn(`${turnId}-status`, "failed", message),
            ];
          } finally {
            if (runView.value.state !== "running") {
              if (registryRunId === activeRunId) {
                registryRunId = null;
              }
              controller = null;
            }
          }
        };
        poll();
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        runView.value = finishRunView(runView.value, "failed", message);
        conversation.value = [
          ...conversation.value,
          statusTurn(`${turnId}-status`, "failed", message),
        ];
        controller = null;
        return;
      }
    }
    const policy = loggingPolicy(buildPolicy());
    const installed = await resolveInstalledPackages(deviceSerial);
    const desktop = createDesktopExecutorDeps(deviceSerial, installed, appPackage.value);
    const deps: ExecutorDeps = { ...desktop, actions: loggingActions(desktop.actions) };
    const flow: Flow | null = needsFlow.value
      ? (flowStore.flows.find((entry) => entry.id === selectedFlowId.value) ?? null)
      : null;
    const recording = RECORDING_ENABLED
      ? await startRunRecording({
          label: flow?.name ?? goalText,
          policyId: selectedPolicyId.value,
          flow,
          goal: needsFlow.value ? null : goalText,
          deviceSerial,
          appPackage: appPackage.value === "" ? null : appPackage.value,
        }).catch((error: unknown) => {
          runView.value = finishRunView(
            runView.value,
            "failed",
            `could not start the run recording: ${error instanceof Error ? error.message : String(error)}`,
          );
          return null;
        })
      : null;
    if (recording === null && RECORDING_ENABLED) {
      conversation.value = [
        ...conversation.value,
        statusTurn(`${turnId}-status`, "failed", runView.value.failureReason),
      ];
      controller = null;
      return;
    }
    let result: RunResult | null = null;
    try {
      const onStep = (record: StepRecord): void => {
        records.value = [...records.value, record];
        pushFeed({
          stepId: record.stepId,
          operation: record.decision.operation,
          confidence: record.decision.confidence,
          outcome: record.verificationStatus ?? record.outcome,
          detail: stepFeedDetail(record),
        });
        recording?.recordStep(record);
      };
      result =
        flow !== null
          ? await runFlow(flow, deps, signal, onStep)
          : await runGoal(goalText, policy, deps, { ...limits.value }, signal, {
              assertions: [],
              onStep,
            });
      runView.value = finishRunView(runView.value, mapStatus(result.status), result.failureReason);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runView.value = finishRunView(runView.value, "failed", message);
      result = {
        status: "failed",
        records: [],
        failureReason: message,
        startedAt: recording?.startedAt ?? Date.now(),
        endedAt: Date.now(),
      };
    } finally {
      await recording?.finish(
        result ?? {
          status: "failed",
          records: [],
          failureReason: "run ended without a result",
          startedAt: recording?.startedAt ?? Date.now(),
          endedAt: Date.now(),
        },
      );
      await disposePolicy(policy);
      const finalState = runView.value.state;
      if (finalState !== "idle" && finalState !== "running") {
        conversation.value = [
          ...conversation.value,
          statusTurn(`${turnId}-status`, finalState, runView.value.failureReason),
        ];
      }
      controller = null;
    }
  }

  function cancelRun(): void {
    if (registryRunId !== null) {
      void getRunRegistry().cancelRun(registryRunId);
      return;
    }
    controller?.abort();
  }

  async function refreshAuthoringCandidates(): Promise<void> {
    const deviceSerial = serial.value;
    if (deviceSerial === null) {
      authoringCandidates.value = [];
      authoringError.value = "Select a connected device first";
      return;
    }
    authoringLoading.value = true;
    authoringError.value = null;
    try {
      const installed = await resolveInstalledPackages(deviceSerial);
      const desktop = createDesktopExecutorDeps(deviceSerial, installed, appPackage.value);
      authoringCandidates.value = candidatesFromObservation(await desktop.observe());
      if (authoringCandidates.value.length === 0) {
        authoringError.value = "No visible enabled controls found on current screen";
      }
    } catch (error) {
      authoringCandidates.value = [];
      authoringError.value = error instanceof Error ? error.message : String(error);
    } finally {
      authoringLoading.value = false;
    }
  }

  /**
   * Resolves third-party package names with per-serial cache.
   */
  async function resolveInstalledPackages(deviceSerial: string): Promise<string[]> {
    const hit = cachedPackages(deviceSerial);
    if (hit.length > 0) {
      return hit;
    }
    try {
      const rows = await invokeCommand("session_list_packages", {
        serial: deviceSerial,
        scope: "third-party",
      });
      setCachedPackageDetails(deviceSerial, rows);
      return rows.map((row) => row.packageName);
    } catch {
      return [];
    }
  }

  function setLimit(field: keyof RunLimitValues, value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return;
    }
    limits.value = { ...limits.value, [field]: Math.round(parsed) };
  }

  function resetConversation(): void {
    conversation.value = [];
    goal.value = "";
  }

  return {
    policies,
    selectedPolicyId,
    goal,
    selectedFlowId,
    selectedAppPackage,
    limits,
    runView,
    records,
    conversation,
    serial,
    appPackage,
    selectedOption,
    selection,
    needsFlow,
    hasGoal,
    canStart,
    isRunning,
    onPolicyChange,
    setAppPackage,
    startRun,
    cancelRun,
    authoringCandidates,
    authoringLoading,
    authoringError,
    refreshAuthoringCandidates,
    setLimit,
    resetConversation,
  };
}

function stepFeedDetail(record: StepRecord): string {
  const parts = [];
  if (record.dispatchStatus !== undefined) {
    parts.push(`dispatch ${record.dispatchStatus}`);
  }
  if (record.verificationStatus !== undefined) {
    parts.push(`verification ${record.verificationStatus}`);
  }
  if (record.screenChanged !== undefined) {
    parts.push(record.screenChanged ? "screen changed" : "screen unchanged");
  }
  if (record.error !== null) {
    parts.push(record.error);
  }
  return parts.join(" · ");
}
