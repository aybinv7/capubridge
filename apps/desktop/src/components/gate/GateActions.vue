<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@capubridge/cladd";
import KeyCaps from "@/components/command/KeyCaps.vue";
import { bindingTokens } from "@/lib/commands/keymap";
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
      size="sm"
      :variant="index === 0 ? 'solid-fill' : 'transparent'"
      :outline="index === 0"
      :loading="running === action"
      :disabled="running !== null && running !== action"
      :read-only="running === action"
      :data-gate-action="action"
      content-class-name="gap-1.5"
      @click="emit('run', action, GATE_ACTIONS[action].label)"
    >
      <component :is="GATE_ACTIONS[action].icon" :size="14" aria-hidden="true" />
      {{ GATE_ACTIONS[action].label }}
      <KeyCaps
        v-if="index === 0 && GATE_ACTIONS[action].binding"
        :keys="bindingTokens(GATE_ACTIONS[action].binding ?? '')"
        class="ml-1"
      />
    </Button>
  </div>
</template>
