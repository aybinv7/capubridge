<script setup lang="ts">
import { Gauge, SlidersHorizontal } from "lucide-vue-next";
import { computed, ref } from "vue";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PolicyOption, RunLimitValues } from "./agentPanelState";
import DecisionModelSetting from "./DecisionModelSetting.vue";
import { useDecisionModelStore } from "./decisions/decisionModelStore";

const props = defineProps<{
  policies: PolicyOption[];
  selectedPolicy: PolicyOption;
  limits: RunLimitValues;
}>();

const emit = defineEmits<{
  selectPolicy: [id: string];
  setLimit: [field: keyof RunLimitValues, value: string];
}>();

const decisionModels = useDecisionModelStore();

function policyLabel(policy: PolicyOption): string {
  const model = policy.id === "jev" ? decisionModels.selected.label : policy.model;
  return model === undefined ? policy.label : `${policy.label} · ${model}`;
}

const modelLabel = computed(() => policyLabel(props.selectedPolicy));

/**
 * Keeps the settings popover open while a Cladd select inside it is in use:
 * its option list is teleported to the body, so a pick there reads as an
 * outside interaction.
 */
function keepOpenForNestedOverlay(event: CustomEvent<{ originalEvent: Event }>): void {
  const target = event.detail.originalEvent.target;
  if (target instanceof Element && target.closest(".cladd-popover") !== null) {
    event.preventDefault();
  }
}

const modelSelectorOpen = ref(false);

function selectPolicy(id: string): void {
  emit("selectPolicy", id);
  modelSelectorOpen.value = false;
}
</script>

<template>
  <div class="flex min-w-0 items-center gap-1">
    <ModelSelector v-model:open="modelSelectorOpen">
      <ModelSelectorTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="max-w-52 justify-start gap-2 px-2 text-muted-foreground"
        >
          <Gauge class="size-4 shrink-0" />
          <span class="truncate">{{ modelLabel }}</span>
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent title="Select agent model">
        <ModelSelectorInput placeholder="Find a model or policy" />
        <ModelSelectorList>
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          <ModelSelectorGroup heading="Available models">
            <ModelSelectorItem
              v-for="policy in policies"
              :key="policy.id"
              :value="policy.id"
              @select="selectPolicy(policy.id)"
            >
              <Gauge class="size-4" />
              <ModelSelectorName>
                {{ policyLabel(policy) }}
              </ModelSelectorName>
            </ModelSelectorItem>
          </ModelSelectorGroup>
        </ModelSelectorList>
        <p
          v-if="selectedPolicy.dataNotice"
          class="border-t px-3 py-2 text-xs leading-5 text-muted-foreground"
        >
          {{ selectedPolicy.dataNotice }}
        </p>
      </ModelSelectorContent>
    </ModelSelector>

    <Popover>
      <PopoverTrigger as-child>
        <Button variant="ghost" size="icon-sm" aria-label="Adjust agent limits">
          <SlidersHorizontal class="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        class="w-72 space-y-3 p-3"
        @interact-outside="keepOpenForNestedOverlay"
      >
        <template v-if="selectedPolicy.id === 'jev'">
          <DecisionModelSetting />
          <div class="border-t" />
        </template>
        <div>
          <p class="text-sm font-medium">Run limits</p>
          <p class="text-xs text-muted-foreground">Bound the agent before it starts.</p>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div class="space-y-1">
            <Label for="agent-max-steps" class="text-xs">Steps</Label>
            <Input
              id="agent-max-steps"
              :model-value="String(limits.maxSteps)"
              inputmode="numeric"
              @update:model-value="(value) => emit('setLimit', 'maxSteps', String(value))"
            />
          </div>
          <div class="space-y-1">
            <Label for="agent-duration" class="text-xs">Seconds</Label>
            <Input
              id="agent-duration"
              :model-value="String(Math.round(limits.maxDurationMs / 1000))"
              inputmode="numeric"
              @update:model-value="
                (value) => emit('setLimit', 'maxDurationMs', String(Number(value) * 1000))
              "
            />
          </div>
          <div class="space-y-1">
            <Label for="agent-failures" class="text-xs">Failures</Label>
            <Input
              id="agent-failures"
              :model-value="String(limits.maxConsecutiveFailures)"
              inputmode="numeric"
              @update:model-value="
                (value) => emit('setLimit', 'maxConsecutiveFailures', String(value))
              "
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
