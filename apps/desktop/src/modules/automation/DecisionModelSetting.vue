<script setup lang="ts">
import { Select } from "@capubridge/cladd";
import { computed } from "vue";
import { useDecisionModelStore } from "./decisions/decisionModelStore";
import {
  describeCapabilities,
  sendsScreenshots,
  visualPathBlocker,
} from "./decisions/decisionModelSummary";
import { JEV_SCREEN_NOTICE } from "./policies/jev";

const store = useDecisionModelStore();

const options = computed(() =>
  store.models.map((model) => ({
    value: model.id,
    label: model.label,
    info: describeCapabilities(model),
  })),
);

const selectedId = computed<string>({
  get: () => store.modelId,
  set: (id) => store.select(String(id)),
});

const notes = computed<string[]>(() => {
  const model = store.selected;
  const lines = [describeCapabilities(model)];
  const blocker = visualPathBlocker(model);
  if (blocker !== null) {
    lines.push(blocker);
  }
  if (sendsScreenshots(model)) {
    lines.push(JEV_SCREEN_NOTICE);
  }
  if (model.alias) {
    lines.push("An alias moves to new releases, so runs are not comparable over time.");
  }
  if (store.persistFailed) {
    lines.push("This choice could not be saved and resets when the app restarts.");
  }
  return lines;
});
</script>

<template>
  <div class="space-y-1.5">
    <p class="text-sm font-medium">Decision model</p>
    <Select
      v-model="selectedId"
      :options="options"
      size="sm"
      :keyboard-hints="false"
      aria-label="Model that decides each agent step"
      popover-class-name="w-80"
      class="w-full"
    >
      {{ store.selected.label }}
    </Select>
    <p v-for="note in notes" :key="note" class="text-xs leading-5 text-muted-foreground">
      {{ note }}
    </p>
  </div>
</template>
