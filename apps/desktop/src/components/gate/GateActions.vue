<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import KeyCaps from "@/components/command/KeyCaps.vue";
import { formatBinding } from "@/lib/commands/keymap";
import { GATE_ACTIONS } from "@/components/gate/gate-actions";
import type { GateActionId } from "@/lib/gates/types";

const props = defineProps<{
  actions: readonly GateActionId[];
  running: GateActionId | null;
  limit?: number;
}>();

const emit = defineEmits<{ run: [action: GateActionId, label: string] }>();

const shown = computed(() => (props.limit ? props.actions.slice(0, props.limit) : props.actions));
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <Button
      v-for="(action, index) in shown"
      :key="action"
      size="xs"
      :variant="index === 0 ? 'default' : 'ghost'"
      :disabled="running !== null"
      :data-gate-action="action"
      @click="emit('run', action, GATE_ACTIONS[action].label)"
    >
      <Spinner v-if="running === action" data-icon="inline-start" />
      <component :is="GATE_ACTIONS[action].icon" v-else data-icon="inline-start" />
      {{ GATE_ACTIONS[action].label }}
      <KeyCaps
        v-if="index === 0 && GATE_ACTIONS[action].binding"
        :keys="formatBinding(GATE_ACTIONS[action].binding ?? '')"
        class="ml-1 opacity-80"
      />
    </Button>
  </div>
</template>
