<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { describeChanges } from "./changeWords";
import type { DataChangeCounts } from "./dataFrame.types";

/**
 * What the device changed in this collection while it was watched (+added ~changed −deleted).
 * Pressing it shows only those rows.
 */
const props = defineProps<{ changes: DataChangeCounts }>();

const changesOnly = defineModel<boolean>("changesOnly", { required: true });

const hint = computed(() =>
  changesOnly.value
    ? "Show every row again"
    : `Show only these rows · ${describeChanges(props.changes)}`,
);
</script>

<template>
  <HintTooltip v-if="changes.total > 0" :text="hint">
    <Button
      size="xs"
      :variant="changesOnly ? 'solid' : 'transparent'"
      :surface-level="changesOnly ? '+2' : undefined"
      :outline="changesOnly"
      :aria-pressed="changesOnly"
      :aria-label="`${describeChanges(changes)}. ${hint}`"
      content-class-name="gap-1.5 font-mono text-2xs tabular-nums"
      @click="changesOnly = !changesOnly"
    >
      <span v-if="changes.add" class="text-success">+{{ changes.add }}</span>
      <span v-if="changes.update" class="text-warning">~{{ changes.update }}</span>
      <span v-if="changes.delete" class="text-error">−{{ changes.delete }}</span>
    </Button>
  </HintTooltip>
</template>
