<script setup lang="ts">
import { Button, Select, uiAccents } from "@capubridge/ui";
import type { UiAccent, UiTheme } from "@capubridge/ui";

const props = defineProps<{
  accent: UiAccent;
  interactionsEnabled: boolean;
  theme: UiTheme;
}>();

const emit = defineEmits<{
  updateAccent: [accent: UiAccent];
  updateInteractions: [enabled: boolean];
  updateTheme: [theme: UiTheme];
}>();

const accentOptions = uiAccents.map((accent) => ({ label: accent, value: accent }));

function changeAccent(value: string): void {
  emit("updateAccent", value as UiAccent);
}
</script>

<template>
  <div class="playground-controls">
    <div class="playground-controls__copy">
      <span>Global controls</span>
      <p>Change provider context and inspect every state together.</p>
    </div>
    <label class="native-control">
      <span>Accent</span>
      <Select
        :model-value="props.accent"
        :options="accentOptions"
        size="sm"
        @change="changeAccent"
      />
    </label>
    <div class="segmented-control" aria-label="Theme">
      <Button
        :pressed="props.theme === 'dark'"
        size="sm"
        variant="transparent"
        @click="emit('updateTheme', 'dark')"
      >
        Dark
      </Button>
      <Button
        :pressed="props.theme === 'light'"
        size="sm"
        variant="transparent"
        @click="emit('updateTheme', 'light')"
      >
        Light
      </Button>
    </div>
    <Button
      :accent="props.interactionsEnabled ? 'green' : 'neutral'"
      :pressed="props.interactionsEnabled"
      size="sm"
      @click="emit('updateInteractions', !props.interactionsEnabled)"
    >
      Interactions {{ props.interactionsEnabled ? "on" : "off" }}
    </Button>
  </div>
</template>
