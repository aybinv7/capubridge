<script setup lang="ts">
import { computed } from "vue";
import { Button, NumberField, StatusDot } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { PORT_MAX, PORT_MIN, clampInteger } from "./mockView";

const port = defineModel<number>("port", { required: true });

const props = defineProps<{ serverRunning: boolean; canReverse: boolean; reversing: boolean }>();

const emit = defineEmits<{ reverse: [] }>();

const portModel = computed({
  get: () => port.value,
  set: (value: unknown) => {
    port.value = clampInteger(value, PORT_MIN, PORT_MAX, port.value);
  },
});
const reverseHint = computed(() =>
  props.canReverse
    ? `Makes localhost:${port.value} on the phone reach this computer (adb reverse)`
    : "Select an app on a phone first",
);
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border-subtle px-3 py-1.5"
    role="group"
    aria-label="Local mock server"
  >
    <span class="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground" role="status">
      <StatusDot
        :color="props.serverRunning ? 'green' : undefined"
        :variant="props.serverRunning ? 'solid' : 'hollow'"
      />
      {{ props.serverRunning ? "Server running at" : "Server stopped" }}
      <span v-if="props.serverRunning" class="font-mono text-foreground">
        http://127.0.0.1:{{ port }}
      </span>
    </span>
    <label class="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      Port
      <NumberField
        v-model="portModel"
        size="sm"
        :min="PORT_MIN"
        :max="PORT_MAX"
        :step="1"
        class="w-24"
        input-class-name="font-mono"
        aria-label="Mock server port"
      />
    </label>
    <span class="flex-1" />
    <HintTooltip :text="reverseHint">
      <Button
        size="sm"
        variant="transparent"
        :disabled="!props.canReverse"
        :loading="props.reversing"
        class="shrink-0"
        @click="emit('reverse')"
      >
        Connect the phone
      </Button>
    </HintTooltip>
  </div>
</template>
