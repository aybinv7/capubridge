<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ExternalLink } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { invokeCommand } from "@/runtime/ipc/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TargetFields from "./TargetFields.vue";
import { inspectorState, withTarget } from "./stepInspectorState";
import {
  PRESALIO_ORDER_MILESTONES,
  type FlowStep,
  type PresalioMilestone,
  type TargetRef,
} from "@/types/automation.types";
import type { RunViewStep } from "./runSource";

const props = defineProps<{
  step: FlowStep | null;
  runStep: RunViewStep | null;
  filePath: string | null;
  acceptanceScenario: "presalio-order-v1" | undefined;
}>();

const emit = defineEmits<{
  "update:step": [step: FlowStep];
  delete: [stepId: string];
}>();

const state = computed(() => inspectorState(props.step, props.runStep, props.filePath));
const screenshotUrl = ref<string | null>(null);
const screenshotMissing = ref(false);

function onTargetChange(target: TargetRef | undefined): void {
  if (props.step === null) {
    return;
  }
  emit("update:step", withTarget(props.step, target));
}

function onScalar(field: string, value: string): void {
  if (props.step === null) {
    return;
  }
  emit("update:step", { ...props.step, [field]: value } as FlowStep);
}

function targetOf(step: FlowStep): TargetRef | undefined {
  if (step.op === "tap" || step.op === "longPress" || step.op === "type" || step.op === "scroll") {
    return (step as Extract<FlowStep, { target?: TargetRef }>).target;
  }
  return undefined;
}

function goalTextOf(step: FlowStep): string {
  return step.op === "goal" ? step.goal : "";
}

function setAcceptanceMilestone(value: string): void {
  if (props.step === null || props.step.op !== "assert") {
    return;
  }
  const milestone = value === "none" ? undefined : (value as PresalioMilestone);
  emit("update:step", { ...props.step, acceptanceMilestone: milestone });
}

watch(
  () => [props.runStep?.screenshotRef ?? "", props.filePath] as const,
  () => {
    void loadScreenshot();
  },
  { immediate: true },
);

async function loadScreenshot(): Promise<void> {
  screenshotUrl.value = null;
  screenshotMissing.value = false;
  const ref = props.runStep?.screenshotRef ?? "";
  if (ref === "") {
    screenshotMissing.value = true;
    return;
  }
  if (ref.startsWith("data:image/")) {
    screenshotUrl.value = ref;
    return;
  }
  if (ref.length > 512 && /^[A-Za-z0-9+/=\s]+$/.test(ref)) {
    screenshotUrl.value = `data:image/png;base64,${ref}`;
    return;
  }
  if (props.filePath === null) {
    screenshotMissing.value = true;
    return;
  }
  const name = ref.includes("/") ? (ref.split("/").pop() ?? ref) : ref;
  try {
    const base64 = await invokeCommand("recording_read_attachment", {
      filePath: props.filePath,
      name,
    });
    screenshotUrl.value = `data:image/png;base64,${base64}`;
  } catch {
    screenshotMissing.value = true;
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div
      v-if="state.mode === 'run' && state.runDetail !== null"
      class="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
    >
      <div class="flex items-center gap-2">
        <Badge variant="secondary">{{ state.runDetail.decision }}</Badge>
        <span class="text-sm text-muted-foreground">{{
          state.runDetail.confidence.toFixed(2)
        }}</span>
        <Badge v-if="state.runDetail.strategy !== null" variant="outline">{{
          state.runDetail.strategy
        }}</Badge>
      </div>
      <div
        v-if="state.runDetail.fallbackLabel !== null"
        class="rounded-md bg-surface-1 p-2 text-sm"
      >
        {{ state.runDetail.fallbackLabel }}
      </div>
      <dl class="grid grid-cols-2 gap-2 text-sm">
        <div class="rounded-md bg-surface-1 p-2">
          <dt class="text-xs text-muted-foreground">Resolved target</dt>
          <dd>{{ state.runDetail.resolvedTarget ?? "none" }}</dd>
        </div>
        <div class="rounded-md bg-surface-1 p-2">
          <dt class="text-xs text-muted-foreground">Strategy</dt>
          <dd>{{ state.runDetail.strategy ?? "none" }}</dd>
        </div>
      </dl>
      <p
        v-if="state.runDetail.error !== null"
        class="rounded-md bg-destructive/10 p-2 text-sm text-destructive"
      >
        {{ state.runDetail.error }}
      </p>
      <dl v-if="state.runDetail.signals !== undefined" class="grid grid-cols-2 gap-2 text-sm">
        <div class="rounded-md bg-surface-1 p-2">
          <dt class="text-xs text-muted-foreground">Pending requests</dt>
          <dd>{{ state.runDetail.signals.pendingRequests }}</dd>
        </div>
        <div class="rounded-md bg-surface-1 p-2">
          <dt class="text-xs text-muted-foreground">Last DB write</dt>
          <dd>{{ state.runDetail.signals.lastDbWrite ?? "none" }}</dd>
        </div>
        <div
          v-if="state.runDetail.signals.recentErrors.length > 0"
          class="col-span-2 rounded-md bg-destructive/10 p-2 text-destructive"
        >
          {{ state.runDetail.signals.recentErrors.join(" · ") }}
        </div>
      </dl>
      <dl v-if="state.runDetail.timings !== undefined" class="grid grid-cols-4 gap-2 text-sm">
        <div class="rounded-md bg-surface-1 p-2">
          <dt class="text-xs text-muted-foreground">Policy</dt>
          <dd>
            {{ state.runDetail.timings.policyMs ?? "—"
            }}{{ state.runDetail.timings.policyMs === undefined ? "" : " ms" }}
          </dd>
        </div>
        <div class="rounded-md bg-surface-1 p-2">
          <dt class="text-xs text-muted-foreground">Observe</dt>
          <dd>{{ state.runDetail.timings.observationMs }} ms</dd>
        </div>
        <div class="rounded-md bg-surface-1 p-2">
          <dt class="text-xs text-muted-foreground">Action</dt>
          <dd>{{ state.runDetail.timings.actionMs }} ms</dd>
        </div>
        <div class="rounded-md bg-surface-1 p-2">
          <dt class="text-xs text-muted-foreground">Settle</dt>
          <dd>{{ state.runDetail.timings.settleMs }} ms</dd>
        </div>
      </dl>
      <dl class="grid grid-cols-2 gap-2 text-sm">
        <div class="rounded-md bg-surface-1 p-2">
          <dt class="text-xs text-muted-foreground">Dispatch</dt>
          <dd>{{ state.runDetail.dispatchStatus ?? "unknown" }}</dd>
        </div>
        <div class="rounded-md bg-surface-1 p-2">
          <dt class="text-xs text-muted-foreground">Verification</dt>
          <dd>{{ state.runDetail.verificationStatus ?? "unknown" }}</dd>
        </div>
        <div class="rounded-md bg-surface-1 p-2">
          <dt class="text-xs text-muted-foreground">Screen changed</dt>
          <dd>
            {{
              state.runDetail.screenChanged === null
                ? "unknown"
                : state.runDetail.screenChanged
                  ? "yes"
                  : "no"
            }}
          </dd>
        </div>
        <div class="rounded-md bg-surface-1 p-2">
          <dt class="text-xs text-muted-foreground">State fingerprint</dt>
          <dd class="truncate" :title="state.runDetail.afterFingerprint ?? undefined">
            {{ state.runDetail.afterFingerprint ?? state.runDetail.beforeFingerprint ?? "none" }}
          </dd>
        </div>
      </dl>
      <div v-if="state.runDetail.assertions.length > 0" class="flex flex-col gap-2">
        <h4 class="text-sm font-medium">Assertions</h4>
        <div
          v-for="(row, index) in state.runDetail.assertions"
          :key="index"
          class="rounded-md bg-surface-1 p-2 text-sm"
          :class="row.passed ? '' : 'text-destructive'"
        >
          <div class="font-medium">{{ row.kind }} · {{ row.passed ? "Passed" : "Failed" }}</div>
          <div class="text-xs">
            <span v-if="row.expected !== null">expected "{{ row.expected }}" · </span>observed "{{
              row.observed
            }}"
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <img
          v-if="screenshotUrl !== null"
          :src="screenshotUrl"
          alt="Step screenshot"
          class="max-h-72 rounded-md border border-border/40 object-contain"
        />
        <p
          v-else-if="screenshotMissing || !state.runDetail.screenshot.present"
          class="text-sm text-muted-foreground"
        >
          No screenshot for this step.
        </p>
        <p v-else class="text-sm text-muted-foreground">Loading screenshot…</p>
      </div>
      <details
        v-if="state.runDetail.rawAnswer !== null"
        class="rounded-md bg-surface-1 p-2 text-sm"
      >
        <summary class="cursor-pointer text-muted-foreground">Raw policy answer</summary>
        <pre class="mt-2 max-h-96 overflow-auto text-xs">{{ state.runDetail.rawAnswer }}</pre>
      </details>
      <Button v-if="state.runDetail.replayHref !== null" size="sm" variant="outline" as-child>
        <a :href="state.runDetail.replayHref">
          <ExternalLink :size="14" />
          Open in Replay at this step
        </a>
      </Button>
      <slot name="run-extra" :run-step="runStep" />
    </div>

    <div v-else-if="step !== null" class="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div v-if="step.op === 'goal'" class="flex flex-col gap-3">
        <Label>Goal</Label>
        <p class="text-sm">{{ goalTextOf(step) }}</p>
        <slot name="goal" :step="step">
          <p class="text-sm text-muted-foreground">Goal policy picker will appear here (CB-61).</p>
        </slot>
      </div>
      <template v-else>
        <div class="flex items-center gap-2">
          <Badge variant="secondary">{{ step.op }}</Badge>
          <span class="text-sm text-muted-foreground">{{ step.id }}</span>
          <span class="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            class="h-7 px-2 text-xs text-destructive"
            @click="emit('delete', step.id)"
          >
            Delete
          </Button>
        </div>
        <div
          v-if="state.errors.length > 0"
          class="rounded-md bg-destructive/10 p-2 text-sm text-destructive"
        >
          {{ state.errors[0]?.message }}
        </div>
        <div
          v-if="
            targetOf(step) !== undefined ||
            step.op === 'tap' ||
            step.op === 'longPress' ||
            step.op === 'type'
          "
          class="flex flex-col gap-2"
        >
          <Label>Target</Label>
          <p class="text-xs text-muted-foreground">Selector strongest, point weakest.</p>
          <TargetFields
            :target="targetOf(step)"
            :allow-none="step.op === 'scroll'"
            @change="onTargetChange"
          />
        </div>
        <div
          v-if="step.op === 'assert' && acceptanceScenario === 'presalio-order-v1'"
          class="flex flex-col gap-1"
        >
          <Label :for="`acceptance-${step.id}`">Presalio checkpoint</Label>
          <Select
            :model-value="step.acceptanceMilestone ?? 'none'"
            @update:model-value="(value) => setAcceptanceMilestone(String(value))"
          >
            <SelectTrigger :id="`acceptance-${step.id}`">
              <SelectValue placeholder="No checkpoint" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No checkpoint</SelectItem>
              <SelectItem
                v-for="milestone in PRESALIO_ORDER_MILESTONES"
                :key="milestone"
                :value="milestone"
              >
                {{ milestone }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">
            A checkpoint is recorded only when this assertion verifies.
          </p>
        </div>
        <div v-if="step.op === 'type'" class="flex flex-col gap-1">
          <Label for="inspector-type-text">Text</Label>
          <Input
            id="inspector-type-text"
            :model-value="(step as Extract<FlowStep, { op: 'type' }>).text"
            @update:model-value="(v) => onScalar('text', String(v))"
          />
        </div>
        <div v-if="step.op === 'pressKey'" class="flex flex-col gap-1">
          <Label for="inspector-keycode">Keycode</Label>
          <Input
            id="inspector-keycode"
            :model-value="(step as Extract<FlowStep, { op: 'pressKey' }>).keycode"
            @update:model-value="(v) => onScalar('keycode', String(v))"
          />
        </div>
        <div v-if="step.op === 'openApp'" class="flex flex-col gap-1">
          <Label for="inspector-package">Package</Label>
          <Input
            id="inspector-package"
            :model-value="(step as Extract<FlowStep, { op: 'openApp' }>).packageName"
            @update:model-value="(v) => onScalar('packageName', String(v))"
          />
        </div>
        <div v-if="step.op === 'wait'" class="flex flex-col gap-1">
          <Label for="inspector-wait">Duration (ms)</Label>
          <Input
            id="inspector-wait"
            :model-value="String((step as Extract<FlowStep, { op: 'wait' }>).durationMs)"
            inputmode="numeric"
            @update:model-value="(v) => onScalar('durationMs', String(v))"
          />
        </div>
      </template>
    </div>

    <div v-else class="flex h-full items-center justify-center p-8 text-center">
      <p class="text-sm text-muted-foreground">Select a step to inspect it.</p>
    </div>
  </div>
</template>
