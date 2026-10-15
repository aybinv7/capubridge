<script setup lang="ts">
import { Bot, OctagonX, Plus, SendHorizontal } from "lucide-vue-next";
import { computed, ref } from "vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { Textarea } from "@/components/ui/textarea";
import AgentComposerSettings from "./AgentComposerSettings.vue";
import AgentAppSelector from "./AgentAppSelector.vue";
import TaskEventInspector from "./TaskEventInspector.vue";
import TaskHistoryRail from "./TaskHistoryRail.vue";
import { hasRemotePolicyConsent, saveRemotePolicyConsent } from "./agentRemoteConsent";
import { useAutomationTaskHistory } from "./useAutomationTaskHistory";
import type { AgentConversationTurn } from "./agentConversationState";
import type { AgentPanelRunState, PolicyOption, RunLimitValues } from "./agentPanelState";

const props = defineProps<{
  goal: string;
  policies: PolicyOption[];
  selectedPolicy: PolicyOption;
  limits: RunLimitValues;
  runState: AgentPanelRunState;
  conversation: AgentConversationTurn[];
  archivedConversation: AgentConversationTurn[] | null;
  canStart: boolean;
  serial: string | null;
  appPackage: string;
  packages: string[];
}>();

const emit = defineEmits<{
  "update:goal": [value: string];
  selectPolicy: [id: string];
  setLimit: [field: keyof RunLimitValues, value: string];
  start: [];
  cancel: [];
  closeHistory: [];
  resetConversation: [];
  "update:appPackage": [value: string];
}>();

const consentOpen = ref(false);
const taskHistory = useAutomationTaskHistory();
const isRunning = computed(() => props.runState === "running");
const isArchived = computed(() => props.archivedConversation !== null);
const displayedConversation = computed(() => props.archivedConversation ?? props.conversation);
const promptPlaceholder = computed(() =>
  isArchived.value
    ? "This saved conversation is read-only"
    : props.conversation.length === 0
      ? "Describe what you want the agent to do on this device"
      : "Ask a follow-up or refine the next action",
);
const targetLabel = computed(() => {
  if (props.appPackage !== "") {
    return props.appPackage;
  }
  return props.serial === null ? "Select a connected Android device" : `Device ${props.serial}`;
});

type ToolState = "input-available" | "output-available" | "output-error";

function toolState(outcome: string): ToolState {
  if (outcome === "error" || outcome === "failed") {
    return "output-error";
  }
  if (outcome === "ok" || outcome === "verified") {
    return "output-available";
  }
  return "input-available";
}

function requestStart(): void {
  if (!props.canStart || isRunning.value) {
    return;
  }
  if (props.selectedPolicy.isRemote && !hasRemotePolicyConsent(props.selectedPolicy)) {
    consentOpen.value = true;
    return;
  }
  emit("start");
}

function acceptConsent(): void {
  saveRemotePolicyConsent(props.selectedPolicy);
  consentOpen.value = false;
  emit("start");
}

function onPromptKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    requestStart();
  }
}
</script>

<template>
  <div class="relative flex h-full min-h-0 overflow-hidden bg-background">
    <TaskHistoryRail
      :tasks="taskHistory.tasks.value"
      :selected-task-id="taskHistory.selectedTaskId.value"
      :selected-event-id="taskHistory.selectedEvent.value?.id ?? null"
      @select-task="taskHistory.selectTask"
      @select-event="taskHistory.selectEvent"
    />
    <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <Conversation class="min-h-0 flex-1">
        <ConversationContent class="mx-auto min-h-full w-full max-w-3xl gap-5 px-6 pb-64 pt-12">
          <ConversationEmptyState
            v-if="displayedConversation.length === 0"
            title="What should the agent do?"
            description="Describe the outcome. The agent takes bounded device actions while the mirror stays visible at the right."
            class="my-auto pb-20"
          >
            <template #icon>
              <Bot class="size-7" />
            </template>
          </ConversationEmptyState>

          <template v-for="turn in displayedConversation" :key="turn.id">
            <Message v-if="turn.kind === 'request'" from="user">
              <MessageContent>
                {{ turn.text }}
              </MessageContent>
            </Message>
            <Tool v-else-if="turn.kind === 'action'" class="mb-0">
              <ToolHeader
                type="dynamic-tool"
                :state="toolState(turn.outcome)"
                :tool-name="turn.operation"
                :title="turn.operation"
              />
              <ToolContent>
                <div
                  class="flex flex-col gap-1 border-t px-4 py-3 text-xs leading-5 text-muted-foreground"
                >
                  <p>
                    {{ turn.detail ?? "The device action completed without additional detail." }}
                  </p>
                  <p v-if="turn.confidence !== null">
                    Decision confidence: {{ Math.round(turn.confidence * 100) }}%
                  </p>
                </div>
              </ToolContent>
            </Tool>
            <Message v-else from="assistant">
              <MessageContent class="flex-row items-center gap-2">
                <Badge :variant="turn.state === 'passed' ? 'secondary' : 'destructive'">{{
                  turn.state
                }}</Badge>
                <span>{{ turn.text }}</span>
              </MessageContent>
            </Message>
          </template>

          <Message v-if="isRunning" from="assistant" role="status">
            <MessageContent class="flex-row items-center gap-2">
              <Bot />
              {{ selectedPolicy.label }} is choosing the next bounded action
            </MessageContent>
          </Message>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/95 to-transparent px-6 pb-5 pt-20"
      >
        <form
          class="pointer-events-auto mx-auto flex w-full max-w-3xl flex-col gap-2"
          @submit.prevent="requestStart"
        >
          <div class="flex items-center gap-2 px-4 text-xs text-muted-foreground">
            <AgentAppSelector
              v-if="serial !== null"
              :model-value="appPackage"
              :packages="packages"
              :disabled="isRunning || isArchived"
              @update:model-value="(value) => emit('update:appPackage', value)"
            />
            <span v-else class="truncate">{{ targetLabel }}</span>
            <span class="h-3 border-l border-border" />
            <button
              v-if="!isArchived && conversation.length > 0 && !isRunning"
              type="button"
              class="shrink-0 hover:text-foreground"
              @click="emit('resetConversation')"
            >
              <Plus class="mr-1 inline size-3.5" />
              New session
            </button>
          </div>

          <div
            class="rounded-3xl border border-border/80 bg-card p-3 shadow-[0_16px_48px_-20px_hsl(var(--foreground)/0.45)]"
          >
            <Textarea
              :model-value="goal"
              :disabled="isRunning || isArchived"
              :placeholder="promptPlaceholder"
              rows="5"
              class="min-h-32 resize-none border-0 bg-transparent px-2 py-2 text-base shadow-none focus-visible:ring-0"
              @update:model-value="(value) => emit('update:goal', String(value))"
              @keydown="onPromptKeydown"
            />
            <div class="flex items-center gap-2 px-1 pt-1">
              <AgentComposerSettings
                v-if="!isArchived"
                :policies="policies"
                :selected-policy="selectedPolicy"
                :limits="limits"
                @select-policy="(id) => emit('selectPolicy', id)"
                @set-limit="(field, value) => emit('setLimit', field, value)"
              />
              <span class="min-w-0 flex-1" />
              <Button
                v-if="isArchived"
                type="button"
                variant="outline"
                @click="emit('closeHistory')"
              >
                Return to agent
              </Button>
              <Button v-else-if="isRunning" type="button" variant="outline" @click="emit('cancel')">
                <OctagonX data-icon="inline-start" />
                Stop
              </Button>
              <Button v-else-if="!isArchived" type="submit" size="icon" :disabled="!canStart">
                <SendHorizontal />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </main>

    <TaskEventInspector
      v-if="taskHistory.inspectorOpen.value"
      :task="taskHistory.selectedTask.value"
      :event="taskHistory.selectedEvent.value"
      @close="taskHistory.inspectorOpen.value = false"
    />

    <Dialog v-model:open="consentOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Allow {{ selectedPolicy.label }} to process this run?</DialogTitle>
          <DialogDescription>{{ selectedPolicy.dataNotice }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="consentOpen = false">Not now</Button>
          <Button @click="acceptConsent">Allow and start</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
