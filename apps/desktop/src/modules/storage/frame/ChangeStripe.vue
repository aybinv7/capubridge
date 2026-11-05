<script setup lang="ts">
import { computed } from "vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { describeChanges } from "./changeWords";
import type { DataChangeCounts } from "./dataFrame.types";

/** A thin bar at a row's edge, split by what the device did: added, changed, deleted. */
const props = defineProps<{ changes: DataChangeCounts }>();

const segments = computed(() =>
  [
    { key: "add", count: props.changes.add, tone: "bg-success" },
    { key: "update", count: props.changes.update, tone: "bg-warning" },
    { key: "delete", count: props.changes.delete, tone: "bg-error" },
  ].filter((segment) => segment.count > 0),
);
const text = computed(() => describeChanges(props.changes));
</script>

<template>
  <HintTooltip :text="text">
    <span
      class="absolute inset-y-1 left-0.5 flex w-[3px] flex-col overflow-hidden rounded-full"
      role="img"
      :aria-label="text"
    >
      <span
        v-for="segment in segments"
        :key="segment.key"
        class="min-h-1 flex-1"
        :class="segment.tone"
      />
    </span>
  </HintTooltip>
</template>
