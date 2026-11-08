<script setup lang="ts">
import { computed } from "vue";
import { Spinner, StatusDot } from "@capubridge/cladd";
import type { PairingPhase } from "@/types/wireless.types";
import { phaseLabel } from "./pairingCopy";

const props = defineProps<{ state: PairingPhase | null; waitingHint?: string }>();

const label = computed(() => phaseLabel(props.state));
const phase = computed(() => props.state?.phase ?? "waiting");
const hint = computed(() => {
  switch (phase.value) {
    case "pairing":
      return "The phone answered. Confirming the code.";
    case "connecting":
      return "Paired. Opening the connection.";
    case "connected":
      return "Opening the device.";
    default:
      return props.waitingHint ?? "";
  }
});
</script>

<template>
  <div class="flex min-w-0 items-center gap-2" role="status" aria-live="polite">
    <StatusDot v-if="phase === 'connected'" color="green" size="xs" />
    <Spinner v-else size="xs" />
    <span class="shrink-0 text-xs font-medium text-foreground">{{ label }}</span>
    <span v-if="hint" class="truncate text-xs text-muted-foreground">{{ hint }}</span>
  </div>
</template>
