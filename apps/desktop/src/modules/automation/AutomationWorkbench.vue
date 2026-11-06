<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Code2,
  FlaskConical,
  Globe,
  History,
  ListChecks,
  OctagonX,
  Play,
  Plus,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import AgentWorkspace from "./AgentWorkspace.vue";
import FlowMigrationNote from "./FlowMigrationNote.vue";
import FlowSourceEditor from "./FlowSourceEditor.vue";
import RunsDrawer from "./RunsDrawer.vue";
import StepCanvas from "./StepCanvas.vue";
import StepInspector from "./StepInspector.vue";
import { EDITABLE_STEP_OPS } from "./flowEditorState";
import type { Flow, FlowStep, FlowStepOp } from "@/types/automation.types";
import type { RunView, RunViewStep } from "./runSource";
import { fromArchive } from "./runSource";
import { flowFromRunSteps, moveTargetFor } from "./stepRowModel";
import type { MoveDirection } from "./stepRowModel";
import { parseAutomationTrack, toRunRow } from "./runHistory";
import { parseReplayManifest } from "@/composables/useReplaySession";
import { invokeCommand } from "@/runtime/ipc/client";
import { useFlowStore } from "./flowStore";
import { createRunOrchestration } from "./runOrchestration";
import { useWorkbenchRun } from "./useWorkbenchRun";
import { useInstalledPackages } from "./useInstalledPackages";
import { useMirrorStore } from "@/stores/mirror.store";
import { archivedConversationTurns } from "./agentConversationState";

const route = useRoute();
const router = useRouter();
const flowStore = useFlowStore();
const orch = createRunOrchestration();
const installedPackages = useInstalledPackages();
const mirrorStore = useMirrorStore();
const workbenchRun = useWorkbenchRun();

const selectedStepId = ref<string | null>(null);
const sheetOpen = ref(false);
const creatingFlow = ref(false);
const newFlowName = ref("");
const addOp = ref<FlowStepOp>("tap");
const archivedView = ref<RunView | null>(null);
const archivedFlow = ref<Flow | null>(null);
const archivedFilePath = ref<string | null>(null);
const archivedGoal = ref<string | null>(null);
const loadingRun = ref(false);
const runLoadError = ref<string | null>(null);
const sourceMode = ref(false);

const flowId = computed(() => {
  const param = route.params.flowId;
  return typeof param === "string" ? param : null;
});

const runId = computed(() => {
  const param = route.params.runId;
  return typeof param === "string" ? param : null;
});

const isRunMode = computed(() => runId.value !== null);
const isAgentMode = computed(() => !orch.needsFlow.value);
const archivedConversation = computed(() => {
  if (runId.value === null || archivedView.value === null) {
    return null;
  }
  return archivedConversationTurns(
    runId.value,
    archivedGoal.value ?? "Saved agent run",
    archivedView.value.steps,
    archivedView.value.status,
  );
});

const activeFlow = computed(() => flowStore.activeFlow);

const foreignRunReason = computed(() =>
  workbenchRun.isForeign.value && workbenchRun.isRunning.value
    ? workbenchRun.blockedReason({
        flow: activeFlow.value,
        deviceSerial: orch.serial.value,
        runnable: true,
        invalidReason: null,
      })
    : null,
);

function cancelActiveRun(): void {
  if (workbenchRun.isForeign.value) {
    void workbenchRun.cancel();
    return;
  }
  orch.cancelRun();
}

const activeStep = computed<FlowStep | null>(() => {
  if (activeFlow.value === null || selectedStepId.value === null) {
    return null;
  }
  return activeFlow.value.steps.find((s) => s.id === selectedStepId.value) ?? null;
});

const canvasFlow = computed<Flow | null>(() => {
  if (isRunMode.value) {
    return archivedFlow.value;
  }
  return activeFlow.value;
});

const canvasRunSteps = computed<RunViewStep[] | null>(() => {
  if (isRunMode.value) {
    return archivedView.value?.steps ?? null;
  }
  return workbenchRun.liveView.value?.steps ?? null;
});

const inspectorStep = computed<FlowStep | null>(() => (isRunMode.value ? null : activeStep.value));

const inspectorRunStep = computed<RunViewStep | null>(() => {
  const id = selectedStepId.value;
  if (id === null) {
    return null;
  }
  const archived = archivedView.value?.steps.find((step) => step.stepId === id);
  if (archived !== undefined) {
    return archived;
  }
  return workbenchRun.liveView.value?.steps.find((step) => step.stepId === id) ?? null;
});

const inspectorFilePath = computed<string | null>(() =>
  isRunMode.value ? archivedFilePath.value : null,
);

const POLICY_ICONS = { rules: ListChecks, jev: Globe } as const;

function policyIcon(id: string) {
  return POLICY_ICONS[id as keyof typeof POLICY_ICONS] ?? ListChecks;
}

function policyPillClass(active: boolean): string {
  return active
    ? "text-brand font-medium bg-brand-soft border border-brand/25"
    : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-surface-2 border border-transparent";
}

/**
 * Run-history drawer, opened by the History control. Runs across every flow
 * live here rather than in a tab, so background work stays reachable from the
 * one surface.
 */
const drawer = ref<InstanceType<typeof RunsDrawer> | null>(null);

/** Opens a run from the drawer through the route, so the permalink is the same one a link carries. */
function openRunFromDrawer(runId: string): void {
  void router.push(`/automation/runs/${runId}`);
}

function selectFlow(id: string | null): void {
  if (id === null) {
    return;
  }
  flowStore.selectFlow(id);
  orch.selectedFlowId.value = id;
}

function createNewFlow(): void {
  const name = newFlowName.value.trim();
  if (name === "") {
    return;
  }
  flowStore.createFlow(name, orch.appPackage.value);
  orch.selectedFlowId.value = flowStore.activeId;
  toast.success(`Flow "${name}" created`);
  newFlowName.value = "";
  creatingFlow.value = false;
}

function openSourceEditor(): void {
  if (activeFlow.value === null) {
    return;
  }
  sourceMode.value = true;
}

function closeSourceEditor(): void {
  sourceMode.value = false;
}

function applySourceFlow(flow: Flow): void {
  flowStore.importFlow(flow);
  selectedStepId.value = flow.steps[0]?.id ?? null;
  sourceMode.value = false;
  toast.success("Source applied");
}

function isNarrowViewport(): boolean {
  return window.matchMedia("(max-width: 1279px)").matches;
}

function onSelectStep(id: string): void {
  selectedStepId.value = id;
  if (isNarrowViewport()) {
    sheetOpen.value = true;
  }
}

function onUpdateStep(next: FlowStep): void {
  if (activeFlow.value === null) {
    return;
  }
  const index = activeFlow.value.steps.findIndex((s) => s.id === next.id);
  if (index >= 0) {
    flowStore.updateStep(index, next);
  }
}

/**
 * Reorders a step from the canvas. `moveTargetFor` returns null for the
 * no-ops — first step up, last step down, a produced row — so those are
 * silently ignored rather than erroring at the edge of the list.
 */
function onMoveStep(id: string, direction: MoveDirection): void {
  if (activeFlow.value === null) {
    return;
  }
  const target = moveTargetFor(activeFlow.value, id, direction);
  if (target === null) {
    return;
  }
  flowStore.moveStepBy(target.from, target.to);
}

function onDeleteStep(id: string): void {
  if (activeFlow.value === null) {
    return;
  }
  if (!window.confirm("Delete this step? This cannot be undone.")) {
    return;
  }
  const index = activeFlow.value.steps.findIndex((s) => s.id === id);
  if (index >= 0) {
    flowStore.deleteStepBy(index);
    toast.success("Step deleted");
  }
  if (selectedStepId.value === id) {
    selectedStepId.value = null;
  }
}

function onAddStep(): void {
  flowStore.addStep(addOp.value);
  toast.success(`Added ${addOp.value} step`);
}

function togglePresalioAcceptance(): void {
  if (activeFlow.value?.appPackage !== "com.presalio.app") {
    return;
  }
  const enabled = activeFlow.value.acceptanceScenario === "presalio-order-v1";
  flowStore.setAcceptanceScenario(enabled ? undefined : "presalio-order-v1");
  toast.success(enabled ? "Presalio acceptance disabled" : "Presalio acceptance enabled");
}

function onPolicyChange(id: string): void {
  orch.onPolicyChange(id);
}

function closeArchivedConversation(): void {
  void router.push("/automation");
}

async function loadArchivedRun(id: string): Promise<void> {
  loadingRun.value = true;
  runLoadError.value = null;
  archivedView.value = null;
  archivedFlow.value = null;
  archivedFilePath.value = null;
  archivedGoal.value = null;
  try {
    const items = await invokeCommand("recording_list_sessions", undefined);
    const row =
      items
        .map((item) => toRunRow(item))
        .find((entry) => entry !== null && entry.sessionId === id) ?? null;
    if (row === null) {
      runLoadError.value = `run ${id} not found`;
      return;
    }
    const raw = await invokeCommand("recording_read_session", { filePath: row.filePath });
    const manifest = parseReplayManifest(raw.manifest_json);
    const events = parseAutomationTrack(raw.tracks["automation"] ?? "");
    const view = fromArchive(events, manifest);
    archivedView.value = view;
    archivedFilePath.value = row.filePath;
    archivedGoal.value = manifest.automation?.goal ?? row.goal ?? manifest.label;
    archivedFlow.value =
      manifest.automation?.flowSnapshot ??
      flowFromRunSteps(view.steps, {
        name: manifest.label,
        goal: manifest.automation?.goal ?? manifest.label,
        goalStepId: "goal",
        policyId: "rules",
        limits: { maxSteps: 40, maxDurationMs: 300000, maxConsecutiveFailures: 3 },
      });
    const failedId =
      view.failedStepIndex !== null ? (view.steps[view.failedStepIndex]?.stepId ?? null) : null;
    selectedStepId.value = failedId ?? view.steps[0]?.stepId ?? null;
  } catch (error) {
    runLoadError.value = error instanceof Error ? error.message : String(error);
  } finally {
    loadingRun.value = false;
  }
}

onMounted(() => {
  if (!flowStore.loaded) {
    flowStore.loadFlows();
  }
  if (flowId.value !== null) {
    selectFlow(flowId.value);
  } else if (flowStore.activeId !== null) {
    orch.selectedFlowId.value = flowStore.activeId;
  }
  if (orch.serial.value !== null) {
    void installedPackages.load(orch.serial.value);
  }
  const query = window.matchMedia("(min-width: 1280px)");
  const closeOnWide = (event: MediaQueryListEvent): void => {
    if (event.matches) {
      sheetOpen.value = false;
    }
  };
  query.addEventListener("change", closeOnWide);
});

watch(flowId, (id) => {
  if (id !== null) {
    selectFlow(id);
  }
});

watch(
  () => route.path,
  (path) => {
    if (path === "/automation") {
      mirrorStore.open();
    }
  },
  { immediate: true },
);

watch(
  () => orch.serial.value,
  (serial) => {
    if (serial !== null) {
      void installedPackages.load(serial);
    }
  },
);

watch(
  runId,
  (id) => {
    if (id !== null) {
      void loadArchivedRun(id);
    } else {
      archivedView.value = null;
      archivedFlow.value = null;
      archivedFilePath.value = null;
      archivedGoal.value = null;
      runLoadError.value = null;
    }
  },
  { immediate: true },
);

watch(
  () => flowStore.activeId,
  (id) => {
    if (id !== null) {
      orch.selectedFlowId.value = id;
    }
  },
);

watch(activeFlow, (flow) => {
  if (flow !== null && selectedStepId.value === null && flow.steps.length > 0) {
    selectedStepId.value = flow.steps[0]?.id ?? null;
  }
  if (flow === null) {
    selectedStepId.value = null;
  }
});

watch(sourceMode, (open) => {
  if (open && orch.serial.value !== null) {
    void orch.refreshAuthoringCandidates();
  }
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <AgentWorkspace
      v-if="isAgentMode"
      :goal="orch.goal.value"
      :policies="orch.policies"
      :selected-policy="orch.selectedOption.value"
      :limits="orch.limits.value"
      :run-state="orch.runView.value.state"
      :conversation="orch.conversation.value"
      :archived-conversation="archivedConversation"
      :can-start="orch.canStart.value"
      :serial="orch.serial.value"
      :app-package="orch.appPackage.value"
      :packages="installedPackages.packages.value"
      @update:goal="(value) => (orch.goal.value = value)"
      @update:app-package="orch.setAppPackage"
      @select-policy="onPolicyChange"
      @set-limit="orch.setLimit"
      @start="orch.startRun"
      @cancel="orch.cancelRun"
      @close-history="closeArchivedConversation"
      @reset-conversation="orch.resetConversation"
    />

    <template v-else>
      <header class="flex shrink-0 items-center gap-3 border-b border-border/30 px-4 py-2">
        <div class="flex items-center gap-2">
          <FlaskConical :size="16" class="shrink-0 text-primary" />
          <span class="text-sm font-semibold tracking-tight">Automation Studio</span>
          <Badge v-if="isRunMode" variant="outline" class="shrink-0">run mode</Badge>
        </div>
        <div class="flex-1" />
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1">
            <button
              v-for="policy in orch.policies"
              :key="policy.id"
              type="button"
              :title="policy.dataNotice ?? policy.label"
              :class="[
                'flex items-center gap-2 px-3 py-1.5 text-sm transition-colors duration-150 rounded-xl',
                policyPillClass(orch.selectedPolicyId.value === policy.id),
              ]"
              @click="onPolicyChange(policy.id)"
            >
              <component
                :is="policyIcon(policy.id)"
                :size="13"
                :class="[
                  'shrink-0',
                  orch.selectedPolicyId.value === policy.id ? 'opacity-100' : 'opacity-50',
                ]"
              />
              {{ policy.label }}
            </button>
          </div>
          <Button
            size="sm"
            :disabled="!orch.canStart.value || foreignRunReason !== null"
            :title="foreignRunReason ?? undefined"
            @click="orch.startRun"
          >
            <Play :size="14" />Run
          </Button>
          <Button
            v-if="orch.isRunning.value || workbenchRun.isRunning.value"
            size="sm"
            variant="outline"
            @click="cancelActiveRun"
          >
            <OctagonX :size="14" />Cancel
          </Button>
          <Badge v-if="workbenchRun.isForeign.value" variant="outline" class="shrink-0">
            {{ workbenchRun.originLabel.value }}
          </Badge>
          <Badge
            v-if="orch.runView.value.state !== 'idle'"
            :variant="
              orch.runView.value.state === 'passed'
                ? 'secondary'
                : orch.runView.value.state === 'running'
                  ? 'default'
                  : 'destructive'
            "
            class="shrink-0"
          >
            {{ orch.runView.value.state }}
          </Badge>
        </div>
      </header>

      <ResizablePanelGroup direction="horizontal" class="flex-1">
        <ResizablePanel :default-size="65" :min-size="30">
          <div class="flex h-full flex-col overflow-hidden p-4">
            <div v-if="creatingFlow" class="mb-3 flex flex-wrap items-end gap-2">
              <div class="flex min-w-40 flex-1 flex-col gap-1">
                <Label for="wb-new-name">Flow name</Label>
                <Input
                  id="wb-new-name"
                  v-model:model-value="newFlowName"
                  placeholder="Checkout"
                  class="h-8"
                />
              </div>
              <Button size="sm" :disabled="newFlowName.trim() === ''" @click="createNewFlow"
                >Create</Button
              >
              <Button
                size="sm"
                variant="ghost"
                @click="
                  creatingFlow = false;
                  newFlowName = '';
                  toast.info('Discarded');
                "
                >Cancel</Button
              >
            </div>

            <div v-else-if="activeFlow !== null" class="mb-3 flex flex-wrap items-center gap-2">
              <Select
                :model-value="flowStore.activeId ?? ''"
                @update:model-value="
                  (value) => selectFlow(String(value) === '' ? null : String(value))
                "
              >
                <SelectTrigger class="h-8 w-44">
                  <SelectValue placeholder="Select a flow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="flow in flowStore.flows" :key="flow.id" :value="flow.id">
                    {{ flow.name }} ({{ flow.steps.length }})
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                v-if="!creatingFlow"
                size="sm"
                variant="ghost"
                class="h-8 shrink-0 px-2"
                @click="creatingFlow = true"
              >
                <Plus :size="14" />
                New
              </Button>
              <Select v-model:model-value="addOp">
                <SelectTrigger class="h-8 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="op in EDITABLE_STEP_OPS" :key="op" :value="op">{{
                    op
                  }}</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" @click="onAddStep"> <Plus :size="14" />Add step </Button>
              <Button
                v-if="activeFlow.appPackage === 'com.presalio.app'"
                size="sm"
                variant="outline"
                class="h-8 shrink-0 px-2"
                :aria-pressed="activeFlow.acceptanceScenario === 'presalio-order-v1'"
                @click="togglePresalioAcceptance"
              >
                <FlaskConical :size="14" />
                {{
                  activeFlow.acceptanceScenario === "presalio-order-v1"
                    ? "Acceptance on"
                    : "Acceptance"
                }}
              </Button>
              <Button
                size="sm"
                variant="outline"
                class="h-8 shrink-0 px-2"
                :aria-pressed="sourceMode"
                @click="sourceMode ? closeSourceEditor() : openSourceEditor()"
              >
                <Code2 :size="14" />{{ sourceMode ? "Canvas" : "Source" }}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                class="h-8 shrink-0 px-2"
                title="Run history"
                @click="drawer?.open()"
              >
                <History :size="14" />
                History
              </Button>
              <span v-if="!flowStore.runnability.runnable" class="text-sm text-destructive">{{
                flowStore.runnability.reason
              }}</span>
            </div>

            <p
              v-if="orch.runView.value.failureReason !== null"
              class="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive"
            >
              {{ orch.runView.value.failureReason }}
            </p>

            <FlowMigrationNote
              v-if="!isRunMode && activeFlow?.migrationNote !== undefined"
              class="mb-3"
              :note="activeFlow?.migrationNote ?? ''"
              @dismiss="flowStore.dismissMigrationNote"
            />

            <div class="flex-1 overflow-hidden rounded-lg border border-border/40">
              <FlowSourceEditor
                v-if="sourceMode && activeFlow !== null"
                :flow="activeFlow"
                :candidates="orch.authoringCandidates.value"
                :candidates-loading="orch.authoringLoading.value"
                :candidates-error="orch.authoringError.value"
                @apply="applySourceFlow"
                @cancel="closeSourceEditor"
                @refresh-targets="orch.refreshAuthoringCandidates"
              />
              <StepCanvas
                v-else-if="canvasFlow !== null"
                :flow="canvasFlow"
                :run-steps="canvasRunSteps"
                :selected-step-id="selectedStepId"
                :is-running="orch.isRunning.value"
                @select="onSelectStep"
                @move="onMoveStep"
                @delete="onDeleteStep"
              />
              <div
                v-else-if="isRunMode && loadingRun"
                class="flex h-full items-center justify-center p-8 text-center"
              >
                <p class="text-sm text-muted-foreground">Loading run…</p>
              </div>
              <div
                v-else-if="isRunMode"
                class="flex h-full flex-col items-center justify-center gap-2 p-8 text-center"
              >
                <p class="text-sm text-destructive">
                  {{ runLoadError ?? "Could not load this run." }}
                </p>
              </div>
              <div
                v-else-if="!creatingFlow"
                class="flex h-full flex-col items-center justify-center gap-2 p-8 text-center"
              >
                <h2 class="text-lg font-medium">No flow yet</h2>
                <p class="max-w-md text-sm text-muted-foreground">
                  Create one to start authoring deterministic steps.
                </p>
                <Button size="sm" @click="creatingFlow = true"><Plus :size="14" />New flow</Button>
              </div>
              <div v-else class="flex h-full items-center justify-center p-8 text-center">
                <p class="max-w-md text-sm text-muted-foreground">
                  Name your flow above, then add steps.
                </p>
              </div>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle class="hidden xl:flex" />
        <ResizablePanel :default-size="35" :min-size="20" class="hidden xl:flex">
          <div class="flex h-full flex-col overflow-hidden">
            <StepInspector
              :step="inspectorStep"
              :run-step="inspectorRunStep"
              :file-path="inspectorFilePath"
              :acceptance-scenario="activeFlow?.acceptanceScenario"
              @update:step="onUpdateStep"
              @delete="onDeleteStep"
            >
              <template #goal="{ step: goalStep }">
                <p class="text-sm text-muted-foreground">
                  Goal policy picker will appear here (CB-61).
                </p>
                <span class="hidden">{{ goalStep.id }}</span>
              </template>
            </StepInspector>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Sheet v-model:open="sheetOpen">
        <SheetContent side="right" class="flex w-[420px] flex-col p-0 xl:hidden">
          <SheetHeader class="shrink-0 p-4">
            <SheetTitle>Inspector</SheetTitle>
          </SheetHeader>
          <div class="flex-1 overflow-hidden">
            <StepInspector
              :step="inspectorStep"
              :run-step="inspectorRunStep"
              :file-path="inspectorFilePath"
              :acceptance-scenario="activeFlow?.acceptanceScenario"
              @update:step="onUpdateStep"
              @delete="onDeleteStep"
            />
          </div>
        </SheetContent>
      </Sheet>
    </template>

    <RunsDrawer ref="drawer" @select="openRunFromDrawer" />
  </div>
</template>
