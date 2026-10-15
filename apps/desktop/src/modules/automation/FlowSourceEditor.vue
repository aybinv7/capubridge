<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AutomationCandidate, Flow } from "@/types/automation.types";
import {
  FLOW_DSL_COMMANDS,
  parseFlowDsl,
  serializeFlowDsl,
  serializeFlowDslTarget,
} from "./flowDsl";
import {
  applyFlowDslCompletion,
  getFlowDslCompletions,
  type FlowDslCompletion,
} from "./flowDslEditor";
import type { FlowParseError } from "./flowShared";

const props = defineProps<{
  flow: Flow;
  candidates: readonly AutomationCandidate[];
  candidatesLoading: boolean;
  candidatesError: string | null;
}>();

const emit = defineEmits<{
  apply: [flow: Flow];
  cancel: [];
  refreshTargets: [];
}>();

const dslText = ref(serializeFlowDsl(props.flow));
const dslErrors = ref<FlowParseError[]>([]);
const dslCursor = ref(dslText.value.length);
const dslCompletionIndex = ref(0);

const dslCompletions = computed(() =>
  getFlowDslCompletions(dslText.value, dslCursor.value, props.candidates),
);

const activeDslCompletion = computed<FlowDslCompletion | null>(() => {
  const suggestions = dslCompletions.value;
  return suggestions[dslCompletionIndex.value] ?? suggestions[0] ?? null;
});

function updateDslDiagnostics(): void {
  const result = parseFlowDsl(dslText.value, props.flow);
  dslErrors.value = result.ok ? [] : result.errors;
}

function applySource(): void {
  const result = parseFlowDsl(dslText.value, props.flow);
  if (!result.ok) {
    dslErrors.value = result.errors;
    return;
  }
  emit("apply", result.flow);
}

function syncDslCursor(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLTextAreaElement) {
    dslCursor.value = target.selectionStart;
    dslCompletionIndex.value = 0;
  }
}

function onDslKeydown(event: KeyboardEvent): void {
  if (dslCompletions.value.length === 0) {
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const count = dslCompletions.value.length;
    dslCompletionIndex.value = (dslCompletionIndex.value + delta + count) % count;
    return;
  }
  if (event.key === "Tab") {
    event.preventDefault();
    const completion = activeDslCompletion.value;
    if (completion !== null) {
      applyDslCompletion(completion);
    }
  }
}

function applyDslCompletion(completion: FlowDslCompletion): void {
  const applied = applyFlowDslCompletion(dslText.value, completion);
  dslText.value = applied.source;
  dslCursor.value = applied.cursor;
  dslCompletionIndex.value = 0;
}

function insertDslCommand(command: string): void {
  dslText.value = `${dslText.value}${dslText.value === "" || dslText.value.endsWith("\n") ? "" : "\n"}${command}\n`;
  dslCursor.value = dslText.value.length;
}

function insertDslCandidate(candidate: AutomationCandidate): void {
  insertDslCommand(`tap ${serializeFlowDslTarget(candidate.target)}`);
}

watch(dslText, updateDslDiagnostics);

watch(
  () => props.flow,
  (flow) => {
    dslText.value = serializeFlowDsl(flow);
    dslCursor.value = dslText.value.length;
    dslErrors.value = [];
  },
);
</script>

<template>
  <div class="flex h-full flex-col gap-3 overflow-hidden p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-sm font-medium">Flow source</h2>
        <p class="text-xs text-muted-foreground">
          One readable command per line. Selectors and values use quotes.
        </p>
      </div>
      <div class="flex gap-2">
        <Button size="sm" variant="ghost" @click="emit('cancel')">Cancel</Button>
        <Button size="sm" @click="applySource">Apply</Button>
      </div>
    </div>
    <Textarea
      v-model:model-value="dslText"
      aria-label="Flow source"
      class="min-h-0 flex-1 resize-none font-mono text-xs leading-5"
      spellcheck="false"
      @click="syncDslCursor"
      @input="syncDslCursor"
      @keyup="syncDslCursor"
      @keydown="onDslKeydown"
    />
    <div
      v-if="dslCompletions.length > 0"
      class="max-h-28 overflow-auto rounded-md border border-border/40 bg-surface-1 p-2"
    >
      <div class="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Suggestions</span>
        <span>Tab to insert · ↑↓ to choose</span>
      </div>
      <div class="flex flex-wrap gap-1">
        <Button
          v-for="(completion, index) in dslCompletions"
          :key="`${completion.label}-${index}`"
          size="sm"
          variant="ghost"
          class="h-7 max-w-full justify-start px-2 font-mono text-[11px]"
          :class="index === dslCompletionIndex ? 'bg-accent' : ''"
          @mousedown.prevent
          @click="applyDslCompletion(completion)"
        >
          <span class="max-w-56 truncate">{{ completion.label }}</span>
          <span class="ml-2 max-w-56 truncate text-[10px] text-muted-foreground">
            {{ completion.detail }}
          </span>
        </Button>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        class="h-7 px-2 text-xs"
        :disabled="candidatesLoading"
        @click="emit('refreshTargets')"
      >
        {{ candidatesLoading ? "Reading screen…" : "Refresh live targets" }}
      </Button>
      <span class="text-xs text-muted-foreground">{{ candidates.length }} live targets</span>
    </div>
    <div
      v-if="candidates.length > 0"
      class="flex max-h-20 flex-wrap gap-1 overflow-auto rounded-md border border-border/40 p-2"
    >
      <Button
        v-for="candidate in candidates"
        :key="candidate.id"
        size="sm"
        variant="ghost"
        class="h-7 max-w-full px-2 text-xs"
        :title="candidate.label"
        @click="insertDslCandidate(candidate)"
      >
        <span class="mr-1 text-[10px] uppercase text-muted-foreground">{{ candidate.source }}</span>
        <span class="max-w-52 truncate">{{ candidate.label }}</span>
      </Button>
    </div>
    <p v-if="candidatesError !== null" class="text-xs text-muted-foreground">
      {{ candidatesError }}
    </p>
    <div class="flex flex-wrap gap-1">
      <Button
        v-for="command in FLOW_DSL_COMMANDS"
        :key="command"
        size="sm"
        variant="ghost"
        class="h-7 px-2 font-mono text-[11px]"
        @click="insertDslCommand(command)"
      >
        {{ command.split(" ")[0] }}
      </Button>
    </div>
    <div
      v-if="dslErrors.length > 0"
      class="max-h-28 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-2"
    >
      <p
        v-for="error in dslErrors"
        :key="`${error.path}-${error.message}`"
        class="text-xs text-destructive"
      >
        {{ error.path }}: {{ error.message }}
      </p>
    </div>
  </div>
</template>
